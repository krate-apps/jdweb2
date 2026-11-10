import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as authApi from '@/api/auth'
import { ApiError } from '@/api/http'

export const useAuthStore = defineStore('auth', () => {
  const username = ref<string | null>(null)
  const ready = ref(false)

  async function bootstrap() {
    try {
      const me = await authApi.me()
      username.value = me.username
    } catch (err) {
      username.value = null
      if (!(err instanceof ApiError && err.status === 401)) {
        console.warn(err)
      }
    } finally {
      ready.value = true
    }
  }

  async function login(user: string, pass: string) {
    const me = await authApi.login(user, pass)
    username.value = me.username
  }

  async function logout() {
    await authApi.logout()
    username.value = null
  }

  return { username, ready, bootstrap, login, logout }
})
