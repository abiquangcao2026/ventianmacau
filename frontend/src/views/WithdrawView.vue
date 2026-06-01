<template>
  <section class="withdraw-page">
    <div class="withdraw-hero">
      <div>
        <p class="withdraw-hero__eyebrow">Cashout</p>
        <h1>Rút tiền</h1>
        <strong class="withdraw-hero__balance">Số dư: {{ formatMoney(userStore.balance) }}</strong>
        <span>Khi gửi yêu cầu, số dư khả dụng sẽ bị trừ ngay. Nếu admin từ chối, tiền sẽ tự động hoàn về ví.</span>
      </div>
    </div>

    <div class="withdraw-card">
      <div class="withdraw-card__header">
        <h2>Yêu cầu rút tiền</h2>
        <small>Kiểm tra ngân hàng nhận tiền và mật khẩu rút trước khi gửi lệnh.</small>
      </div>

      <div class="withdraw-bank">
        <template v-if="hasLinkedBank">
          <p class="withdraw-bank__line">
            <strong>Ngân hàng:</strong> {{ linkedBank.bankName }}
            <RouterLink class="withdraw-bank__link" to="/addbank">Thay đổi</RouterLink>
          </p>
          <p class="withdraw-bank__line"><strong>STK:</strong> {{ maskAccount(linkedBank.bankAccount) }}</p>
          <p class="withdraw-bank__line"><strong>Chủ TK:</strong> {{ linkedBank.accountName }}</p>
        </template>
        <template v-else>
          <p class="withdraw-bank__line">Bạn chưa liên kết ngân hàng để rút tiền.</p>
          <RouterLink class="withdraw-bank__link withdraw-bank__link--primary" to="/addbank">Liên kết ngân hàng</RouterLink>
        </template>
      </div>

      <p v-if="!hasWithdrawPassword" class="withdraw-password-note">
        Tài khoản này chưa có mật khẩu rút tiền. Vui lòng liên hệ CSKH để kiểm tra.
      </p>

      <label class="withdraw-field">
        <span>Số tiền rút</span>
        <input v-model.number="amount" type="number" min="1" placeholder="Nhập số tiền rút" />
      </label>

      <button class="withdraw-submit" :disabled="submitting || !hasLinkedBank" @click="openWithdrawConfirm">
        {{ submitting ? 'Đang xử lý...' : 'Xác nhận rút tiền' }}
      </button>

      <p v-if="message" class="withdraw-message" :class="{ 'withdraw-message--error': isError }">
        {{ message }}
      </p>
    </div>

    <div class="withdraw-card">
      <div class="withdraw-card__header">
        <h2>Lịch sử rút tiền</h2>
        <small>{{ withdrawHistory.length }} giao dịch</small>
      </div>

      <div v-if="loadingHistory" class="withdraw-empty">Đang tải lịch sử...</div>
      <div v-else-if="withdrawHistory.length === 0" class="withdraw-empty">Chưa có yêu cầu rút tiền.</div>

      <div v-else class="withdraw-history">
        <article v-for="tx in withdrawHistory" :key="tx._id" class="withdraw-history__item">
          <div class="withdraw-history__top">
            <strong>{{ formatWithdrawStatus(tx) }}</strong>
            <span>{{ formatMoney(tx.amount) }}</span>
          </div>
          <div class="withdraw-history__meta">
            <span>{{ formatDate(tx.createdAt) }}</span>
            <span>{{ tx.meta?.bankName || linkedBank.bankName || '--' }}</span>
          </div>
          <p v-if="isRejectedWithdraw(tx)" class="withdraw-history__note">
            Lý do: {{ tx.meta?.adminNote || 'Liên hệ CSKH để kiểm tra' }}
          </p>
        </article>
      </div>
    </div>

    <div v-if="showPasswordModal" class="withdraw-modal" @click.self="closeWithdrawConfirm">
      <div class="withdraw-modal__dialog">
        <div class="withdraw-modal__head">
          <div>
            <strong>Xác nhận rút tiền</strong>
            <span>Kiểm tra thông tin trước khi nhập mật khẩu rút tiền.</span>
          </div>
          <button type="button" class="withdraw-modal__close" @click="closeWithdrawConfirm">×</button>
        </div>

        <div class="withdraw-modal__summary">
          <p><span>1. Quý khách đang thực hiện rút số tiền là:</span> <strong>{{ formatMoney(amount) }}</strong></p>
          <p><span>2. Ngân hàng:</span> <strong>{{ linkedBank.bankName || '--' }}</strong></p>
          <p><span>3. Số tài khoản:</span> <strong>{{ linkedBank.bankAccount || '--' }}</strong></p>
          <p><span>4. Họ và tên chủ tài khoản:</span> <strong>{{ linkedBank.accountName || '--' }}</strong></p>
        </div>

        <label class="withdraw-field withdraw-field--modal">
          <span>Quý khách vui lòng nhập mật khẩu rút tiền</span>
          <input v-model="withdrawPassword" type="password" autocomplete="current-password" placeholder="Nhập mật khẩu rút tiền" @keyup.enter="submitWithdraw" />
        </label>

        <div class="withdraw-modal__actions">
          <button class="withdraw-modal__ghost" type="button" @click="closeWithdrawConfirm">Hủy</button>
          <button class="withdraw-modal__submit" :disabled="submitting || !withdrawPassword" type="button" @click="submitWithdraw">
            {{ submitting ? 'Đang xử lý...' : 'Gửi lệnh rút' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { useUserStore } from '@/stores/user'
import { formatDateTimeVN } from '@/utils/vietnamTime'

const userStore = useUserStore()

const amount = ref(null)
const withdrawPassword = ref('')
const submitting = ref(false)
const loadingHistory = ref(false)
const message = ref('')
const isError = ref(false)
const showPasswordModal = ref(false)

const linkedBank = reactive({ bankName: '', bankAccount: '', accountName: '' })
const hasLinkedBank = computed(() => Boolean(linkedBank.bankName && linkedBank.bankAccount && linkedBank.accountName))
const hasWithdrawPassword = computed(() => Boolean(userStore.user?.hasWithdrawPassword))
const withdrawHistory = computed(() =>
  (userStore.transactions || []).filter((tx) =>
    ['withdraw_pending', 'withdraw', 'withdraw_rejected'].includes(String(tx.type || ''))
  )
)

function formatMoney(value) {
  return `${new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Number(value || 0))}$`
}

function formatDate(value) {
  return formatDateTimeVN(value)
}

function formatWithdrawStatus(tx) {
  if (tx.type === 'withdraw') return 'Rút thành công'
  if (tx.type === 'withdraw_rejected' || tx.status === 'rejected') return 'Từ chối'
  return 'Đang chờ duyệt'
}

function isRejectedWithdraw(tx) {
  return tx.type === 'withdraw_rejected' || tx.status === 'rejected'
}

function maskAccount(acc) {
  const value = String(acc || '').trim()
  if (!value) return ''
  if (value.length <= 4) return value
  return `****${value.slice(-4)}`
}

async function loadLinkedBank() {
  try {
    const data = await apiFetch('/api/account/bank', { headers: userStore.authHeaders })
    const bank = data.bank || {}
    linkedBank.bankName = bank.bankName || ''
    linkedBank.bankAccount = bank.bankAccount || ''
    linkedBank.accountName = bank.accountName || ''
  } catch {
    linkedBank.bankName = ''
    linkedBank.bankAccount = ''
    linkedBank.accountName = ''
  }
}

async function loadWithdrawHistory() {
  loadingHistory.value = true
  try {
    await userStore.fetchTransactions({ group: 'withdraw', limit: 100 })
  } finally {
    loadingHistory.value = false
  }
}

function validateWithdrawDraft() {
  message.value = ''
  isError.value = false

  if (!userStore.user?._id) {
    message.value = 'Không tìm thấy thông tin người dùng'
    isError.value = true
    return false
  }

  if (!amount.value || Number(amount.value) < 1) {
    message.value = 'Vui lòng nhập số tiền hợp lệ'
    isError.value = true
    return false
  }

  if (Number(amount.value) > Number(userStore.balance || 0)) {
    message.value = 'Số dư không đủ'
    isError.value = true
    return false
  }

  if (!hasLinkedBank.value) {
    message.value = 'Vui lòng liên kết ngân hàng trước khi rút tiền'
    isError.value = true
    return false
  }

  if (!hasWithdrawPassword.value) {
    message.value = 'Tài khoản chưa được thiết lập mật khẩu rút tiền'
    isError.value = true
    return false
  }

  return true
}

function openWithdrawConfirm() {
  if (!validateWithdrawDraft()) return
  withdrawPassword.value = ''
  showPasswordModal.value = true
}

function closeWithdrawConfirm() {
  if (submitting.value) return
  showPasswordModal.value = false
  withdrawPassword.value = ''
}

async function submitWithdraw() {
  if (!validateWithdrawDraft()) return

  if (!withdrawPassword.value) {
    message.value = 'Vui lòng nhập mật khẩu rút tiền'
    isError.value = true
    return
  }

  submitting.value = true
  try {
    await userStore.createWithdrawRequest({
      amount: Number(amount.value),
      bankName: linkedBank.bankName,
      bankAccount: linkedBank.bankAccount,
      accountName: linkedBank.accountName,
      withdrawPassword: withdrawPassword.value
    })
    submitting.value = false
    showPasswordModal.value = false
    withdrawPassword.value = ''
    isError.value = false
    message.value = 'Đã xác nhận mật khẩu rút tiền và gửi yêu cầu rút tiền thành công. Số dư khả dụng đã được trừ tạm giữ.'
    amount.value = null
    await loadWithdrawHistory()
  } catch (error) {
    message.value = error?.message || 'Không thể tạo yêu cầu rút tiền'
    isError.value = true
    if (String(error?.message || '').toLowerCase().includes('mật khẩu rút tiền')) {
      withdrawPassword.value = ''
    }
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    await userStore.fetchMe()
  } catch {
    // Keep current session state if profile refresh fails.
  }
  await Promise.all([loadLinkedBank(), loadWithdrawHistory()])
})
</script>

<style scoped>
.withdraw-page {
  min-height: calc(100vh - var(--member-header-height, 64px) - var(--member-nav-height, 86px));
  min-height: calc(100dvh - var(--member-header-height, 64px) - var(--member-nav-height, 86px));
  padding: 16px 16px 120px;
  color: #fff;
}

.withdraw-hero {
  display: block;
  padding: 20px 18px 22px;
  border-radius: 22px;
  background:
    radial-gradient(circle at top left, rgba(255, 173, 82, 0.24), transparent 34%),
    linear-gradient(135deg, rgba(48, 26, 80, 0.95), rgba(16, 16, 41, 0.96));
  border: 1px solid rgba(255, 214, 143, 0.14);
  box-shadow: 0 18px 40px rgba(13, 7, 33, 0.24);
}

.withdraw-hero__eyebrow {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #ffd688;
}

.withdraw-hero h1 {
  margin: 0;
  font-size: clamp(30px, 8vw, 42px);
  line-height: 1.05;
  font-weight: 900;
}

.withdraw-hero__balance {
  display: block;
  margin-top: 14px;
  font-size: clamp(22px, 6vw, 30px);
  line-height: 1.15;
  font-weight: 950;
  white-space: normal;
  word-break: break-word;
  color: #fff2aa;
}

.withdraw-hero span {
  display: block;
  margin-top: 12px;
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.72);
}

