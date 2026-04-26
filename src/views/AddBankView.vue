<template>
  <section class="addbank-page">
    <h1 class="addbank-page__title">Liên kết Ngân hàng</h1>

    <!-- Đã liên kết -->
    <div v-if="hasLinkedBank && !editing" class="addbank-linked">
      <div class="addbank-linked__card">
        <span class="addbank-linked__label">Ngân hàng đã liên kết</span>
        <strong class="addbank-linked__bank">{{ linkedBank.bankName }}</strong>
        <p class="addbank-linked__account">{{ maskAccount(linkedBank.bankAccount) }}</p>
        <p class="addbank-linked__name">{{ linkedBank.accountName }}</p>
      </div>
      <button class="addbank-edit-btn" @click="startEdit">Thay đổi ngân hàng</button>
    </div>

    <!-- Form liên kết -->
    <div v-else class="addbank-form">
      <label class="addbank-field">
        <span>Chọn ngân hàng</span>
        <select v-model="form.bankName" class="addbank-select">
          <option value="" disabled>Chọn ngân hàng</option>
          <option v-for="bank in bankList" :key="bank" :value="bank">{{ bank }}</option>
        </select>
      </label>

      <label class="addbank-field">
        <span>Số tài khoản</span>
        <input v-model.trim="form.bankAccount" type="text" placeholder="Nhập số tài khoản" />
      </label>

      <label class="addbank-field">
        <span>Tên chủ tài khoản</span>
        <input v-model.trim="form.accountName" type="text" placeholder="Nhập tài khoản chủ tên" />
      </label>

      <button class="addbank-submit" :disabled="submitting" @click="submitBank">
        {{ submitting ? 'Đang xử lý...' : 'Xác định' }}
      </button>

      <button v-if="hasLinkedBank" class="addbank-cancel" @click="editing = false">
        Hủy
      </button>
    </div>

    <p v-if="message" class="addbank-message" :class="{ 'addbank-message--error': isError }">
      {{ message }}
    </p>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { apiFetch } from '@/lib/api'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const linkedBank = reactive({ bankName: '', bankAccount: '', accountName: '' })
const form = reactive({ bankName: '', bankAccount: '', accountName: '' })
const submitting = ref(false)
const editing = ref(false)
const message = ref('')
const isError = ref(false)

const bankList = [
  'Vietcombank',
  'MB Bank',
  'ACB',
  'BIDV',
  'Techcombank',
  'VPBank',
  'Sacombank',
  'TPBank',
  'Agribank',
  'VietinBank',
  'SHB',
  'HDBank',
  'OCB',
  'MSB',
  'Eximbank',
  'LienVietPostBank',
  'SCB',
  'SeABank',
  'BaoVietBank',
  'VIB'
]

const hasLinkedBank = computed(() => Boolean(linkedBank.bankName && linkedBank.bankAccount))

function maskAccount(acc) {
  if (!acc || acc.length <= 4) return acc || ''
  return '****' + acc.slice(-4)
}

function startEdit() {
  form.bankName = linkedBank.bankName
  form.bankAccount = linkedBank.bankAccount
  form.accountName = linkedBank.accountName
  editing.value = true
  message.value = ''
}

async function loadBank() {
  try {
    const data = await apiFetch('/api/account/bank', { headers: userStore.authHeaders })
    const bank = data.bank || {}
    linkedBank.bankName = bank.bankName || ''
    linkedBank.bankAccount = bank.bankAccount || ''
    linkedBank.accountName = bank.accountName || ''
  } catch {
    // Ignore — bank not linked yet
  }
}

async function submitBank() {
  message.value = ''
  isError.value = false

  if (!form.bankName || !form.bankAccount || !form.accountName) {
    message.value = 'Vui lòng nhập đầy đủ thông tin'
    isError.value = true
    return
  }

  submitting.value = true
  try {
    const data = await apiFetch('/api/account/bank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userStore.authHeaders },
      body: JSON.stringify({
        bankName: form.bankName,
        bankAccount: form.bankAccount,
        accountName: form.accountName
      })
    })

    const bank = data.bank || {}
    linkedBank.bankName = bank.bankName || form.bankName
    linkedBank.bankAccount = bank.bankAccount || form.bankAccount
    linkedBank.accountName = bank.accountName || form.accountName

    message.value = 'Liên kết ngân hàng thành công!'
    isError.value = false
    editing.value = false
  } catch (error) {
    message.value = error?.message || 'Không thể liên kết ngân hàng'
    isError.value = true
  } finally {
    submitting.value = false
  }
}

onMounted(loadBank)
</script>

<style scoped>
.addbank-page {
  min-height: calc(100vh - 152px);
  padding: 24px 16px 30px;
  color: #fff;
}

.addbank-page__title {
  margin: 0 0 28px;
  text-align: center;
  font-size: 24px;
  font-weight: 800;
  color: #fff;
}

/* Linked card */
.addbank-linked {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.addbank-linked__card {
  padding: 20px 18px;
  border-radius: 16px;
  background: linear-gradient(135deg, #294a87, #182f63);
  border: 1px solid rgba(255,255,255,0.08);
}

.addbank-linked__label {
  display: block;
  font-size: 12px;
  color: rgba(255,255,255,0.55);
  margin-bottom: 8px;
}

.addbank-linked__bank {
  display: block;
  font-size: 18px;
  font-weight: 700;
}

.addbank-linked__account,
.addbank-linked__name {
  margin: 4px 0 0;
  font-size: 14px;
  color: rgba(255,255,255,0.7);
}

.addbank-edit-btn {
  width: 100%;
  height: 46px;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 23px;
  background: transparent;
  color: rgba(255,255,255,0.7);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

/* Form */
.addbank-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.addbank-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.addbank-field span {
  font-size: 13px;
  color: rgba(255,255,255,0.6);
  font-weight: 500;
}

.addbank-field input,
.addbank-select {
  width: 100%;
  height: 52px;
  padding: 0 18px;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 14px;
  background: rgba(255,255,255,0.06);
  color: #fff;
  font-size: 15px;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
}

.addbank-select {
  background: rgba(255,255,255,0.06) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23999' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 16px center;
}

.addbank-field input::placeholder {
  color: rgba(255,255,255,0.35);
}

.addbank-field input:focus,
.addbank-select:focus {
  border-color: rgba(255,255,255,0.3);
}

.addbank-submit {
  width: 100%;
  height: 54px;
  margin-top: 8px;
  border: none;
  border-radius: 27px;
  background: linear-gradient(135deg, #8ec5fc, #a0c4ff, #c4b5fd);
  color: #1a1a2e;
  font-size: 20px;
  font-weight: 800;
  cursor: pointer;
  transition: opacity 0.2s;
}

.addbank-submit:active {
  opacity: 0.85;
}

.addbank-submit:disabled {
  opacity: 0.5;
}

.addbank-cancel {
  width: 100%;
  height: 44px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 22px;
  background: transparent;
  color: rgba(255,255,255,0.5);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.addbank-message {
  margin: 20px 0 0;
  text-align: center;
  font-size: 14px;
  color: #43e97b;
}

.addbank-message--error {
  color: #ff6b8a;
}
</style>
