<template>
  <section class="sicbo-page">
    <div v-if="socketStore.lastError" class="sicbo-alert">
      {{ socketStore.lastError }}
    </div>

    <section class="sicbo-room-switch">
      <button
        type="button"
        class="sicbo-room-pill"
        :class="{ active: currentRoomId === 'sicbo-3p' }"
        @click="switchRoom('sicbo-3p')"
      >
        <small>Phòng nhanh</small>
        <strong>Xúc sắc 3P</strong>
      </button>

      <button
        type="button"
        class="sicbo-room-pill"
        :class="{ active: currentRoomId === 'sicbo-5p' }"
        @click="switchRoom('sicbo-5p')"
      >
        <small>Phòng ổn định</small>
        <strong>Xúc sắc 5P</strong>
      </button>
    </section>

    <div class="sicbo-card">
      <div class="sicbo-card__top">
        <div class="sicbo-card__session">
          <span>Phiên số</span>
          <strong>{{ roundLabel }}</strong>
          <button type="button" @click="showGuide = true">Hướng dẫn cách chơi</button>
        </div>

        <div class="sicbo-card__timer">
          <span>Thời gian còn lại</span>
          <div class="sicbo-card__timebox">
            <strong>{{ minuteText }}</strong>
            <em>:</em>
            <strong>{{ secondText }}</strong>
          </div>
        </div>
      </div>

      <div class="sicbo-card__stage">
        <div class="sicbo-card__arrow sicbo-card__arrow--left"></div>

        <div class="sicbo-card__dice-grid">
          <div class="sicbo-card__dice-timer">
            {{ minuteText }} : {{ secondText }}
          </div>

          <div class="sicbo-card__dice-lanes">
            <div
              v-for="(value, index) in displayDiceValues"
              :key="`dice-${index}`"
              class="sicbo-card__dice-slot"
            >
              <img :src="getDiceAsset(value)" :alt="`Xúc xắc ${value}`" class="sicbo-card__dice-item" />
            </div>
          </div>

          <div class="sicbo-card__dice-status">
            {{ canBet ? 'Đang mở cược' : 'Đang chờ kết quả...' }}
          </div>
        </div>

        <div class="sicbo-card__arrow sicbo-card__arrow--right"></div>
      </div>
    </div>

    <section class="sicbo-panel">
      <div class="sicbo-panel__tabs">
        <button
          :class="{ active: activeMode === 'cltx' }"
          @click="activeMode = 'cltx'"
        >
          CLTX
        </button>
        <button
          :class="{ active: activeMode === 'double' }"
          @click="activeMode = 'double'"
        >
          2 số trùng
        </button>
        <button
          :class="{ active: activeMode === 'triple' }"
          @click="activeMode = 'triple'"
        >
          3 số trùng
        </button>
      </div>

      <div v-if="activeMode === 'cltx'" class="sicbo-panel__bets">
        <button
          v-for="gate in betOptions"
          :key="gate.key"
          :disabled="!canBet"
          class="bet-card"
          @click="onBet(gate.key)"
        >
          <span>{{ gate.label }}</span>
          <strong>{{ gate.odds.toFixed(2) }}</strong>
          <small>{{ formatMoney(gateTotals[gate.key]) }}</small>
        </button>
      </div>

      <div v-else-if="activeMode === 'double'" class="sicbo-panel__number-bets">
        <button
          v-for="gate in doubleBetOptions"
          :key="gate.key"
          :disabled="!canBet"
          class="number-bet-card"
          @click="onBet(gate.key)"
        >
          <span>2 số {{ gate.face }}</span>
          <strong>{{ gate.odds.toFixed(2) }}</strong>
          <small>{{ formatMoney(gateTotals[gate.key]) }}</small>
        </button>
      </div>

      <div v-else class="sicbo-panel__number-bets">
        <button
          v-for="gate in tripleBetOptions"
          :key="gate.key"
          :disabled="!canBet"
          class="number-bet-card number-bet-card--triple"
          @click="onBet(gate.key)"
        >
          <span>3 số {{ gate.face }}</span>
          <strong>{{ gate.odds.toFixed(2) }}</strong>
          <small>{{ formatMoney(gateTotals[gate.key]) }}</small>
        </button>
      </div>

      <div class="sicbo-panel__status">
        <strong>{{ activeModeLabel }}</strong>
        <em>{{ canBet ? 'Đang mở cược' : 'Đang chờ kết quả' }}</em>
      </div>
      <small class="sicbo-bet-hint">
        Nhấn vào cửa cược để nhập số tiền ({{ formatMoney(sicboConfig.minBet) }} - {{ formatMoney(sicboConfig.maxBet) }}).
      </small>
    </section>

    <section class="current-bets">
      <div class="current-bets__head">
        <h2>Cược của bạn trong phiên {{ roundLabel }}</h2>
        <span>{{ groupedCurrentRoundBets.length }} cửa · {{ formatMoney(currentRoundStake) }}</span>
      </div>

      <div v-if="groupedCurrentRoundBets.length === 0" class="current-bets__empty">
        Chưa có cược nào trong phiên hiện tại.
      </div>

      <div v-else class="current-bets__list">
        <article v-for="bet in groupedCurrentRoundBets" :key="bet.gate" class="current-bet-row">
          <div>
            <strong>{{ formatGateLabel(bet.gate) }}</strong>
            <span>{{ bet.count }} lệnh · {{ formatBetStatus(bet.status, bet.payout) }}</span>
          </div>
          <em>{{ formatMoney(bet.amount) }}</em>
        </article>
      </div>
    </section>

    <section class="history-switch">
      <button :class="{ active: activeHistoryTab === 'table' }" @click="activeHistoryTab = 'table'">
        Lịch sử trò chơi
      </button>
      <button :class="{ active: activeHistoryTab === 'mine' }" @click="activeHistoryTab = 'mine'">
        Lịch sử của tôi
      </button>
    </section>

    <section class="history-board">
      <div class="history-head">
        <span>Phiên số</span>
        <span>Kết quả</span>
        <span>Thời gian</span>
      </div>

      <div v-if="activeHistoryTab === 'table'" class="history-list">
        <div v-for="row in historyRows" :key="row.key" class="history-row">
          <span>{{ row.roundId }}</span>
          <div class="history-row__result">
            <template v-if="row.pending">
              <em>Đang chờ kết quả</em>
            </template>
            <template v-else>
              <div class="history-result-stack">
                <div class="history-dice">
                  <img
                    v-for="(value, index) in row.result"
                    :key="index"
                    :src="getDiceAsset(value)"
                    :alt="`Kết quả ${value}`"
                    class="history-dice__item"
                  />
                </div>
                <small v-if="row.winningGates?.length" class="history-result-stack__meta">
                  {{ row.winningGates.map((gate) => formatGateLabel(gate)).join(' · ') }}
                </small>
              </div>
            </template>
          </div>
          <span>{{ formatDate(row.createdAt) }}</span>
        </div>
      </div>

      <div v-else class="history-list">
        <div v-if="myBets.length === 0" class="history-empty">Chưa có lịch sử cược</div>

        <div v-for="bet in myBets" :key="bet._id" class="history-row">
          <span>{{ bet.roundId }}</span>
          <div class="history-row__result history-row__result--mine">
            <strong>{{ formatGateLabel(bet.gate) }}</strong>
            <em>{{ formatBetStatus(bet.status, bet.payout) }}</em>
          </div>
          <span>{{ formatDate(bet.createdAt) }}</span>
        </div>
      </div>
    </section>

    <div v-if="showGuide" class="guide-backdrop" @click.self="showGuide = false">
      <div class="guide-modal">
        <div class="guide-modal__head">
          <div>
            <span>Hướng dẫn</span>
            <h2>{{ sicboConfig.title }}</h2>
          </div>
          <button type="button" @click="showGuide = false">Đóng</button>
        </div>

        <div class="guide-modal__body">
          <div class="guide-block">
            <strong>Luật cơ bản</strong>
            <p>- Lớn thắng khi tổng 11-17 và không phải bộ ba.</p>
            <p>- Nhỏ thắng khi tổng 4-10 và không phải bộ ba.</p>
            <p>- Lẻ/Chẵn tính theo tổng ba viên xúc xắc.</p>
          </div>

          <div class="guide-block">
            <strong>Cửa 2 số trùng</strong>
            <p>- Trúng khi đúng mặt số xuất hiện đúng 2 lần.</p>
            <p>- Tỷ lệ hiện tại: {{ Number(sicboConfig.odds?.double_1 || 0).toFixed(2) }}</p>
          </div>

          <div class="guide-block">
            <strong>Cửa 3 số trùng</strong>
            <p>- Trúng khi cả 3 viên ra cùng đúng mặt số đã chọn.</p>
            <p>- Tỷ lệ hiện tại: {{ Number(sicboConfig.odds?.triple_1 || 0).toFixed(2) }}</p>
          </div>

          <div class="guide-block">
            <strong>Giới hạn phiên</strong>
            <p>- Cược tối thiểu: {{ formatMoney(sicboConfig.minBet) }}</p>
            <p>- Cược tối đa mỗi lệnh: {{ formatMoney(sicboConfig.maxBet) }}</p>
            <p>- Khóa cược trước {{ sicboConfig.betLockSeconds }} giây cuối.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { useUserStore } from '@/stores/user'
