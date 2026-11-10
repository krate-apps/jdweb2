import { apiJson } from './http'

export function setupStatus() {
  return apiJson<{ needsSetup: boolean }>('api/setup/status')
}

export function setupAdmin(username: string, password: string) {
  return apiJson<{ username: string }>('api/setup/admin', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}
