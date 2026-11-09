import { readdir, rm, stat } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { getAppSettings } from './settings.js'

export type StagingEntry = {
  name: string
  path: string
  kind: 'file' | 'dir'
  size: number
  mtimeMs: number
}

function stagingRoot(): string {
  return resolve(getAppSettings().stagingDir)
}

/** Resolve a relative path under staging; rejects traversal. */
export function resolveStagingPath(subpath = ''): string {
  const base = stagingRoot()
  const segments = subpath.split(/[/\\]+/).filter(Boolean)
  const target = resolve(join(base, ...segments))
  if (target !== base && !target.startsWith(base + sep)) {
    throw new Error('invalid_path')
  }
  return target
}

export async function listStaging(subpath = ''): Promise<StagingEntry[]> {
  const dir = resolveStagingPath(subpath)
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const out: StagingEntry[] = []
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      const rel = subpath ? `${subpath.replace(/\/+$/, '')}/${entry.name}` : entry.name
      try {
        const info = await stat(full)
        out.push({
          name: entry.name,
          path: rel.replace(/\\/g, '/'),
          kind: entry.isDirectory() ? 'dir' : 'file',
          size: info.size,
          mtimeMs: info.mtimeMs,
        })
      } catch {
        /* skip unreadable */
      }
    }
    out.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    return out
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

/** Delete a file or directory under staging (never the staging root itself). */
export async function deleteStaging(subpath: string): Promise<void> {
  if (!subpath.trim()) throw new Error('invalid_path')
  const target = resolveStagingPath(subpath)
  const root = stagingRoot()
  if (target === root) throw new Error('cannot_delete_root')
  await rm(target, { recursive: true, force: false })
}
