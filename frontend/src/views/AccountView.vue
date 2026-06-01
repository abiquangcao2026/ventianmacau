<template>
  <section class="account-page">
    <!-- === PANEL LỊCH SỬ === -->
    <div v-if="accountPanel" class="history-panel">
      <div class="history-panel__header">
        <button class="history-panel__back" @click="closeAccountPanel">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h2 class="history-panel__title">Thông tin tài khoản</h2>
      </div>

      <div class="account-form-card">
        <label class="account-field">
          <span>ID</span>
          <input :value="userStore.user?.userCode || '--'" type="text" disabled />
        </label>

        <label class="account-field">
          <span>Số điện thoại liên kết</span>
          <input v-model="accountProfileForm.phone" type="text" placeholder="Nhập số điện thoại liên kết" />
        </label>

        <label class="account-field">
          <span>Họ tên tài khoản</span>
          <input v-model="accountProfileForm.fullName" type="text" placeholder="Nhập họ tên" />
        </label>

        <div class="account-bank-card">
          <strong>Thông tin tài khoản ngân hàng</strong>
          <span>{{ accountBankSummary }}</span>
          <RouterLink class="account-bank-card__link" to="/support">Liên hệ CSKH để đổi tài khoản ngân hàng</RouterLink>
        </div>

        <label class="account-field">
          <span>Đổi mật khẩu đăng nhập</span>
          <input v-model="accountSecurityForm.password" type="password" placeholder="Để trống nếu không đổi" />
        </label>

        <label class="account-field">
          <span>Đổi mật khẩu rút tiền</span>
          <input v-model="accountSecurityForm.withdrawPassword" type="password" placeholder="Để trống nếu không đổi" />
        </label>

        <p v-if="accountPanelMessage" class="account-panel-message" :class="{ 'account-panel-message--error': accountPanelError }">
          {{ accountPanelMessage }}
        </p>

        <div class="account-panel-actions">
          <button class="account-panel-btn account-panel-btn--primary" :disabled="savingAccountPanel" @click="saveAccountPanel">
            {{ savingAccountPanel ? 'Đang lưu...' : 'Lưu' }}
          </button>
          <button class="account-panel-btn" type="button" @click="closeAccountPanel">Thoát</button>
        </div>
      </div>
    </div>

    <div v-else-if="historyPanel" class="history-panel">
      <div class="history-panel__header">
        <button class="history-panel__back" @click="historyPanel = null">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h2 class="history-panel__title">{{ historyTitle }}</h2>
      </div>

      <div v-if="loadingHistory" class="history-panel__empty">Đang tải...</div>
      <div v-else-if="filteredHistory.length === 0" class="history-panel__empty">Chưa có giao dịch nào.</div>

      <div v-else class="history-list">
        <article v-for="tx in filteredHistory" :key="tx._id" class="history-item">
          <div class="history-item__left">
            <span class="history-item__type" :class="typeClass(tx.type)">{{ typeLabel(tx.type) }}</span>
            <span class="history-item__date">{{ fmtDate(tx.createdAt) }}</span>
          </div>
          <div class="history-item__right">
            <strong class="history-item__amount" :class="tx.amount >= 0 ? 'is-plus' : 'is-minus'">
              {{ tx.amount >= 0 ? '+' : '' }}{{ fmtMoney(tx.amount) }}
            </strong>
            <span class="history-item__balance">Sau: {{ fmtMoney(tx.balanceAfter) }}</span>
          </div>
        </article>
      </div>
    </div>

    <!-- === TRANG CHÍNH === -->
    <template v-else>
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
                <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/>
              </svg>
            </span>
            <span>Nạp tiền</span>
          </RouterLink>
          <RouterLink class="member-card__action-btn" to="/withdraw">
            <span class="member-card__action-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="9" y1="12" x2="15" y2="12"/>
              </svg>
            </span>
            <span>Rút tiền</span>
          </RouterLink>
        </div>
      </div>

      <!-- Menu list -->
      <div class="menu-list">
        <button class="menu-item" type="button" @click="openAccountPanel">
          <span class="menu-item__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 12a4 4 0 100-8 4 4 0 000 8z"/><path d="M4 21a8 8 0 0116 0"/><path d="M17 8h4M19 6v4"/></svg>
          </span>
          <span class="menu-item__label">Thông tin tài khoản</span>
          <span class="menu-item__chevron">›</span>
        </button>

        <button class="menu-item" type="button" @click="openHistory('bets')">
          <span class="menu-item__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg>
          </span>
          <span class="menu-item__label">Lịch sử tham gia</span>
          <span class="menu-item__chevron">›</span>
        </button>

        <button class="menu-item" type="button" @click="openHistory('all')">
          <span class="menu-item__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 12h10M12 7v10"/></svg>
          </span>
          <span class="menu-item__label">Biến động số dư</span>
          <span class="menu-item__chevron">›</span>
        </button>

        <button class="menu-item" type="button" @click="openHistory('deposit')">
          <span class="menu-item__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 7h20v12H2z"/><path d="M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2"/></svg>
          </span>
          <span class="menu-item__label">Lịch sử nạp</span>
          <span class="menu-item__chevron">›</span>
        </button>

        <button class="menu-item" type="button" @click="openHistory('withdraw')">
          <span class="menu-item__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
          </span>
          <span class="menu-item__label">Lịch sử rút</span>
          <span class="menu-item__chevron">›</span>
        </button>

        <RouterLink class="menu-item" to="/addbank">
          <span class="menu-item__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>
          </span>
          <span class="menu-item__label">Liên kết ngân hàng</span>
          <span class="menu-item__chevron">›</span>
        </RouterLink>

        <button class="menu-item menu-item--logout" type="button" @click="handleLogout">
          <span class="menu-item__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          </span>
          <span class="menu-item__label">Đăng xuất</span>
          <span class="menu-item__chevron">›</span>
        </button>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { apiFetch } from '@/lib/api'
