import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
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

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) await auth.bootstrap()
  if (to.meta.public) {
    if (auth.username && to.name === 'login') return { name: 'downloads' }
    return true
  }
  if (!auth.username) return { name: 'login', query: { redirect: to.fullPath } }
  return true
})

export default router