import { useSocketStore } from '@/stores/socket'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const socketStore = useSocketStore()

const sicboConfig = reactive({
  roomId: 'sicbo-3p',
  title: 'Xúc sắc 3P',
  minBet: 1000,
  maxBet: 50000,
  roundDuration: 240,
  betLockSeconds: 10,
  chipOptions: [1000, 5000, 10000, 50000],
  odds: {
    tai: 1.98,
    xiu: 1.98,
    odd: 1.98,
    even: 1.98
  }
})

const lastEnteredBetAmount = ref(1000)
const myBets = ref([])
const activeMode = ref('cltx')
const activeHistoryTab = ref('table')
const showGuide = ref(false)
const roundState = computed(() => socketStore.roundState)
const currentRoomId = computed(() =>
  route.query.room === 'sicbo-5p' ? 'sicbo-5p' : 'sicbo-3p'
)
const canBet = computed(
  () =>
    roundState.value.roomId === currentRoomId.value &&
    roundState.value.bettingOpen &&
    roundState.value.timeLeft > Number(sicboConfig.betLockSeconds || 10)
)
const roundHistory = computed(() => roundState.value.history || [])
const roundLabel = computed(() => roundState.value.roundId || '--')
const timeLeft = computed(() => Number(roundState.value.timeLeft || 0))
const minuteText = computed(() => String(Math.floor(timeLeft.value / 60)).padStart(2, '0'))
const secondText = computed(() => String(timeLeft.value % 60).padStart(2, '0'))
const betOptions = computed(() => [
  { key: 'tai', label: 'Lớn', odds: Number(sicboConfig.odds?.tai || 1.98) },
  { key: 'xiu', label: 'Nhỏ', odds: Number(sicboConfig.odds?.xiu || 1.98) },
  { key: 'odd', label: 'Lẻ', odds: Number(sicboConfig.odds?.odd || 1.98) },
  { key: 'even', label: 'Chẵn', odds: Number(sicboConfig.odds?.even || 1.98) }
])
const doubleBetOptions = computed(() =>
  [1, 2, 3, 4, 5, 6].map((face) => ({
    key: `double_${face}`,
    face,
    odds: Number(sicboConfig.odds?.[`double_${face}`] || 5.8)
  }))
)
const tripleBetOptions = computed(() =>
  [1, 2, 3, 4, 5, 6].map((face) => ({
    key: `triple_${face}`,
    face,
    odds: Number(sicboConfig.odds?.[`triple_${face}`] || 24)
  }))
)
const activeModeLabel = computed(() => {
  if (activeMode.value === 'double') return '2 số trùng'
  if (activeMode.value === 'triple') return '3 số trùng'
  return 'CLTX'
})

