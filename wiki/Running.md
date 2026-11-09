# Running

## Development (local machine only)

Start the API and the Vite UI together:

```bash
pnpm dev
```

Or separately:

```bash
pnpm dev:server
pnpm dev:web
```

Open the Vite URL (default `http://127.0.0.1:5173`). API calls are proxied to the server on port `8787`.

Do not use the Vite port (`5173`) to expose jdweb on the internet. It is a development tool, not the application server. `https://…:5173` will not work without a TLS setup in front of Vite.

## Production (including a remote server)

```bash
cp .env.example .env
# Edit .env — at minimum credentials, JD_API_URL, and listen address
pnpm install
pnpm build
pnpm start
```

### Listen on the network

By default `JDWEB_HOST=127.0.0.1`, so only processes on the same machine can connect. On a VPS or when browsing from another device, set:

```bash
JDWEB_HOST=0.0.0.0
JDWEB_PORT=8787
```

Then open `http://YOUR_SERVER_IP:8787/` (plus `JDWEB_BASE_PATH` if set).

Allow the port in the host firewall (for example `ufw allow 8787/tcp`).

### HTTPS

jdweb serves plain HTTP. For `https://…`, put a reverse proxy (Caddy, nginx, …) in front with TLS certificates, and proxy to `http://127.0.0.1:8787`. See [Reverse proxy](Reverse-proxy).

## JDownloader local API

Enable JDownloader’s local HTTP API and point `JD_API_URL` at it. Typical settings:

- Localhost only
- Port matching `JD_API_URL` (for example `3128`)

jdweb proxies authenticated browser requests to that API. Do not expose the JDownloader port itself to the internet.
