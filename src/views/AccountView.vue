<template>
  <section class="account-page">
    <!-- Thành Viên ribbon -->
    <div class="member-ribbon">
      <span class="member-ribbon__label">Thành Viên</span>
    </div>

    <!-- Avatar + Info card -->
    <div class="member-card">
      <div class="member-card__avatar">
        <div class="member-card__avatar-ring">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="32" cy="24" r="12" fill="rgba(255,255,255,0.85)"/>
            <path d="M12 56c0-11 9-20 20-20s20 9 20 20" fill="rgba(255,255,255,0.85)"/>
          </svg>
        </div>
      </div>
      <h2 class="member-card__username">{{ userStore.user?.username || 'Người chơi' }}</h2>
      <p class="member-card__balance">$ {{ Number(balance || 0).toFixed(0) }}</p>

      <div class="member-card__actions">
        <RouterLink class="member-card__action-btn" to="/deposit">
          <span class="member-card__action-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <line x1="12" y1="9" x2="12" y2="15"/>
              <line x1="9" y1="12" x2="15" y2="12"/>
            </svg>
          </span>
          <span>Nạp tiền</span>
        </RouterLink>
        <RouterLink class="member-card__action-btn" to="/withdraw">
          <span class="member-card__action-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <line x1="9" y1="12" x2="15" y2="12"/>
            </svg>
          </span>
          <span>Rút tiền</span>
        </RouterLink>
      </div>
    </div>

    <!-- Menu list -->
    <div class="menu-list">
      <RouterLink class="menu-item" to="/account">
        <span class="menu-item__icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>
          </svg>
        </span>
        <span class="menu-item__label">Lịch sử tham gia</span>
        <span class="menu-item__chevron">›</span>
      </RouterLink>

      <button class="menu-item" type="button" @click="showTransactionHistory('balance')">
        <span class="menu-item__icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <path d="M7 12h10M12 7v10"/>
          </svg>
        </span>
        <span class="menu-item__label">Biến động số dư</span>
        <span class="menu-item__chevron">›</span>
      </button>

      <button class="menu-item" type="button" @click="showTransactionHistory('deposit')">
        <span class="menu-item__icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M2 7h20v12H2z"/>
            <path d="M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2"/>
          </svg>
        </span>
        <span class="menu-item__label">Lịch sử nạp</span>
        <span class="menu-item__chevron">›</span>
      </button>

      <button class="menu-item" type="button" @click="showTransactionHistory('withdraw')">
        <span class="menu-item__icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="2" y="6" width="20" height="12" rx="2"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </span>
        <span class="menu-item__label">Lịch sử rút</span>
        <span class="menu-item__chevron">›</span>
      </button>

      <button class="menu-item" type="button" @click="showBankLink">
        <span class="menu-item__icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
          </svg>
        </span>
        <span class="menu-item__label">Liên kết ngân hàng</span>
        <span class="menu-item__chevron">›</span>
      </button>

      <button class="menu-item menu-item--logout" type="button" @click="handleLogout">
        <span class="menu-item__icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
        </span>
        <span class="menu-item__label">Đăng xuất</span>
        <span class="menu-item__chevron">›</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const balance = computed(() => userStore.balance)

function showTransactionHistory(type) {
  // Future: navigate to filtered transaction history
  alert('Tính năng đang phát triển')
}

function showBankLink() {
  router.push('/withdraw')
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.account-page {
  min-height: calc(100vh - 152px);
  padding: 0 0 20px;
  color: #fff;
}

/* Thành Viên ribbon */
.member-ribbon {
  display: flex;
  justify-content: center;
  padding: 18px 0 8px;
}

.member-ribbon__label {
  display: inline-block;
  padding: 6px 28px;
  background: linear-gradient(135deg, #c9a84c, #f0d98d, #c9a84c);
  color: #1a1a2e;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  border-radius: 0 0 12px 12px;
  box-shadow: 0 4px 12px rgba(201, 168, 76, 0.3);
}

/* Member card */
.member-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 8px 16px 0;
  padding: 20px 16px 24px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(30, 50, 90, 0.6), rgba(20, 30, 60, 0.8));
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.member-card__avatar {
  margin-bottom: 12px;
}

.member-card__avatar-ring {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  padding: 4px;
  background: linear-gradient(135deg, #c9a84c, #f0d98d, #c9a84c);
  display: flex;
  align-items: center;
  justify-content: center;
}

.member-card__avatar-ring svg {
  width: 56px;
  height: 56px;
  background: #1a2744;
  border-radius: 50%;
  padding: 4px;
}

.member-card__username {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.member-card__balance {
  margin: 8px 0 20px;
  font-size: 32px;
  font-weight: 800;
  color: #fff;
}

.member-card__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  width: 100%;
  max-width: 280px;
  padding: 12px 20px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.25);
}

.member-card__action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  transition: opacity 0.2s;
}

.member-card__action-btn:active {
  opacity: 0.7;
}

.member-card__action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
}

/* Menu list */
.menu-list {
  margin: 24px 16px 0;
  display: flex;
  flex-direction: column;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 4px;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: transparent;
  color: #fff;
  text-decoration: none;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
  width: 100%;
}

.menu-item:first-child {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.menu-item:active {
  background: rgba(255, 255, 255, 0.04);
}

.menu-item__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.7);
}

.menu-item__label {
  flex: 1;
}

.menu-item__chevron {
  font-size: 22px;
  color: rgba(255, 255, 255, 0.3);
  font-weight: 300;
}

.menu-item--logout {
  border-bottom: none;
}

.menu-item--logout .menu-item__label {
  color: rgba(255, 255, 255, 0.85);
}
</style>
