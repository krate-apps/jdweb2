import { apiJson } from './http'

export interface AppSettings {
  basePath: string
  jdApiUrl: string
  stagingDir: string
  moviesDir: string
  showsDir: string
  otherDir: string
  moverIntervalMs: number
}

export async function getSettings(): Promise<{
  settings: AppSettings
  basePathForcedByEnv: boolean
}> {
  return apiJson('api/settings')
}

export async function patchSettings(patch: Partial<AppSettings>): Promise<{
  settings: AppSettings
  restartRequired?: boolean
  basePathForcedByEnv: boolean
}> {
  return apiJson('api/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
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
