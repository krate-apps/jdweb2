# Configuration

All settings are environment variables. A template is provided in `.env.example`.

| Variable | Meaning |
|----------|---------|
| `JDWEB_HOST` | Address the server binds to (`127.0.0.1` local-only; `0.0.0.0` for remote access) |
| `JDWEB_PORT` | Port (default `8787`) |
| `JDWEB_BASE_PATH` | Public URL prefix without trailing slash (`/jdweb`, `/alice/jdweb`, or empty) |
| `JDWEB_SESSION_SECRET` | Secret used to sign session cookies |
| `JDWEB_DB_PATH` | SQLite file for users and hoster accounts (default `./data/jdweb.sqlite`) |
| `JDWEB_DATA_KEY` | 64 hex chars (32-byte AES key) for hoster password encryption; required in production |
| `JDWEB_DATA_KEY_PREVIOUS` | Old key during rotation; remove after a successful re-encrypting restart |
| `JDWEB_USER` | Optional seed username for the first admin when the DB has no users |
| `JDWEB_PASSWORD` | Optional seed password for the first admin (argon2id-hashed on insert) |
| `JD_API_URL` | JDownloader local HTTP API base URL (server-side only) |
| `JDWEB_STAGING_DIR` | Root folder where JDownloader downloads and extracts |
| `JDWEB_MOVIES_DIR` | Library folder for movies |
| `JDWEB_SHOWS_DIR` | Library folder for series |
| `JDWEB_OTHER_DIR` | Library folder for other packages |
| `JDWEB_MOVER_INTERVAL_MS` | Mover poll interval in milliseconds; `0` disables the mover |
| `VITE_DEV_PROXY_TARGET` | Dev-only proxy target for the Vite server |

## Base path

jdweb is designed to run under different public prefixes:

- `http://203.0.113.10/alice/jdweb` → `JDWEB_BASE_PATH=/alice/jdweb`
- `https://example.com/alice/jdweb` → `JDWEB_BASE_PATH=/alice/jdweb`
- `https://alice.example.com/jdweb` → `JDWEB_BASE_PATH=/jdweb`
- root URL → leave `JDWEB_BASE_PATH` empty

Rebuild the web app after changing `JDWEB_BASE_PATH` so asset URLs match the prefix (`pnpm --filter ./web build`).
