import { apiJson } from './http'

export function login(username: string, password: string) {
  return apiJson<{ username: string }>('api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logout() {
  return apiJson<{ ok: boolean }>('api/auth/logout', { method: 'POST' })
}

export function me() {
  return apiJson<{ username: string }>('api/auth/me')
}
