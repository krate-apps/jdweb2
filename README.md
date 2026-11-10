# jdweb

<p align="center">
  <img src="web/public/favicon.svg" width="96" height="96" alt="jdweb" />
</p>

<p align="center">
  <a href="https://github.com/krate-apps/jdweb2/actions/workflows/ci.yml"><img src="https://github.com/krate-apps/jdweb2/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/krate-apps/jdweb2/releases"><img src="https://img.shields.io/github/v/release/krate-apps/jdweb2" alt="Release" /></a>
  <a href="https://github.com/krate-apps/jdweb2/pkgs/container/jdweb2"><img src="https://img.shields.io/badge/GHCR-krate--apps%2Fjdweb2-blue" alt="GHCR" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Unlicense-lightgrey" alt="Unlicense" /></a>
</p>

Self-hosted web UI for [JDownloader 2](https://jdownloader.org/). A Vue app and a small Node API sit in front of JDownloader’s **local** HTTP API — the browser never talks to JD directly.

```text
Browser ──HTTPS──▶ reverse proxy ──HTTP──▶ jdweb (:8787)
                                              ├── SQLite (users, sessions, hosters, …)
                                              └── HTTP ──▶ JDownloader local API
```

## Quick start

Needs Node.js, pnpm, and JDownloader with the local HTTP API enabled. Tooling pins live in `package.json`.

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

**Docker:**

```bash
docker compose up -d
```

Path prefix without rebuild: `JDWEB_BASE_PATH=/alice/jdweb docker compose up -d`.

<!-- jdweb-version -->0.0.0<!-- /jdweb-version -->

## Documentation

Guides are in [`docs/`](docs/Home.md) and on the [Wiki](https://github.com/krate-apps/jdweb2/wiki).

- [Installation](docs/Installation.md) · [Configuration](docs/Configuration.md) · [Running](docs/Running.md)
- [Reverse proxy](docs/Reverse-proxy.md) · [Authentication](docs/Authentication.md)
- [Destinations & mover](docs/Destinations-and-library-mover.md) · [Webhooks](docs/Webhooks.md)
- [API](docs/API.md) · [Troubleshooting](docs/Troubleshooting.md)

## License

[Unlicense](LICENSE) — public domain dedication.
