# Reverse proxy

Place a reverse proxy in front of jdweb when you terminate TLS or mount the app under a path.

## Path prefix

If users open `https://example.com/alice/jdweb`:

1. Set `JDWEB_BASE_PATH=/alice/jdweb`
2. Rebuild the UI
3. Proxy `https://example.com/alice/jdweb*` to `http://127.0.0.1:8787/alice/jdweb*`

Keep the path prefix identical on the proxy and in `JDWEB_BASE_PATH`.

## Subdomain with app path

If users open `https://alice.example.com/jdweb`:

1. Set `JDWEB_BASE_PATH=/jdweb`
2. Rebuild the UI
3. Proxy that host’s `/jdweb*` path to the jdweb process

## Headers

Forward the original `Host` header. Cookie path is set to `JDWEB_BASE_PATH` (or `/` when empty) so sessions stay scoped to the app prefix.
