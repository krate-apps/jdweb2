# Troubleshooting

## Empty MIME type / `nosniff` on JS or CSS

**Symptom:** Firefox/Chrome blocks `…/assets/index-….js` (or `.css`) with an empty or wrong MIME type and `X-Content-Type-Options: nosniff`. The document URL is under a path prefix (for example `/alice/jdweb/`) but the asset URL is `/assets/...` at the **host root**.

**Cause:** The UI was built without the matching `JDWEB_BASE_PATH`, or the reverse proxy only forwards the app prefix. Root `/assets/*` never reaches jdweb.

**Fix:**

1. Set `JDWEB_BASE_PATH=/trevor/jdweb` (or your public prefix) in `.env` — same path as the proxy.
2. **Rebuild the UI** (required; rewriting HTML alone is not enough for JS chunk/`BASE_URL`):
   ```bash
   pnpm build && pnpm start
   # Docker:
   docker compose build --build-arg JDWEB_BASE_PATH=/trevor/jdweb
   docker compose up -d
   ```
   Compose now passes `JDWEB_BASE_PATH` from `.env` as a build arg automatically.
3. Hard-refresh (Ctrl+Shift+R). View source must show `/trevor/jdweb/assets/...`, not `/assets/...`.
4. If the server log says `web dist built without JDWEB_BASE_PATH; rebuild required`, the running `web/dist` is still a root build.

See [Reverse proxy](Reverse-proxy).

## Login loop or cookie not sticking

- Cookie path must match `JDWEB_BASE_PATH`.
- Proxy must not change the path inconsistently (trailing slash redirects are fine).
- Mixing `http://` app URL with `https://` proxy without correct `X-Forwarded-Proto` can confuse some setups; prefer terminating TLS on the proxy and keeping Node on HTTP localhost.

## `needs_setup` / cannot log in after reinstall

Env seed (`JDWEB_USER` / `JDWEB_PASSWORD`) only runs when the users table is empty. An existing SQLite file keeps old users. Use `scripts/reset-password.ts`, delete the DB (destructive), or remove users deliberately — see [Authentication](Authentication).

## JDownloader unreachable

- Check the JD API URL in Settings (or `GET /api/health` → `jdApiUrl` / `jdReachable`) from the **jdweb** host/container.
- JD local API must be enabled and listening.
- Docker: `127.0.0.1` inside the container is not the host — use the host gateway or a shared network.
- UI shows offline; logs include structured `jd call failed` / `jd proxy failed` lines; `/api/metrics` increments `jd_errors`.

## Mover never moves

- `JDWEB_MOVER_INTERVAL_MS` must be > 0 for the timer (manual **Run mover now** still works).
- Package must be **finished**, with `saveTo` under staging and a mapped library destination.
- Extraction may still be running.
- Destination folder must not already exist.
- Check package comment for `jdweb-mover:` errors and Settings → Recent moves.

## Webhooks not firing

- Hook must be **enabled** and include the event name.
- `JDWEB_WEBHOOK_URLS` only seeds an **empty** table.
- Delivery failures appear in JSON logs and `webhook_failures` in `/api/metrics`; they do not fail the download/mover.

## Port 5173 in production

Vite is for development only. Production must use `pnpm build && pnpm start` (or Docker) on `8787` behind a reverse proxy.

## Typecheck / tests locally

```bash
pnpm typecheck
pnpm --filter ./server test
```
