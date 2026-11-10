# Installation

## Quick start (3 commands)

```bash
git clone https://github.com/krate-apps/jdweb.git
cd jdweb && pnpm install
pnpm build && pnpm start
```

Requires Node.js 22+ (26 LTS recommended; matches CI and the Docker image) and pnpm 9 (`corepack enable` is enough on recent Node).

On first boot without secrets, jdweb writes **`data/secrets.env`** (mode `600`) with `JDWEB_SESSION_SECRET` and `JDWEB_DATA_KEY`. Open the UI on localhost — the **setup wizard** creates the admin, probes JDownloader, and sets staging/library paths (defaults under `~/medias/jdownloader/…`, stored in SQLite).

Optional: `cp .env.example .env` only if you need bind address, base path, or DB path. See [Configuration](Configuration).

## Environment file (optional)

```bash
cp .env.example .env
```

Boot-only variables: `JDWEB_HOST`, `JDWEB_PORT`, `JDWEB_BASE_PATH`, `JDWEB_DB_PATH`, secrets (or auto `data/secrets.env`), optional `JDWEB_USER` / `JDWEB_PASSWORD` for unattended admin seed.

JD URL and library paths belong in **Settings** (or the wizard), not in `.env`.

## Build and start (production)

```bash
pnpm build
pnpm start
```

`pnpm build` compiles the Vue app (`web/dist`) and the TypeScript server (`server/dist`). The server listens on `JDWEB_HOST`:`JDWEB_PORT` and serves the SPA from `web/dist`.

If you change the public path prefix, set `JDWEB_BASE_PATH` (Compose) or edit it in Settings and restart — no UI rebuild.

## Development

```bash
pnpm dev
```

Vite UI: `http://127.0.0.1:5173` (proxies `/api` to the server). Do **not** expose port `5173` on the internet.

## Docker

Published image: `ghcr.io/krate-apps/jdweb:1.2.1` (<!-- jdweb-version -->1.2.1<!-- /jdweb-version -->).

```bash
cp .env.example .env   # optional; secrets auto-create under the data volume
docker compose up -d
```

Mounting `./data` is enough for DB, secrets file, staging, and library. The image runs as the non-root `node` user (**UID 1000**); ensure `./data` is writable by that UID (`chown -R 1000:1000 data` on first setup if needed). Path prefix (no rebuild):

```bash
JDWEB_BASE_PATH=/alice/jdweb docker compose up -d
```

JDownloader is **not** in the compose file. After start, set the JD API URL in Settings (from the container, often `http://host.docker.internal:3128` or the host gateway — must stay private/loopback per SSRF rules).

Details: [Running](Running), [Releases](Release).

## Backup

Copy together:

- SQLite: `JDWEB_DB_PATH` (default `./data/jdweb.sqlite`)
- Secrets: `data/secrets.env` (or your env-provided keys)

## Wiki sync

English docs live in `docs/` and can be published to the GitHub Wiki:

```bash
./scripts/publish-docs.sh
```

(Create the first Wiki page once in the GitHub UI so the `*.wiki` remote exists.)
