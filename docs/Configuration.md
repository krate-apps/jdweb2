# Configuration

All settings are environment variables. Copy `.env.example` to `.env`. The server loads `.env` from the repository root at startup.

## Reference

| Variable | Default | Meaning |
|----------|---------|---------|
| `JDWEB_HOST` | `127.0.0.1` | Bind address. Use `127.0.0.1` behind a proxy; `0.0.0.0` only if clients must hit Node directly |
| `JDWEB_PORT` | `8787` | Listen port |
| `JDWEB_BASE_PATH` | *(empty)* | Public URL prefix **without** trailing slash (`/jdweb`, `/alice/jdweb`). Empty = site root |
| `JDWEB_SESSION_SECRET` | `dev-only-change-me` | HMAC secret for the session cookie. **Change in production** |
| `JDWEB_DB_PATH` | `./data/jdweb.sqlite` | SQLite file (users, sessions, hosters, move history, webhooks) |
| `JDWEB_DATA_KEY` | derived in dev | 64 hex chars (32-byte AES-256 key) for hoster password encryption. **Set explicitly in production** |
| `JDWEB_DATA_KEY_PREVIOUS` | unset | Old key during rotation; remove after a successful restart |
| `JDWEB_USER` | unset | Seed username for the first admin when `users` is empty |
| `JDWEB_PASSWORD` | unset | Seed password (argon2id-hashed on insert; unused after seed) |
| `JD_API_URL` | `http://127.0.0.1:3128` | JDownloader local HTTP API base URL (server-side only) |
| `JDWEB_STAGING_DIR` | `./data/staging` | Root where JD downloads/extracts (`movies/`, `shows/`, `downloads/`) |
| `JDWEB_MOVIES_DIR` | `./data/library/movies` | Movies library root |
| `JDWEB_SHOWS_DIR` | `./data/library/shows` | Series library root |
| `JDWEB_OTHER_DIR` | `./data/library/other` | Other / misc library root |
| `JDWEB_MOVER_INTERVAL_MS` | `15000` | Mover poll interval; `0` disables the automatic mover |
| `JDWEB_WEBHOOK_URLS` | unset | CSV of webhook URLs seeded **once** when the `webhooks` table is empty |
| `VITE_DEV_PROXY_TARGET` | `http://127.0.0.1:8787` | Dev-only: Vite → API proxy target |

Relative paths are resolved from the repository root (the parent of `server/`).

## Base path

jdweb is designed to run under different public prefixes:

| Example public URL | `JDWEB_BASE_PATH` |
|--------------------|-------------------|
| `http://203.0.113.10/alice/jdweb` | `/alice/jdweb` |
| `https://example.com/alice/jdweb` | `/alice/jdweb` |
| `https://alice.example.com/jdweb` | `/jdweb` |
| `https://jdweb.example.com/` | *(empty)* |

After changing `JDWEB_BASE_PATH`:

1. Rebuild the web app (`pnpm build` or `pnpm --filter ./web build`).
2. Align the reverse proxy with the same prefix ([Reverse proxy](Reverse-proxy)).
3. Restart the server.

Vite reads `JDWEB_BASE_PATH` from the root `.env` at **build** time. Docker image builds accept `ARG JDWEB_BASE_PATH`. At runtime the server also rewrites root-absolute `src`/`href` in `index.html` if the build was missing the prefix, but rebuilding is still the reliable fix.

## Production checklist

- [ ] `JDWEB_SESSION_SECRET` is unique and long
- [ ] `JDWEB_DATA_KEY` is set (`openssl rand -hex 32`)
- [ ] `JDWEB_USER` / `JDWEB_PASSWORD` only used for first boot (or use localhost setup)
- [ ] `JDWEB_HOST=127.0.0.1` when a reverse proxy terminates TLS
- [ ] `JDWEB_BASE_PATH` matches the public path; UI rebuilt
- [ ] JDownloader local API is not exposed to the internet
- [ ] `data/` (DB, staging, libraries) is backed up as needed

## Data key rotation

1. Set `JDWEB_DATA_KEY` to the **new** key and `JDWEB_DATA_KEY_PREVIOUS` to the **old** key.
2. Restart once — jdweb re-encrypts every hoster secret; failure aborts startup.
3. Remove `JDWEB_DATA_KEY_PREVIOUS` after verifying login/hosters.

See [Authentication](Authentication).
