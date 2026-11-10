# Webhooks

jdweb can POST a small JSON payload to configured HTTP endpoints when packages finish downloading or when the library mover succeeds or fails.

## Events

| Event               | When                                                      |
| ------------------- | --------------------------------------------------------- |
| `download.finished` | The server poller detects a package newly marked finished |
| `mover.succeeded`   | The mover copied a package into the library               |
| `mover.failed`      | The mover failed for a package                            |

## Payload

```json
{
  "event": "download.finished",
  "at": "2026-01-15T12:00:00.000Z",
  "package": { "uuid": 123, "name": "Example", "saveTo": "/path" },
  "error": "optional failure message"
}
```

- Method: `POST`
- Header: `Content-Type: application/json`
- Timeout: **5 seconds**
- Failures are logged (and counted in metrics) and never interrupt downloads or moves

## Configuration

### Settings UI

Settings → Notifications → HTTP webhooks: add a URL (all events enabled by default), enable/disable, or remove.

Webhook URLs must be public `http`/`https` hosts. Private, loopback, and link-local targets (including cloud metadata addresses) are rejected to prevent SSRF.

### Environment seed

Set `JDWEB2_WEBHOOK_URLS` to a comma-separated list of URLs. They are inserted **once** when the `webhooks` table is empty (all events enabled). Later edits are done in the UI/API; changing the env var alone does not update existing rows.

### API

| Method   | Path                   | Body / notes                                                                                                                   |
| -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/api/webhooks`        | List                                                                                                                           |
| `POST`   | `/api/webhooks`        | `{ "url", "events"?, "enabled"? }`                                                                                             |
| `PATCH`  | `/api/webhooks/:id`    | `{ "url"?, "events"?, "enabled"? }`                                                                                            |
| `DELETE` | `/api/webhooks/:id`    | Remove                                                                                                                         |
| `POST`   | `/api/webhooks/notify` | `{ "event", "package": { "name", "uuid"?, "saveTo"? }, "error"? }` — starts delivery in the background and returns immediately |

Event names must be one of: `download.finished`, `mover.succeeded`, `mover.failed`.
