# Authentication

jdweb uses a single account defined by environment variables:

- `JDWEB_USER`
- `JDWEB_PASSWORD`
- `JDWEB_SESSION_SECRET`

## Session

Successful login sets an HTTP-only cookie (`jdweb_session`) signed with `JDWEB_SESSION_SECRET`. The cookie path follows `JDWEB_BASE_PATH`.

Protected routes:

- `GET /api/auth/me`
- `GET /api/config/public`
- Destination and mover endpoints under `/api/`
- JDownloader proxy under `/api/jd/*`

Unauthenticated calls receive HTTP 401. The UI redirects to the sign-in page.

## Logout

`POST /api/auth/logout` clears the session cookie.
