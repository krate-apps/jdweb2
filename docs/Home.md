# jdweb

jdweb is a self-hosted web companion for [JDownloader 2](https://jdownloader.org/). It serves a Vue UI and a small authenticated HTTP API that talks to JDownloader’s **local** HTTP API on the same machine (or network). The browser never calls JDownloader directly.

## Contents

- [Installation](Installation)
- [Configuration](Configuration)
- [Running](Running)
- [Reverse proxy](Reverse-proxy) (Caddy, nginx, Apache)
- [Authentication](Authentication)
- [Destinations and library mover](Destinations-and-library-mover)
- [Webhooks](Webhooks)
- [API overview](API)
- [Releases](Release)
- [Troubleshooting](Troubleshooting)

## Architecture

```text
Browser  --HTTPS-->  reverse proxy  --HTTP-->  jdweb (:8787)
                                              |-- SQLite (users, sessions, hosters, moves, webhooks)
                                              |-- AES hoster secrets
                                              '-- HTTP --> JDownloader local API (Settings)
```

- **Auth** is owned by jdweb (argon2id users + server-side sessions), not by JDownloader.
- **Hoster accounts** are stored encrypted in SQLite and synced into JDownloader.
- **Downloads / grabber / engine** go through `/api/jd/*` (authenticated proxy).
- **Library mover** is a server-side job that copies finished staging folders into configured library roots.

## Features

- Sign-in with an HTTP-only session cookie; multi-user SQLite auth (argon2id)
- First admin via setup wizard, localhost setup API, or env seed
- Download list with filters/sort, cleanup, context menus (rename, comment, stop-after, move, retry extract, …)
- Link grabber; add URLs or `.dlc` / `.ccf` / `.rsdf` containers with crawler progress
- Drop container files anywhere in the window; Ctrl+L / Cmd+L opens Add links
- Premium hoster accounts in SQLite (import from JD, edit passwords, resync)
- Connection limits, download speed limit, archive password list
- Destinations: Movies, Series, Other, with library folder suggestions
- Automatic and manual library mover; move history in Settings
- Optional completion toasts and HTTP webhooks
- Structured JSON logs and authenticated `GET /api/metrics`
- English and French UI; dark / light theme (local preference)
- Docker image + Compose; CI typecheck, unit tests, and e2e

## Requirements

- Node.js and pnpm (pins in the root `package.json`)
- A running JDownloader 2 instance with the **local HTTP API** enabled
- For production behind TLS: a reverse proxy (see [Reverse proxy](Reverse-proxy))

## License

Unlicense — see the repository `LICENSE` file.
