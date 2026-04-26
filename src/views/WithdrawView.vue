<template>
  <section class="withdraw-page">
    <!-- Balance card -->
    <div class="balance-card">
      <div class="balance-card__inner">
        <div class="balance-card__top">
          <span class="balance-card__label">Số dư khả dụng</span>
          <p class="balance-card__amount">$ {{ Number(userStore.balance || 0).toLocaleString() }}</p>
        </div>
        <div class="balance-card__bottom">
          <span class="balance-card__card-icon">
            <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
              <rect width="32" height="24" rx="4" fill="#4CAF50" opacity="0.8"/>
              <rect x="2" y="6" width="12" height="8" rx="1" fill="#FFD700" opacity="0.6"/>
              <rect x="18" y="14" width="12" height="2" rx="1" fill="rgba(255,255,255,0.5)"/>
            </svg>
          </span>
          <span class="balance-card__username">{{ userStore.user?.username || 'Người chơi' }}</span>
        </div>
      </div>
    </div>

    <!-- Withdraw form -->
    <div class="withdraw-form">
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

      <label class="withdraw-field">
        <span>Số tiền rút</span>
        <input v-model.number="amount" type="number" min="1" placeholder="Nhập số tiền rút" />
      </label>

      <label class="withdraw-field">
        <span>Mật khẩu rút tiền</span>
        <input v-model="withdrawPassword" type="password" placeholder="Nhập mật khẩu rút tiền" />
      </label>
    </div>

    <button class="withdraw-submit" :disabled="submitting || !hasLinkedBank" @click="submitWithdraw">
      {{ submitting ? 'Đang xử lý...' : 'Gửi Yêu Cầu Rút Tiền' }}
    </button>

    <p v-if="message" class="withdraw-message" :class="{ 'withdraw-message--error': isError }">
      {{ message }}
    </p>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const amount = ref(null)
const withdrawPassword = ref('')
const submitting = ref(false)
const message = ref('')
const isError = ref(false)

const linkedBank = reactive({ bankName: '', bankAccount: '', accountName: '' })
const hasLinkedBank = computed(() => Boolean(linkedBank.bankName && linkedBank.bankAccount && linkedBank.accountName))

function maskAccount(acc) {
  const value = String(acc || '').trim()
  if (!value) return ''
  if (value.length <= 4) return value
  return '****' + value.slice(-4)
}

// Load linked bank (separate screen: /addbank)
async function loadLinkedBank() {
  try {
    const data = await apiFetch('/api/account/bank', { headers: userStore.authHeaders })
    const bank = data.bank || {}
    linkedBank.bankName = bank.bankName || ''
    linkedBank.bankAccount = bank.bankAccount || ''
    linkedBank.accountName = bank.accountName || ''
  } catch {
    // Ignore
  }
}

async function submitWithdraw() {
  message.value = ''
  isError.value = false

  if (!userStore.user?._id) {
    message.value = 'Không tìm thấy thông tin người dùng'
    isError.value = true
    return
  }

  if (!amount.value || Number(amount.value) < 1) {
    message.value = 'Vui lòng nhập số tiền hợp lệ'
    isError.value = true
    return
  }

  if (Number(amount.value) > Number(userStore.balance || 0)) {
    message.value = 'Số dư không đủ'
    isError.value = true
    return
  }

  if (!hasLinkedBank.value) {
    message.value = 'Vui lòng liên kết ngân hàng trước khi rút tiền'
    isError.value = true
    return
  }

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
    message.value = 'Đã gửi yêu cầu rút tiền thành công!'
    isError.value = false
    amount.value = null
    withdrawPassword.value = ''
  } catch (error) {
    message.value = error?.message || 'Không thể tạo yêu cầu rút tiền'
    isError.value = true
  } finally {
    submitting.value = false
  }
}

onMounted(loadLinkedBank)
</script>

<style scoped>
.withdraw-page {
  min-height: calc(100vh - 152px);
  padding: 16px 16px 120px;
  color: #fff;
}

/* Linked bank (simple) */
.withdraw-bank {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
}

.withdraw-bank__line {
  margin: 0;
  font-size: 13px;
  color: rgba(255,255,255,0.85);
}

.withdraw-bank__line + .withdraw-bank__line {
  margin-top: 6px;
}

.withdraw-bank__link {
  margin-left: 10px;
  color: rgba(255,255,255,0.95);
  font-weight: 700;
  text-decoration: underline;
}

.withdraw-bank__link--primary {
  display: inline-block;
  margin: 10px 0 0;
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255,255,255,0.95);
  color: #1f2d4f;
  font-weight: 800;
}

/* Balance card */
.balance-card {
  margin: 0 0 24px;
}

.balance-card__inner {
  padding: 20px;
  border-radius: 16px;
  background: linear-gradient(135deg, #f8a4c8, #f48fb1, #f06292);
  min-height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.balance-card__label {
  font-size: 13px;
  color: rgba(255,255,255,0.8);
  font-weight: 500;
}

.balance-card__amount {
  margin: 4px 0 0;
  font-size: 28px;
  font-weight: 800;
  color: #fff;
}

.balance-card__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
}

.balance-card__card-icon {
  display: flex;
}

.balance-card__username {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
}

/* Form */
.withdraw-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.withdraw-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.withdraw-field span {
  font-size: 13px;
  color: rgba(255,255,255,0.6);
  font-weight: 500;
}

.withdraw-field input {
  height: 50px;
  padding: 0 18px;
  border: none;
  border-radius: 25px;
  background: #fff;
  color: #2b3b55;
  font-size: 15px;
  outline: none;
}

.withdraw-field input::placeholder {
  color: #a0a8b6;
}

/* Submit */
.withdraw-submit {
  width: 100%;
  height: 56px;
  border: none;
  border-radius: 28px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 18px;
  font-weight: 800;
  cursor: pointer;
  transition: opacity 0.2s;
}

.withdraw-submit:active {
  transform: scale(0.98);
}

.withdraw-submit:disabled {
  opacity: 0.6;
}

.withdraw-message {
  margin: 18px 0 0;
  text-align: center;
  font-size: 14px;
  color: #43e97b;
}

.withdraw-message--error {
  color: #ff6b8a;
}
</style>
