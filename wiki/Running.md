# Running

## Development

Start the API and the Vite UI together:

```bash
pnpm dev
```

Or separately:

```bash
pnpm dev:server
pnpm dev:web
```

Open the Vite URL (default `http://127.0.0.1:5173`). API calls are proxied to the server.

## Production

```bash
pnpm build
pnpm start
```

Open `http://JDWEB_HOST:JDWEB_PORT` (plus `JDWEB_BASE_PATH` if set).

## JDownloader local API

Enable JDownloader’s local HTTP API and point `JD_API_URL` at it. Typical settings:

- Localhost only
- Port matching `JD_API_URL` (for example `3128`)

jdweb proxies authenticated browser requests to that API. Do not expose the JDownloader port itself to the internet.
