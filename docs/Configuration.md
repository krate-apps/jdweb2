# Configuration

jdweb splits configuration into **boot env** (process + secrets) and **app settings** (SQLite, editable in the UI).

## Minimal environment (boot)

Copy `.env.example` to `.env` when you need to override defaults. A normal install can start with **no** `.env`: secrets are auto-created under `data/secrets.env`.

| Variable                | Meaning                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `JDWEB2_HOST`           | Bind address (`127.0.0.1` behind a proxy; `0.0.0.0` if exposing Node). Default `127.0.0.1`             |
| `JDWEB2_PORT`           | Listen port (default `8787`)                                                                           |
| `JDWEB2_BASE_PATH`      | Optional public URL prefix (e.g. `/jdweb`). Synced into Settings on boot when set; no UI rebuild |
| `JDWEB2_DB_PATH`        | SQLite file (default `./data/jdweb.sqlite`)                                                            |
| `JDWEB2_SESSION_SECRET` | Cookie HMAC secret — or auto-written to `data/secrets.env`                                             |
| `JDWEB2_DATA_KEY`       | 64 hex chars AES key — or auto-written to `data/secrets.env`                                           |

Optional:

| Variable                          | Meaning                                                             |
| --------------------------------- | ------------------------------------------------------------------- |
| `JDWEB2_DATA_KEY_PREVIOUS`        | Old key during rotation                                             |
| `JDWEB2_USER` / `JDWEB2_PASSWORD` | Seed first admin when `users` is empty                              |
| `JDWEB2_STRICT_SECRETS=1`         | Refuse default/derived secrets (also on when `NODE_ENV=production`) |
| `JDWEB2_WEBHOOK_URLS`             | CSV seed if `webhooks` table is empty                               |
| `JDWEB2_EVENTS_INTERVAL_MS`       | Server SSE poll interval (default `2000`)                           |
| `JDWEB2_OIDC_ISSUER`              | OIDC issuer URL                                                     |
| `JDWEB2_OIDC_CLIENT_ID`           | OIDC client id                                                      |
| `JDWEB2_OIDC_CLIENT_SECRET`       | OIDC client secret (usually required)                               |
| `JDWEB2_OIDC_REDIRECT_URI`        | Must match the IdP app callback                                     |
| `JDWEB2_OIDC_USERNAME_CLAIM`      | Claim mapped to local username (default `preferred_username`)       |
| `JDWEB2_OIDC_AUTO_PROVISION`      | `true` to create local users on first SSO login (default off)       |

On first boot without secrets, jdweb creates **`data/secrets.env`** (mode `600`) with random `JDWEB2_SESSION_SECRET` and `JDWEB2_DATA_KEY`, then loads it.

## App settings (SQLite)

Stored in `app_settings` and edited under **Settings → JDownloader and library** (or the first-run wizard):

| Setting                               | Default seed                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `basePath`                            | `JDWEB2_BASE_PATH` or empty (site root). Editable in Settings unless env is set |
| `jdApiUrl`                            | `JD_API_URL` or `http://127.0.0.1:3128`                                         |
| `stagingDir`                          | `JDWEB2_STAGING_DIR` or `~/medias/jdownloader/staging`                          |
| `moviesDir` / `showsDir` / `otherDir` | matching env or `~/medias/jdownloader/library/…`                                |
| `moverIntervalMs`                     | `JDWEB2_MOVER_INTERVAL_MS` or `15000` (`0` = off)                               |

Host layout matches other downloaders under `~/medias/<app>/`:

```text
~/medias/jdownloader/
  staging/{movies,shows,downloads}
  library/{movies,shows,other}
```

Docker Compose seeds `/data/…` via env (volume `./data`).

Env values for those keys are used **once** to seed SQLite when the table is empty. Afterwards the database is the source of truth — changing `JDWEB2_MOVER_INTERVAL_MS` (or path env vars) alone does **not** update a running install; use Settings.

`jdApiUrl` must be `http(s)://` to **loopback or a private** address (SSRF protection).

API: `GET/PATCH /api/settings` (authenticated).

## Base path

| Public URL                   | `basePath` / `JDWEB2_BASE_PATH` |
| ---------------------------- | ------------------------------- |
| `https://example.com/jdweb`  | `/jdweb`                        |
| `https://jdweb.example.com/` | *(empty)*                       |

Set via **Compose** (`JDWEB2_BASE_PATH` in `environment` / `.env`), or **Settings → Connection** (then restart). The published image needs no rebuild — the server injects the prefix at runtime. See [Reverse proxy](Reverse-proxy).

## Data key rotation

1. Set `JDWEB2_DATA_KEY` (new) and `JDWEB2_DATA_KEY_PREVIOUS` (old).
2. Restart once.
3. Remove `PREVIOUS` after success.

## Production checklist

- [ ] Secrets not the development default (`JDWEB2_STRICT_SECRETS=1` or `NODE_ENV=production`)
- [ ] `JDWEB2_HOST=127.0.0.1` behind TLS proxy
- [ ] `basePath` / `JDWEB2_BASE_PATH` matches proxy; jdweb restarted after change
- [ ] Backup `JDWEB2_DB_PATH` and `data/secrets.env`
