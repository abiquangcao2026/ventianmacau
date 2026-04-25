<template>
  <div v-if="usesMemberShell" class="member-shell">
    <header class="member-header">
      <RouterLink class="member-brand" to="/">
        <img alt="The Venetian" src="/img/the-venetian-wordmark.svg" />
      </RouterLink>

      <div v-if="userStore.isLoggedIn" class="member-header__right">
        <span class="member-header__balance">$ {{ Number(userStore.balance || 0).toFixed(0) }}</span>
        <RouterLink class="member-header__icon-btn" to="/support">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
          </svg>
        </RouterLink>
        <RouterLink class="member-header__icon-btn" to="/account">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </RouterLink>
      </div>
    </header>

    <main class="member-main">
      <RouterView />
    </main>

    <nav class="member-nav">
      <RouterLink class="member-nav__item" to="/account">
        <span class="member-nav__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </span>
        <span>Tài Khoản</span>
      </RouterLink>

      <RouterLink class="member-nav__item" to="/deposit">
        <span class="member-nav__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <line x1="12" y1="9" x2="12" y2="15"/>
            <line x1="9" y1="12" x2="15" y2="12"/>
          </svg>
        </span>
        <span>Nạp Tiền</span>
      </RouterLink>

      <RouterLink class="member-nav__item member-nav__item--home" to="/">
        <div class="member-nav__home-circle">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <span>Trang chủ</span>
      </RouterLink>

      <RouterLink class="member-nav__item" to="/withdraw">
        <span class="member-nav__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </span>
        <span>Rút Tiền</span>
      </RouterLink>

      <RouterLink class="member-nav__item" to="/support">
        <span class="member-nav__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.82.487 3.53 1.338 5L2 22l5-1.338A9.96 9.96 0 0012 22z"/>
          </svg>
        </span>
        <span>CSKH</span>
      </RouterLink>
    </nav>
  </div>

  <RouterView v-else />
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const userStore = useUserStore()

const usesMemberShell = computed(() => route.meta.layout === 'member')

onMounted(async () => {
  await userStore.restoreSession()
})
</script>

<style scoped>
.member-shell {
  position: relative;
  width: 100%;
  max-width: 414px;
  min-height: 100vh;
  margin: 0 auto;
  padding-bottom: 86px;
  background:
    radial-gradient(circle at top, rgba(50, 95, 168, 0.28), transparent 28%),
    linear-gradient(180deg, #1a3763 0, #170b34 148px, #170b34 100%);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.03), 0 24px 60px rgba(6, 10, 24, 0.44);
}

/* Header */
.member-header {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px 12px;
  background: linear-gradient(180deg, rgba(31, 60, 105, 0.98), rgba(31, 60, 105, 0.92));
  backdrop-filter: blur(12px);
}

.member-brand {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  color: #fff;
}

.member-brand img {
  width: 120px;
  height: auto;
}

.member-header__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.member-header__balance {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.member-header__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  text-decoration: none;
}

/* Main */
.member-main {
  min-height: calc(100vh - 152px);
}

/* Bottom Nav */
.member-nav {
  position: fixed;
  left: 50%;
  bottom: 0;
  z-index: 30;
  width: 100%;
  max-width: 414px;
  height: 78px;
  transform: translateX(-50%);
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: end;
  padding: 0 6px 8px;
  background: linear-gradient(180deg, rgba(23, 11, 52, 0.2), rgba(15, 8, 35, 0.98) 35%);
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.member-nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  text-decoration: none;
  color: rgba(200, 200, 220, 0.6);
  font-size: 11px;
  font-weight: 600;
  transition: color 0.15s;
}

.member-nav__item.router-link-exact-active {
  color: #fff;
}

.member-nav__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
}

/* Home button */
.member-nav__item--home {
  align-self: start;
}

.member-nav__home-circle {
  width: 60px;
  height: 60px;
  margin-top: -14px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ffd58b, #ff965f 50%, #e87040);
  box-shadow: 0 8px 24px rgba(232, 112, 64, 0.4);
  transition: box-shadow 0.2s;
}

.member-nav__item--home.router-link-exact-active .member-nav__home-circle {
  box-shadow: 0 8px 28px rgba(232, 112, 64, 0.55), 0 0 0 3px rgba(255, 255, 255, 0.1);
}

.member-nav__item--home span:last-child {
  margin-top: 2px;
}

@media (max-width: 414px) {
  .member-header {
    padding-left: 12px;
    padding-right: 12px;
  }

  .member-nav {
    padding-left: 4px;
    padding-right: 4px;
  }
}
</style>
