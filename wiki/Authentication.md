# Authentication

jdweb stores its own users and premium hoster credentials in a local SQLite database (`JDWEB_DB_PATH`, default `./data/jdweb.sqlite`).

## Users

Login passwords are hashed with **argon2id** and never stored in plain text.

### First admin (bootstrap)

When the `users` table is empty, create the first administrator in either of these ways:

1. **Environment seed** (typical for Docker): set `JDWEB_USER` and `JDWEB_PASSWORD` before starting the server. They are used once at startup, then ignored for login.
2. **Internal API**: `POST /api/setup/admin` with `{ "username", "password" }` from **localhost only**. After at least one user exists, this endpoint returns 403.

`GET /api/setup/status` returns `{ "needsSetup": true|false }`. The UI redirects to `/setup` when needed.

### Session

Successful login creates a server-side row in the `sessions` table and sets an HTTP-only cookie (`jdweb_session`) holding a signed session id (`JDWEB_SESSION_SECRET`). The cookie path follows `JDWEB_BASE_PATH`. Logout deletes the current session.

List and revoke sessions from Settings or via `GET/DELETE /api/sessions` (and `DELETE /api/sessions/:id`).

Protected routes include `/api/auth/me`, `/api/users`, `/api/hosters`, destination/mover endpoints, and the JDownloader proxy under `/api/jd/*`.

### Managing users

Authenticated callers can list, create, update passwords, and delete users under `/api/users`. The last remaining user cannot be deleted.

Signed-in users change their own password with `POST /api/users/me/password` `{ currentPassword, newPassword }` (Settings → My password).

### Resetting a forgotten password

Env seed only runs when the users table is empty. To reset an existing user without the current password:

```bash
pnpm --filter ./server exec tsx scripts/reset-password.ts <username> <newPassword>
```

Alternatively delete all users (or the last admin) and bootstrap again via setup.

## Hoster accounts

Premium hoster accounts are the source of truth in SQLite. Passwords are encrypted with **AES-256-GCM** using `JDWEB_DATA_KEY` (64 hex characters = 32 bytes). They are decrypted only in memory when syncing to JDownloader’s `accountsV2` API.

If `JDWEB_DATA_KEY` is unset, a development key is derived from `JDWEB_SESSION_SECRET` and a warning is printed. Set an explicit key in production.

To rotate the key: set `JDWEB_DATA_KEY` to the new value and `JDWEB_DATA_KEY_PREVIOUS` to the old one, restart once (jdweb re-encrypts all hoster secrets), then remove `JDWEB_DATA_KEY_PREVIOUS`. A failed rotation aborts startup.

UI and API live under Accounts / `/api/hosters` (create, enable/disable, password update, delete, refresh, resync).

## Logout

`POST /api/auth/logout` clears the session cookie.
