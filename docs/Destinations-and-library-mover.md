# Destinations and library mover

## Destinations

When adding links (or moving a package), choose a destination kind:

| Kind   | Staging under staging dir | Library root                       |
| ------ | ------------------------- | ---------------------------------- |
| Movies | `movies/<Title>`          | movies library `/<Title>`          |
| Series | `shows/<Name>/Season <N>` | shows library `/<Name>/Season <N>` |
| Other  | `downloads/<Name>`        | other library `/<Name>`            |

Paths are **app settings** (SQLite / Settings UI), seeded once from env if present.
Default host seed: `~/medias/jdownloader/staging` and `~/medias/jdownloader/library/…`.

JDownloader is told to save into the **staging** path. You can change a package’s destination later from the download list (context menu → move).

### Folder suggestions

Title fields suggest existing folders from:

- `GET /api/library/movies`
- `GET /api/library/shows`
- `GET /api/library/other`

Optional query `?path=` lists a subfolder. Choosing an existing series can prefill the highest `Season N` folder found under that show. Paths outside the library root are rejected (`invalid_path`).

`POST /api/destinations/resolve` returns the staging path and a short label for a kind/title/season without moving files.

## Library mover

When the mover interval (Settings) is greater than zero, jdweb periodically looks for **finished** packages whose `saveTo` sits under the staging tree and maps to a library destination. For each candidate it:

1. Waits until extraction looks ready (best-effort via JD extraction API)
2. Copies the package folder to a temporary name beside the library destination
3. Renames it into place (refuses to overwrite an existing destination)
4. Removes the staging folder
5. Removes the package from JDownloader’s download list
6. Records a `move_events` row and fires webhooks (`mover.succeeded` / `mover.failed`)

Failures are also written into the package comment with a `jdweb-mover:` prefix so they remain visible in the UI. Packages already marked with that comment prefix are skipped on later ticks.

### Manual run and history

| Action                                  | How                                                                  |
| --------------------------------------- | -------------------------------------------------------------------- |
| Run one mover pass                      | Settings → **Move finished downloads now**, or `POST /api/mover/run` |
| Recent moves                            | Settings → Recent moves, or `GET /api/mover/history?limit=50`        |
| Retarget one package (staging dir only) | UI move dialog → `POST /api/mover/move`                              |

Set **Library move interval** to `0` in Settings to disable the automatic timer (`JDWEB2_MOVER_INTERVAL_MS` only seeds SQLite on first boot). Manual destination changes and **Move finished downloads now** still work.


### Permissions and disk layout

The jdweb process user must be able to read staging and create/rename under the library roots. In Docker, keep staging and libraries under the mounted `./data` volume (Compose defaults) or bind-mount the real media paths.
