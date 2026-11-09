# jdweb

Self-hosted web companion for [JDownloader 2](https://jdownloader.org/).

jdweb serves a Vue interface and a small authenticated API that talks to JDownloader’s local HTTP API on your machine. The browser never calls JDownloader directly.

## Documentation

English documentation lives in [`docs/`](docs/) and is published to the [project Wiki](https://github.com/krate-apps/jdweb/wiki):

| Page | Topic |
|------|--------|
| [Home](docs/Home.md) | Overview, architecture, features |
| [Installation](docs/Installation.md) | Clone, env, build, Docker |
| [Configuration](docs/Configuration.md) | Environment variables |
| [Running](docs/Running.md) | Dev, production, systemd, metrics |
| [Reverse proxy](docs/Reverse-proxy.md) | **Caddy, nginx, Apache** examples |
| [Authentication](docs/Authentication.md) | Users, sessions, hosters, data key |
| [Destinations and library mover](docs/Destinations-and-library-mover.md) | Staging → library |
| [Webhooks](docs/Webhooks.md) | HTTP notifications |
| [API](docs/API.md) | Endpoint overview |
| [Troubleshooting](docs/Troubleshooting.md) | MIME/base path, JD, mover |

After creating the first Wiki page once in the GitHub UI (so the `jdweb.wiki` remote exists), sync with:

```bash
./scripts/publish-docs.sh
```

## Quick start

Local development:

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Open `http://127.0.0.1:5173/` (Vite). The API listens on port `8787`.

Production (or a remote server):

```bash
# In .env: secrets, JD_API_URL, and JDWEB_HOST=127.0.0.1 behind a proxy
# (or 0.0.0.0 if you expose Node directly)
pnpm install && pnpm build && pnpm start
```

Then open `http://YOUR_SERVER_IP:8787/` (plus `JDWEB_BASE_PATH` if set). For HTTPS and path prefixes, use a reverse proxy — see [docs/Reverse-proxy.md](docs/Reverse-proxy.md) for Caddy, nginx, and Apache.

Docker:

```bash
cp .env.example .env
docker compose up -d --build
```

## License

UNLICENSE (see `LICENSE`).
