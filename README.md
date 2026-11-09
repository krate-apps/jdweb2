# jdweb

**Self-hosted web UI for [JDownloader 2](https://jdownloader.org/).**

A Vue front end and a small authenticated Node API that talk to JDownloader’s **local** HTTP API on your machine. The browser never reaches JDownloader directly.

<p align="center">
  <img src="web/public/favicon.svg" width="72" height="72" alt="jdweb icon" />
</p>

```text
Browser ──HTTPS──▶ reverse proxy ──HTTP──▶ jdweb (:8787)
                                              ├── SQLite (users, sessions, hosters, moves)
                                              └── HTTP ──▶ JDownloader local API
```

## Why jdweb

| | |
|---|---|
| **Own your auth** | Multi-user SQLite login (argon2id), server-side sessions, encrypted hoster secrets |
| **Safer surface** | JD stays on localhost; only jdweb is exposed behind your proxy |
| **Library-aware** | Staging → movies / series / other mover, suggestions, history |
| **Ops-friendly** | Docker, webhooks, JSON logs, metrics, path-prefix installs |

## Quick start

**Requirements:** Node.js 20+, pnpm 9, JDownloader with the local HTTP API enabled.

```bash
pnpm install && pnpm build && pnpm start
```

Secrets are written to `data/secrets.env` on first boot if missing. Open the UI on localhost and complete the setup wizard (admin, JDownloader URL, library paths). Optional boot env: copy `.env.example` — see [docs/Configuration.md](docs/Configuration.md).

| | URL |
|---|-----|
| Production UI/API | http://127.0.0.1:8787 |
| Dev (`pnpm dev`) | UI http://127.0.0.1:5173 · API :8787 |

**Docker** (published image <!-- jdweb-version -->1.0.0<!-- /jdweb-version -->)

```bash
docker compose up -d
# pulls ghcr.io/krate-apps/jdweb:1.0.0
```

Path prefix (no rebuild): `JDWEB_BASE_PATH=/alice/jdweb docker compose up -d`. See **[docs/Reverse-proxy.md](docs/Reverse-proxy.md)** and **[docs/Release.md](docs/Release.md)**.

## Features

- Download list with filters, cleanup, and rich context menus
- Link grabber + `.dlc` / `.ccf` / `.rsdf` containers and crawler progress
- Premium hoster accounts in SQLite (import from JD, edit passwords, resync)
- Speed limit, connection caps, archive passwords
- Automatic & manual library mover with history
- HTTP webhooks (`download.finished`, `mover.succeeded`, `mover.failed`)
- English / French UI, dark & light themes
- Structured logs and `GET /api/metrics`

## Documentation

| Guide | |
|-------|---|
| [Home](docs/Home.md) | Overview & architecture |
| [Installation](docs/Installation.md) | Clone, env, Docker |
| [Configuration](docs/Configuration.md) | Environment variables |
| [Running](docs/Running.md) | Dev, production, systemd |
| [Releases](docs/Release.md) | semantic-release + GHCR |
| [Reverse proxy](docs/Reverse-proxy.md) | Caddy · nginx · Apache |
| [Authentication](docs/Authentication.md) | Users, sessions, data key |
| [Destinations & mover](docs/Destinations-and-library-mover.md) | Staging → library |
| [Webhooks](docs/Webhooks.md) | HTTP notifications |
| [API](docs/API.md) | Endpoint map |
| [Troubleshooting](docs/Troubleshooting.md) | MIME, JD port, mover |

Publish to the GitHub Wiki:

```bash
pnpm docs:publish
```

## Stack

- **web** — Vue 3, Vite, Pinia, vue-i18n, Tailwind 4  
- **server** — Hono, `node:sqlite`, argon2id, AES-256-GCM  

## License

[UNLICENSE](LICENSE) — public domain dedication.
