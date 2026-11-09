#!/usr/bin/env bash
# Publish ./docs markdown pages to the GitHub Wiki remote.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCS_SRC="${ROOT}/docs"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

git clone --depth 1 "https://github.com/krate-apps/jdweb.wiki.git" "${TMP}/wiki" 2>/dev/null \
  || git clone "https://github.com/krate-apps/jdweb.wiki.git" "${TMP}/wiki"

rsync -a --delete --exclude .git "${DOCS_SRC}/" "${TMP}/wiki/"
git -C "${TMP}/wiki" add -A
if git -C "${TMP}/wiki" diff --cached --quiet; then
  echo "Wiki already up to date."
  exit 0
fi
git -C "${TMP}/wiki" -c user.name="$(git -C "${ROOT}" config user.name)" \
  -c user.email="$(git -C "${ROOT}" config user.email)" \
  commit -m "$(cat <<'EOF'
docs: update wiki pages

Sync English documentation from the jdweb repository docs/ folder.
EOF
)"
git -C "${TMP}/wiki" push origin HEAD
echo "Wiki published."
