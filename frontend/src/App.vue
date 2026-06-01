<template>
  <div v-if="usesMemberShell" class="member-shell">
    <header class="member-header">
      <RouterLink class="member-brand" to="/">
        <img alt="The Venetian" src="/img/the-venetian-wordmark.svg" />
      </RouterLink>

      <!-- Đã đăng nhập: hiện balance + icons -->
      <div v-if="userStore.isLoggedIn" class="member-header__right">
        <span class="member-header__balance">
          <em aria-hidden="true">$</em>
          {{ Number(userStore.balance || 0).toFixed(0) }}
        </span>
        <RouterLink class="member-header__icon-btn" to="/deposit" aria-label="Nạp tiền">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <path d="M12 5v14"/>
            <path d="M5 12h14"/>
          </svg>
        </RouterLink>
        <RouterLink class="member-header__icon-btn" to="/support" aria-label="CSKH">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 12a8 8 0 0116 0v5a3 3 0 01-3 3h-2"/>
            <path d="M4 12v3a2 2 0 002 2h1v-7H6a2 2 0 00-2 2z"/>
            <path d="M20 12v3a2 2 0 01-2 2h-1v-7h1a2 2 0 012 2z"/>
          </svg>
        </RouterLink>
        <RouterLink class="member-header__icon-btn" to="/account" aria-label="Cài đặt tài khoản">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"/>
            <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1.03 1.56V21a2 2 0 01-4 0v-.08a1.7 1.7 0 00-1.03-1.56 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.56-1.03H3a2 2 0 010-4h.08A1.7 1.7 0 004.6 8a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 012.83-2.83l.06.06A1.7 1.7 0 008.96 3a1.7 1.7 0 001.03-1.56V1.4a2 2 0 014 0v.04A1.7 1.7 0 0015.04 3a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 012.83 2.83l-.06.06A1.7 1.7 0 0019.4 8c.2.62.78 1.03 1.44 1.03H21a2 2 0 010 4h-.08A1.7 1.7 0 0019.4 15z"/>
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
import { computed, onMounted, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useSocketStore } from '@/stores/socket'

const route = useRoute()
const userStore = useUserStore()
const socketStore = useSocketStore()

const usesMemberShell = computed(() => route.meta.layout === 'member')

onMounted(async () => {
  await userStore.restoreSession()
})

watch(
  () => userStore.isLoggedIn,
  (isLoggedIn) => {
    if (isLoggedIn) {
      socketStore.connect()
      socketStore.ensureSocketAuth()
      return
    }

    socketStore.disconnect()
  },
  { immediate: true }
)
</script>

<style scoped>
.member-shell {
  --member-safe-bottom: env(safe-area-inset-bottom, 0px);
  --member-header-height: 64px;
  --member-nav-height: calc(78px + var(--member-safe-bottom));
  position: relative;
  width: 100%;
  max-width: min(520px, 100vw);
  min-width: 0;
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0 auto;
  padding-bottom: var(--member-nav-height);
  background:
    radial-gradient(circle at top, rgba(50, 95, 168, 0.28), transparent 28%),
    linear-gradient(180deg, #1a3763 0, #170b34 148px, #170b34 100%);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.03), 0 24px 60px rgba(6, 10, 24, 0.44);
  overflow-x: clip;
}

/* Header */
.member-header {
  position: sticky;
  top: 0;
  z-index: 9991;
  display: flex;
  width: 100%;
  min-width: 0;
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
  min-width: 0;
}

.member-brand img {
  width: 120px;
  height: auto;
}

.member-header__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
  min-width: 0;
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
  min-width: 0;
  min-height: calc(100vh - var(--member-header-height) - var(--member-nav-height));
  min-height: calc(100dvh - var(--member-header-height) - var(--member-nav-height));
  display: flex;
  flex-direction: column;
}

