import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { layout: 'auth', guest: true, title: 'Kirish · FindTheWay Biznes' },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/RegisterView.vue'),
    meta: { layout: 'auth', guest: true, title: "Ro'yxatdan o'tish · FindTheWay Biznes" },
  },
  {
    path: '/',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: {
      layout: 'dashboard',
      requiresOwner: true,
      titleKey: 'nav.dashboard',
      title: 'Bosh sahifa · FindTheWay Biznes',
    },
  },
  {
    path: '/arizalar',
    name: 'applications',
    component: () => import('../views/ApplicationsView.vue'),
    meta: {
      layout: 'dashboard',
      requiresOwner: true,
      titleKey: 'nav.applications',
      title: 'Arizalar · FindTheWay Biznes',
    },
  },
  {
    path: '/markazim',
    name: 'center',
    component: () => import('../views/CenterView.vue'),
    meta: {
      layout: 'dashboard',
      requiresOwner: true,
      titleKey: 'nav.center',
      title: 'Markazim · FindTheWay Biznes',
    },
  },
  {
    path: '/kurslar',
    name: 'courses',
    component: () => import('../views/CoursesView.vue'),
    meta: {
      layout: 'dashboard',
      requiresOwner: true,
      titleKey: 'nav.courses',
      title: 'Kurslar · FindTheWay Biznes',
    },
  },
  {
    path: '/sozlamalar',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: {
      layout: 'dashboard',
      requiresOwner: true,
      titleKey: 'nav.settings',
      title: 'Sozlamalar · FindTheWay Biznes',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue'),
    meta: { layout: 'blank', title: '404 · FindTheWay Biznes' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.path === from.path) return false
    return { top: 0 }
  },
})

// Panelga faqat 'owner' rolidagi foydalanuvchi kira oladi
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.waitUntilReady()

  if (to.meta.requiresOwner) {
    if (!auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
    if (!auth.isOwner) {
      await auth.signOut()
      return { name: 'login', query: { notOwner: '1' } }
    }
  }

  if (to.meta.guest && auth.isAuthenticated && auth.isOwner) {
    return { name: 'dashboard' }
  }

  return true
})

router.afterEach((to) => {
  if (to.meta?.title) document.title = to.meta.title
})

export default router
