<template>
  <section class="deposit-page">
    <h1 class="deposit-page__title">Nạp Tiền</h1>

    <div class="deposit-info-box">
      <p>XIN CHÀO, QUÝ KHÁCH VUI LÒNG LIÊN HỆ BỘ PHẬN CHĂM SÓC KHÁCH HÀNG ĐỂ ĐƯỢC HỖ TRỢ NẠP TIỀN. XIN CẢM ƠN!</p>
    </div>

    <div class="deposit-form">
      <input
        v-model.number="amount"
        type="number"
        min="10000"
        class="deposit-input"
        placeholder="Nhập số tiền"
      />

      <button
        class="deposit-submit"
        :disabled="submitting"
        @click="submitDeposit"
      >
        {{ submitting ? 'Đang xử lý...' : 'Xác nhận' }}
      </button>
    </div>

    <div class="deposit-guide">
      <div class="deposit-guide__header">
        <h2>Hướng dẫn nạp tiền</h2>
      </div>
      <ul class="deposit-guide__list">
        <li>VUI LÒNG LIÊN HỆ CHĂM SÓC KHÁCH HÀNG ĐỂ ĐƯỢC CUNG CẤP SỐ TÀI KHOẢN NẠP TIỀN</li>
        <li>TIẾP SAU ĐÓ NHẬP SỐ TIỀN ĐÃ CHUYỂN KHOẢN VÀO Ô BÊN TRÊN VÀ ẤN XÁC NHẬN</li>
        <li>CHÚ Ý: ĐƠN VỊ TÍNH THEO USD. TỈ GIÁ NHẬN THEO TỈ GIÁ HÀNG NGÀY</li>
      </ul>
    </div>

    <p v-if="message" class="deposit-message">{{ message }}</p>

    <!-- VIP Table -->
    <div class="vip-section">
      <h2 class="vip-section__title">Nâng cấp đặc quyền VIP</h2>
      <p class="vip-section__subtitle">Bảng tích lũy thưởng nạp khi nâng cấp VIP:</p>

      <div class="vip-table">
        <div class="vip-row vip-row--header">
          <span>Tích lũy</span>
          <span>Cấp</span>
          <span>Thưởng</span>
          <span>Hạn mức</span>
        </div>
        <div v-for="tier in vipTiers" :key="tier.level" class="vip-row">
          <span>{{ tier.required }}</span>
          <span class="vip-row__level">{{ tier.level }}</span>
          <span>{{ tier.bonus }}</span>
          <span>{{ tier.limit }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const amount = ref(null)
const submitting = ref(false)
const message = ref('')

const vipTiers = [
  { required: '4.000$', level: 'VIP 1', bonus: '100$', limit: '10.000$' },
  { required: '8.000$', level: 'VIP 2', bonus: '200$', limit: '20.000$' },
  { required: '12.000$', level: 'VIP 3', bonus: '500$', limit: '50.000$' },
  { required: '20.000$', level: 'VIP 4', bonus: '1.000$', limit: '80.000$' },
  { required: '50.000$', level: 'VIP 5', bonus: '3.000$', limit: '200.000$' },
  { required: '100.000$', level: 'VIP 6', bonus: '5.000$', limit: '400.000$' },
  { required: '200.000$', level: 'VIP 7', bonus: '10.000$', limit: '1.000.000$' }
]

async function submitDeposit() {
  if (!userStore.user?._id) {
    message.value = 'Không tìm thấy thông tin người dùng'
    return
  }

  if (!amount.value || Number(amount.value) < 1) {
    message.value = 'Vui lòng nhập số tiền hợp lệ'
    return
  }

  submitting.value = true
  message.value = ''
  try {
    await userStore.createDepositRequest({
      amount: Number(amount.value),
      bankCode: 'VCB',
      transferContent: `NAP-${userStore.user?.username || 'guest'}`
    })
    message.value = 'Đã tạo yêu cầu nạp tiền thành công!'
    amount.value = null
  } catch (error) {
    message.value = error?.message || 'Không thể tạo yêu cầu nạp tiền'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.deposit-page {
  min-height: calc(100vh - 152px);
  padding: 16px 16px 30px;
  color: #fff;
}

.deposit-page__title {
  margin: 12px 0 24px;
  text-align: center;
  font-size: 28px;
  font-weight: 800;
  color: #fff;
}

.deposit-info-box {
  margin: 0 0 24px;
  padding: 18px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.deposit-info-box p {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.85);
  text-transform: uppercase;
}

.deposit-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 28px;
}

.deposit-input {
  width: 100%;
  height: 52px;
  padding: 0 18px;
  border: none;
  border-radius: 26px;
  background: #fff;
  color: #2b3b55;
  font-size: 15px;
  font-weight: 500;
  outline: none;
}

.deposit-input::placeholder {
  color: #a0a8b6;
}

.deposit-submit {
  width: 100%;
  height: 56px;
  border: none;
  border-radius: 28px;
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: #1a1a2e;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.deposit-submit:active {
  transform: scale(0.98);
}

.deposit-submit:disabled {
  opacity: 0.6;
}

.deposit-guide {
  border-radius: 14px;
  overflow: hidden;
}

.deposit-guide__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 12px;
}

.deposit-guide__header::before {
  content: '';
  display: block;
  width: 4px;
  height: 22px;
  border-radius: 2px;
  background: linear-gradient(180deg, #f0a830, #e8842c);
  flex-shrink: 0;
}

.deposit-guide__header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
}

.deposit-guide__list {
  margin: 0;
  padding: 0 0 0 16px;
  list-style: disc;
}

.deposit-guide__list li {
  padding: 6px 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.75);
}

.deposit-guide__list li::marker {
  color: #f0a830;
}

.deposit-message {
  margin: 20px 0 0;
  text-align: center;
  font-size: 14px;
  color: #43e97b;
}

/* VIP Section */
.vip-section {
  margin-top: 28px;
}

.vip-section__title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
}

.vip-section__subtitle {
  margin: 6px 0 14px;
  font-size: 13px;
  color: rgba(255,255,255,0.6);
}

.vip-table {
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255,255,255,0.95);
}

.vip-row {
  display: grid;
  grid-template-columns: 1.3fr 0.8fr 0.9fr 1.1fr;
}

.vip-row span {
  padding: 11px 8px;
  font-size: 13px;
  color: #3a3a3a;
  text-align: center;
  border-bottom: 1px solid #eee;
}

.vip-row:last-child span {
  border-bottom: none;
}

.vip-row--header {
  background: #f8f0dd;
}

.vip-row--header span {
  font-weight: 700;
  font-size: 11px;
  color: #8b6914;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom-color: #e8dcc0;
}

.vip-row__level {
  font-weight: 700;
  color: #c49520 !important;
}
</style>