.withdraw-card {
  margin-top: 18px;
  padding: 18px;
  border-radius: 20px;
  background: rgba(11, 17, 42, 0.84);
  border: 1px solid rgba(145, 166, 219, 0.16);
}

.withdraw-card__header {
  margin-bottom: 14px;
}

.withdraw-card__header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
}

.withdraw-card__header small {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

.withdraw-bank {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.withdraw-bank__line {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
}

.withdraw-bank__line + .withdraw-bank__line {
  margin-top: 6px;
}

.withdraw-bank__link {
  margin-left: 10px;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 700;
  text-decoration: underline;
}

.withdraw-bank__link--primary {
  display: inline-block;
  margin: 10px 0 0;
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  color: #1f2d4f;
  font-weight: 800;
}

.withdraw-password-note {
  margin: 14px 0 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 189, 100, 0.16);
  border: 1px solid rgba(255, 201, 138, 0.34);
  color: rgba(255, 243, 225, 0.94);
  font-size: 12px;
  line-height: 1.55;
}

.withdraw-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
}

.withdraw-field span {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.withdraw-field input {
  height: 50px;
  padding: 0 18px;
  border: none;
  border-radius: 16px;
  background: #fff;
  color: #2b3b55;
  font-size: 15px;
  outline: none;
}

.withdraw-field input::placeholder {
  color: #a0a8b6;
}

.withdraw-submit {
  width: 100%;
  height: 54px;
  margin-top: 16px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #f7b44c, #ff7d6b);
  color: #fff;
  font-size: 17px;
  font-weight: 900;
  cursor: pointer;
}

.withdraw-submit:disabled {
  opacity: 0.6;
}

.withdraw-message {
  margin: 14px 0 0;
  text-align: center;
  font-size: 14px;
  color: #66e29a;
}

.withdraw-message--error {
  color: #ff8ba4;
}

.withdraw-empty {
  padding: 26px 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.withdraw-history {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.withdraw-history__item {
  padding: 14px 14px 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.withdraw-history__top,
.withdraw-history__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.withdraw-history__top strong {
  font-size: 14px;
  font-weight: 800;
}

.withdraw-history__top span {
  font-size: 15px;
  font-weight: 900;
  color: #fff0aa;
}

.withdraw-history__meta {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.52);
}

.withdraw-history__note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #ffb6b6;
}

.withdraw-modal {
  position: fixed;
  inset: 0;
  z-index: 10020;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(5, 10, 26, 0.62);
  backdrop-filter: blur(8px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.withdraw-modal__dialog {
  width: min(100%, 420px);
  max-height: calc(100dvh - 40px);
  padding: 20px;
  border-radius: 24px;
  background: linear-gradient(180deg, #101a42, #0a1027);
  border: 1px solid rgba(145, 166, 219, 0.18);
  box-shadow: 0 24px 40px rgba(4, 8, 18, 0.34);
  overflow-y: auto;
}

.withdraw-modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.withdraw-modal__head strong,
.withdraw-modal__head span {
  display: block;
}

.withdraw-modal__head strong {
  font-size: 18px;
  font-weight: 900;
}

.withdraw-modal__head span {
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.64);
  font-size: 13px;
}

.withdraw-modal__summary {
  display: grid;
  gap: 10px;
  margin-top: 16px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
}

.withdraw-modal__summary p {
  display: grid;
  gap: 3px;
  margin: 0;
  color: rgba(255,255,255,0.72);
  font-size: 13px;
  line-height: 1.35;
}

.withdraw-modal__summary strong {
  color: #fff6bd;
  font-size: 15px;
  font-weight: 900;
  overflow-wrap: anywhere;
}

.withdraw-modal__close {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 22px;
}

.withdraw-field--modal {
  margin-top: 18px;
}

.withdraw-modal__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 18px;
}

.withdraw-modal__ghost,
.withdraw-modal__submit {
  height: 48px;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 800;
}

.withdraw-modal__ghost {
  border: 1px solid rgba(255,255,255,0.14);
  background: transparent;
  color: rgba(255,255,255,0.82);
}

.withdraw-modal__submit {
  border: none;
  background: linear-gradient(135deg, #f7b44c, #ff7d6b);
  color: #fff;
}

@media (max-width: 480px) {
  .withdraw-page {
    padding: 14px 14px 120px;
  }

  .withdraw-hero {
    padding: 18px 18px 20px;
  }

  .withdraw-card {
    margin-top: 16px;
    padding: 16px;
  }

  .withdraw-bank__line {
    overflow-wrap: anywhere;
  }

  .withdraw-modal {
    padding: 14px;
    align-items: center;
  }

  .withdraw-modal__dialog {
    width: 100%;
    padding: 18px;
    border-radius: 22px;
  }
}
</style>