const historyRows = computed(() => {
  const shouldShowPendingRow =
    Boolean(roundLabel.value) &&
    (roundState.value.bettingOpen ||
      !roundHistory.value.some((item) => String(item.roundId) === String(roundLabel.value)))

  const rows = shouldShowPendingRow
    ? [
        {
          key: `pending-${roundLabel.value}`,
          roundId: roundLabel.value,
          pending: true,
          createdAt: new Date().toISOString()
        }
      ]
    : []

  return rows.concat(
    roundHistory.value.map((item) => ({
      ...item,
      key: `history-${item.roundId}`,
      pending: false
    }))
  )
})
const currentRoundBets = computed(() =>
  myBets.value.filter((bet) => String(bet.roundId) === String(roundLabel.value))
)
const groupedCurrentRoundBets = computed(() => {
  const groups = new Map()

  for (const bet of currentRoundBets.value) {
    const existing = groups.get(bet.gate) || {
      gate: bet.gate,
      amount: 0,
      payout: 0,
      count: 0,
      status: bet.status
    }

    existing.amount += Number(bet.amount || 0)
    existing.payout += Number(bet.payout || 0)
    existing.count += 1
    if (bet.status === 'won') existing.status = 'won'
    if (bet.status === 'lost' && existing.status !== 'won') existing.status = 'lost'

    groups.set(bet.gate, existing)
  }

  return Array.from(groups.values()).sort((left, right) => right.amount - left.amount)
})
const currentRoundStake = computed(() =>
  currentRoundBets.value.reduce((sum, bet) => sum + Number(bet.amount || 0), 0)
)
const gateTotals = computed(() => roundState.value.gateTotals || {})
const displayDiceValues = computed(() => {
  const fromCurrentRound = normalizeDiceResult(roundState.value.result)
  if (fromCurrentRound.length === 3) {
    return fromCurrentRound
  }

  const historyItem = roundHistory.value.find(
    (item) => Array.isArray(item.result) && item.result.length === 3
  )
  const fromHistory = normalizeDiceResult(historyItem?.result)
  if (fromHistory.length === 3) {
    return fromHistory
  }

  return [1, 2, 3]
})
function switchRoom(roomId) {
  router.replace({
    path: route.path,
    query: roomId === 'sicbo-5p' ? { room: 'sicbo-5p' } : {}
  })
}

