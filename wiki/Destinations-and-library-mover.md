# Destinations and library mover

## Destinations

When adding links, choose a destination kind:

| Kind | Staging folder under `JDWEB_STAGING_DIR` | Library folder |
|------|------------------------------------------|----------------|
| Movies | `movies/<Title>` | `JDWEB_MOVIES_DIR/<Title>` |
| Series | `shows/<Name>/Season <N>` | `JDWEB_SHOWS_DIR/<Name>/Season <N>` |
| Other | `downloads/<Name>` | `JDWEB_OTHER_DIR/<Name>` |

JDownloader is told to save into the staging path. You can change a package’s destination later from the download list.

## Library mover

When `JDWEB_MOVER_INTERVAL_MS` is greater than zero, jdweb periodically looks for finished packages whose `saveTo` path sits under the staging tree. For each candidate it:

1. Copies the package folder to a temporary name beside the library destination
2. Renames it into place (refuses to overwrite an existing destination)
3. Removes the staging folder
4. Removes the package from JDownloader’s download list

Failures are written into the package comment with a `jdweb-mover:` prefix so they remain visible in the UI.

Set `JDWEB_MOVER_INTERVAL_MS=0` to disable automatic moves. Manual destination changes still update JDownloader’s download directory.