import { RouterLink, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { formatDateTimeVN } from '@/utils/vietnamTime'

const router = useRouter()
const userStore = useUserStore()
const balance = computed(() => userStore.balance)
const accountPanel = ref(false)
const savingAccountPanel = ref(false)
const accountPanelMessage = ref('')
const accountPanelError = ref(false)
const accountProfileForm = reactive({
  fullName: '',
  phone: ''
})
const accountSecurityForm = reactive({
  password: '',
  withdrawPassword: ''
})

// --- History panel ---
const historyPanel = ref(null)   // null | 'all' | 'deposit' | 'withdraw' | 'bets'
const loadingHistory = ref(false)
const allTransactions = computed(() => userStore.transactions || [])

const TITLES = {
  all: 'Biến động số dư',
  deposit: 'Lịch sử nạp',
  withdraw: 'Lịch sử rút',
  bets: 'Lịch sử tham gia'
}

const DEPOSIT_TYPES = ['deposit_pending', 'deposit', 'deposit_rejected']
const WITHDRAW_TYPES = ['withdraw_pending', 'withdraw', 'withdraw_rejected']
const BET_TYPES = ['bet', 'win', 'refund']

const historyTitle = computed(() => TITLES[historyPanel.value] || 'Giao dịch')
const accountBankSummary = computed(() => {
  const bank = userStore.user?.linkedBank || {}
  if (!bank.bankName || !bank.bankAccount || !bank.accountName) {
    return 'Chưa liên kết tài khoản ngân hàng'
  }
  return `${bank.bankName} · ${bank.bankAccount} · ${bank.accountName}`
})

const filteredHistory = computed(() => {
  const items = allTransactions.value
  const panel = historyPanel.value
  if (panel === 'deposit') return items.filter(t => DEPOSIT_TYPES.includes(t.type))
  if (panel === 'withdraw') return items.filter(t => WITHDRAW_TYPES.includes(t.type))
  if (panel === 'bets') return items.filter(t => BET_TYPES.includes(t.type))
  return items // 'all'
})

async function openHistory(type) {
  accountPanel.value = false
  historyPanel.value = type
  loadingHistory.value = true
  try {
    await userStore.fetchTransactions({
      group: ['deposit', 'withdraw', 'bets'].includes(type) ? type : 'all',
      limit: 100
    })
  } catch {
    userStore.setTransactions([])
  } finally {
    loadingHistory.value = false
  }
}

function syncAccountPanelForm() {
  accountProfileForm.fullName = String(userStore.user?.fullName || '')
  accountProfileForm.phone = String(userStore.user?.phone || '')
  accountSecurityForm.password = ''
  accountSecurityForm.withdrawPassword = ''
}

function openAccountPanel() {
  historyPanel.value = null
  accountPanelMessage.value = ''
  accountPanelError.value = false
  syncAccountPanelForm()
  accountPanel.value = true
}

function closeAccountPanel() {
  accountPanel.value = false
  accountPanelMessage.value = ''
  accountPanelError.value = false
}

async function saveAccountPanel() {
  if (savingAccountPanel.value) return

  savingAccountPanel.value = true
  accountPanelMessage.value = ''
  accountPanelError.value = false

  try {
    await apiFetch('/api/account/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...userStore.authHeaders
      },
      body: JSON.stringify({
        fullName: accountProfileForm.fullName,
        phone: accountProfileForm.phone,
        displayName: userStore.user?.displayName || '',
        characterName: userStore.user?.characterName || ''
      })
    })

    if (accountSecurityForm.password || accountSecurityForm.withdrawPassword) {
      await apiFetch('/api/account/security', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...userStore.authHeaders
        },
        body: JSON.stringify({
          password: accountSecurityForm.password,
          withdrawPassword: accountSecurityForm.withdrawPassword
        })
      })
    }

    await userStore.fetchMe()
    syncAccountPanelForm()
    accountPanelMessage.value = 'Đã gửi cập nhật thông tin tài khoản thành công.'
  } catch (error) {
    accountPanelMessage.value = error?.message || 'Không thể lưu thông tin tài khoản'
    accountPanelError.value = true
  } finally {
    savingAccountPanel.value = false
  }
}

