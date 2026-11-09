# Installation

## Clone and install

```bash
git clone https://github.com/krate-apps/jdweb.git
cd jdweb
pnpm install
```

Requires Node.js 20+ and pnpm 9 (`corepack enable` is enough on recent Node).

## Environment file

```bash
cp .env.example .env
```

Edit `.env` before the first production run. Minimum recommended values:

| Variable | Why |
|----------|-----|
| `JDWEB_SESSION_SECRET` | Long random string; signs session cookies |
| `JDWEB_DATA_KEY` | `openssl rand -hex 32` — encrypts hoster passwords |
| `JDWEB_USER` / `JDWEB_PASSWORD` | Seeds the first admin when the DB is empty |
| `JD_API_URL` | JDownloader local API (default `http://127.0.0.1:3128`) |
| `JDWEB_BASE_PATH` | Public URL prefix if not serving at `/` (see [Reverse proxy](Reverse-proxy)) |

Generate secrets:

```bash
openssl rand -hex 32   # → JDWEB_SESSION_SECRET or JDWEB_DATA_KEY
```

## Build and start (production)

```bash
pnpm build
pnpm start
```

`pnpm build` compiles the Vue app (`web/dist`) and the TypeScript server (`server/dist`). The server listens on `JDWEB_HOST`:`JDWEB_PORT` and serves the SPA from `web/dist`.

If you change `JDWEB_BASE_PATH`, rebuild so asset URLs match the public prefix.

## Development

```bash
pnpm dev
```

Vite UI: `http://127.0.0.1:5173` (proxies `/api` to the server). Do **not** expose port `5173` on the internet.

## Docker

```bash
cp .env.example .env
# set secrets, JD_API_URL, JDWEB_BASE_PATH as needed
docker compose up -d --build
```

With a path prefix, pass the build arg so the UI is compiled correctly:

```bash
docker compose build --build-arg JDWEB_BASE_PATH=/alice/jdweb
docker compose up -d
```

Compose mounts `./data` for the database, staging, and library folders. JDownloader is **not** in the compose file — only jdweb. Point `JD_API_URL` at a reachable JD API from inside the container network (often `http://host.docker.internal:3128` or the host gateway IP).

Details: [Running](Running).

## Wiki sync

English docs live in `docs/` and can be published to the GitHub Wiki:

```bash
./scripts/publish-docs.sh
```

(Create the first Wiki page once in the GitHub UI so the `*.wiki` remote exists.)
