# Webhooks

jdweb can POST a small JSON payload to configured HTTP endpoints when packages finish downloading or when the library mover succeeds or fails.

## Events

| Event | When |
|-------|------|
| `download.finished` | A package newly appears as finished in the download list |
| `mover.succeeded` | The mover copied a package into the library |
| `mover.failed` | The mover failed for a package |

## Payload

```json
{
  "event": "download.finished",
  "at": "2026-01-15T12:00:00.000Z",
  "package": { "uuid": 123, "name": "Example", "saveTo": "/path" },
  "error": "optional failure message"
}
```

Delivery uses a 5s timeout. Failures are logged and do not interrupt downloads or moves.

## Configuration

Manage webhooks in Settings, or seed URLs with `JDWEB_WEBHOOK_URLS` (comma-separated) when the `webhooks` table is empty. API: `GET/POST /api/webhooks`, `PATCH/DELETE /api/webhooks/:id`.
