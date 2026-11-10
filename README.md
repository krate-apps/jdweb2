# jdweb

[![CI](https://github.com/krate-apps/jdweb/actions/workflows/ci.yml/badge.svg)](https://github.com/krate-apps/jdweb/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/krate-apps/jdweb)](https://github.com/krate-apps/jdweb/releases)
[![GHCR](https://img.shields.io/badge/GHCR-krate--apps%2Fjdweb-blue)](https://github.com/krate-apps/jdweb/pkgs/container/jdweb)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)
[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-lightgrey)](LICENSE)

Self-hosted web UI for [JDownloader 2](https://jdownloader.org/). A Vue app and a small Node API sit in front of JDownloader’s **local** HTTP API — the browser never talks to JD directly.

```text
Browser ──HTTPS──▶ reverse proxy ──HTTP──▶ jdweb (:8787)
                                              ├── SQLite (users, sessions, hosters, …)
                                              └── HTTP ──▶ JDownloader local API
```

## Quick start

Requires **Node.js 22+** (26 LTS recommended), **pnpm 9**, and JDownloader with the local HTTP API enabled.

```bash
pnpm install && pnpm build && pnpm start
# → http://127.0.0.1:8787
```

On first boot, secrets are written to `data/secrets.env` if missing. Open the UI on **localhost** and finish the setup wizard (admin, JD URL, library paths), or create the admin via API:

```bash
curl -sS -X POST http://127.0.0.1:8787/api/setup/admin \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"password123"}'
```

**Docker** (`ghcr.io/krate-apps/jdweb:1.2.2` · <!-- jdweb-version -->1.2.2<!-- /jdweb-version -->):

```bash
docker compose up -d
```

Path prefix without rebuild: `JDWEB_BASE_PATH=/alice/jdweb docker compose up -d`.

## Documentation

Full guides live in [`docs/`](docs/Home.md) (also published to the [Wiki](https://github.com/krate-apps/jdweb/wiki)):

| | |
|---|---|
| [Installation](docs/Installation.md) · [Configuration](docs/Configuration.md) · [Running](docs/Running.md) | Install, env, systemd |
| [Reverse proxy](docs/Reverse-proxy.md) · [Authentication](docs/Authentication.md) | Caddy / nginx / Apache, sessions |
| [Destinations & mover](docs/Destinations-and-library-mover.md) · [Webhooks](docs/Webhooks.md) | Library moves, notifications |
| [API](docs/API.md) · [Troubleshooting](docs/Troubleshooting.md) · [Releases](docs/Release.md) | Endpoints, ops, GHCR |

```bash
pnpm docs:publish   # push docs/ to the GitHub Wiki
```

## License

[Unlicense](LICENSE) — public domain dedication.
