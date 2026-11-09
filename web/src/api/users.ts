import { apiJson } from './http'

export interface AppUser {
  id: number
  username: string
  createdAt: number
  updatedAt: number
}

export function listUsers() {
  return apiJson<{ users: AppUser[] }>('api/users')
}

export function createUser(username: string, password: string) {
  return apiJson<AppUser>('api/users', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function updateUserPassword(id: number, password: string) {
  return apiJson<{ ok: boolean }>(`api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ password }),
  })
}

export function deleteUser(id: number) {
  return apiJson<{ ok: boolean }>(`api/users/${id}`, { method: 'DELETE' })
}
