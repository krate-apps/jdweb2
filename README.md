# jdweb

Self-hosted web companion for [JDownloader 2](https://jdownloader.org/).

jdweb serves a Vue interface and a small authenticated API that talks to JDownloader’s local HTTP API on your machine. The browser never calls JDownloader directly.

## Documentation

English documentation is maintained in [`wiki/`](wiki/) and published to the [project Wiki](https://github.com/krate-apps/jdweb/wiki).

After creating the first Wiki page once in the GitHub UI (so the `jdweb.wiki` remote exists), sync with:

```bash
./scripts/publish-wiki.sh
```

## Quick start

Local development:

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Open `http://127.0.0.1:5173/` (Vite). The API listens on port `8787`.

On a remote server, use a production build (not Vite’s port `5173`):

```bash
# In .env: JDWEB_HOST=0.0.0.0  and set user/password / JD_API_URL
pnpm install && pnpm build && pnpm start
```

Then open `http://YOUR_SERVER_IP:8787/`. For HTTPS, put a reverse proxy in front. See the Wiki for configuration, reverse proxy base paths, destinations, and the library mover.

## License

UNLICENSE (see `LICENSE`).
