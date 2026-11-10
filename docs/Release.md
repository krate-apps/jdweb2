# Releases

jdweb versions with **semantic-release** on pushes to **`main` only**, after the CI `check` job succeeds (same workflow: `.github/workflows/ci.yml`). PRs and other branches never release. CI and release never run in parallel on the same ref.

## Version rules

| Commit type | Bump |
|-------------|------|
| `feat` | minor |
| `fix`, `perf` | patch |
| `ux`, `i18n` | minor |
| type with `!` (breaking) | major |
| `chore`, `docs`, `test`, `ci`, `build`, `style`, `refactor` | no release |

Current published image: `ghcr.io/krate-apps/jdweb:1.2.2` (<!-- jdweb-version -->1.2.2<!-- /jdweb-version -->).

## What a release does

1. Bumps `package.json` / `web` / `server` to the same version
2. Updates `CHANGELOG.md`
3. Updates the GHCR tag in `docker-compose.yml` and docs
4. Creates git tag `vX.Y.Z` and a GitHub Release
5. Builds and pushes `ghcr.io/krate-apps/jdweb:X.Y.Z` and `:latest`

## Baseline

The first tag in history is **`v0.1.0`**. Without it, semantic-release would start at `1.0.0`. Do not delete that tag.

## Path prefix

The image is base-path agnostic. Set the prefix at runtime:

```bash
JDWEB_BASE_PATH=/alice/jdweb docker compose up -d
```

## Manual dry-run

```bash
pnpm exec semantic-release --dry-run
```

## Wiki sync (maintainers)

English docs live in `docs/` and can be published to the GitHub Wiki:

```bash
pnpm docs:publish
# or: ./scripts/publish-docs.sh
```

Create the first Wiki page once in the GitHub UI so the `*.wiki` remote exists.
