import { apiJson } from './http'

export interface AppSettings {
  jdApiUrl: string
  stagingDir: string
  moviesDir: string
  showsDir: string
  otherDir: string
  moverIntervalMs: number
}

export async function getSettings(): Promise<AppSettings> {
  const res = await apiJson<{ settings: AppSettings }>('api/settings')
  return res.settings
}

export async function patchSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const res = await apiJson<{ settings: AppSettings }>('api/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return res.settings
}

export async function probeJd(url?: string): Promise<
  | { ok: true; version: unknown; candidates?: undefined }
  | { ok: false; error: string; candidates?: undefined }
  | { candidates: { url: string; version: unknown }[] }
> {
  return apiJson('api/setup/probe-jd', {
    method: 'POST',
    body: JSON.stringify(url ? { url } : {}),
  })
}
