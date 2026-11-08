# jdweb

Self-hosted web companion for [JDownloader 2](https://jdownloader.org/).

jdweb serves a Vue interface and a small authenticated API that talks to JDownloader’s local HTTP API on your machine. The browser never calls JDownloader directly.

## Documentation

English documentation is maintained in [`wiki/`](wiki/) and published to the [project Wiki](https://github.com/krate-apps/jdweb/wiki).

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Open the URL printed by the web and server processes. See the Wiki for configuration, reverse proxy base paths, destinations, and the library mover.

## License

UNLICENSE (see `LICENSE`).
