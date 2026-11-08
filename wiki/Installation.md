# Installation

## Clone and install

```bash
git clone https://github.com/krate-apps/jdweb.git
cd jdweb
pnpm install
```

## Environment file

```bash
cp .env.example .env
```

Edit `.env` before the first run. At minimum set:

- `JDWEB_USER` and `JDWEB_PASSWORD`
- `JDWEB_SESSION_SECRET` to a long random string
- `JD_API_URL` to your JDownloader local API (default `http://127.0.0.1:3128`)

## Build for production

```bash
pnpm build
pnpm start
```

The server listens on `JDWEB_HOST`:`JDWEB_PORT` and serves the built UI from `web/dist`.
