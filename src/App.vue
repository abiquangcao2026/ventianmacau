<template>
  <div v-if="usesMemberShell" class="member-shell">
    <header class="member-header">
      <RouterLink class="member-brand" to="/">
        <img alt="The Venetian" src="/img/the-venetian-wordmark.svg" />
      </RouterLink>

      <!-- Đã đăng nhập: hiện balance + icons -->
      <div v-if="userStore.isLoggedIn" class="member-header__right">
        <span class="member-header__balance">$ {{ Number(userStore.balance || 0).toFixed(0) }}</span>
        <RouterLink class="member-header__icon-btn" to="/support">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 12a8 8 0 0116 0v5a3 3 0 01-3 3h-2"/>
            <path d="M4 12v3a2 2 0 002 2h1v-7H6a2 2 0 00-2 2z"/>
            <path d="M20 12v3a2 2 0 01-2 2h-1v-7h1a2 2 0 012 2z"/>
          </svg>
        </RouterLink>
        <RouterLink class="member-header__icon-btn" to="/account">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21a8 8 0 00-16 0"/>
            <path d="M12 11a4 4 0 100-8 4 4 0 000 8z"/>
          </svg>
        </RouterLink>
      </div>

      <!-- Chưa đăng nhập: hiện nút Đăng nhập / Đăng ký -->
      <div v-else class="member-header__right">
        <RouterLink class="member-header__auth-btn" to="/login">Đăng nhập</RouterLink>
        <RouterLink class="member-header__auth-btn member-header__auth-btn--primary" to="/signup">Đăng ký</RouterLink>
      </div>
    </header>

    <main class="member-main">
      <RouterView />
    </main>

    <nav class="member-nav">
      <RouterLink class="member-nav__item" to="/account">
        <span class="member-nav__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21a8 8 0 00-16 0"/>
            <path d="M12 11a4 4 0 100-8 4 4 0 000 8z"/>
          </svg>
        </span>
        <span>Tài Khoản</span>
      </RouterLink>

      <RouterLink class="member-nav__item" to="/deposit">
        <span class="member-nav__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v9"/>
            <path d="M8.8 9.6L12 12.8l3.2-3.2"/>
            <path d="M4 14v4a3 3 0 003 3h10a3 3 0 003-3v-4"/>
            <path d="M4 14h16"/>
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 21V12"/>
            <path d="M8.8 15.2L12 12l3.2 3.2"/>
            <path d="M4 10V6a3 3 0 013-3h10a3 3 0 013 3v4"/>
            <path d="M4 10h16"/>
          </svg>
        </span>
        <span>Rút Tiền</span>
      </RouterLink>

      <RouterLink class="member-nav__item" to="/support">
        <span class="member-nav__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 12a8 8 0 0116 0v5a3 3 0 01-3 3h-2"/>
            <path d="M4 12v3a2 2 0 002 2h1v-7H6a2 2 0 00-2 2z"/>
            <path d="M20 12v3a2 2 0 01-2 2h-1v-7h1a2 2 0 012 2z"/>
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
  max-width: 520px;
  min-height: 100vh;
  margin: 0 auto;
  padding-bottom: calc(86px + env(safe-area-inset-bottom, 0px));
  background:
    radial-gradient(circle at top, rgba(50, 95, 168, 0.28), transparent 28%),
    linear-gradient(180deg, #1a3763 0, #170b34 148px, #170b34 100%);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.03), 0 24px 60px rgba(6, 10, 24, 0.44);
}

/* Header */
.member-header {
  position: sticky;
  top: 0;
  z-index: 9991;
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

.member-header__auth-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s;
  white-space: nowrap;
}

.member-header__auth-btn:active {
  background: rgba(255, 255, 255, 0.2);
}

.member-header__auth-btn--primary {
  background: linear-gradient(135deg, #ffd58b, #ff965f);
  color: #1a1a2e;
}

.member-header__auth-btn--primary:active {
  background: linear-gradient(135deg, #ffc96b, #f0854f);
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
  z-index: 9990;
  width: 100%;
  max-width: 520px;
  height: calc(78px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: end;
  padding: 0 6px calc(8px + env(safe-area-inset-bottom, 0px));
  background: #0e0820;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
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

@media (max-width: 520px) {
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
