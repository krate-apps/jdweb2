# API overview

All paths below are relative to `JDWEB_BASE_PATH` (empty = site root). Example with base `/alice/jdweb`: login is `POST /alice/jdweb/api/auth/login`.

Unless noted, endpoints require a valid `jdweb_session` cookie. JSON request bodies use `Content-Type: application/json`.

## Public / bootstrap

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | no | Liveness; `jdReachable`, `uiBuilt`, `settingsReady`, mover, setup |
| `GET` | `/api/setup/status` | no | `{ needsSetup }` when no users exist |
| `POST` | `/api/setup/admin` | localhost only | Create first admin `{ username, password }` |
| `POST` | `/api/setup/probe-jd` | localhost (pre-setup) or auth | Probe URL or scan common local ports |
| `POST` | `/api/auth/login` | no | `{ username, password }` → sets session cookie (rate-limited) |
| `POST` | `/api/auth/logout` | cookie | Clears session |
| `GET` | `/api/auth/me` | yes | Current username |

## Sessions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sessions` | List sessions for the current user |
| `DELETE` | `/api/sessions/:id` | Revoke one session |
| `DELETE` | `/api/sessions` | Revoke all other sessions |

## Users

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users` | List users |
| `POST` | `/api/users` | Create `{ username, password }` |
| `PATCH` | `/api/users/:id` | `{ password }` admin reset |
| `DELETE` | `/api/users/:id` | Delete (not the last user) |
| `POST` | `/api/users/me/password` | `{ currentPassword, newPassword }` |

## Hosters

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/hosters` | List (with JD status when available) |
| `POST` | `/api/hosters` | Create account + secret |
| `PATCH` | `/api/hosters/:id` | Enable/disable and/or set password |
| `DELETE` | `/api/hosters/:id` | Delete |
| `POST` | `/api/hosters/refresh` | Refresh status from JD |
| `POST` | `/api/hosters/import` | Import missing JD accounts (no secrets) |
| `POST` | `/api/hosters/:id/resync` | Push one account to JD again |

## Config, library, destinations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/config/public` | Staging/library paths, mover enabled, JD URL |
| `GET` | `/api/settings` | Full app settings (JD URL, paths, mover interval) |
| `PATCH` | `/api/settings` | Update app settings (JD URL must be private/loopback) |
| `GET` | `/api/library/:root` | `root` = `movies` \| `shows` \| `other`; `?path=` subfolder |
| `POST` | `/api/destinations/resolve` | `{ kind, title, season? }` → staging path + label |

## Mover

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/mover/move` | Retarget package staging dir `{ packageUuid, kind, title, season? }` |
| `POST` | `/api/mover/run` | One-shot mover tick → `{ moved, failed }` |
| `GET` | `/api/mover/history` | Recent `move_events` (`?limit=`) |

## Webhooks and metrics

| Method | Path | Description |
|--------|------|-------------|
| `GET`/`POST` | `/api/webhooks` | List / create |
| `PATCH`/`DELETE` | `/api/webhooks/:id` | Update / delete |
| `POST` | `/api/webhooks/notify` | Fire event payload to matching hooks |
| `GET` | `/api/metrics` | Process counters (JSON, or `Accept: text/plain`) |

## JDownloader proxy

| Method | Path | Description |
|--------|------|-------------|
| `ALL` | `/api/jd/*` | Authenticated proxy to configured JD API URL + same path suffix |

The browser never talks to JDownloader directly. Request body is forwarded as JD’s JSON `params` envelope expects.

## Errors

JSON errors typically look like `{ "error": "code_or_message" }` with HTTP 4xx/5xx. JD unreachable often surfaces as `503` with `jdownloader_unreachable`.
