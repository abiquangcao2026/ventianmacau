<template>
  <section class="deposit-page">
    <div class="deposit-hero">
      <div>
        <p class="deposit-hero__eyebrow">Topup</p>
        <h1>Nạp tiền</h1>
        <span>Theo dõi yêu cầu nạp và thời gian xử lý ngay trên cùng một màn hình.</span>
      </div>
      <strong>{{ formatMoney(userStore.balance) }}</strong>
    </div>

    <div class="deposit-card">
      <div class="deposit-card__header">
        <h2>Tạo yêu cầu nạp tiền</h2>
        <small>Nhập số tiền đã chuyển khoản để hệ thống ghi nhận.</small>
      </div>

      <label class="deposit-field">
        <span>Số tiền nạp</span>
        <input
          v-model.number="amount"
          type="number"
          min="1"
          class="deposit-input"
          placeholder="Nhập số tiền"
        />
      </label>

      <button class="deposit-submit" :disabled="submitting" @click="submitDeposit">
        {{ submitting ? 'Đang xử lý...' : 'Xác nhận' }}
      </button>

      <div v-if="message" class="deposit-feedback" :class="{ 'deposit-feedback--error': isError }">
        <p>{{ message }}</p>
        <RouterLink v-if="showSupportShortcut" class="deposit-feedback__link" to="/support">
          Liên hệ CSKH
        </RouterLink>
      </div>
    </div>

    <div class="deposit-card deposit-card--vip">
      <div class="deposit-card__header deposit-card__header--vip">
        <div>
          <h2>{{ vipPrivilegeTitle }}</h2>
          <small>{{ vipPrivilegeSubtitle }}</small>
        </div>
        <strong class="deposit-vip-badge">VIP {{ currentVipLevel }}</strong>
      </div>

      <div class="vip-privilege-card">
        <div class="vip-privilege-card__hero">
          <div class="vip-privilege-card__crest">
            <span class="vip-privilege-card__crown">♛</span>
            <strong>VIP</strong>
          </div>
          <div class="vip-privilege-card__title-wrap">
            <h3>{{ vipPrivilegeTitle }}</h3>
            <i></i>
            <p>{{ vipPrivilegeSubtitle }}</p>
          </div>
        </div>
        <div class="vip-privilege-card__table-wrap">
          <table v-if="vipPrivilegeRows.length" class="vip-privilege-card__table">
            <thead>
              <tr>
                <th><span>💼</span>TÍCH LŨY</th>
                <th><span>👑</span>CẤP VIP</th>
                <th><span>🎁</span>THƯỞNG</th>
                <th><span>🪙</span>HẠN MỨC</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in vipPrivilegeRows" :key="`${row.cap}-${row.tich_luy}-${row.han_muc}`">
                <td>{{ row.tich_luy }}</td>
                <td>{{ row.cap }}</td>
                <td>{{ row.thuong }}</td>
                <td>{{ row.han_muc }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="vip-privilege-card__empty">Chưa có cấu hình đặc quyền VIP.</div>
        </div>
        <p class="vip-privilege-card__note">
          Mốc hiện tại của bạn: <strong>VIP {{ currentVipLevel }}</strong>
        </p>
        <div class="vip-privilege-card__perks">
          <span><b>↻</b>Hoàn trả cao hơn</span>
          <span><b>🎁</b>Ưu đãi sinh nhật</span>
          <span><b>♛</b>Chăm sóc VIP</span>
          <span><b>✓</b>Hỗ trợ 24/7</span>
          <span><b>💰</b>Nhiều ưu đãi</span>
        </div>
      </div>
    </div>

    <div class="deposit-card">
      <div class="deposit-card__header">
        <h2>Lịch sử nạp tiền</h2>
        <small>{{ depositHistory.length }} giao dịch</small>
      </div>

      <div v-if="loadingHistory" class="deposit-empty">Đang tải lịch sử...</div>
      <div v-else-if="depositHistory.length === 0" class="deposit-empty">Chưa có yêu cầu nạp tiền.</div>

      <div v-else class="deposit-history">
        <article v-for="tx in depositHistory" :key="tx._id" class="deposit-history__item">
          <div class="deposit-history__top">
            <strong>{{ formatDepositStatus(tx) }}</strong>
            <span>{{ formatMoney(tx.amount) }}</span>
          </div>
          <div class="deposit-history__meta">
            <span>{{ formatDate(tx.createdAt) }}</span>
            <span>{{ tx.meta?.transferContent || 'NAP' }}</span>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { useUserStore } from '@/stores/user'
import { formatDateTimeVN } from '@/utils/vietnamTime'
import {
  VIP_PRIVILEGE_DEFAULT_SUBTITLE,
  VIP_PRIVILEGE_DEFAULT_TITLE,
  normalizeVipPrivilegeSubtitle,
  normalizeVipPrivilegeTitle,
  toVipPrivilegeDisplayRows
} from '@/constants/vipPrivilegeDefaults'

const userStore = useUserStore()

const amount = ref(null)
const submitting = ref(false)
const loadingHistory = ref(false)
const message = ref('')
const isError = ref(false)
const showSupportShortcut = ref(false)
const currentVipLevel = computed(() => Number(userStore.user?.vipLevel || 0))
const vipPrivilegeTitle = ref(VIP_PRIVILEGE_DEFAULT_TITLE)
const vipPrivilegeSubtitle = ref(VIP_PRIVILEGE_DEFAULT_SUBTITLE)
const vipPrivilegeRows = ref([])

const depositHistory = computed(() =>
  (userStore.transactions || []).filter((tx) =>
    ['deposit_pending', 'deposit', 'deposit_rejected'].includes(String(tx.type || ''))
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

function formatDepositStatus(tx) {
  if (tx.type === 'deposit') return 'Nạp thành công'
  if (tx.type === 'deposit_rejected' || tx.status === 'rejected') return 'Từ chối'
  return 'Đang chờ duyệt'
}

async function loadDepositHistory() {
  loadingHistory.value = true
  try {
    await userStore.fetchTransactions({ group: 'deposit', limit: 100 })
  } finally {
    loadingHistory.value = false
  }
}

async function loadVipPrivileges() {
  try {
    const data = await apiFetch('/api/game/vip-privileges')
    vipPrivilegeTitle.value = normalizeVipPrivilegeTitle(data?.title)
    vipPrivilegeSubtitle.value = normalizeVipPrivilegeSubtitle(data?.subtitle)
    vipPrivilegeRows.value = toVipPrivilegeDisplayRows(data?.rows)
  } catch {
    vipPrivilegeTitle.value = VIP_PRIVILEGE_DEFAULT_TITLE
    vipPrivilegeSubtitle.value = VIP_PRIVILEGE_DEFAULT_SUBTITLE
    vipPrivilegeRows.value = []
  }
}

async function submitDeposit() {
  showSupportShortcut.value = false
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

  submitting.value = true
  try {
    await userStore.createDepositRequest({
      amount: Number(amount.value),
      bankCode: 'VCB',
      transferContent: `NAP-${userStore.user?.username || 'guest'}`
    })
    message.value = 'Đã gửi yêu cầu nạp tiền thành công.'
    showSupportShortcut.value = true
    amount.value = null
    await loadDepositHistory()
  } catch (error) {
    message.value = error?.message || 'Không thể tạo yêu cầu nạp tiền'
    isError.value = true
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadDepositHistory(), loadVipPrivileges()])
})
</script>

<style scoped>
.deposit-page {
  min-height: calc(100vh - var(--member-header-height, 64px) - var(--member-nav-height, 86px));
  min-height: calc(100dvh - var(--member-header-height, 64px) - var(--member-nav-height, 86px));
  padding: 16px 16px 120px;
  color: #fff;
}

.deposit-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 18px 20px;
  border-radius: 22px;
  background:
    radial-gradient(circle at top left, rgba(92, 224, 193, 0.28), transparent 34%),
    linear-gradient(135deg, rgba(28, 56, 96, 0.96), rgba(12, 24, 51, 0.96));
  border: 1px solid rgba(136, 220, 255, 0.16);
  box-shadow: 0 18px 40px rgba(3, 11, 31, 0.22);
}

