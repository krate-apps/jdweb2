import { apiJson } from './http'

export interface AppSession {
  id: string
  createdAt: number
  lastSeenAt: number
  userAgent: string | null
  ip: string | null
  current: boolean
}

export function listSessions() {
  return apiJson<{ sessions: AppSession[] }>('api/sessions')
}

export function revokeSession(id: string) {
  return apiJson<{ ok: boolean }>(`api/sessions/${id}`, { method: 'DELETE' })
}

export function revokeOtherSessions() {
  return apiJson<{ ok: boolean; removed: number }>('api/sessions', { method: 'DELETE' })
}
