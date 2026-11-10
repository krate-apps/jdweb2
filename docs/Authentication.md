# Authentication

jdweb stores users, sessions, and premium hoster credentials in SQLite (`JDWEB_DB_PATH`, default `./data/jdweb.sqlite`). JDownloader’s own MyJDownloader login is separate and unused by the UI.

## Users

Login passwords are hashed with **argon2id** and never stored in plain text.

### First admin (bootstrap)

When the `users` table is empty:

1. **Setup wizard** (`/setup`): when `GET /api/setup/status` reports `needsSetup: true`, the UI walks admin → JD URL → library paths.
2. **Localhost setup API**: `POST /api/setup/admin` with `{ "username", "password" }` from a **TCP loopback peer only** (`127.0.0.1` / `::1`). `X-Forwarded-For` is ignored for this gate so a published Docker port cannot spoof setup. After at least one user exists, this returns `403 setup_already_done`.
3. **Environment seed** (typical for Docker / unattended install): set `JDWEB_USER` and `JDWEB_PASSWORD` before starting. They are applied once at startup when the users table is empty, then ignored for login.

Password minimum length: **8** characters.


### Sessions

Successful login:

1. Inserts a row in `sessions` (`id`, `user_id`, `user_agent`, `ip`, timestamps).
2. Sets an HTTP-only cookie `jdweb_session` with a signed opaque id (`JDWEB_SESSION_SECRET`).

Cookie path follows Settings `basePath` (seeded from `JDWEB_BASE_PATH`, or `/` when empty). Flags: **HttpOnly**, **SameSite=Lax**, and **Secure** when the request is HTTPS or `X-Forwarded-Proto: https`. Logout (`POST /api/auth/logout`) deletes the current session and clears the cookie.


CSRF: same-origin SPA + `SameSite=Lax` is enough for cookie-authenticated JSON `PATCH`/`POST`. If cookies were ever sent cross-site, add a CSRF token.

Manage sessions in Settings or via API:

| Method | Path | Effect |
|--------|------|--------|
| `GET` | `/api/sessions` | List sessions for the current user |
| `DELETE` | `/api/sessions/:id` | Revoke one session |
| `DELETE` | `/api/sessions` | Revoke all **other** sessions |

### Managing users

Authenticated callers can list, create, reset passwords, and delete users under `/api/users`. The last remaining user cannot be deleted.

Change your own password: Settings → My password, or `POST /api/users/me/password` with `{ "currentPassword", "newPassword" }`.

### Resetting a forgotten password

Env seed only runs when the users table is empty. To reset an existing user without the current password:

```bash
pnpm --filter ./server exec tsx scripts/reset-password.ts <username> <newPassword>
```

Alternatively delete users until the table is empty and bootstrap again via setup or env seed.

## Hoster accounts

Premium hoster accounts in SQLite are the source of truth. Passwords are encrypted with **AES-256-GCM** using `JDWEB_DATA_KEY` (64 hex characters = 32 bytes). They are decrypted only in memory when syncing to JDownloader’s `accountsV2` API.

If `JDWEB_DATA_KEY` is unset, a development key is derived from `JDWEB_SESSION_SECRET` and a warning is logged. Set an explicit key in production.

### Import from JDownloader

`POST /api/hosters/import` (Accounts → Import) copies hoster usernames present in JD but missing from SQLite. Secrets are **not** readable from JD — imported rows are marked as needing a password until you set one (Accounts → Change password / `PATCH /api/hosters/:id`).

### Data key rotation

1. Set `JDWEB_DATA_KEY` to the new value and `JDWEB_DATA_KEY_PREVIOUS` to the old one.
2. Restart once (all hoster secrets are re-encrypted; partial failure aborts startup).
3. Remove `JDWEB_DATA_KEY_PREVIOUS` after verifying.

### API surface

Accounts UI and `/api/hosters`: create, enable/disable, password update, delete, refresh status from JD, import, resync one account.

## Protected routes

Anything under `/api/*` except health, setup status, setup admin / JD probe (localhost), login, and OIDC start/callback/status requires a valid session. The JDownloader proxy lives at `/api/jd/*`.

## OIDC (optional)

Set `JDWEB_OIDC_ISSUER`, `JDWEB_OIDC_CLIENT_ID`, `JDWEB_OIDC_REDIRECT_URI` (and usually `JDWEB_OIDC_CLIENT_SECRET`). Login shows **Continue with SSO**. By default the IdP username/email must already exist as a local user (`JDWEB_OIDC_AUTO_PROVISION=true` to create accounts on first login).

Login and setup are **rate-limited** per client IP. Failed and successful logins are recorded in `audit_events`.
