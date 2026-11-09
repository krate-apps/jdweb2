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

Open the Vite URL (default `http://127.0.0.1:5173`). API calls under `/api` (and under `JDWEB_BASE_PATH/api` when set) are proxied to the server on port `8787`.

Do **not** expose Vite (`5173`) on the internet. It is a development tool. Production traffic must hit the Node server (or a reverse proxy in front of it).

## Production

```bash
cp .env.example .env
# Edit .env — secrets, JD_API_URL, base path, library dirs
pnpm install
pnpm build
pnpm start
```

Health check (no auth):

```bash
curl -sS "http://127.0.0.1:8787${JDWEB_BASE_PATH}/api/health"
```

### Listen address

| Goal | Setting |
|------|---------|
| Only local / reverse proxy | `JDWEB_HOST=127.0.0.1` (default) |
| Direct access from LAN/WAN | `JDWEB_HOST=0.0.0.0` and open the firewall |

Then open `http://YOUR_SERVER_IP:8787/` plus `JDWEB_BASE_PATH` if set. Prefer a reverse proxy for HTTPS instead of opening Node publicly — see [Reverse proxy](Reverse-proxy).

### HTTPS

jdweb serves plain HTTP. Terminate TLS on Caddy, nginx, or Apache and proxy to `http://127.0.0.1:8787`.

### Process manager (example systemd)

```ini
[Unit]
Description=jdweb
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/jdweb
EnvironmentFile=/opt/jdweb/.env
ExecStart=/usr/bin/pnpm start
Restart=on-failure
User=jdweb

[Install]
WantedBy=multi-user.target
```

Adjust paths and ensure `pnpm build` has been run as that user (or deploy prebuilt `web/dist` + `server/dist`).

## Docker

```bash
cp .env.example .env
# secrets, JD_API_URL (reachable from the container), optional JDWEB_BASE_PATH
docker compose up -d --build
```

Compose:

- Builds a multi-stage image (web + server)
- Sets `JDWEB_HOST=0.0.0.0` inside the container
- Mounts `./data` → `/data` for SQLite, staging, and library dirs
- Loads `.env` (override paths are set to `/data/...`)

Path-prefix build:

```bash
docker compose build --build-arg JDWEB_BASE_PATH=/alice/jdweb
docker compose up -d
```

There is **no** JDownloader container. Keep JD on the host (or elsewhere) and set `JD_API_URL` accordingly.

## JDownloader local API

Enable JDownloader’s local HTTP API and point `JD_API_URL` at it. Typical settings:

- Listen on localhost only
- Port matching `JD_API_URL` (for example `3128`)

jdweb proxies authenticated browser requests to that API. **Do not** expose the JDownloader port to the internet.

Ensure JD download directories align with `JDWEB_STAGING_DIR` (or configure destinations from the UI so packages land under staging).

## Logs and metrics

The server emits JSON lines (`level`, `msg`, `time`, …) for auth, mover, webhooks, and JD errors.

Authenticated metrics:

```bash
# JSON
curl -sS -b cookies.txt "http://127.0.0.1:8787/api/metrics"

# Simple text
curl -sS -b cookies.txt -H 'Accept: text/plain' "http://127.0.0.1:8787/api/metrics"
```

Counters include user/hoster/webhook counts, mover last tick, webhook failures, and auth login stats.

## Tests

```bash
pnpm typecheck
pnpm --filter ./server test
```

CI runs the same on pull requests (`.github/workflows/ci.yml`).
