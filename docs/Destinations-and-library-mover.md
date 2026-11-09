# Destinations and library mover

## Destinations

When adding links (or moving a package), choose a destination kind:

| Kind | Staging under `JDWEB_STAGING_DIR` | Library root |
|------|-----------------------------------|--------------|
| Movies | `movies/<Title>` | `JDWEB_MOVIES_DIR/<Title>` |
| Series | `shows/<Name>/Season <N>` | `JDWEB_SHOWS_DIR/<Name>/Season <N>` |
| Other | `downloads/<Name>` | `JDWEB_OTHER_DIR/<Name>` |

JDownloader is told to save into the **staging** path. You can change a package’s destination later from the download list (context menu → move).

### Folder suggestions

Title fields suggest existing folders from:

- `GET /api/library/movies`
- `GET /api/library/shows`
- `GET /api/library/other`

Optional query `?path=` lists a subfolder. Choosing an existing series can prefill the highest `Season N` folder found under that show. Paths outside the library root are rejected (`invalid_path`).

`POST /api/destinations/resolve` returns the staging path and a short label for a kind/title/season without moving files.

## Library mover

When `JDWEB_MOVER_INTERVAL_MS` is greater than zero, jdweb periodically looks for **finished** packages whose `saveTo` sits under the staging tree and maps to a library destination. For each candidate it:

1. Waits until extraction looks ready (best-effort via JD extraction API)
2. Copies the package folder to a temporary name beside the library destination
3. Renames it into place (refuses to overwrite an existing destination)
4. Removes the staging folder
5. Removes the package from JDownloader’s download list
6. Records a `move_events` row and fires webhooks (`mover.succeeded` / `mover.failed`)

Failures are also written into the package comment with a `jdweb-mover:` prefix so they remain visible in the UI. Packages already marked with that comment prefix are skipped on later ticks.

### Manual run and history

| Action | How |
|--------|-----|
| Run one mover pass | Settings → **Run mover now**, or `POST /api/mover/run` |
| Recent moves | Settings → Recent moves, or `GET /api/mover/history?limit=50` |
| Retarget one package (staging dir only) | UI move dialog → `POST /api/mover/move` |

Set `JDWEB_MOVER_INTERVAL_MS=0` to disable the automatic timer. Manual destination changes and **Run mover now** still work.

### Permissions and disk layout

The jdweb process user must be able to read staging and create/rename under the library roots. In Docker, keep staging and libraries under the mounted `./data` volume (Compose defaults) or bind-mount the real media paths.
