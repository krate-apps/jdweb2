# Configuration

jdweb splits configuration into **boot env** (process + secrets) and **app settings** (SQLite, editable in the UI).

## Minimal environment (boot)

Copy `.env.example` to `.env`. Only these are required for a normal install:

| Variable | Meaning |
|----------|---------|
| `JDWEB_HOST` | Bind address (`127.0.0.1` behind a proxy; `0.0.0.0` if exposing Node) |
| `JDWEB_PORT` | Listen port (default `8787`) |
| `JDWEB_BASE_PATH` | Public URL prefix without trailing slash; rebuild UI after change |
| `JDWEB_DB_PATH` | SQLite file (default `./data/jdweb.sqlite`) |
| `JDWEB_SESSION_SECRET` | Cookie HMAC secret — or auto-written to `data/secrets.env` |
| `JDWEB_DATA_KEY` | 64 hex chars AES key — or auto-written to `data/secrets.env` |

Optional:

| Variable | Meaning |
|----------|---------|
| `JDWEB_DATA_KEY_PREVIOUS` | Old key during rotation |
| `JDWEB_USER` / `JDWEB_PASSWORD` | Seed first admin when `users` is empty |
| `JDWEB_STRICT_SECRETS=1` | Refuse default/derived secrets (also on when `NODE_ENV=production`) |
| `JDWEB_WEBHOOK_URLS` | Legacy CSV seed if `webhooks` table is empty |

On first boot without secrets, jdweb creates **`data/secrets.env`** (mode `600`) with random `JDWEB_SESSION_SECRET` and `JDWEB_DATA_KEY`, then loads it.

## App settings (SQLite)

Stored in `app_settings` and edited under **Settings → JDownloader and library** (or the first-run wizard):

| Setting | Default seed |
|---------|----------------|
| `jdApiUrl` | `JD_API_URL` or `http://127.0.0.1:3128` |
| `stagingDir` | `JDWEB_STAGING_DIR` or `./data/staging` |
| `moviesDir` / `showsDir` / `otherDir` | matching env or `./data/library/…` |
| `moverIntervalMs` | `JDWEB_MOVER_INTERVAL_MS` or `15000` (`0` = off) |

Env values for those keys are used **once** to seed SQLite (and as legacy override when seeding an empty table). Afterwards the database is the source of truth.

`jdApiUrl` must be `http(s)://` to **loopback or a private** address (SSRF protection).

API: `GET/PATCH /api/settings` (authenticated).

## Base path

| Public URL | `JDWEB_BASE_PATH` |
|------------|-------------------|
| `https://example.com/alice/jdweb` | `/alice/jdweb` |
| `https://jdweb.example.com/` | *(empty)* |

Rebuild after changing: `pnpm build`. See [Reverse proxy](Reverse-proxy).

## Data key rotation

1. Set `JDWEB_DATA_KEY` (new) and `JDWEB_DATA_KEY_PREVIOUS` (old).
2. Restart once.
3. Remove `PREVIOUS` after success.

## Production checklist

- [ ] Secrets not the development default (`JDWEB_STRICT_SECRETS=1` or `NODE_ENV=production`)
- [ ] `JDWEB_HOST=127.0.0.1` behind TLS proxy
- [ ] `JDWEB_BASE_PATH` matches proxy; UI rebuilt
- [ ] Backup `JDWEB_DB_PATH` and `data/secrets.env`