function formatMoney(value) {
  return `$${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0))}`
}

function formatDate(value) {
  if (!value) return '--'
  return new Date(value).toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getDiceAsset(value) {
  const normalized = [1, 2, 3, 4, 5, 6].includes(Number(value)) ? Number(value) : 1
  return `/img/dice-${normalized}.svg`
}

function formatGateLabel(gate) {
  if (gate === 'tai') return 'Lớn'
  if (gate === 'xiu') return 'Nhỏ'
  if (gate === 'odd') return 'Lẻ'
  if (gate === 'even') return 'Chẵn'
  if (gate.startsWith('double_')) return `2 số ${gate.split('_')[1]}`
  if (gate.startsWith('triple_')) return `3 số ${gate.split('_')[1]}`
  return gate
}

function formatBetStatus(status, payout) {
  if (status === 'won') {
    return `Thắng ${formatMoney(payout)}`
  }

  if (status === 'lost') {
    return 'Thua'
  }

  if (status === 'placed') {
    return 'Đang chờ'
  }

  return status
}

function normalizeDiceResult(result) {
  if (!Array.isArray(result) || result.length !== 3) {
    return []
  }

  const normalized = result.map((value) => Number(value))
  const isValid = normalized.every((value) => Number.isInteger(value) && value >= 1 && value <= 6)
  return isValid ? normalized : []
}

async function loadConfig() {
  const data = await apiFetch(`/api/game/sicbo-config?roomId=${currentRoomId.value}`)
  Object.assign(sicboConfig, data.config || {})
  const normalized = Number(lastEnteredBetAmount.value || 0)
  if (!Number.isFinite(normalized) || normalized < Number(sicboConfig.minBet || 0)) {
    lastEnteredBetAmount.value = Number(sicboConfig.minBet || 1000)
  }
}

async function loadState() {
  const data = await apiFetch(`/api/game/sicbo-state?roomId=${currentRoomId.value}`)
  socketStore.hydrateRoundState(data.state || {})
}

async function loadMyBets() {
  if (!userStore.isLoggedIn) {
    myBets.value = []
    return
  }

  const data = await apiFetch(`/api/account/bets?roomId=${currentRoomId.value}&limit=100`, {
    headers: userStore.authHeaders
  })
  myBets.value = data.items || []
}

async function onBet(gate) {
  if (!userStore.user?._id) {
    alert('Vui lòng đăng nhập trước khi đặt cược')
    return
  }

  if (!canBet.value) {
    alert('Đã hết thời gian đặt cược')
    return
  }

  const rawInput = window.prompt(
    `Nhập số tiền cược cho cửa ${formatGateLabel(gate)} (${formatMoney(sicboConfig.minBet)} - ${formatMoney(
      sicboConfig.maxBet
    )})`,
    String(lastEnteredBetAmount.value || sicboConfig.minBet || 1000)
  )

  if (rawInput === null) {
    return
  }

  const amount = Math.floor(Number(String(rawInput).replace(/[^\d.]/g, '')))
  if (!Number.isFinite(amount)) {
    alert('Số tiền không hợp lệ')
    return
  }

  if (amount < Number(sicboConfig.minBet || 0) || amount > Number(sicboConfig.maxBet || 0)) {
    alert(`Số tiền cược phải trong khoảng ${formatMoney(sicboConfig.minBet)} - ${formatMoney(sicboConfig.maxBet)}`)
    return
  }

  lastEnteredBetAmount.value = amount

  const response = await socketStore.placeBet({
    userId: userStore.user._id,
    roomId: currentRoomId.value,
    gate,
    amount
  })

  if (!response?.ok) {
    alert(response?.message || 'Không thể đặt cược')
    return
  }

  userStore.setBalance(response.balance)
  if (response.bet) {
    myBets.value = [response.bet, ...myBets.value]
  } else {
    await loadMyBets()
  }
}

async function joinCurrentRoom() {
  await Promise.all([loadConfig(), loadState()])
  socketStore.connect()

  socketStore.joinSicboRoom(userStore.user?._id, currentRoomId.value)
  await loadMyBets()
}

onMounted(async () => {
  await joinCurrentRoom()
})

watch(currentRoomId, async () => {
  await joinCurrentRoom()
})

watch(
  () => userStore.user?._id,
  async (userId) => {
    socketStore.joinSicboRoom(userId, currentRoomId.value)
    await loadMyBets()
  }
)

watch(
  () => roundState.value.history?.length,
  async () => {
    await loadMyBets()
  }
)

watch(
  () => roundState.value.roundId,
  async () => {
    await loadMyBets()
  }
)

watch(
  () => roundState.value.config,
  (config) => {
    if (config && roundState.value.roomId === currentRoomId.value) {
      Object.assign(sicboConfig, config)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  // App dùng chung socket nên không ngắt ở đây.
})
</script>

<style scoped>
.sicbo-page {
  min-height: calc(100vh - 152px);
  padding: 14px 12px 20px;
  background: #18325e;
}

.sicbo-alert {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.14);
  color: #ffd5d5;
  font-size: 12px;
  line-height: 1.5;
}

.sicbo-room-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.sicbo-room-pill {
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  text-align: left;
}

.sicbo-room-pill small {
  display: block;
  color: rgba(255, 255, 255, 0.64);
  font-size: 11px;
}

.sicbo-room-pill strong {
  display: block;
  margin-top: 6px;
  font-size: 18px;
}

.sicbo-room-pill.active {
  background: linear-gradient(135deg, #294a87, #182f63);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.sicbo-card {
  padding: 14px 14px 18px;
  border-radius: 26px;
  background: #fcfbf6;
}

.sicbo-card__top {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}

.sicbo-card__session,
.sicbo-card__timer {
  text-align: center;
}

.sicbo-card__session span,
.sicbo-card__timer span {
  display: block;
  color: #222;
  font-size: 16px;
  font-weight: 600;
}

.sicbo-card__session strong {
  display: block;
  margin-top: 10px;
  font-size: 40px;
  line-height: 1;
  color: #111;
}

.sicbo-card__session button {
  margin-top: 16px;
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid #7c7c7c;
  background: transparent;
  color: #3c3c3c;
  font-size: 13px;
}

.sicbo-card__timer {
  padding-top: 8px;
}

.sicbo-card__timebox {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.sicbo-card__timebox strong {
  width: 44px;
  height: 48px;
  display: grid;
  place-items: center;
  background: #eef0f6;
  color: #20365c;
  font-size: 28px;
  font-weight: 800;
}

.sicbo-card__timebox em {
  font-style: normal;
  font-size: 30px;
  color: #1f1f1f;
}

.sicbo-card__stage {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: 22px;
  padding: 10px 8px;
  border-radius: 14px;
  background: linear-gradient(180deg, #24d384 0%, #11b76b 100%);
}

.sicbo-card__arrow {
  width: 14px;
  height: 42px;
  background: linear-gradient(180deg, #10d888 0%, #0cad6c 100%);
  clip-path: polygon(0 50%, 100% 0, 100% 100%);
  opacity: 1;
}

.sicbo-card__arrow--left {
  transform: translateX(1px);
}

.sicbo-card__arrow--right {
  transform: translateX(-1px) scaleX(-1);
}

.sicbo-card__dice-grid {
  position: relative;
  flex: 1;
  padding: 8px 8px 36px;
  border-radius: 10px;
  background: #111722;
  border: 2px solid #0f2239;
  min-height: 158px;
}

.sicbo-card__dice-timer {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 2;
  padding: 4px 8px;
  border-radius: 8px;
  background: rgba(14, 33, 65, 0.9);
  border: 1px solid rgba(67, 104, 162, 0.75);
  color: #66ebff;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.sicbo-card__dice-lanes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  min-height: 110px;
}

.sicbo-card__dice-slot {
  display: grid;
  place-items: center;
  border-radius: 4px;
  background:
    linear-gradient(180deg, #2f3440 0%, #181c26 100%);
  border: 1px solid rgba(0, 0, 0, 0.55);
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.4);
}

.sicbo-card__dice-item {
  width: 70px;
  height: 70px;
  object-fit: contain;
  filter: drop-shadow(0 5px 8px rgba(0, 0, 0, 0.44));
}

.sicbo-card__dice-status {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  z-index: 2;
  border-radius: 999px;
  padding: 4px 14px;
  background: rgba(3, 27, 62, 0.9);
  border: 1px solid rgba(104, 150, 211, 0.56);
  color: #dff0ff;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.sicbo-panel {
  margin-top: 14px;
  padding: 12px;
  border-radius: 14px;
  background: #233980;
}

.sicbo-panel__tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  overflow: hidden;
  border-radius: 10px;
  background: #f2f2f2;
}

.sicbo-panel__tabs button {
  height: 42px;
  border: none;
  background: transparent;
  color: #5d6474;
  font-size: 15px;
  font-weight: 700;
}

.sicbo-panel__tabs button.active {
  background: linear-gradient(180deg, #ffce32, #d7a200);
  color: #fff;
}

.sicbo-panel__bets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 12px;
}

.sicbo-panel__number-bets {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 12px;
}

.bet-card {
  min-height: 88px;
  border-radius: 12px;
  border: 2px solid rgba(255, 255, 255, 0.56);
  background: linear-gradient(180deg, #25438d, #183169);
  color: #fff;
  display: grid;
  place-items: center;
  gap: 4px;
  padding: 8px 4px;
}

.bet-card span {
  font-size: 18px;
  font-weight: 700;
}

.bet-card strong {
  font-size: 20px;
}

.bet-card small,
.number-bet-card small {
  display: block;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.72);
}

.bet-card:disabled {
  opacity: 0.7;
}

.number-bet-card {
  min-height: 74px;
  border-radius: 12px;
  border: 2px solid rgba(255, 255, 255, 0.42);
  background: linear-gradient(180deg, #3154a8, #1b356e);
  color: #fff;
  display: grid;
  place-items: center;
  gap: 4px;
  padding: 8px 4px;
}

.number-bet-card--triple {
  background: linear-gradient(180deg, #6a41c8, #3d237f);
}

.number-bet-card span {
  font-size: 15px;
  font-weight: 700;
}

.number-bet-card strong {
  font-size: 18px;
}

.number-bet-card:disabled {
  opacity: 0.7;
}

.sicbo-panel__status,
.sicbo-bet-hint {
  margin-top: 12px;
  color: #eef1f8;
  font-size: 13px;
}

.sicbo-panel__status {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.sicbo-panel__status strong {
  color: #fff0b1;
}

.sicbo-panel__status em {
  font-style: normal;
}

.sicbo-bet-hint {
  display: block;
  color: rgba(255, 255, 255, 0.86);
  line-height: 1.45;
}

.current-bets {
  margin-top: 12px;
  padding: 14px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.current-bets__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.current-bets__head h2 {
  margin: 0;
  font-size: 16px;
}

.current-bets__head span,
.current-bets__empty,
.current-bet-row span {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.76);
}

.current-bets__empty {
  padding-top: 12px;
}

.current-bets__list {
  margin-top: 12px;
}

.current-bet-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.current-bet-row + .current-bet-row {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.current-bet-row strong {
  display: block;
  font-size: 14px;
}

.current-bet-row em {
  font-style: normal;
  font-weight: 700;
  color: #fff2b1;
}

.history-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 16px;
  padding: 0 10px;
}

.history-switch button {
  padding-bottom: 10px;
  border: none;
  border-bottom: 2px solid rgba(255, 255, 255, 0.22);
  background: transparent;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
}

.history-switch button.active {
  border-bottom-color: #ffffff;
}

.history-board {
  margin-top: 12px;
  padding: 14px 10px 16px;
  border-radius: 12px;
  background: #ffffff;
}

.history-head,
.history-row {
  display: grid;
  grid-template-columns: 72px 1fr 118px;
  gap: 12px;
  align-items: center;
}

.history-head {
  padding: 0 4px 10px;
  color: #474747;
  font-size: 16px;
  font-weight: 700;
}

.history-list {
  max-height: 310px;
  overflow-y: auto;
}

.history-row {
  padding: 10px 4px;
  color: #4b5460;
  font-size: 14px;
}

.history-row + .history-row {
  border-top: 1px solid #edf0f4;
}

.history-row__result {
  min-width: 0;
}

.history-row__result em {
  color: #66a13f;
  font-style: normal;
}

.history-row__result--mine {
  display: grid;
  gap: 2px;
}

.history-row__result--mine strong {
  color: #1d315f;
}

.history-dice {
  display: inline-flex;
  gap: 4px;
}

.history-result-stack {
  display: grid;
  gap: 6px;
}

.history-result-stack__meta {
  color: #687487;
  font-size: 11px;
  line-height: 1.4;
}

.history-dice__item {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.history-empty {
  padding: 24px 12px;
  text-align: center;
  color: #667384;
}

.guide-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  align-items: end;
  background: rgba(6, 10, 24, 0.65);
}

.guide-modal {
  width: 100%;
  max-width: 414px;
  margin: 0 auto;
  padding: 18px 16px 26px;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  background: #fff;
  color: #20365c;
}

.guide-modal__head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.guide-modal__head span {
  display: block;
  color: #8390a7;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.guide-modal__head h2 {
  margin: 6px 0 0;
  font-size: 22px;
}

.guide-modal__head button {
  width: auto;
  padding: 8px 12px;
  border: none;
  border-radius: 999px;
  background: #edf1f7;
  color: #334566;
  font-size: 12px;
  font-weight: 700;
}

.guide-modal__body {
  display: grid;
  gap: 14px;
  margin-top: 16px;
}

.guide-block {
  padding: 14px;
  border-radius: 16px;
  background: #f6f8fc;
}

.guide-block strong {
  display: block;
  font-size: 15px;
}

.guide-block p {
  margin: 6px 0 0;
  color: #5d6b82;
  font-size: 13px;
  line-height: 1.55;
}

@media (max-width: 390px) {
  .sicbo-room-switch,
  .sicbo-panel__bets {
    grid-template-columns: repeat(2, 1fr);
  }

  .sicbo-panel__number-bets {
    grid-template-columns: repeat(2, 1fr);
  }

  .history-head,
  .history-row {
    grid-template-columns: 54px 1fr 92px;
    gap: 8px;
    font-size: 12px;
  }

  .sicbo-card__dice-item {
    width: 62px;
    height: 62px;
  }

  .sicbo-card__dice-timer {
    font-size: 13px;
    padding: 3px 7px;
  }
}
</style>