/* Bottom Nav */
.member-nav {
  position: fixed;
  left: 50%;
  bottom: 0;
  z-index: 9990;
  width: 100%;
  max-width: min(520px, 100vw);
  height: var(--member-nav-height);
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
  min-width: 0;
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
  .member-shell {
    --member-header-height: 58px;
    width: 100%;
    max-width: none;
    margin: 0;
    overflow-x: hidden;
  }

  .member-main {
    width: 100%;
    max-width: none;
    overflow-x: hidden;
  }

  .member-header {
    padding-left: 12px;
    padding-right: 12px;
    gap: 8px;
  }

  .member-brand img {
    width: 108px;
  }

  .member-header__right {
    flex: 1 1 auto;
    justify-content: flex-end;
    gap: 6px;
    overflow: hidden;
  }

  .member-header__balance {
    max-width: clamp(96px, 38vw, 150px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-left: 8px;
    padding-right: 8px;
    font-size: 13px;
  }

  .member-header__icon-btn {
    width: 32px;
    height: 32px;
    flex: 0 0 32px;
  }

  .member-header__auth-btn {
    flex: 0 1 auto;
    min-width: 0;
    padding: 6px 10px;
    font-size: 12px;
  }

  .member-nav {
    left: 0;
    width: 100%;
    max-width: none;
    transform: none;
    padding-left: 4px;
    padding-right: 4px;
  }

  .member-nav__item {
    min-width: 0;
    font-size: 10px;
  }

  .member-nav__item span:last-child {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@media (max-width: 768px) {
  .member-shell {
    width: 100%;
    max-width: none;
    margin: 0;
    overflow-x: hidden;
  }

  .member-main {
    width: 100%;
    max-width: none;
    overflow-x: hidden;
  }

  .member-nav {
    left: 0;
    width: 100%;
    max-width: none;
    transform: none;
  }
}

/* Premium casino mobile shell */
.member-shell {
  background:
    radial-gradient(circle at 50% 0%, rgba(37, 132, 255, 0.32), transparent 30%),
    radial-gradient(circle at 88% 34%, rgba(182, 69, 255, 0.14), transparent 28%),
    linear-gradient(180deg, #07142d 0%, #0a1a3d 44%, #070d22 100%);
}

.member-header {
  background:
    linear-gradient(180deg, rgba(11, 31, 68, 0.98), rgba(8, 24, 55, 0.96));
  border-bottom: 1px solid rgba(78, 164, 255, 0.16);
  box-shadow: 0 14px 30px rgba(0, 5, 19, 0.28);
}

.member-brand img {
  filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.2));
}

.member-header__balance {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 13px;
  border: 1px solid rgba(80, 160, 255, 0.22);
  border-radius: 999px;
  background:
    radial-gradient(circle at 20% 18%, rgba(255, 218, 111, 0.18), transparent 32%),
    linear-gradient(180deg, rgba(29, 62, 126, 0.95), rgba(13, 34, 77, 0.95));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 8px 20px rgba(0, 7, 28, 0.26);
  color: #ffe4a3;
  font-weight: 900;
  letter-spacing: 0.01em;
}

.member-header__balance em {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 999px;
  background: linear-gradient(180deg, #ffd86b, #f59d17);
  color: #613b00;
  font-style: normal;
  font-size: 13px;
  box-shadow: 0 0 14px rgba(248, 180, 0, 0.42);
}

.member-header__icon-btn {
  width: 38px;
  height: 38px;
  border: 1px solid rgba(93, 176, 255, 0.2);
  border-radius: 13px;
  background:
    linear-gradient(180deg, rgba(36, 72, 142, 0.96), rgba(17, 42, 92, 0.96));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 8px 18px rgba(0, 8, 30, 0.24);
  color: #eef7ff;
}

.member-header__icon-btn:active {
  transform: translateY(1px) scale(0.98);
}

.member-nav {
  background:
    linear-gradient(180deg, rgba(9, 24, 57, 0.98), rgba(8, 4, 25, 0.99));
  border-top: 1px solid rgba(81, 162, 255, 0.18);
  box-shadow: 0 -18px 38px rgba(0, 7, 28, 0.44);
}

.member-nav__item {
  color: rgba(188, 205, 236, 0.62);
}

.member-nav__item.router-link-exact-active {
  color: #ffffff;
  text-shadow: 0 0 12px rgba(57, 160, 255, 0.48);
}

.member-nav__home-circle {
  background:
    radial-gradient(circle at 32% 28%, rgba(255,255,255,0.42), transparent 28%),
    linear-gradient(135deg, #ffce5a, #ff8a3d 58%, #e85f2d);
  box-shadow:
    0 10px 28px rgba(255, 138, 61, 0.44),
    0 0 0 7px rgba(255, 138, 61, 0.12);
}

.member-nav__item--home.router-link-exact-active .member-nav__home-circle {
  box-shadow:
    0 12px 34px rgba(255, 138, 61, 0.58),
    0 0 0 7px rgba(255, 138, 61, 0.16),
    0 0 30px rgba(31, 136, 255, 0.36);
}

@media (max-width: 520px) {
  .member-header__balance {
    height: 34px;
    max-width: clamp(92px, 34vw, 142px);
    font-size: 13px;
  }

  .member-header__balance em {
    width: 19px;
    height: 19px;
    font-size: 11px;
  }

  .member-header__icon-btn {
    width: 32px;
    height: 32px;
    flex-basis: 32px;
    border-radius: 11px;
  }
}

/* Compact member shell for game screens */
.member-shell {
  --member-header-height: 56px;
  --member-nav-height: calc(64px + var(--member-safe-bottom));
}

.member-header {
  height: 56px;
  min-height: 56px;
  padding: 8px 12px;
}

.member-brand img {
  width: 104px;
}

.member-header__right {
  gap: 6px;
}

.member-header__balance {
  height: 34px;
  padding: 0 10px;
  font-size: 13px;
}

.member-header__icon-btn {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 11px;
}

.member-nav {
  height: var(--member-nav-height);
  padding: 0 5px calc(5px + env(safe-area-inset-bottom, 0px));
}

.member-nav__icon {
  width: 24px;
  height: 24px;
}

.member-nav__item {
  gap: 2px;
  font-size: 10px;
}

.member-nav__home-circle {
  width: 50px;
  height: 50px;
  margin-top: -10px;
}
</style>
