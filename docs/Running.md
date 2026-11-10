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
cp .env.example .env   # optional; secrets auto-create under data/
pnpm install
pnpm build
pnpm start
```

Configure JD URL and library paths in the setup wizard or Settings (SQLite). Boot env is documented in [Configuration](Configuration).

Health check (no auth):

```bash
curl -sS "http://127.0.0.1:8787${JDWEB_BASE_PATH}/api/health"
```

Response includes `jdReachable`, `uiBuilt`, `settingsReady`, and `needsSetup`.

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

Default: pull the published image `ghcr.io/krate-apps/jdweb:1.2.2` (<!-- jdweb-version -->1.2.2<!-- /jdweb-version -->).

```bash
cp .env.example .env   # optional
docker compose up -d
```

Compose:

- Uses `image: ghcr.io/krate-apps/jdweb:…` (updated on each release)
- Sets `JDWEB_HOST=0.0.0.0` inside the container
- Mounts `./data` → `/data` for SQLite, `secrets.env`, staging, and library dirs
- Loads `.env` when present (override paths are set to `/data/...`)

Path prefix (runtime, no rebuild):

```bash
JDWEB_BASE_PATH=/alice/jdweb docker compose up -d
```

Or set the prefix in Settings after first login (when env is unset) and restart.

There is **no** JDownloader container. Keep JD on the host (or elsewhere) and set the JD API URL in Settings after first login (must be a private/loopback URL reachable from the container).

Release automation: [Releases](Release).

## JDownloader local API

Enable JDownloader’s local HTTP API and point jdweb at it (Settings → JDownloader URL). Typical settings:

- Listen on localhost only
- Port such as `3128` or `49247` (use Detect in Settings / setup)

jdweb proxies authenticated browser requests to that API. **Do not** expose the JDownloader port to the internet.

Ensure JD download directories align with the staging directory configured in Settings (or destinations from the UI so packages land under staging).

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
pnpm test                 # server unit + web format helpers
pnpm test:e2e             # API smoke + first-run setup API
pnpm test:e2e:ui          # Playwright (logged-in smoke + setup wizard)
```

CI runs typecheck, unit tests, build, and e2e on pull requests and pushes to `main` (`.github/workflows/ci.yml`). On `main`, release + Docker publish run only after that check job succeeds.
