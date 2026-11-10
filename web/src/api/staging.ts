import { apiJson } from './http'
import { apiUrl } from '@/lib/base'

export type StagingEntry = {
  name: string
  path: string
  kind: 'file' | 'dir'
  size: number
  mtimeMs: number
}

export function listStaging(path = '') {
  const q = path ? `?path=${encodeURIComponent(path)}` : ''
  return apiJson<{ path: string; entries: StagingEntry[] }>(`api/staging${q}`)
}

export function deleteStaging(path: string) {
  return apiJson<{ ok: boolean }>('api/staging', {
    method: 'DELETE',
    body: JSON.stringify({ path }),
  })
}

export async function downloadBackup(): Promise<void> {
  const response = await fetch(apiUrl('api/backup'), { credentials: 'same-origin' })
  if (!response.ok) throw new Error('backup_failed')
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = /filename="([^"]+)"/.exec(disposition)
  const filename = match?.[1] ?? 'jdweb-backup.sqlite'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function restoreBackup(file: File): Promise<{ ok: boolean; restartRequired?: boolean }> {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch(apiUrl('api/backup/restore'), {
    method: 'POST',
    credentials: 'same-origin',
    body,
  })
  if (!response.ok) {
    const err = await response.json().catch(() => null)
    throw new Error(err?.error ?? 'restore_failed')
  }
  return (await response.json()) as { ok: boolean; restartRequired?: boolean }
}