// --- Helpers ---
const TYPE_LABELS = {
  deposit_pending: 'Yêu cầu nạp',
  deposit: 'Nạp thành công',
  deposit_rejected: 'Từ chối nạp',
  withdraw_pending: 'Yêu cầu rút',
  withdraw: 'Rút thành công',
  withdraw_rejected: 'Từ chối rút',
  bet: 'Đặt cược',
  win: 'Thắng cược',
  refund: 'Hoàn cược'
}

function typeLabel(type) { return TYPE_LABELS[type] || type || 'Giao dịch' }

function typeClass(type) {
  if (type === 'deposit' || type === 'win' || type === 'refund') return 'type-green'
  if (type === 'deposit_rejected' || type === 'withdraw_rejected') return 'type-red'
  if (type === 'bet' || type === 'withdraw') return 'type-orange'
  return ''
}

function fmtMoney(v) { return new Intl.NumberFormat('vi-VN').format(Number(v || 0)) + '$' }
function fmtDate(v) { return formatDateTimeVN(v) }

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.account-page {
  min-height: calc(100vh - var(--member-header-height, 64px) - var(--member-nav-height, 86px));
  min-height: calc(100dvh - var(--member-header-height, 64px) - var(--member-nav-height, 86px));
  padding: 0 0 20px;
  color: #fff;
}

/* ===== HISTORY PANEL ===== */
.history-panel {
  padding: 0 16px 20px;
}

.history-panel__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 0 14px;
}

.history-panel__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: rgba(255,255,255,0.08);
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
}

.history-panel__back:active {
  background: rgba(255,255,255,0.14);
}

.history-panel__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.account-form-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 16px;
  border-radius: 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
}

.account-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.account-field span {
  font-size: 12px;
  color: rgba(255,255,255,0.62);
  font-weight: 700;
  text-transform: uppercase;
}

.account-field input {
  height: 46px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  background: rgba(255,255,255,0.96);
  color: #1f2d4f;
  padding: 0 14px;
  font-size: 14px;
  outline: none;
}

.account-field input:disabled {
  opacity: 0.65;
}

.account-bank-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
}

.account-bank-card strong {
  font-size: 13px;
}

.account-bank-card span {
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255,255,255,0.72);
}

.account-bank-card__link {
  color: #ffd985;
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
}

.account-panel-message {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #7cf0aa;
}

.account-panel-message--error {
  color: #ff9aa8;
}

.account-panel-actions {
  display: flex;
  gap: 10px;
}

.account-panel-btn {
  flex: 1;
  height: 46px;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 14px;
  background: transparent;
  color: #fff;
  font-size: 14px;
  font-weight: 800;
}

.account-panel-btn--primary {
  background: linear-gradient(135deg, #f4c859, #f19a44);
  color: #1f2144;
  border-color: transparent;
}

.history-panel__empty {
  padding: 40px 0;
  text-align: center;
  color: rgba(255,255,255,0.45);
  font-size: 14px;
}

.history-list {
  display: flex;
  flex-direction: column;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.history-item:last-child {
  border-bottom: none;
}

.history-item__left,
.history-item__right {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.history-item__right {
  align-items: flex-end;
  flex-shrink: 0;
}

.history-item__type {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
}

.history-item__type.type-green { color: #6ee7a0; }
.history-item__type.type-red   { color: #ff8a8a; }
.history-item__type.type-orange { color: #ffb86c; }

.history-item__date {
  font-size: 12px;
  color: rgba(255,255,255,0.4);
}

.history-item__amount {
  font-size: 15px;
  font-weight: 700;
}

.history-item__amount.is-plus  { color: #6ee7a0; }
.history-item__amount.is-minus { color: #ff8a8a; }

.history-item__balance {
  font-size: 11px;
  color: rgba(255,255,255,0.35);
}

/* ===== MAIN PAGE ===== */

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
