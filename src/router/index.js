import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import SicboGame from '@/views/SicboGame.vue'
import { useUserStore } from '@/stores/user'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { layout: 'member' }
    },
    {
      path: '/sicbo',
      name: 'sicbo',
      component: SicboGame,
      meta: { layout: 'member' }
    },
    {
      path: '/account',
      name: 'account',
      component: () => import('@/views/AccountView.vue'),
      meta: { requiresAuth: true, layout: 'member' }
    },
    {
      path: '/deposit',
      name: 'deposit',
      component: () => import('@/views/DepositView.vue'),
      meta: { requiresAuth: true, layout: 'member' }
    },
    {
      path: '/withdraw',
      name: 'withdraw',
      component: () => import('@/views/WithdrawView.vue'),
      meta: { requiresAuth: true, layout: 'member' }
    },
    {
      path: '/support',
      name: 'support',
      component: () => import('@/views/SupportView.vue'),
      meta: { layout: 'member' }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { guestOnly: true, layout: 'member-auth' }
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('@/views/SignupView.vue'),
      meta: { guestOnly: true, layout: 'member-auth' }
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('@/views/AdminLoginView.vue'),
      meta: { adminGuestOnly: true, layout: 'admin-auth' }
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    }
  ]
})

router.beforeEach(async (to) => {
  const userStore = useUserStore()

  if (!userStore.initialized && userStore.token) {
    await userStore.restoreSession()
  }

  if (to.meta.requiresAdmin && !userStore.isLoggedIn) {
    return { name: 'admin-login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresAdmin && !userStore.isAdmin) {
    return { name: 'admin-login' }
  }

  if (to.meta.guestOnly && userStore.isLoggedIn) {
    return { name: userStore.isAdmin ? 'admin' : 'account' }
  }

  if (to.meta.adminGuestOnly && userStore.isLoggedIn) {
    if (userStore.isAdmin) {
      return { name: 'admin' }
    }

    // Allow non-admin logged users to open admin login page
    // so they can switch account without being forced to home.
    return true
  }

  return true
})

export default router
