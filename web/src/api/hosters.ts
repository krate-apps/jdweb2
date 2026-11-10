import { apiJson } from './http'

export interface HosterAccount {
  id: number
  hoster: string
  username: string
  enabled: boolean
  jdUuid: number | null
  needsSecret: boolean
  createdAt: number
  updatedAt: number
  valid?: boolean
  status?: string
  errorString?: string
  trafficLeft?: number
  trafficMax?: number
}

export function listHosters() {
  return apiJson<{ hosters: HosterAccount[] }>('api/hosters')
}

export function createHoster(payload: {
  hoster: string
  username: string
  password: string
  enabled?: boolean
}) {
  return apiJson<HosterAccount>('api/hosters', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function patchHoster(id: number, payload: { enabled?: boolean; password?: string }) {
  return apiJson<HosterAccount>(`api/hosters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteHoster(id: number) {
  return apiJson<{ ok: boolean }>(`api/hosters/${id}`, { method: 'DELETE' })
}

export function refreshHosters() {
  return apiJson<{ hosters: HosterAccount[] }>('api/hosters/refresh', { method: 'POST' })
}

export function resyncHoster(id: number) {
  return apiJson<HosterAccount>(`api/hosters/${id}/resync`, { method: 'POST' })
}

export function importHosters() {
  return apiJson<{ imported: number; skipped: number; hosters: HosterAccount[] }>('api/hosters/import', {
    method: 'POST',
  })
}