.deposit-hero__eyebrow {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #78ffd6;
}

.deposit-hero h1 {
  margin: 0;
  font-size: 30px;
  font-weight: 900;
}

.deposit-hero span {
  display: block;
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.72);
}

.deposit-hero strong {
  font-size: 24px;
  font-weight: 900;
  white-space: nowrap;
  color: #fff2aa;
}

.deposit-card {
  margin-top: 18px;
  padding: 18px;
  border-radius: 20px;
  background: rgba(9, 19, 44, 0.84);
  border: 1px solid rgba(113, 143, 210, 0.18);
  box-shadow: 0 14px 28px rgba(7, 15, 34, 0.18);
}

.deposit-card__header {
  margin-bottom: 14px;
}

.deposit-card__header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
}

.deposit-card__header small {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

.deposit-card--vip {
  background:
    radial-gradient(circle at top right, rgba(255, 214, 107, 0.14), transparent 28%),
    rgba(9, 19, 44, 0.84);
}

.deposit-card__header--vip {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.deposit-vip-badge {
  flex-shrink: 0;
  padding: 10px 14px;
  border-radius: 999px;
  background: linear-gradient(135deg, #ffe89f, #ffcb54);
  color: #533400;
  font-size: 13px;
  font-weight: 900;
}

.vip-privilege-card {
  position: relative;
  overflow: hidden;
  max-width: 760px;
  margin: 0 auto;
  padding: 18px 16px 16px;
  border-radius: 30px;
  border: 2px solid rgba(205, 151, 47, 0.78);
  background:
    radial-gradient(circle at 8% 12%, rgba(255, 202, 65, 0.16), transparent 16%),
    radial-gradient(circle at 92% 8%, rgba(255, 202, 65, 0.10), transparent 18%),
    radial-gradient(circle at 50% 44%, rgba(31, 65, 95, 0.28), transparent 46%),
    linear-gradient(180deg, #0c1624 0%, #050b13 100%);
  box-shadow:
    0 26px 60px rgba(0, 0, 0, 0.36),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05),
    inset 0 0 46px rgba(245, 198, 89, 0.08);
}

.vip-privilege-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 222, 124, 0.12), transparent);
  transform: translateX(-70%);
  pointer-events: none;
}

