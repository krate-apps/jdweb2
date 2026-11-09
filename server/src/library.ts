import { readdir } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { config } from './config.js'

export type LibraryRoot = 'movies' | 'shows'

function rootDir(root: LibraryRoot): string {
  return root === 'movies' ? config.moviesDir : config.showsDir
}

/** Resolve a path under a library root; rejects traversal outside the root. */
function resolveUnderRoot(root: LibraryRoot, subpath: string): string {
  const base = resolve(rootDir(root))
  const segments = subpath.split(/[/\\]+/).filter(Boolean)
  const target = resolve(join(base, ...segments))
  if (target !== base && !target.startsWith(base + sep)) {
    throw new Error('invalid_path')
  }
  return target
}

/**
 * List immediate subdirectory names under a library root (optional subpath).
 * Returns [] when the folder is missing or unreadable.
 */
export async function listLibraryFolders(root: LibraryRoot, subpath = ''): Promise<string[]> {
  const dir = resolveUnderRoot(root, subpath)
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

export function isLibraryRoot(value: string): value is LibraryRoot {
  return value === 'movies' || value === 'shows'
}
