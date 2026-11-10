# jdweb

<p align="center">
  <img src="web/public/favicon.svg" width="96" height="96" alt="jdweb" />
</p>

<p align="center">
  <a href="https://github.com/krate-apps/jdweb/actions/workflows/ci.yml"><img src="https://github.com/krate-apps/jdweb/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/krate-apps/jdweb/releases"><img src="https://img.shields.io/github/v/release/krate-apps/jdweb" alt="Release" /></a>
  <a href="https://github.com/krate-apps/jdweb/pkgs/container/jdweb"><img src="https://img.shields.io/badge/GHCR-krate--apps%2Fjdweb-blue" alt="GHCR" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node.js" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Unlicense-lightgrey" alt="Unlicense" /></a>
</p>

Self-hosted web UI for [JDownloader 2](https://jdownloader.org/). A Vue app and a small Node API sit in front of JDownloader’s **local** HTTP API — the browser never talks to JD directly.

```text
Browser ──HTTPS──▶ reverse proxy ──HTTP──▶ jdweb (:8787)
                                              ├── SQLite (users, sessions, hosters, …)
                                              └── HTTP ──▶ JDownloader local API
```

## Requirements

| | |
|---|---|
| **Node.js** | `>=22` (`engines` in `package.json`; **26** in CI and the Docker image) |
| **pnpm** | **9.7.0** (`packageManager` field — `corepack enable` then `corepack prepare`) |
| **JDownloader 2** | Local HTTP API enabled |

## Quick start

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

Guides are in [`docs/`](docs/Home.md) and on the [Wiki](https://github.com/krate-apps/jdweb/wiki).

- [Installation](docs/Installation.md) · [Configuration](docs/Configuration.md) · [Running](docs/Running.md)
- [Reverse proxy](docs/Reverse-proxy.md) · [Authentication](docs/Authentication.md)
- [Destinations & mover](docs/Destinations-and-library-mover.md) · [Webhooks](docs/Webhooks.md)
- [API](docs/API.md) · [Troubleshooting](docs/Troubleshooting.md)

## License

[Unlicense](LICENSE) — public domain dedication.
