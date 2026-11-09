# jdweb

jdweb is a self-hosted web companion for [JDownloader 2](https://jdownloader.org/). It provides a browser interface and a small authenticated HTTP API that talks to JDownloader’s local HTTP API on the same machine. The browser never calls JDownloader directly.

## Contents

- [Installation](Installation)
- [Configuration](Configuration)
- [Running](Running)
- [Reverse proxy](Reverse-proxy)
- [Destinations and library mover](Destinations-and-library-mover)
- [Authentication](Authentication)

## Features

- Sign-in form with an HTTP-only session cookie
- Multi-user SQLite auth (argon2id); first admin via env seed or localhost setup API
- Download list with package and link details
- Link grabber (add URLs, confirm into the download list)
- Premium hoster accounts stored encrypted in SQLite and synced to JDownloader
- Connection limits, download speed limit, and archive password list
- Optional toast when a package finishes downloading
- Right-click actions on download packages, links, and link-grabber rows
- Retry archive extraction with a password from a package’s context menu
- Ctrl+L (Cmd+L on macOS) opens the add-links dialog outside text fields
- Add links accepts pasted URLs or `.dlc` container files and shows crawler progress (found / filtered / broken)
- Drop `.dlc` files anywhere in the window to open Add links on the DLC tab
- Destinations: Movies, Series, Other, with autocomplete from existing library folders
- Optional automatic mover from staging folders into a library
- English and French interface
- Dark and light themes (local preference only)

## Requirements

- Node.js 20 or newer
- pnpm 9
- A running JDownloader 2 instance with the local HTTP API enabled