.vip-privilege-card__hero {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.vip-privilege-card__crest {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 104px;
  color: #ffd96a;
  font-weight: 950;
  text-align: center;
  text-transform: uppercase;
  text-shadow: 0 3px 12px rgba(255, 210, 89, 0.42);
}

.vip-privilege-card__crest::before {
  content: '';
  position: absolute;
  inset: 8px 4px 2px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 25%, rgba(255, 238, 170, 0.42), transparent 26%),
    linear-gradient(180deg, rgba(97, 62, 16, 0.84), rgba(30, 21, 10, 0.94));
  border: 1px solid rgba(245, 198, 89, 0.46);
  box-shadow: inset 0 0 22px rgba(255, 214, 102, 0.12), 0 10px 22px rgba(0, 0, 0, 0.28);
}

.vip-privilege-card__crest strong {
  position: relative;
  margin-top: 54px;
  color: #ffd96a;
  font-size: 25px;
  letter-spacing: 0.06em;
}

.vip-privilege-card__crown {
  position: absolute;
  z-index: 1;
  top: 8px;
  color: #ffd45f;
  font-size: 54px;
  line-height: 1;
  filter: drop-shadow(0 7px 10px rgba(0, 0, 0, 0.42));
}

.vip-privilege-card__title-wrap {
  min-width: 0;
  text-align: center;
}

.vip-privilege-card__title-wrap h3 {
  margin: 0;
  color: #ffd96a;
  font-size: clamp(25px, 5.8vw, 43px);
  line-height: 1;
  font-weight: 950;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  text-shadow:
    0 2px 0 #7c4a0d,
    0 4px 10px rgba(255, 210, 89, 0.46),
    0 16px 26px rgba(0, 0, 0, 0.58);
}

.vip-privilege-card__title-wrap i {
  display: block;
  width: min(280px, 72%);
  height: 2px;
  margin: 12px auto 8px;
  background: linear-gradient(90deg, transparent, #d49a2b, #ffdf78, #d49a2b, transparent);
  box-shadow: 0 0 14px rgba(255, 214, 102, 0.48);
}

.vip-privilege-card__title-wrap p {
  margin: 0;
  color: rgba(255, 255, 255, 0.92);
  font-size: clamp(15px, 3vw, 22px);
  line-height: 1.35;
  font-weight: 650;
}

.vip-privilege-card__table-wrap {
  position: relative;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  max-width: 100%;
  border: 1px solid rgba(205, 151, 47, 0.58);
  border-radius: 18px;
  background: rgba(7, 16, 29, 0.78);
  box-shadow: inset 0 0 24px rgba(245, 198, 89, 0.06);
}

.vip-privilege-card__table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  color: #ffe28a;
  font-size: 15px;
}

.vip-privilege-card__table th,
.vip-privilege-card__table td {
  padding: 15px 10px;
  text-align: center;
}

.vip-privilege-card__table th {
  background:
    linear-gradient(180deg, rgba(126, 81, 20, 0.98), rgba(55, 34, 12, 0.98));
  color: #ffe36c;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-top: 1px solid rgba(245, 198, 89, 0.3);
  border-bottom: 1px solid rgba(245, 198, 89, 0.38);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.42);
  white-space: nowrap;
}

.vip-privilege-card__table th span {
  display: inline-block;
  margin-right: 6px;
}

.vip-privilege-card__table th:first-child {
  border-left: 1px solid rgba(245, 198, 89, 0.3);
  border-top-left-radius: 16px;
}

