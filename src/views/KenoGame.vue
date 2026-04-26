<template>
  <section class="keno-page">
    <div class="keno-hero">
      <div class="keno-hero__left">
        <strong class="keno-hero__title">Keno</strong>
        <span class="keno-hero__meta">Phòng: {{ roomId }}</span>
      </div>
      <div class="keno-hero__right">
        <span class="keno-hero__round">Kỳ {{ state.roundId || '--' }}</span>
        <span class="keno-hero__timer">{{ fmtCountdown(state.timeLeft) }}</span>
      </div>
    </div>

    <div class="keno-card">
      <div class="keno-card__row">
        <span>Trạng thái</span>
        <strong :class="state.bettingOpen ? 'is-open' : 'is-closed'">{{ state.bettingOpen ? 'Đang mở' : 'Khóa cược' }}</strong>
      </div>
      <div class="keno-card__row">
        <span>Kết quả</span>
        <strong>{{ typeof state.resultNumber === 'number' ? state.resultNumber : '--' }}</strong>
      </div>
      <div class="keno-card__row">
        <span>Số dư</span>
        <strong>{{ fmtMoney(userStore.balance) }}</strong>
      </div>
    </div>

    <div class="keno-bet">
      <div class="keno-bet__chips">
        <button v-for="chip in chips" :key="chip" class="keno-chip" type="button" @click="amount = chip">
          {{ fmtMoney(chip) }}
        </button>
      </div>

      <div class="keno-bet__amount">
        <label>
          <span>Số tiền</span>
          <input v-model.number="amount" type="number" min="1" />
        </label>
      </div>

      <div class="keno-bet__gates">
        <button class="keno-gate" type="button" :disabled="!canBet" @click="placeBet('tai')">Lớn</button>
        <button class="keno-gate" type="button" :disabled="!canBet" @click="placeBet('xiu')">Nhỏ</button>
        <button class="keno-gate" type="button" :disabled="!canBet" @click="placeBet('odd')">Lẻ</button>
        <button class="keno-gate" type="button" :disabled="!canBet" @click="placeBet('even')">Chẵn</button>
      </div>

      <p v-if="message" class="keno-msg" :class="{ 'keno-msg--err': isError }">{{ message }}</p>
    </div>

    <div class="keno-history">
      <div class="keno-history__head">
        <strong>Lịch sử</strong>
      </div>
      <div class="keno-history__list">
        <span v-for="item in state.history" :key="item.roundId" class="keno-pill">
          {{ typeof item.resultNumber === 'number' ? item.resultNumber : '--' }}
        </span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useSocketStore } from '@/stores/socket'

const route = useRoute()
const userStore = useUserStore()
const socketStore = useSocketStore()

const roomId = computed(() => String(route.query.room || 'keno-1p'))

const state = reactive({
  roomId: 'keno-1p',
  roundId: null,
  timeLeft: 0,
  bettingOpen: false,
  resultNumber: null,
  history: []
})

const chips = [1000, 5000, 10000, 50000, 100000]
const amount = ref(1000)
const message = ref('')
const isError = ref(false)

const canBet = computed(() => userStore.isLoggedIn && state.bettingOpen)

function fmtMoney(v) {
  return new Intl.NumberFormat('vi-VN').format(Number(v || 0)) + ' đ'
}

