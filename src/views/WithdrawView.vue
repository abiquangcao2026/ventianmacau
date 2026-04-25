<template>
  <section class="withdraw-page">
    <div class="withdraw-header">
      <span class="withdraw-header__balance">Số dư: <strong>$ {{ Number(userStore.balance || 0).toFixed(0) }}</strong></span>
    </div>

    <h1 class="withdraw-page__title">Rút Tiền</h1>

    <!-- Balance card -->
    <div class="balance-card">
      <div class="balance-card__inner">
        <div class="balance-card__top">
          <span class="balance-card__label">Số dư khả dụng</span>
          <p class="balance-card__amount">$ {{ Number(userStore.balance || 0).toFixed(0) }}</p>
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

    <!-- Bank status -->
    <p v-if="!showBankForm" class="withdraw-bank-hint">Vui lòng thêm ngân hàng</p>

    <!-- Add bank / Withdraw form -->
    <div v-if="!showBankForm" class="withdraw-actions">
      <button class="withdraw-add-bank" type="button" @click="showBankForm = true">
        Thêm Ngân Hàng
      </button>
    </div>

    <div v-else class="withdraw-form">
      <div class="withdraw-form__fields">
        <label class="withdraw-field">
          <span>Số tiền rút</span>
          <input v-model.number="amount" type="number" min="1" placeholder="Nhập số tiền rút" />
        </label>

        <label class="withdraw-field">
          <span>Tên ngân hàng</span>
          <input v-model.trim="bankName" type="text" placeholder="Ví dụ: Vietcombank" />
        </label>

        <label class="withdraw-field">
          <span>Số tài khoản</span>
          <input v-model.trim="bankAccount" type="text" placeholder="Nhập số tài khoản" />
        </label>

        <label class="withdraw-field">
          <span>Tên chủ tài khoản</span>
          <input v-model.trim="accountName" type="text" placeholder="Nhập tên chủ tài khoản" />
        </label>

        <label class="withdraw-field">
          <span>Mật khẩu rút tiền</span>
          <input v-model="withdrawPassword" type="password" placeholder="Nhập mật khẩu rút tiền" />
        </label>
      </div>

      <button
        class="withdraw-submit"
        :disabled="submitting"
        @click="submitWithdraw"
      >
        {{ submitting ? 'Đang xử lý...' : 'Gửi Yêu Cầu Rút Tiền' }}
      </button>

      <button class="withdraw-cancel" type="button" @click="showBankForm = false">
        Quay lại
      </button>
    </div>

    <p v-if="message" class="withdraw-message" :class="{ 'withdraw-message--error': isError }">
      {{ message }}
    </p>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const showBankForm = ref(false)
const amount = ref(null)
const bankName = ref('')
const bankAccount = ref('')
const accountName = ref('')
const withdrawPassword = ref('')
const submitting = ref(false)
const message = ref('')
const isError = ref(false)

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

  if (!bankName.value || !bankAccount.value || !accountName.value || !withdrawPassword.value) {
    message.value = 'Vui lòng nhập đầy đủ thông tin rút tiền'
    isError.value = true
    return
  }

  submitting.value = true
  try {
    await userStore.createWithdrawRequest({
      amount: Number(amount.value),
      bankName: bankName.value,
      bankAccount: bankAccount.value,
      accountName: accountName.value,
      withdrawPassword: withdrawPassword.value
    })
    message.value = 'Đã gửi yêu cầu rút tiền thành công!'
    isError.value = false
    showBankForm.value = false
    amount.value = null
    bankName.value = ''
    bankAccount.value = ''
    accountName.value = ''
    withdrawPassword.value = ''
  } catch (error) {
    message.value = error?.message || 'Không thể tạo yêu cầu rút tiền'
    isError.value = true
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.withdraw-page {
  min-height: calc(100vh - 152px);
  padding: 0 16px 30px;
  color: #fff;
}

.withdraw-header {
  display: flex;
  justify-content: flex-end;
  padding: 12px 0;
}

.withdraw-header__balance {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.withdraw-header__balance strong {
  color: #fff;
  font-weight: 700;
}

.withdraw-page__title {
  margin: 0 0 24px;
  text-align: center;
  font-size: 28px;
  font-weight: 800;
  color: #fff;
}

/* Balance card */
.balance-card {
  margin: 0 0 20px;
  border-radius: 16px;
  overflow: hidden;
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

.balance-card__top {
  display: flex;
  flex-direction: column;
}

.balance-card__label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
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
  align-items: center;
}

.balance-card__username {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

/* Bank hint */
.withdraw-bank-hint {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
  margin: 20px 0;
}

/* Actions */
.withdraw-actions {
  padding: 0;
}

.withdraw-add-bank {
  width: 100%;
  height: 50px;
  border: none;
  border-radius: 25px;
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: #1a1a2e;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  transition: opacity 0.2s;
}

.withdraw-add-bank:active {
  opacity: 0.8;
}

/* Form */
.withdraw-form {
  margin-top: 8px;
}

.withdraw-form__fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 20px;
}

.withdraw-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.withdraw-field span {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.withdraw-field input {
  height: 48px;
  padding: 0 16px;
  border: none;
  border-radius: 14px;
  background: #fff;
  color: #2b3b55;
  font-size: 14px;
  outline: none;
}

.withdraw-field input::placeholder {
  color: #a0a8b6;
}

.withdraw-submit {
  width: 100%;
  height: 52px;
  border: none;
  border-radius: 26px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 17px;
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

.withdraw-cancel {
  width: 100%;
  height: 44px;
  margin-top: 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 22px;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
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
