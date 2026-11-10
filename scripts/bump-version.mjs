#!/usr/bin/env node
/**
 * Sync monorepo package versions and GHCR image tags for a release.
 * Usage: node scripts/bump-version.mjs <version>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const version = process.argv[2]?.trim()
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node scripts/bump-version.mjs <semver>')
  process.exit(1)
}

const image = `ghcr.io/krate-apps/jdweb2:${version}`

function bumpPackageJson(relPath) {
  const path = resolve(root, relPath)
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  pkg.version = version
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`)
}

function replaceImageTags(relPath) {
  const path = resolve(root, relPath)
  let text = readFileSync(path, 'utf8')
  const next = text
    .replace(/ghcr\.io\/krate-apps\/jdweb2?:\d+\.\d+\.\d+/g, image)
    .replace(/<!-- jdweb-version -->[\s\S]*?<!-- \/jdweb-version -->/g, `<!-- jdweb-version -->${version}<!-- /jdweb-version -->`)
  if (next === text && !text.includes('ghcr.io/krate-apps/jdweb2:')) {
    console.warn(`warn: no GHCR image tag found in ${relPath}`)
  }
  writeFileSync(path, next)
}

for (const file of ['package.json', 'web/package.json', 'server/package.json']) {
  bumpPackageJson(file)
}

for (const file of [
  'docker-compose.yml',
  'README.md',
  'docs/Running.md',
  'docs/Installation.md',
  'docs/Release.md',
]) {
  replaceImageTags(file)
}

console.log(`bumped to ${version} (${image})`)
