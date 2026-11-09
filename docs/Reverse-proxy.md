# Reverse proxy

Put a reverse proxy in front of jdweb to terminate TLS and/or mount the app under a URL path. jdweb itself speaks plain HTTP on `JDWEB_HOST`:`JDWEB_PORT` (default `127.0.0.1:8787`).

## Rules that always apply

1. **Same path on proxy and app.** If users open `https://example.com/alice/jdweb/`, set `JDWEB_BASE_PATH=/alice/jdweb` and proxy that exact prefix to the Node process **without stripping it**. jdweb expects the full public path (for example `/alice/jdweb/api/...` and `/alice/jdweb/assets/...`).
2. **Rebuild after changing the base path.** Run `pnpm build` (or at least `pnpm --filter ./web build`) so Vite emits asset URLs under the prefix. A build with an empty base produces `/assets/...` at the host root; the proxy will not forward those requests and browsers report an empty MIME type with `X-Content-Type-Options: nosniff`.
3. **Keep jdweb on localhost when proxied.** Prefer `JDWEB_HOST=127.0.0.1` and do not expose port `8787` publicly.
4. **Forward `Host`.** Cookie path is `JDWEB_BASE_PATH` (or `/` when empty).
5. **Do not strip the prefix** with `handle_path`, `uri strip_prefix`, `proxy_pass .../` tricks that drop `/alice/jdweb`, or Apache `ProxyPass` that maps to `http://127.0.0.1:8787/` without the prefix.

### Quick matrix

| Public URL | `JDWEB_BASE_PATH` | Proxy must forward |
|------------|-------------------|--------------------|
| `https://example.com/alice/jdweb/` | `/alice/jdweb` | `/alice/jdweb` and `/alice/jdweb/*` |
| `https://alice.example.com/jdweb/` | `/jdweb` | `/jdweb` and `/jdweb/*` |
| `https://jdweb.example.com/` | *(empty)* | `/` and `/*` |

---

## Caddy

### Path prefix (recommended pattern)

```caddy
example.com {
	redir /alice/jdweb /alice/jdweb/ 302

	@jdweb path /alice/jdweb /alice/jdweb/*
	handle @jdweb {
		reverse_proxy 127.0.0.1:8787 {
			header_up Host {host}
			header_up X-Real-IP {remote_host}
			header_up X-Forwarded-Proto {scheme}
			header_up X-Forwarded-Prefix /alice/jdweb
		}
	}
}
```

App env:

```bash
JDWEB_HOST=127.0.0.1
JDWEB_PORT=8787
JDWEB_BASE_PATH=/alice/jdweb
```

Then `pnpm build && pnpm start`.

### Subdomain at site root

```caddy
jdweb.example.com {
	reverse_proxy 127.0.0.1:8787 {
		header_up Host {host}
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}
}
```

Leave `JDWEB_BASE_PATH` empty and rebuild.

### What not to do (Caddy)

```caddy
# WRONG — strips /alice/jdweb before the upstream sees the request
handle_path /alice/jdweb/* {
	reverse_proxy 127.0.0.1:8787
}
```

---

## nginx

### Path prefix

```nginx
server {
	listen 443 ssl http2;
	server_name example.com;

	# ssl_certificate     /path/fullchain.pem;
	# ssl_certificate_key /path/privkey.pem;

	location = /alice/jdweb {
		return 302 /alice/jdweb/;
	}

	# No URI on proxy_pass → the full request path is forwarded unchanged
	location /alice/jdweb/ {
		proxy_http_version 1.1;
		proxy_pass http://127.0.0.1:8787;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_set_header X-Forwarded-Prefix /alice/jdweb;
		proxy_read_timeout 300s;
	}
}
```

`JDWEB_BASE_PATH=/alice/jdweb`, then rebuild and start jdweb.

### Subdomain at site root

```nginx
server {
	listen 443 ssl http2;
	server_name jdweb.example.com;

	location / {
		proxy_http_version 1.1;
		proxy_pass http://127.0.0.1:8787;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
	}
}
```

Empty `JDWEB_BASE_PATH`.

### What not to do (nginx)

```nginx
# WRONG — replaces /alice/jdweb/ with / on the upstream
location /alice/jdweb/ {
	proxy_pass http://127.0.0.1:8787/;
}
```

---

## Apache (httpd + `mod_proxy`)

Enable modules: `proxy`, `proxy_http`, `headers`, and usually `ssl`.

### Path prefix

```apache
<VirtualHost *:443>
	ServerName example.com
	# SSLEngine on
	# SSLCertificateFile    /path/fullchain.pem
	# SSLCertificateKeyFile /path/privkey.pem

	ProxyPreserveHost On
	RequestHeader set X-Forwarded-Proto "https"
	RequestHeader set X-Forwarded-Prefix "/alice/jdweb"

	# Keep the /alice/jdweb prefix on the upstream URL
	ProxyPass        /alice/jdweb http://127.0.0.1:8787/alice/jdweb
	ProxyPassReverse /alice/jdweb http://127.0.0.1:8787/alice/jdweb

	# Optional: redirect bare prefix to trailing slash for the SPA
	RedirectMatch ^/alice/jdweb$ /alice/jdweb/
</VirtualHost>
```

`JDWEB_BASE_PATH=/alice/jdweb`, then rebuild and start.

### Subdomain at site root

```apache
<VirtualHost *:443>
	ServerName jdweb.example.com
	ProxyPreserveHost On
	RequestHeader set X-Forwarded-Proto "https"

	ProxyPass        / http://127.0.0.1:8787/
	ProxyPassReverse / http://127.0.0.1:8787/
</VirtualHost>
```

Empty `JDWEB_BASE_PATH`.

### What not to do (Apache)

```apache
# WRONG — drops the public prefix before Node sees the path
ProxyPass /alice/jdweb/ http://127.0.0.1:8787/
```

---

## Checklist after enabling a proxy

1. `JDWEB_BASE_PATH` matches the public path (or is empty for a root subdomain).
2. `pnpm build` completed **after** that value was set (Vite reads it at build time; Docker: `docker compose build --build-arg JDWEB_BASE_PATH=/alice/jdweb`).
3. Open the app URL and view source: script/link tags must look like `/alice/jdweb/assets/index-….js`, not `/assets/…`.
4. `GET https://…/alice/jdweb/api/health` returns JSON.
5. Login sets a cookie whose path is `/alice/jdweb` (or `/`).

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Empty MIME / `nosniff` on `.js` / `.css` | HTML still references `/assets/...` while the proxy only serves `/alice/jdweb/*` |
| `404` on `/api/...` from the browser | Base path mismatch, or proxy strips the prefix |
| Login works then immediate logout | Cookie path wrong (`JDWEB_BASE_PATH` ≠ public path) |
| UI loads, API fails CORS-like | You are hitting Vite (`5173`) through the proxy; use the production server on `8787` |
