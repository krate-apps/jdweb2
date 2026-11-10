import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { setupStatus } from '@/api/setup'
import { appBase } from '@/lib/base'

const router = createRouter({
  history: createWebHistory(appBase()),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/setup',
      name: 'setup',
      component: () => import('@/views/SetupView.vue'),
      meta: { public: true, setup: true },
    },
    {
      path: '/',
      component: () => import('@/components/layout/AppShell.vue'),
      children: [
        { path: '', redirect: { name: 'downloads' } },
        {
          path: 'downloads',
          name: 'downloads',
          component: () => import('@/views/DownloadsView.vue'),
        },
        {
          path: 'grabber',
          name: 'grabber',
          component: () => import('@/views/GrabberView.vue'),
        },
        {
          path: 'accounts',
          name: 'accounts',
          component: () => import('@/views/AccountsView.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/SettingsView.vue'),
        },
      ],
    },
  ],
})

let setupChecked = false
let needsSetup = false

async function ensureSetupStatus() {
  if (setupChecked) return needsSetup
  try {
    needsSetup = (await setupStatus()).needsSetup
  } catch {
    needsSetup = false
  }
  setupChecked = true
  return needsSetup
}

export function markSetupDone() {
  needsSetup = false
  setupChecked = true
}

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) await auth.bootstrap()
  const setupRequired = await ensureSetupStatus()

  if (setupRequired && to.name !== 'setup') {
    return { name: 'setup' }
  }
  if (!setupRequired && to.name === 'setup') {
    return { name: 'login' }
  }

  if (to.meta.public) {
    if (auth.username && (to.name === 'login' || to.name === 'setup')) return { name: 'downloads' }
    return true
  }
  if (!auth.username) return { name: 'login', query: { redirect: to.fullPath } }
  return true
})

export default router