.vip-privilege-card__table th:last-child {
  border-right: 1px solid rgba(245, 198, 89, 0.3);
  border-top-right-radius: 16px;
}

.vip-privilege-card__table td {
  background:
    linear-gradient(180deg, rgba(8, 19, 34, 0.94), rgba(6, 14, 25, 0.96));
  border-right: 1px solid rgba(205, 151, 47, 0.28);
  border-bottom: 1px solid rgba(205, 151, 47, 0.28);
  color: #ffd95d;
  font-size: 16px;
  font-weight: 950;
  text-shadow: 0 1px 8px rgba(255, 214, 102, 0.22);
}

.vip-privilege-card__table td:first-child {
  border-left: 1px solid rgba(245, 198, 89, 0.24);
}

.vip-privilege-card__table td:nth-child(2) {
  color: #ffe97a;
  font-size: 17px;
}

.vip-privilege-card__table td:nth-child(2)::before {
  content: '♕ ';
  color: #ffd45f;
}

.vip-privilege-card__table tbody tr:last-child td:first-child {
  border-bottom-left-radius: 16px;
}

.vip-privilege-card__table tbody tr:last-child td:last-child {
  border-bottom-right-radius: 16px;
}

.vip-privilege-card__note {
  margin: 0;
  margin-top: 14px;
  text-align: center;
  font-size: 13px;
  color: rgba(255, 246, 201, 0.74);
}

.vip-privilege-card__perks {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0;
  margin-top: 16px;
  padding: 12px 8px;
  border: 1px solid rgba(205, 151, 47, 0.58);
  border-radius: 18px;
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 214, 102, 0.08), transparent 45%),
    rgba(7, 16, 29, 0.82);
}

.vip-privilege-card__perks span {
  display: grid;
  place-items: center;
  gap: 6px;
  min-height: 76px;
  padding: 0 8px;
  border-right: 1px solid rgba(205, 151, 47, 0.22);
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  font-weight: 750;
  line-height: 1.25;
  text-align: center;
}

.vip-privilege-card__perks span:last-child {
  border-right: none;
}

.vip-privilege-card__perks b {
  color: #ffd45f;
  font-size: 27px;
  line-height: 1;
  filter: drop-shadow(0 4px 8px rgba(255, 214, 102, 0.25));
}

.vip-privilege-card__note strong {
  color: #ffd95d;
}

.vip-privilege-card__empty {
  padding: 28px 12px;
  text-align: center;
  color: rgba(255, 246, 201, 0.72);
  font-size: 13px;
  font-weight: 800;
}

.deposit-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.deposit-field span {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.64);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.deposit-input {
  width: 100%;
  height: 52px;
  padding: 0 16px;
  border-radius: 16px;
  border: 1px solid rgba(145, 166, 219, 0.18);
  background: rgba(255, 255, 255, 0.96);
  color: #243452;
  font-size: 16px;
  font-weight: 700;
  outline: none;
}

.deposit-submit {
  width: 100%;
  height: 54px;
  margin-top: 16px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #55e8ae, #23bfe2);
  color: #0d1d3d;
  font-size: 17px;
  font-weight: 900;
  cursor: pointer;
}

.deposit-submit:disabled {
  opacity: 0.62;
}

.deposit-feedback {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(53, 199, 137, 0.16);
  border: 1px solid rgba(88, 228, 169, 0.2);
}

.deposit-feedback--error {
  background: rgba(255, 107, 138, 0.14);
  border-color: rgba(255, 107, 138, 0.22);
}

.deposit-feedback p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

.deposit-feedback__link {
  flex-shrink: 0;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  color: #13264f;
  font-size: 12px;
  font-weight: 900;
  text-decoration: none;
}

.deposit-empty {
  padding: 26px 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.deposit-history {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.deposit-history__item {
  padding: 14px 14px 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.deposit-history__top,
.deposit-history__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.deposit-history__top strong {
  font-size: 14px;
  font-weight: 800;
}

.deposit-history__top span {
  font-size: 15px;
  font-weight: 900;
  color: #fff0aa;
}

.deposit-history__meta {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.52);
}

@media (max-width: 640px) {
  .deposit-card__header--vip {
    flex-direction: column;
  }

  .deposit-vip-badge {
    align-self: flex-start;
  }

  .vip-privilege-card {
    padding: 16px 14px 14px;
    border-radius: 22px;
  }

  .vip-privilege-card__table {
    min-width: 520px;
    font-size: 14px;
  }

  .vip-privilege-card__table th,
  .vip-privilege-card__table td {
    padding: 14px 10px;
  }
}
</style>