function fmtCountdown(v) {
  const s = Math.max(Number(v || 0), 0)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function onRoundState(payload) {
  if (!payload || payload.roomId !== roomId.value) return
  state.roomId = payload.roomId
  state.roundId = payload.roundId || state.roundId
  state.timeLeft = Number(payload.timeLeft || 0)
  state.bettingOpen = Boolean(payload.bettingOpen)
  state.resultNumber = typeof payload.resultNumber === 'number' ? payload.resultNumber : state.resultNumber
  state.history = Array.isArray(payload.history) ? payload.history : state.history
}

function onTimerUpdate(payload) {
  if (!payload || payload.roomId !== roomId.value) return
  state.roundId = payload.roundId || state.roundId
  state.timeLeft = Number(payload.timeLeft || 0)
  state.bettingOpen = Boolean(payload.bettingOpen)
}

function onRoundResult(payload) {
  if (!payload || payload.roomId !== roomId.value) return
  state.resultNumber = typeof payload.resultNumber === 'number' ? payload.resultNumber : state.resultNumber
  state.history = Array.isArray(payload.history) ? payload.history : state.history
}

async function placeBet(gate) {
  message.value = ''
  isError.value = false

  const numericAmount = Number(amount.value || 0)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    message.value = 'Số tiền không hợp lệ'
    isError.value = true
    return
  }

  const socket = socketStore.connect()
  socket.emit('place_keno_bet', {
    roomId: roomId.value,
    gate,
    amount: numericAmount,
    clientBetId: `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }, (res) => {
    if (!res?.ok) {
      message.value = res?.message || 'Không thể đặt cược'
      isError.value = true
      return
    }
    message.value = 'Đã đặt cược'
    isError.value = false
  })
}

onMounted(() => {
  const socket = socketStore.connect()
  socketStore.ensureSocketAuth()
  socket.emit('join_keno_room', { roomId: roomId.value })
  socket.on('keno_round_state', onRoundState)
  socket.on('keno_timer_update', onTimerUpdate)
  socket.on('keno_round_result', onRoundResult)
})

onBeforeUnmount(() => {
  const socket = socketStore.socket
  if (!socket) return
  socket.emit('leave_keno_room', { roomId: roomId.value })
  socket.off('keno_round_state', onRoundState)
  socket.off('keno_timer_update', onTimerUpdate)
  socket.off('keno_round_result', onRoundResult)
})
</script>

<style scoped>
.keno-page {
  min-height: calc(100vh - 152px);
  padding: 16px 16px 120px;
  color: #fff;
}

.keno-hero {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, #0b2b57, #1b4b7a);
  border: 1px solid rgba(255,255,255,0.12);
}

.keno-hero__title {
  display: block;
  font-size: 18px;
  letter-spacing: 0.02em;
}

.keno-hero__meta {
  display: block;
  font-size: 12px;
  color: rgba(255,255,255,0.7);
  margin-top: 4px;
}

.keno-hero__round {
  display: block;
  font-size: 12px;
  color: rgba(255,255,255,0.7);
  text-align: right;
}

.keno-hero__timer {
  display: block;
  font-size: 22px;
  font-weight: 900;
  color: #ffd36a;
  text-align: right;
  margin-top: 4px;
}

.keno-card {
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
}

.keno-card__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: rgba(255,255,255,0.75);
}

.keno-card__row + .keno-card__row {
  margin-top: 8px;
}

.keno-card__row strong {
  color: #fff;
}

.is-open { color: #43e97b !important; }
.is-closed { color: #ff6b8a !important; }

.keno-bet {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
}

.keno-bet__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.keno-chip {
  border: none;
  border-radius: 999px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.12);
  color: #fff;
  font-weight: 800;
  cursor: pointer;
}

.keno-bet__amount {
  margin-top: 12px;
}

.keno-bet__amount span {
  display: block;
  font-size: 12px;
  color: rgba(255,255,255,0.65);
  margin-bottom: 6px;
}

.keno-bet__amount input {
  width: 100%;
  height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.18);
  color: #fff;
  padding: 0 14px;
  outline: none;
}

.keno-bet__gates {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.keno-gate {
  height: 46px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #ffd36a, #ffb64a);
  color: #1a1a2e;
  font-weight: 900;
  cursor: pointer;
}

.keno-gate:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.keno-msg {
  margin: 12px 0 0;
  text-align: center;
  font-size: 13px;
  color: #43e97b;
}

.keno-msg--err {
  color: #ff6b8a;
}

.keno-history {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
}

.keno-history__head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.keno-history__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.keno-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 34px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.12);
  font-weight: 900;
}
</style>
