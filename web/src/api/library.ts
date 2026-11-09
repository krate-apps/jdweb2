import { apiJson } from './http'

export type LibraryRoot = 'movies' | 'shows'

/** List subdirectory names under a library root (optional relative path). */
export async function listLibraryFolders(root: LibraryRoot, path = ''): Promise<string[]> {
  const query = path ? `?path=${encodeURIComponent(path)}` : ''
  try {
    const res = await apiJson<{ folders: string[] }>(`api/library/${root}${query}`)
    return res.folders
  } catch {
    return []
  }
}
