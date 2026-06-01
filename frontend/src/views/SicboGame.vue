<template>
  <section class="sicbo-page">
    <transition name="settlement-toast-fade">
      <div
        v-if="settlementToast.visible"
        class="settlement-toast"
        :class="{
          'settlement-toast--win': settlementToast.kind === 'win',
          'settlement-toast--lose': settlementToast.kind === 'lose'
        }"
      >
        <div v-if="settlementToast.kind === 'win'" class="settlement-toast__fireworks" aria-hidden="true">
          <span v-for="particle in 18" :key="particle" :style="getFireworkStyle(particle)"></span>
        </div>

        <div class="settlement-toast__card">
          <small>Kết quả: {{ settlementToast.summary }}</small>
          <strong>{{ settlementToast.title }}</strong>
          <p>{{ settlementToast.message }}</p>
          <div v-if="settlementToast.amount > 0" class="settlement-toast__amount">
            +{{ formatMoney(settlementToast.amount) }}
          </div>
        </div>
      </div>
    </transition>

    <div v-if="socketStore.lastError" class="sicbo-alert">
      {{ socketStore.lastError }}
    </div>

    <div v-if="maintenanceMode" class="sicbo-maintenance">
      <strong>{{ currentRoomId === 'sicbo-5p' ? 'XÚC SẮC 5P đang bảo trì' : 'XÚC SẮC 3P đang bảo trì' }}</strong>
      <span>{{ maintenanceMessage }}</span>
    </div>

    <section class="sicbo-room-switch">
      <button
        type="button"
        class="sicbo-room-pill"
        :class="{ active: currentRoomId === 'sicbo-3p' }"
        @click="switchRoom('sicbo-3p')"
      >
        <span>
          <small>Phòng nhanh</small>
          <strong>Xúc sắc 3P</strong>
        </span>
        <em aria-hidden="true">⚂</em>
      </button>

      <button
        type="button"
        class="sicbo-room-pill"
        :class="{ active: currentRoomId === 'sicbo-5p' }"
        @click="switchRoom('sicbo-5p')"
      >
        <span>
          <small>Phòng ổn định</small>
          <strong>Xúc sắc 5P</strong>
        </span>
        <em aria-hidden="true">⚄</em>
      </button>
    </section>

    <div class="sicbo-card">
      <div class="sicbo-card__top">
        <div class="sicbo-card__session">
          <span>Phiên số</span>
          <strong>{{ roundLabel }}</strong>
          <button type="button" @click="showGuide = true">Hướng dẫn cách chơi</button>
        </div>

        <div class="sicbo-card__timer" :class="{ 'sicbo-card__timer--urgent': timeLeft <= 10 }">
          <span>Thời gian còn lại</span>
          <div class="sicbo-card__timebox">
            <strong>{{ minuteText }}</strong>
            <em>:</em>
            <strong>{{ secondText }}</strong>
          </div>
          <small>{{ canBet ? 'Đặt cược ngay!' : 'Đang chốt phiên' }}</small>
        </div>

        <div class="sicbo-card__total sicbo-card__total--history-only">
          <button type="button" @click="activeHistoryTab = 'table'">Lịch sử phiên</button>
        </div>
      </div>

      <div class="sicbo-card__stage">
        <div class="sicbo-card__arrow sicbo-card__arrow--left"></div>

        <div class="sicbo-card__dice-grid">
          <Dice3D :result="displayDiceValues" :rolling="isDiceRolling" :countdown="timeLeft" />
        </div>

        <div class="sicbo-card__arrow sicbo-card__arrow--right"></div>
      </div>
    </div>

    <section v-if="!maintenanceMode" class="sicbo-panel">
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
          :class="{ 'bet-card--active': isGateSelected(gate.key) }"
          @click="toggleGate(gate.key)"
        >
          <span>{{ gate.label }}</span>
          <strong>{{ formatOdds(gate.odds) }}</strong>
          <small v-if="getSelectedGateAmount(gate.key)" class="bet-card__amount">
            {{ formatMoney(getSelectedGateAmount(gate.key)) }}
          </small>
        </button>
      </div>

      <div v-else-if="activeMode === 'double'" class="sicbo-panel__number-bets">
        <button
          v-for="gate in doubleBetOptions"
          :key="gate.key"
          :disabled="!canBet"
          class="number-bet-card"
          :class="{ 'number-bet-card--active': isGateSelected(gate.key) }"
          @click="toggleGate(gate.key)"
        >
          <span>2 số {{ gate.face }}</span>
          <strong>{{ formatOdds(gate.odds) }}</strong>
          <small v-if="getSelectedGateAmount(gate.key)" class="number-bet-card__amount">
            {{ formatMoney(getSelectedGateAmount(gate.key)) }}
          </small>
        </button>
      </div>

      <div v-else class="sicbo-panel__number-bets">
        <button
          v-for="gate in tripleBetOptions"
          :key="gate.key"
          :disabled="!canBet"
          class="number-bet-card number-bet-card--triple"
          :class="{ 'number-bet-card--active': isGateSelected(gate.key) }"
          @click="toggleGate(gate.key)"
        >
          <span>3 số {{ gate.face }}</span>
          <strong>{{ formatOdds(gate.odds) }}</strong>
          <small v-if="getSelectedGateAmount(gate.key)" class="number-bet-card__amount">
            {{ formatMoney(getSelectedGateAmount(gate.key)) }}
          </small>
        </button>
      </div>

      <div class="compact-bet-bar" :class="{ 'compact-bet-bar--active': selectedGates.length }">
        <template v-if="selectedGates.length">
          <div class="compact-bet-row">
            <span class="compact-bet-selected">Đã chọn: {{ selectedGateLabels }}</span>
            <strong class="compact-bet-total">Tổng: {{ formatMoney(betPlan.total) }}</strong>
            <button class="compact-bet-cancel" type="button" @click="clearSelectedGates">Hủy</button>
          </div>

          <div class="compact-bet-control-row">
            <div class="compact-bet-toggle" role="group" aria-label="Chọn kiểu đặt cược">
              <button
                type="button"
                :class="{ active: betStrategy === 'manual' }"
                @click="betStrategy = 'manual'"
              >
                Mỗi cửa
              </button>
              <button
                type="button"
                :class="{ active: betStrategy === 'allin' }"
                @click="betStrategy = 'allin'"
              >
                Tất tay
              </button>
            </div>

            <input
              v-if="betStrategy === 'manual'"
              id="manualStake"
              v-model.number="manualStakeInput"
              type="number"
              class="compact-input"
              min="0"
              step="1"
              placeholder="Tối thiểu 10$"
            />
            <div v-else class="compact-allin">{{ formatMoney(userBalance) }}</div>

            <button
              class="compact-submit"
              :disabled="!canBet || submittingBet || !selectedGatePlans.length || Boolean(betPlan.error)"
              type="button"
              @click="confirmBet"
            >
              {{ submittingBet ? '...' : 'Đặt' }}
            </button>
          </div>

          <div class="compact-bet-meta">
            <span>{{ selectedGates.length }} cửa</span>
            <span v-if="selectedGatePlans.length">
              {{ selectedGatePlans.map((plan) => `${formatGateLabel(plan.gate)} ${formatMoney(plan.amount)}`).join(' · ') }}
            </span>
            <em v-if="betPlan.error">{{ betPlan.error }}</em>
          </div>
        </template>
        <template v-else>
          <div class="compact-bet-empty">Chọn cửa để đặt cược</div>
        </template>
      </div>

      <div class="sicbo-panel__status">
        <span>{{ activeModeLabel }} · Chọn nhiều cửa và đặt một lần</span>
        <strong>{{ selectedGates.length }} cửa đã chọn</strong>
      </div>
    </section>

    <section class="history-switch">
      <div class="history-switch__topline">
        <div class="history-switch__summary">
          <span>Phiên {{ roundLabel }}</span>
          <strong>{{ groupedCurrentRoundBets.length }} cửa · {{ formatMoney(currentRoundStake) }}</strong>
        </div>
        <div v-if="groupedCurrentRoundBets.length" class="history-switch__pills">
          <span v-for="bet in groupedCurrentRoundBets" :key="`summary-${bet.gate}`">
            {{ formatGateLabel(bet.gate) }} · {{ formatMoney(bet.amount) }}
          </span>
        </div>
      </div>
      <button :class="{ active: activeHistoryTab === 'table' }" @click="activeHistoryTab = 'table'">
        Lịch sử trò chơi
      </button>
      <button :class="{ active: activeHistoryTab === 'mine' }" @click="activeHistoryTab = 'mine'">
        Lịch sử của tôi
      </button>
    </section>

    <section class="history-board">
      <div v-if="activeHistoryTab === 'table'" class="history-head">
        <span>Phiên số</span>
        <span>Kết quả</span>
        <span>Thời gian</span>
      </div>
      <div v-else class="history-head history-head--mine">
        <span>Phiên số</span>
        <span>Kết quả</span>
        <span>Tiền cược</span>
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
                  <span
                    v-for="(value, index) in row.result"
                    :key="index"
                    class="history-dice__item"
                    :class="`history-dice__item--${value}`"
                    :aria-label="`Kết quả ${value}`"
                  >
                    <i v-for="pip in 9" :key="pip"></i>
                  </span>
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

        <div v-for="bet in myBets" :key="bet._id" class="history-row history-row--mine">
          <span>{{ bet.roundId }}</span>
          <div class="history-row__result history-row__result--mine">
            <strong>{{ formatGateLabel(bet.gate) }}</strong>
            <em>{{ formatBetStatus(bet.status, bet.payout) }}</em>
          </div>
          <span class="history-row__amount">{{ formatMoney(bet.amount) }}</span>
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
            <p>- Tỷ lệ hiện tại: {{ formatOdds(sicboConfig.odds?.double_1 || 0) }}</p>
          </div>

          <div class="guide-block">
            <strong>Cửa 3 số trùng</strong>
            <p>- Trúng khi cả 3 viên ra cùng đúng mặt số đã chọn.</p>
            <p>- Tỷ lệ hiện tại: {{ formatOdds(sicboConfig.odds?.triple_1 || 0) }}</p>
          </div>

          <div class="guide-block">
            <strong>Giới hạn phiên</strong>
            <p>- Cược tối thiểu: {{ formatMoney(sicboConfig.minBet) }}</p>
            <p>- Cược tối đa mỗi lệnh: {{ formatMaxBet(sicboConfig.maxBet) }}</p>
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
import Dice3D from '@/components/game/Dice3D.vue'
import { formatDateTimeVN } from '@/utils/vietnamTime'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const socketStore = useSocketStore()

const sicboConfig = reactive({
  roomId: 'sicbo-3p',
  title: 'Xúc sắc 3P',
  minBet: 1000,
  maxBet: 0,
  roundDuration: 240,
  betLockSeconds: 10,
  maintenanceEnabled: false,
  maintenanceMessage: 'Game Xúc sắc đang bảo trì. Vui lòng quay lại sau.',
  chipOptions: [1000, 5000, 10000, 50000],
  odds: {
    tai: 1.98,
    xiu: 1.98,
    odd: 1.98,
    even: 1.98
  }
})

const selectedGates = ref([])
const betStrategy = ref('manual')
const manualStakeInput = ref(null)
const submittingBet = ref(false)
const myBets = ref([])
const activeMode = ref('cltx')
const activeHistoryTab = ref('table')
const showGuide = ref(false)
const maintenanceMode = ref(false)
const maintenanceMessage = ref('Game Xúc sắc đang bảo trì. Vui lòng quay lại sau.')
const settlementToast = reactive({
  visible: false,
  kind: 'win',
  title: '',
  message: '',
  summary: '',
  amount: 0
})
const lastSettlementSignature = ref('')
const roundState = computed(() => socketStore.roundState)
const currentRoomId = computed(() =>
  route.query.room === 'sicbo-5p' ? 'sicbo-5p' : 'sicbo-3p'
)
const canBet = computed(
  () =>
    roundState.value.roomId === currentRoomId.value &&
    !maintenanceMode.value &&
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
  { key: 'even', label: 'Chẵn', odds: Number(sicboConfig.odds?.even || 1.98) },
  { key: 'odd', label: 'Lẻ', odds: Number(sicboConfig.odds?.odd || 1.98) }
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
const currentGateOptions = computed(() => {
  if (activeMode.value === 'double') return doubleBetOptions.value
  if (activeMode.value === 'triple') return tripleBetOptions.value
  return betOptions.value
})
const activeModeLabel = computed(() => {
  if (activeMode.value === 'double') return '2 số trùng'
  if (activeMode.value === 'triple') return '3 số trùng'
  return 'CLTX'
})
const userBalance = computed(() => Math.floor(Number(userStore.user?.balance || 0)))
const selectedGateLabels = computed(() =>
  selectedGates.value.map((gate) => formatGateLabel(gate)).join(' · ')
)
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
const roundTotalBetAmount = computed(() =>
  Object.values(gateTotals.value || {}).reduce((sum, value) => sum + Number(value || 0), 0)
)
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
const isDiceRolling = computed(() => {
  const status = String(roundState.value.status || '')
  if (['rolling', 'settling'].includes(status)) return true
  return (
    roundState.value.roomId === currentRoomId.value &&
    roundState.value.bettingOpen &&
    Number(roundState.value.timeLeft || 0) <= Number(sicboConfig.betLockSeconds || 10)
  )
})
const betPlan = computed(() => buildBetPlan())
const selectedGatePlans = computed(() => betPlan.value.plans || [])

let settlementToastTimer = null

function switchRoom(roomId) {
  router.replace({
    path: route.path,
    query: roomId === 'sicbo-5p' ? { room: 'sicbo-5p' } : {}
  })
}

function formatMoney(value) {
  return `${new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Number(value || 0))}$`
}

function formatMaxBet(value) {
  return Number(value || 0) > 0 ? formatMoney(value) : 'Không giới hạn'
}

function formatOdds(value) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2
  }).format(Number(value || 0))
}

function formatDate(value) {
  return formatDateTimeVN(value)
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

function getSelectedGateAmount(gate) {
  return Number(selectedGatePlans.value.find((item) => item.gate === gate)?.amount || 0)
}

function getRoundOutcomeSummary(result = []) {
  const values = normalizeDiceResult(result)
  if (values.length !== 3) return 'Đang chờ kết quả'

  const total = values.reduce((sum, value) => sum + value, 0)
  const triple = values[0] === values[1] && values[1] === values[2]
  const parts = [total % 2 === 0 ? 'Chẵn' : 'Lẻ']

  if (triple) {
    parts.push(`Bộ ba ${values[0]}`)
  } else {
    parts.push(total >= 11 ? 'Lớn' : 'Nhỏ')
  }

  return parts.join(' - ')
}

function getFireworkStyle(index) {
  const angle = (index / 18) * Math.PI * 2
  const distance = 68 + (index % 3) * 18
  const x = Math.cos(angle) * distance
  const y = Math.sin(angle) * distance * -1
  const hue = 42 + (index * 19) % 130

  return {
    '--tx': `${x}px`,
    '--ty': `${y}px`,
    '--delay': `${(index % 6) * 0.03}s`,
    '--color': `hsl(${hue} 100% 66%)`
  }
}

function hideSettlementToast() {
  settlementToast.visible = false
  if (settlementToastTimer) {
    window.clearTimeout(settlementToastTimer)
    settlementToastTimer = null
  }
}

function showSettlementToast({ kind = 'win', amount = 0, summary = '', totalStake = 0 } = {}) {
  hideSettlementToast()

  settlementToast.kind = kind
  settlementToast.summary = summary || 'Đang đối chiếu kết quả'
  settlementToast.amount = Math.max(0, Number(amount || 0))

  if (kind === 'win') {
    settlementToast.title = 'Chúc mừng bạn đã trúng thưởng'
    settlementToast.message = 'Tiền thưởng đã được cộng trực tiếp vào số dư của bạn.'
  } else {
    settlementToast.title = 'Phiên cược đã chốt kết quả'
    settlementToast.message =
      totalStake > 0
        ? `Phiên này chưa trúng thưởng. Tổng tiền cược: ${formatMoney(totalStake)}`
        : 'Phiên này không phát sinh tiền thắng.'
  }

  settlementToast.visible = true
  settlementToastTimer = window.setTimeout(() => {
    settlementToast.visible = false
    settlementToastTimer = null
  }, kind === 'win' ? 1800 : 1500)
}

async function handleSettledRound(historyEntry) {
  const roundId = String(historyEntry?.roundId || '')
  if (!roundId || !userStore.isLoggedIn) return

  const signature = `${currentRoomId.value}:${roundId}:${normalizeDiceResult(historyEntry?.result).join('-')}`
  if (!signature || signature === lastSettlementSignature.value) return

  lastSettlementSignature.value = signature
  await loadMyBets()

  const bets = myBets.value.filter(
    (bet) => String(bet.roomId || currentRoomId.value) === currentRoomId.value && String(bet.roundId) === roundId
  )

  if (!bets.length) {
    return
  }

  const totalStake = bets.reduce((sum, bet) => sum + Number(bet.amount || 0), 0)
  const totalWin = bets.reduce(
    (sum, bet) => sum + (bet.status === 'won' ? Number(bet.payout || 0) : 0),
    0
  )

  showSettlementToast({
    kind: totalWin > 0 ? 'win' : 'lose',
    amount: totalWin,
    totalStake,
    summary: getRoundOutcomeSummary(historyEntry?.result)
  })
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
  maintenanceMode.value = Boolean(data?.config?.maintenanceEnabled)
  maintenanceMessage.value = String(data?.config?.maintenanceMessage || 'Game Xúc sắc đang bảo trì. Vui lòng quay lại sau.')
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

function isGateSelected(gate) {
  return selectedGates.value.includes(gate)
}

function clearSelectedGates() {
  selectedGates.value = []
}

function sanitizeSelectedGates() {
  const allowed = new Set(currentGateOptions.value.map((gate) => gate.key))
  selectedGates.value = selectedGates.value.filter((gate) => allowed.has(gate))
}

function toggleGate(gate) {
  if (!userStore.user?._id) {
    alert('Vui lòng đăng nhập trước khi đặt cược')
    return
  }

  if (!canBet.value) {
    alert('Đã hết thời gian đặt cược')
    return
  }

  if (isGateSelected(gate)) {
    selectedGates.value = selectedGates.value.filter((item) => item !== gate)
    return
  }

  selectedGates.value = [...selectedGates.value, gate]
}

function distributeEvenly(totalAmount, count) {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0 || count <= 0) return []
  const base = Math.floor(totalAmount / count)
  const remainder = totalAmount % count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}

function buildBetPlan() {
  if (!selectedGates.value.length) {
    return { plans: [], total: 0, error: '' }
  }

  const minBet = Number(sicboConfig.minBet || 0)
  const maxBet = Number(sicboConfig.maxBet || 0)
  const hasMaxBet = maxBet > 0
  const plans = []

  if (betStrategy.value === 'manual') {
    const eachAmount = Math.floor(Number(manualStakeInput.value || 0))
    if (!Number.isFinite(eachAmount) || eachAmount <= 0) {
      return { plans: [], total: 0, error: 'Nhập số tiền mỗi cửa lớn hơn 0.' }
    }
    for (const gate of selectedGates.value) {
      plans.push({ gate, amount: eachAmount })
    }
  } else {
    const distributed = distributeEvenly(userBalance.value, selectedGates.value.length)
    for (let index = 0; index < selectedGates.value.length; index += 1) {
      plans.push({ gate: selectedGates.value[index], amount: distributed[index] || 0 })
    }
  }

  const total = plans.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  if (!total) {
    return { plans: [], total: 0, error: 'Không đủ số dư để tạo lệnh cược.' }
  }
  if (total > userBalance.value) {
    return { plans: [], total, error: 'Tổng tiền cược vượt quá số dư hiện tại.' }
  }
  if (plans.some((item) => item.amount < minBet)) {
    return { plans: [], total, error: `Mỗi cửa tối thiểu ${formatMoney(minBet)}.` }
  }
  if (hasMaxBet && plans.some((item) => item.amount > maxBet)) {
    return { plans: [], total, error: `Mỗi cửa tối đa ${formatMoney(maxBet)}.` }
  }

  return { plans, total, error: '' }
}

async function confirmBet() {
  if (!canBet.value) return

  const plan = betPlan.value
  if (!plan.plans.length || plan.error) {
    alert(plan.error || 'Không thể tạo lệnh cược')
    return
  }

  submittingBet.value = true
  const placedBets = []
  let successCount = 0
  let failureMessage = ''

  try {
    for (const item of plan.plans) {
      const response = await socketStore.placeBet({
        userId: userStore.user._id,
        roomId: currentRoomId.value,
        gate: item.gate,
        amount: item.amount
      })

      if (!response?.ok) {
        failureMessage = response?.message || 'Không thể đặt cược'
        if (response?.maintenance && response?.message) {
          maintenanceMode.value = true
          maintenanceMessage.value = response.message
        }
        break
      }

      successCount += 1
      if (typeof response.balance !== 'undefined') {
        userStore.setBalance(response.balance)
      }
      if (response.bet) {
        placedBets.push(response.bet)
      }
    }
  } finally {
    submittingBet.value = false
  }

  if (failureMessage) {
    await loadMyBets()
    if (successCount > 0) {
      alert(`Đã đặt ${successCount}/${plan.plans.length} cửa. ${failureMessage}`)
    } else {
      alert(failureMessage)
    }
    return
  }

  if (placedBets.length) {
    myBets.value = [...placedBets.reverse(), ...myBets.value]
  } else {
    await loadMyBets()
  }

  clearSelectedGates()
}

async function joinCurrentRoom() {
  await Promise.all([loadConfig(), loadState()])
  if (maintenanceMode.value) {
    clearSelectedGates()
    return
  }
  socketStore.connect()

  socketStore.joinSicboRoom(userStore.user?._id, currentRoomId.value)
  await loadMyBets()
}

onMounted(async () => {
  await joinCurrentRoom()
})

watch(currentRoomId, async () => {
  clearSelectedGates()
  await joinCurrentRoom()
})

watch(activeMode, () => {
  sanitizeSelectedGates()
})

watch(
  () => userStore.user?._id,
  async (userId) => {
    if (maintenanceMode.value) return
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
  () => roundHistory.value[0],
  async (historyEntry) => {
    if (!historyEntry || !Array.isArray(historyEntry.result) || historyEntry.result.length !== 3) {
      return
    }

    await handleSettledRound(historyEntry)
  },
  { deep: true }
)

watch(
  () => roundState.value.config,
  (config) => {
    if (config && roundState.value.roomId === currentRoomId.value) {
      Object.assign(sicboConfig, config)
      if (Object.prototype.hasOwnProperty.call(config, 'maintenanceEnabled')) {
        maintenanceMode.value = Boolean(config.maintenanceEnabled)
      }
      if (Object.prototype.hasOwnProperty.call(config, 'maintenanceMessage')) {
        maintenanceMessage.value = String(config.maintenanceMessage || maintenanceMessage.value || 'Game Xúc sắc đang bảo trì. Vui lòng quay lại sau.')
      }
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  hideSettlementToast()
  // App dùng chung socket nên không ngắt ở đây.
})
</script>

<style scoped>
.sicbo-page {
  min-height: calc(100vh - var(--member-header-height, 64px) - var(--member-nav-height, 86px));
  min-height: calc(100dvh - var(--member-header-height, 64px) - var(--member-nav-height, 86px));
  padding: 14px 12px 122px;
  background: #18325e;
}

.sicbo-maintenance {
  margin: 0 0 14px;
  padding: 18px 16px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(103, 18, 18, 0.94), rgba(152, 35, 35, 0.9));
  border: 1px solid rgba(255, 212, 212, 0.22);
  box-shadow: 0 16px 34px rgba(16, 18, 38, 0.22);
  display: grid;
  gap: 6px;
  color: #fff;
}

.sicbo-maintenance strong {
  font-size: 17px;
  font-weight: 900;
}

.sicbo-maintenance span {
  color: rgba(255,255,255,0.84);
  line-height: 1.45;
}

.settlement-toast {
  position: fixed;
  inset: 0;
  z-index: 10020;
  display: grid;
  place-items: center;
  padding: 24px;
  background: radial-gradient(circle at top, rgba(255, 214, 102, 0.24), rgba(7, 15, 34, 0.86) 54%);
  pointer-events: none;
  overflow-y: auto;
}

.settlement-toast__card {
  position: relative;
  width: min(100%, 420px);
  padding: 24px 22px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(18, 36, 80, 0.96), rgba(7, 18, 47, 0.98));
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.35);
  color: #fff;
  text-align: center;
  overflow: hidden;
}

.settlement-toast__card small {
  display: block;
  color: rgba(206, 228, 255, 0.86);
  font-size: 13px;
  letter-spacing: 0.02em;
}

.settlement-toast__card strong {
  display: block;
  margin-top: 10px;
  font-size: 28px;
  line-height: 1.18;
}

.settlement-toast__card p {
  margin: 10px 0 0;
  color: rgba(232, 241, 255, 0.86);
  font-size: 14px;
  line-height: 1.55;
}

.settlement-toast__amount {
  margin-top: 16px;
  font-size: 32px;
  font-weight: 800;
  color: #ffe16f;
  text-shadow: 0 0 18px rgba(255, 227, 117, 0.45);
  animation: settlement-blink 0.52s ease-in-out infinite alternate;
}

.settlement-toast__fireworks {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.settlement-toast__fireworks span {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: radial-gradient(circle, #fff 0%, var(--color) 45%, rgba(255,255,255,0) 72%);
  box-shadow: 0 0 14px color-mix(in srgb, var(--color) 78%, white 22%);
  animation: firework-burst 1s ease-out forwards;
  animation-delay: var(--delay);
}

.settlement-toast--win .settlement-toast__card {
  background: linear-gradient(180deg, rgba(17, 50, 98, 0.96), rgba(10, 27, 58, 0.98));
}

.settlement-toast--lose .settlement-toast__card {
  background: linear-gradient(180deg, rgba(43, 55, 90, 0.96), rgba(19, 28, 51, 0.98));
}

.settlement-toast-fade-enter-active,
.settlement-toast-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.settlement-toast-fade-enter-from,
.settlement-toast-fade-leave-to {
  opacity: 0;
}

@keyframes settlement-blink {
  from {
    opacity: 0.62;
    transform: scale(0.96);
  }

  to {
    opacity: 1;
    transform: scale(1.04);
  }
}

@keyframes firework-burst {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.2);
  }

  12% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translate(var(--tx), var(--ty)) scale(1.8);
  }
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
  position: relative;
  padding: 12px 14px;
  border: 1px solid rgba(164, 196, 255, 0.18);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(48, 78, 141, 0.92), rgba(26, 44, 92, 0.94));
  color: #fff;
  text-align: left;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
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
  border-color: rgba(133, 226, 255, 0.95);
  background: linear-gradient(135deg, rgba(94, 152, 255, 0.98), rgba(27, 76, 163, 0.98));
  box-shadow: 0 0 0 2px rgba(129, 216, 255, 0.22), 0 14px 28px rgba(19, 45, 93, 0.36);
  transform: translateY(-1px);
}

.sicbo-room-pill.active small {
  color: rgba(230, 248, 255, 0.84);
}

.sicbo-card {
  padding: 14px 14px 18px;
  border-radius: 26px;
  background: linear-gradient(180deg, #fffdf7 0%, #f7f3e8 100%);
  box-shadow: 0 24px 40px rgba(7, 19, 46, 0.18);
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
  padding: 14px 10px;
  border-radius: 18px;
  background: linear-gradient(180deg, #27d086 0%, #005a39 100%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12), 0 16px 30px rgba(0, 49, 31, 0.26);
}

.sicbo-card__arrow {
  width: 14px;
  height: 42px;
  background: linear-gradient(180deg, #1ab070 0%, #006b3a 100%);
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
  flex: 1;
  padding: 6px;
  border-radius: 16px;
  background:
    radial-gradient(circle at top, rgba(34, 111, 73, 0.3), transparent 38%),
    linear-gradient(180deg, #003c26 0%, #022a1c 100%);
  border: 2px solid rgba(90, 204, 150, 0.32);
  min-height: 168px;
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

.bet-card--active,
.number-bet-card--active {
  border-color: #8ad7ff;
  background: linear-gradient(180deg, #4175da, #1b3f86);
  box-shadow: 0 0 0 2px rgba(138, 215, 255, 0.2), 0 12px 20px rgba(12, 24, 58, 0.26);
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
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease;
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

.number-bet-card--active {
  border-color: #78f0ff;
  background: linear-gradient(180deg, #39a4ff, #1f4ac0);
  box-shadow: 0 0 0 2px rgba(120, 240, 255, 0.24), 0 16px 24px rgba(9, 26, 63, 0.34);
  transform: translateY(-1px) scale(1.02);
}

.number-bet-card--triple.number-bet-card--active {
  background: linear-gradient(180deg, #8e69ff, #4b28ae);
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

.history-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 16px;
  padding: 0 10px;
}

.history-switch__topline {
  grid-column: 1 / -1;
  display: grid;
  gap: 10px;
}

.history-switch__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.84);
}

.history-switch__summary span {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.history-switch__summary strong {
  font-size: 14px;
  color: #fff0b8;
}

.history-switch__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.history-switch__pills span {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(116, 177, 255, 0.16);
  border: 1px solid rgba(145, 204, 255, 0.22);
  color: #f4f7ff;
  font-size: 12px;
  font-weight: 600;
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

.history-head--mine,
.history-row--mine {
  grid-template-columns: 64px 1fr 96px 118px;
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

.history-row__amount {
  color: #d38b05;
  font-weight: 800;
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

/* Bet bar */
.bet-composer {
  margin-top: 14px;
  padding: 14px 14px 16px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(15, 31, 67, 0.98), rgba(8, 21, 47, 0.98));
  border: 1px solid rgba(146, 194, 255, 0.18);
  box-shadow: 0 18px 28px rgba(5, 12, 28, 0.32);
  backdrop-filter: blur(10px);
}

.bet-composer--inline {
  margin-top: 16px;
}

.bet-composer__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.bet-composer__head span,
.bet-composer__head small,
.bet-composer__info,
.bet-composer__summary {
  color: rgba(235, 240, 255, 0.72);
}

.bet-composer__head span,
.bet-composer__field label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.bet-composer__head strong {
  display: block;
  margin-top: 4px;
  font-size: 16px;
  line-height: 1.4;
  color: #fff;
}

.bet-composer__head small {
  font-size: 12px;
  text-align: right;
}

.bet-composer__modes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 12px;
}

.bet-composer__modes button {
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.72);
  font-size: 13px;
  font-weight: 700;
}

.bet-composer__modes button.active {
  border-color: rgba(130, 224, 255, 0.95);
  background: linear-gradient(135deg, #1d4fa8, #2b7bd8);
  color: #fff;
}

.bet-composer__info {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.45;
}

.bet-composer__field {
  margin-top: 12px;
}

.bet-composer__input {
  width: 100%;
  height: 42px;
  margin-top: 8px;
  padding: 0 14px;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 12px;
  background: rgba(255,255,255,0.08);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  outline: none;
}

.bet-composer__input::placeholder {
  color: rgba(255,255,255,0.38);
}

.bet-composer__allin,
.bet-composer__summary,
.bet-composer__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.bet-composer__allin {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255,255,255,0.05);
}

.bet-composer__allin strong,
.bet-composer__total {
  color: #ffb34a;
}

.bet-composer__summary {
  margin-top: 12px;
  font-size: 13px;
}

.bet-composer__plans {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.bet-composer__plan-pill {
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(120, 175, 255, 0.16);
  border: 1px solid rgba(140, 208, 255, 0.22);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.bet-composer__error {
  margin: 12px 0 0;
  color: #ff9ea7;
  font-size: 12px;
  line-height: 1.45;
}

.bet-composer__actions {
  margin-top: 14px;
}

.bet-bar__cancel {
  padding: 8px 14px;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  background: transparent;
  color: rgba(255,255,255,0.6);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.bet-bar__submit {
  min-width: 112px;
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #3366ff, #5577ff);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.bet-bar__submit:disabled {
  opacity: 0.5;
}

.guide-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10010;
  display: grid;
  align-items: end;
  background: rgba(6, 10, 24, 0.65);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.guide-modal {
  width: 100%;
  max-width: 520px;
  max-height: calc(100dvh - 24px);
  margin: 0 auto;
  padding: 18px 16px 26px;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  background: #fff;
  color: #20365c;
  overflow-y: auto;
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

  .history-head--mine,
  .history-row--mine {
    grid-template-columns: 46px 1fr 74px 92px;
  }

  .bet-composer {
    padding: 12px;
  }

  .bet-composer__head,
  .bet-composer__summary,
  .bet-composer__allin,
  .bet-composer__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .history-switch__summary {
    flex-direction: column;
    align-items: flex-start;
  }

  .bet-composer__head small {
    text-align: left;
  }

  .bet-bar__submit,
  .bet-bar__cancel {
    width: 100%;
  }
}

/* Premium neon casino UI - visual only, betting logic unchanged */
.sicbo-page {
  --bg-main: #07142d;
  --bg-panel: #0d2350;
  --bg-panel-2: #142f68;
  --blue: #1f88ff;
  --cyan: #00d4ff;
  --gold: #f8b400;
  --orange: #ff8a3d;
  --green: #21d07a;
  --red: #ff4d5a;
  --text-main: #ffffff;
  --text-muted: #9fb4d8;
  --border-soft: rgba(255, 255, 255, 0.12);
  min-height: calc(100dvh - var(--member-header-height, 64px) - var(--member-nav-height, 86px));
  padding: 18px 14px 132px;
  color: var(--text-main);
  background:
    radial-gradient(circle at 50% 0%, rgba(31, 136, 255, 0.34), transparent 26%),
    radial-gradient(circle at 86% 42%, rgba(214, 61, 255, 0.18), transparent 24%),
    linear-gradient(180deg, #07142d 0%, #0a1a3d 48%, #060c21 100%);
  overflow-x: hidden;
}

.sicbo-room-switch {
  gap: 14px;
  margin-bottom: 16px;
}

.sicbo-room-pill {
  display: flex;
  min-height: 86px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 16px 14px;
  border-radius: 22px;
  border: 1px solid rgba(123, 178, 255, 0.22);
  background:
    radial-gradient(circle at 82% 30%, rgba(86, 105, 255, 0.2), transparent 28%),
    linear-gradient(145deg, rgba(15, 35, 78, 0.94), rgba(7, 20, 48, 0.96));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 26px rgba(0, 8, 30, 0.22);
}

.sicbo-room-pill small {
  color: rgba(214, 229, 255, 0.74);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.sicbo-room-pill strong {
  margin-top: 7px;
  color: #fff;
  font-size: clamp(16px, 4.6vw, 23px);
  line-height: 1.05;
  text-transform: uppercase;
  text-shadow: 0 0 14px rgba(255,255,255,0.22);
}

.sicbo-room-pill em {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 14px;
  background:
    radial-gradient(circle at 30% 28%, rgba(255,255,255,0.34), transparent 22%),
    linear-gradient(145deg, #2aa7ff, #1450c4);
  box-shadow: 0 0 24px rgba(31, 136, 255, 0.46);
  color: #fff;
  font-style: normal;
  font-size: 25px;
}

.sicbo-room-pill.active {
  border-color: rgba(0, 212, 255, 0.92);
  background:
    radial-gradient(circle at 84% 28%, rgba(0, 212, 255, 0.26), transparent 30%),
    linear-gradient(145deg, rgba(18, 76, 174, 0.98), rgba(6, 29, 74, 0.98));
  box-shadow:
    0 0 0 1px rgba(0, 212, 255, 0.28),
    0 0 30px rgba(31, 136, 255, 0.34),
    0 18px 34px rgba(0, 8, 30, 0.3);
}

.sicbo-card {
  position: relative;
  padding: 18px 14px 16px;
  border-radius: 24px;
  border: 1px solid rgba(93, 170, 255, 0.24);
  background:
    radial-gradient(circle at 50% 30%, rgba(31, 136, 255, 0.15), transparent 36%),
    linear-gradient(180deg, rgba(13, 35, 80, 0.9), rgba(7, 19, 49, 0.96));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.08),
    0 20px 44px rgba(0, 6, 26, 0.36);
  overflow: hidden;
}

.sicbo-card::before {
  content: '';
  position: absolute;
  inset: -60% -20% auto;
  height: 160px;
  background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.14), transparent);
  transform: rotate(-8deg);
  pointer-events: none;
}

.sicbo-card__top {
  position: relative;
  z-index: 1;
  grid-template-columns: 0.92fr 1.14fr 0.94fr;
  gap: 10px;
  align-items: center;
}

.sicbo-card__session,
.sicbo-card__timer,
.sicbo-card__total {
  text-align: center;
}

.sicbo-card__total--history-only {
  display: flex;
  align-items: center;
  justify-content: center;
}

.sicbo-card__session span,
.sicbo-card__timer span,
.sicbo-card__total span {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sicbo-card__session strong {
  margin-top: 8px;
  color: #fff;
  font-size: clamp(30px, 8vw, 42px);
  font-weight: 950;
  text-shadow: 0 0 18px rgba(255,255,255,0.24);
}

.sicbo-card__session button,
.sicbo-card__total button {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(144, 200, 255, 0.24);
  background: rgba(255,255,255,0.04);
  color: #eef7ff;
  font-size: 11px;
  font-weight: 800;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
}

.sicbo-card__total--history-only button {
  margin-top: 0;
}

.sicbo-card__timer {
  padding-top: 0;
}

.sicbo-card__timebox {
  gap: 8px;
  margin-top: 8px;
}

.sicbo-card__timebox strong {
  width: auto;
  min-width: 46px;
  height: 48px;
  border-radius: 9px;
  background:
    radial-gradient(circle at 50% 20%, rgba(255,255,255,0.28), transparent 32%),
    linear-gradient(180deg, rgba(29, 95, 196, 0.48), rgba(15, 40, 96, 0.72));
  color: #ffffff;
  font-size: clamp(29px, 8vw, 42px);
  font-weight: 950;
  text-shadow:
    0 0 14px rgba(0, 212, 255, 0.72),
    0 0 26px rgba(255, 78, 216, 0.36);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.16),
    0 0 22px rgba(0, 212, 255, 0.18);
}

.sicbo-card__timebox em {
  color: #eaf7ff;
  font-weight: 950;
  text-shadow: 0 0 12px rgba(255,255,255,0.28);
}

.sicbo-card__timer small {
  display: block;
  margin-top: 8px;
  color: #ffe084;
  font-size: 12px;
  font-weight: 900;
}

.sicbo-card__timer--urgent .sicbo-card__timebox strong {
  color: #fff1d9;
  text-shadow: 0 0 18px rgba(255, 77, 90, 0.9), 0 0 30px rgba(255, 138, 61, 0.7);
  animation: sicbo-timer-pulse 0.8s ease-in-out infinite alternate;
}

.sicbo-card__total strong {
  display: block;
  margin-top: 8px;
  color: #ffd56b;
  font-size: clamp(17px, 4.8vw, 25px);
  font-weight: 950;
  line-height: 1.2;
  text-shadow: 0 0 18px rgba(248, 180, 0, 0.36);
}

.sicbo-card__stage {
  margin-top: 22px;
  padding: 12px 10px;
  border-radius: 24px;
  border: 1px solid rgba(0, 212, 255, 0.26);
  background:
    radial-gradient(circle at 50% 10%, rgba(0, 212, 255, 0.18), transparent 36%),
    linear-gradient(180deg, rgba(13, 41, 80, 0.98), rgba(4, 14, 34, 0.98));
  box-shadow:
    0 0 0 3px rgba(31, 136, 255, 0.08),
    0 0 34px rgba(0, 212, 255, 0.18),
    0 0 46px rgba(255, 77, 216, 0.1),
    inset 0 1px 0 rgba(255,255,255,0.1);
}

.sicbo-card__arrow {
  opacity: 0.58;
  background: linear-gradient(180deg, rgba(0, 212, 255, 0.7), rgba(31, 136, 255, 0.08));
}

.sicbo-card__dice-grid {
  padding: 7px;
  border-radius: 20px;
  border: 1px solid rgba(0, 212, 255, 0.26);
  background:
    linear-gradient(90deg, rgba(31, 136, 255, 0.2), rgba(255, 77, 216, 0.16)),
    linear-gradient(180deg, #071a3e, #030b1f);
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.04),
    inset 0 0 30px rgba(0, 212, 255, 0.1);
}

.sicbo-card__dice-grid :deep(.dice3d-wrap) {
  min-height: 170px;
  border-radius: 18px;
  background:
    radial-gradient(circle at 50% 28%, rgba(31, 136, 255, 0.26), transparent 44%),
    linear-gradient(180deg, #0e2145, #050d22);
  box-shadow:
    inset 0 0 0 2px rgba(0, 212, 255, 0.18),
    inset 0 0 34px rgba(31, 136, 255, 0.13),
    0 0 28px rgba(0, 212, 255, 0.16);
}

.sicbo-card__dice-grid :deep(.dice3d-table__frame) {
  background: linear-gradient(180deg, #0d2041 0%, #061226 100%);
  box-shadow:
    inset 0 0 0 2px rgba(0, 212, 255, 0.18),
    inset 0 12px 28px rgba(255,255,255,0.05);
}

.sicbo-card__dice-grid :deep(.dice3d-table__floor) {
  background:
    linear-gradient(180deg, rgba(41, 210, 122, 0.95) 0%, rgba(23, 156, 92, 0.95) 100%);
  box-shadow: 0 0 28px rgba(33, 208, 122, 0.26);
}

.sicbo-card__dice-grid :deep(.dice3d-table__lane-glow-cell) {
  box-shadow:
    inset 0 0 0 1px rgba(0, 212, 255, 0.14),
    0 0 22px rgba(0, 212, 255, 0.16);
}

.sicbo-panel {
  margin-top: 16px;
  padding: 12px;
  border-radius: 20px;
  border: 1px solid rgba(109, 179, 255, 0.18);
  background:
    radial-gradient(circle at 50% 0%, rgba(31, 136, 255, 0.15), transparent 34%),
    linear-gradient(180deg, rgba(20, 47, 104, 0.92), rgba(11, 29, 70, 0.98));
  box-shadow: 0 18px 36px rgba(0, 7, 27, 0.3);
}

.sicbo-panel__tabs {
  padding: 4px;
  border-radius: 15px;
  background: rgba(255,255,255,0.92);
}

.sicbo-panel__tabs button {
  height: 44px;
  border-radius: 12px;
  color: #2b3d65;
  font-size: 14px;
  transition: transform 0.16s ease, background 0.16s ease, color 0.16s ease;
}

.sicbo-panel__tabs button.active {
  background: linear-gradient(180deg, #ffcf35, #e5a900);
  color: #ffffff;
  text-shadow: 0 1px 0 rgba(89, 53, 0, 0.26);
  box-shadow: 0 7px 18px rgba(248, 180, 0, 0.28);
}

.sicbo-panel__bets {
  gap: 11px;
}

.bet-card,
.number-bet-card {
  position: relative;
  overflow: hidden;
  min-height: 92px;
  border-radius: 16px;
  border: 1px solid rgba(139, 191, 255, 0.4);
  background:
    radial-gradient(circle at 50% 15%, rgba(31, 136, 255, 0.18), transparent 40%),
    linear-gradient(180deg, rgba(31, 63, 131, 0.92), rgba(13, 35, 82, 0.98));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.08),
    0 12px 26px rgba(0, 8, 31, 0.24);
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease;
}

.bet-card::before,
.number-bet-card::before {
  content: '';
  position: absolute;
  inset: 10px 12px auto;
  height: 26px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(0, 212, 255, 0.16), transparent 72%);
  opacity: 0.7;
}

.bet-card span,
.number-bet-card span {
  position: relative;
  z-index: 1;
  color: #fff;
  font-size: 19px;
  font-weight: 950;
  text-shadow: 0 0 14px rgba(255,255,255,0.2);
}

.number-bet-card span {
  font-size: 15px;
}

.bet-card strong,
.number-bet-card strong {
  position: relative;
  z-index: 1;
  color: #f3f7ff;
  font-size: 21px;
  font-weight: 950;
}

.bet-card__amount,
.number-bet-card__amount {
  position: relative;
  z-index: 1;
  margin-top: 2px;
  color: #ffd66b !important;
  font-size: 12px !important;
  font-weight: 900;
  text-shadow: 0 0 12px rgba(248, 180, 0, 0.35);
}

.bet-card--active,
.number-bet-card--active,
.number-bet-card--triple.number-bet-card--active {
  border-color: rgba(0, 212, 255, 0.98);
  background:
    radial-gradient(circle at 50% 18%, rgba(0, 212, 255, 0.26), transparent 42%),
    linear-gradient(180deg, rgba(41, 111, 214, 0.98), rgba(16, 55, 132, 0.98));
  box-shadow:
    0 0 0 1px rgba(0, 212, 255, 0.34),
    0 0 25px rgba(0, 212, 255, 0.62),
    0 0 38px rgba(31, 136, 255, 0.34),
    inset 0 1px 0 rgba(255,255,255,0.2);
  transform: translateY(-1px) scale(1.02);
}

.bet-card:disabled,
.number-bet-card:disabled {
  filter: saturate(0.78);
  opacity: 0.62;
}

.sicbo-panel__status {
  align-items: center;
  margin-top: 12px;
  padding: 9px 10px;
  border-radius: 13px;
  background: rgba(255,255,255,0.06);
  color: rgba(238, 247, 255, 0.86);
}

.sicbo-panel__status strong {
  color: #ffd66b;
}

.bet-composer {
  border-radius: 20px;
  border: 1px solid rgba(0, 212, 255, 0.2);
  background:
    radial-gradient(circle at 50% 0%, rgba(31, 136, 255, 0.17), transparent 36%),
    linear-gradient(180deg, rgba(11, 35, 82, 0.98), rgba(5, 16, 42, 0.98));
  box-shadow:
    0 0 28px rgba(0, 212, 255, 0.12),
    0 20px 34px rgba(0, 7, 29, 0.36);
}

.bet-composer--sheet {
  position: sticky;
  bottom: calc(var(--member-nav-height, 86px) + 12px);
  z-index: 10000;
  max-height: min(68dvh, 520px);
  margin: 12px -2px 0;
  padding: 14px 14px calc(14px + env(safe-area-inset-bottom, 0px));
  overflow-y: auto;
  overscroll-behavior: contain;
  border-radius: 22px 22px 18px 18px;
  border-color: rgba(0, 212, 255, 0.32);
  background:
    radial-gradient(circle at 50% 0%, rgba(31, 136, 255, 0.22), transparent 36%),
    linear-gradient(180deg, rgba(13, 23, 56, 0.98), rgba(5, 12, 34, 0.99));
  box-shadow:
    0 -8px 34px rgba(0, 212, 255, 0.16),
    0 22px 50px rgba(0, 0, 0, 0.46),
    inset 0 1px 0 rgba(255,255,255,0.1);
  animation: bet-sheet-rise 0.2s ease-out;
}

.bet-composer__sheet-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(132, 195, 255, 0.16);
}

.bet-composer__sheet-title strong {
  color: #fff;
  font-size: 18px;
  font-weight: 950;
  text-shadow: 0 0 14px rgba(0, 212, 255, 0.28);
}

.bet-composer__sheet-title span {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(248, 180, 0, 0.14);
  border: 1px solid rgba(248, 180, 0, 0.3);
  color: #ffe199;
  font-size: 12px;
  font-weight: 900;
}

.bet-composer__modes {
  grid-template-columns: repeat(2, 1fr);
}

.bet-composer__modes button {
  height: 42px;
  border-radius: 14px;
  border-color: rgba(127, 190, 255, 0.2);
  background: rgba(255,255,255,0.06);
  color: rgba(232, 243, 255, 0.78);
}

.bet-composer__modes button.active {
  border-color: rgba(0, 212, 255, 0.9);
  background: linear-gradient(135deg, #1f88ff, #1260d8);
  box-shadow: 0 0 18px rgba(0, 212, 255, 0.26);
}

.bet-composer__modes button:nth-child(2).active {
  border-color: rgba(248, 180, 0, 0.9);
  background: linear-gradient(135deg, #f8b400, #ff8a3d);
  color: #fff;
  box-shadow: 0 0 22px rgba(248, 180, 0, 0.34);
}

.bet-composer__input {
  height: 48px;
  border-radius: 14px;
  border-color: rgba(118, 188, 255, 0.24);
  background: rgba(3, 14, 37, 0.76);
}

.bet-composer__input:focus {
  border-color: rgba(0, 212, 255, 0.95);
  box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.14), 0 0 22px rgba(0, 212, 255, 0.2);
}

.bet-composer__input:invalid {
  border-color: rgba(255, 77, 90, 0.82);
}

.bet-composer__allin,
.bet-composer__summary {
  border-radius: 14px;
  background: rgba(255,255,255,0.06);
  padding: 10px 12px;
}

.bet-composer__plans {
  gap: 7px;
}

.bet-composer__plan-pill {
  border-color: rgba(248, 180, 0, 0.28);
  background: rgba(248, 180, 0, 0.12);
  color: #ffe39a;
}

.bet-bar__cancel,
.bet-bar__submit {
  height: 48px;
  border-radius: 14px;
  font-weight: 950;
}

.bet-bar__cancel {
  min-width: 110px;
  border-color: rgba(127, 190, 255, 0.22);
  background: linear-gradient(180deg, rgba(18, 45, 94, 0.82), rgba(8, 24, 56, 0.92));
  color: rgba(238, 247, 255, 0.82);
}

.bet-bar__submit {
  min-width: 150px;
  background:
    radial-gradient(circle at 30% 20%, rgba(255,255,255,0.28), transparent 28%),
    linear-gradient(180deg, #ffce35, #f18a18);
  box-shadow: 0 0 24px rgba(248, 180, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.28);
  color: #fff;
  text-shadow: 0 1px 0 rgba(111, 61, 0, 0.35);
}

.bet-bar__submit:not(:disabled) {
  animation: sicbo-button-glow 1.4s ease-in-out infinite alternate;
}

.bet-bar__submit:disabled {
  background: linear-gradient(180deg, rgba(85, 110, 151, 0.74), rgba(46, 65, 100, 0.82));
  box-shadow: none;
  color: rgba(255,255,255,0.62);
}

.history-switch {
  margin-top: 18px;
  padding: 0;
  gap: 12px;
}

.history-switch__summary {
  border: 1px solid rgba(116, 177, 255, 0.18);
  background: rgba(255,255,255,0.07);
}

.history-switch button {
  color: rgba(232, 243, 255, 0.72);
  border-bottom-color: rgba(0, 212, 255, 0.16);
}

.history-switch button.active {
  color: #ffffff;
  border-bottom-color: var(--cyan);
  text-shadow: 0 0 14px rgba(0, 212, 255, 0.42);
}

.history-board {
  border: 1px solid rgba(116, 177, 255, 0.16);
  border-radius: 18px;
  background: rgba(246, 250, 255, 0.98);
  box-shadow: 0 18px 34px rgba(0, 7, 28, 0.2);
  overflow-x: auto;
}

.history-head {
  color: #0f244d;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.history-row {
  color: #23395f;
}

@keyframes sicbo-timer-pulse {
  from {
    transform: scale(0.98);
  }

  to {
    transform: scale(1.04);
  }
}

@keyframes sicbo-button-glow {
  from {
    box-shadow: 0 0 18px rgba(248, 180, 0, 0.28), inset 0 1px 0 rgba(255,255,255,0.28);
  }

  to {
    box-shadow: 0 0 30px rgba(248, 180, 0, 0.48), inset 0 1px 0 rgba(255,255,255,0.32);
  }
}

@keyframes bet-sheet-rise {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 430px) {
  .sicbo-page {
    padding: 14px 10px 124px;
  }

  .sicbo-room-switch {
    gap: 10px;
  }

  .sicbo-room-pill {
    min-height: 78px;
    padding: 13px 11px;
    border-radius: 18px;
  }

  .sicbo-room-pill em {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    font-size: 21px;
  }

  .sicbo-card {
    padding: 15px 11px 13px;
    border-radius: 22px;
  }

  .sicbo-card__top {
    grid-template-columns: 0.92fr 1.16fr 0.92fr;
    gap: 6px;
  }

  .sicbo-card__session span,
  .sicbo-card__timer span,
  .sicbo-card__total span {
    font-size: 9px;
  }

  .sicbo-card__session strong {
    font-size: 28px;
  }

  .sicbo-card__timebox strong {
    min-width: 38px;
    height: 42px;
    font-size: 28px;
  }

  .sicbo-card__timebox em {
    font-size: 24px;
  }

  .sicbo-card__session button,
  .sicbo-card__total button {
    padding: 7px 8px;
    font-size: 10px;
  }

  .sicbo-card__total strong {
    font-size: 15px;
  }

  .sicbo-card__stage {
    padding: 10px 7px;
  }

  .sicbo-card__dice-grid {
    min-height: 0;
  }

  .sicbo-card__dice-grid :deep(.dice3d-wrap) {
    min-height: 154px;
  }

  .sicbo-panel {
    padding: 10px;
  }

  .sicbo-panel__tabs button {
    height: 40px;
    font-size: 13px;
  }

  .sicbo-panel__bets {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .bet-card {
    min-height: 84px;
    padding: 8px 3px;
  }

  .bet-card span {
    font-size: 17px;
  }

  .bet-card strong {
    font-size: 19px;
  }

  .sicbo-panel__number-bets {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .bet-composer--sheet {
    bottom: calc(var(--member-nav-height, 86px) + 8px);
    max-height: min(62dvh, 470px);
    margin-left: -4px;
    margin-right: -4px;
  }

  .bet-composer__head,
  .bet-composer__summary,
  .bet-composer__allin {
    flex-direction: row;
    align-items: center;
  }

  .bet-composer__actions {
    display: grid;
    grid-template-columns: 0.85fr 1.15fr;
  }

  .bet-bar__submit,
  .bet-bar__cancel {
    width: 100%;
  }
}

@media (max-width: 370px) {
  .sicbo-card__top {
    grid-template-columns: 1fr 1fr;
  }

  .sicbo-card__total {
    grid-column: 1 / -1;
  }

  .sicbo-panel__bets {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sicbo-panel__number-bets {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Pixel-level compact game layout */
.sicbo-page {
  padding: 0 10px 64px;
}

.sicbo-room-switch {
  height: 80px;
  gap: 10px;
  margin-bottom: 0;
  align-items: center;
}

.sicbo-room-pill {
  min-height: 0;
  height: 64px;
  padding: 10px 12px;
  border-radius: 16px;
}

.sicbo-room-pill strong {
  margin-top: 4px;
  font-size: clamp(15px, 4.2vw, 19px);
}

.sicbo-room-pill em {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  font-size: 20px;
}

.sicbo-card {
  padding: 0;
  border-radius: 18px;
  background: transparent;
  box-shadow: none;
  border: none;
  overflow: visible;
}

.sicbo-card::before {
  display: none;
}

.sicbo-card__top {
  height: 100px;
  grid-template-columns: 0.9fr 1.16fr 0.94fr;
  gap: 6px;
  align-items: center;
  padding: 10px;
  border-radius: 18px;
  border: 1px solid rgba(93, 170, 255, 0.24);
  background:
    radial-gradient(circle at 50% 30%, rgba(31, 136, 255, 0.15), transparent 36%),
    linear-gradient(180deg, rgba(13, 35, 80, 0.9), rgba(7, 19, 49, 0.96));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.08),
    0 14px 28px rgba(0, 6, 26, 0.26);
}

.sicbo-card__session span,
.sicbo-card__timer span,
.sicbo-card__total span {
  font-size: 9px;
}

.sicbo-card__session strong {
  margin-top: 5px;
  font-size: 31px;
}

.sicbo-card__session button,
.sicbo-card__total button {
  margin-top: 7px;
  padding: 5px 8px;
  font-size: 9px;
}

.sicbo-card__timer small {
  margin-top: 4px;
  font-size: 10px;
}

.sicbo-card__timebox {
  gap: 5px;
  margin-top: 5px;
}

.sicbo-card__timebox strong {
  min-width: 38px;
  height: 40px;
  font-size: 30px;
  line-height: 1;
}

.sicbo-card__timebox em {
  font-size: 24px;
}

.sicbo-card__total strong {
  margin-top: 6px;
  font-size: 16px;
}

.sicbo-card__stage {
  height: 170px;
  margin-top: 0;
  padding: 14px;
  border-radius: 22px;
  background:
    radial-gradient(circle at center, rgba(0, 212, 255, 0.16), transparent 58%),
    linear-gradient(180deg, #102b61 0%, #07142d 100%);
  border: 1px solid rgba(0, 212, 255, 0.28);
  box-shadow:
    0 0 24px rgba(0, 212, 255, 0.18),
    inset 0 0 18px rgba(0, 212, 255, 0.1);
}

.sicbo-card__arrow {
  display: none;
}

.sicbo-card__dice-grid {
  height: 120px;
  min-height: 120px;
  padding: 0;
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)),
    linear-gradient(180deg, #0b1a3d, #050b1f);
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow:
    inset 0 8px 20px rgba(255,255,255,0.05),
    inset 0 -12px 24px rgba(0,0,0,0.42),
    0 12px 30px rgba(0,0,0,0.35);
  overflow: hidden;
}

.sicbo-card__dice-grid::before {
  content: '';
  position: absolute;
  inset: 16px 24px;
  border-radius: 16px;
  background: radial-gradient(circle at center, rgba(0,212,255,0.12), transparent 60%);
  pointer-events: none;
}

.sicbo-card__dice-grid :deep(.dice3d-wrap) {
  height: 120px !important;
  min-height: 120px !important;
  max-height: 120px !important;
  border-radius: 18px;
  background:
    radial-gradient(circle at center, rgba(0,212,255,0.18), transparent 55%),
    linear-gradient(180deg, #142f68 0%, #07142d 100%) !important;
}

.sicbo-card__dice-grid :deep(.dice3d-table) {
  inset: 0;
}

.sicbo-card__dice-grid :deep(.dice3d-table__frame) {
  border-radius: 18px;
  background:
    radial-gradient(circle at center, rgba(0,212,255,0.16), transparent 58%),
    linear-gradient(180deg, #0b1a3d, #050b1f) !important;
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow:
    inset 0 8px 20px rgba(255,255,255,0.05),
    inset 0 -12px 24px rgba(0,0,0,0.42),
    inset 0 0 12px rgba(0,212,255,0.1) !important;
}

.sicbo-card__dice-grid :deep(.dice3d-table__floor),
.sicbo-card__dice-grid :deep(.dice3d-table__lane-glow-cell) {
  background:
    linear-gradient(180deg, rgba(0,212,255,0.12), rgba(255,255,255,0.03)) !important;
  box-shadow:
    inset 0 0 0 1px rgba(0,212,255,0.14),
    0 0 16px rgba(0,212,255,0.12) !important;
}

.sicbo-card__dice-grid :deep(.dice3d-table__floor) {
  height: 54px;
  left: 18px;
  right: 18px;
  bottom: 12px;
}

.sicbo-card__dice-grid :deep(.dice3d-table__wall) {
  height: 72px;
}

.sicbo-card__dice-grid :deep(.dice3d-table__wall-panel) {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 42%),
    linear-gradient(180deg, #1a2948, #0d172d) !important;
}

.sicbo-card__dice-grid :deep(.dice3d-canvas),
.dice-img,
.dice-cube,
.dice-result img {
  max-width: 100% !important;
  object-fit: contain;
}

.sicbo-panel {
  height: 240px;
  margin-top: 0;
  padding: 10px;
  border-radius: 18px;
}

.sicbo-panel__tabs {
  height: 46px;
}

.sicbo-panel__tabs button {
  height: 38px;
  font-size: 13px;
}

.sicbo-panel__bets,
.sicbo-panel__number-bets {
  margin-top: 8px;
  gap: 8px;
}

.sicbo-panel__bets {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.sicbo-panel__number-bets {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.sicbo-panel__number-bets::-webkit-scrollbar {
  display: none;
}

.bet-card,
.number-bet-card {
  min-height: 0;
  height: 72px;
  border-radius: 14px;
  padding: 7px 3px;
}

.number-bet-card {
  flex: 0 0 72px;
}

.bet-card span,
.number-bet-card span {
  font-size: 15px;
}

.bet-card strong,
.number-bet-card strong {
  font-size: 17px;
}

.bet-card__amount,
.number-bet-card__amount {
  font-size: 10px !important;
}

.compact-bet-bar {
  position: relative;
  height: 90px;
  margin-top: 8px;
  padding: 7px 9px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(20,47,104,0.95), rgba(7,20,45,0.96));
  border: 1px solid rgba(0,212,255,0.22);
  box-shadow: 0 10px 24px rgba(0,0,0,0.28);
  overflow: hidden;
}

.compact-bet-empty {
  height: 100%;
  display: grid;
  place-items: center;
  color: rgba(231, 244, 255, 0.72);
  font-size: 13px;
  font-weight: 800;
}

.compact-bet-row {
  height: 24px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 7px;
}

.compact-bet-selected {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
}

.compact-bet-total {
  color: #ffd66b;
  font-size: 12px;
  white-space: nowrap;
}

.compact-bet-cancel {
  height: 24px;
  padding: 0 7px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 999px;
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.72);
  font-size: 10px;
  font-weight: 800;
}

.compact-bet-control-row {
  height: 38px;
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr) 74px;
  gap: 8px;
  align-items: center;
}

.compact-bet-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 38px;
  padding: 3px;
  border-radius: 12px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
}

.compact-bet-toggle button {
  border: none;
  border-radius: 9px;
  background: transparent;
  color: rgba(255,255,255,0.68);
  font-size: 11px;
  font-weight: 900;
}

.compact-bet-toggle button.active {
  background: linear-gradient(135deg, #1f88ff, #1260d8);
  color: #fff;
  box-shadow: 0 0 14px rgba(0,212,255,0.24);
}

.compact-bet-toggle button:nth-child(2).active {
  background: linear-gradient(135deg, #f8b400, #ff8a3d);
}

.compact-input,
.compact-allin {
  width: 100%;
  height: 38px;
  min-width: 0;
  border-radius: 12px;
  background: #07142d;
  border: 1px solid rgba(255,255,255,0.12);
  color: #fff;
  padding: 0 10px;
  font-size: 13px;
  font-weight: 800;
  outline: none;
}

.compact-input:focus {
  border-color: rgba(0,212,255,0.82);
  box-shadow: 0 0 0 2px rgba(0,212,255,0.12);
}

.compact-allin {
  display: flex;
  align-items: center;
  color: #ffd66b;
}

.compact-submit {
  height: 38px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(180deg, #f8c84b, #ff8a3d);
  color: #fff;
  font-weight: 950;
  font-size: 13px;
  box-shadow: 0 0 18px rgba(248,180,0,0.28);
}

.compact-submit:disabled {
  background: linear-gradient(180deg, rgba(85,110,151,0.74), rgba(46,65,100,0.82));
  box-shadow: none;
  color: rgba(255,255,255,0.6);
}

.compact-bet-meta {
  height: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: rgba(215, 231, 255, 0.62);
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
}

.compact-bet-meta span,
.compact-bet-meta em {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.compact-bet-meta em {
  color: #ff7b8a;
  font-style: normal;
  font-weight: 800;
}

.sicbo-panel__status {
  display: none;
}

.history-switch {
  height: auto;
  margin-top: 8px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.history-switch__topline {
  display: none;
}

.history-switch__summary {
  height: auto;
  flex-direction: row;
  align-items: center;
  border-radius: 14px;
  padding: 9px 12px;
}

.history-switch > button {
  display: block;
  height: 38px;
  padding: 0 6px 8px;
  font-size: 13px;
}

.history-board {
  display: block;
  max-height: 220px;
  margin-top: 8px;
  overflow: hidden;
}

.history-list {
  max-height: 168px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.history-head,
.history-row {
  grid-template-columns: 58px minmax(0, 1fr) 96px;
  gap: 8px;
  font-size: 12px;
}

.history-head--mine,
.history-row--mine {
  grid-template-columns: 48px minmax(0, 1fr) 78px 92px;
}

.history-dice__item {
  width: 18px;
  height: 18px;
}

@media (max-width: 430px) {
  .sicbo-page {
    padding: 0 8px 64px;
  }

  .sicbo-card {
    padding: 0;
  }

  .sicbo-card__stage {
    height: 170px;
    padding: 13px;
  }

  .sicbo-card__dice-grid,
  .sicbo-card__dice-grid :deep(.dice3d-wrap) {
    height: 120px !important;
    min-height: 120px !important;
  }

  .sicbo-panel__number-bets {
    display: flex;
  }
}

@media (max-width: 390px) {
  .compact-bet-control-row {
    grid-template-columns: 116px minmax(0, 1fr) 64px;
    gap: 6px;
  }

  .compact-bet-toggle button {
    font-size: 10px;
  }

  .compact-submit {
    font-size: 12px;
  }
}

/* Final mobile layout correction: keep betting/history compact and readable. */
.sicbo-panel {
  height: auto;
  min-height: 0;
  padding: 10px;
  overflow: visible;
}

.sicbo-panel__tabs {
  height: 42px;
  padding: 4px;
  border-radius: 14px;
}

.sicbo-panel__tabs button {
  height: 34px;
  border-radius: 11px;
  font-size: 13px;
  line-height: 1;
}

.sicbo-panel__bets {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 9px;
}

.sicbo-panel__number-bets {
  margin-top: 9px;
  gap: 8px;
}

.bet-card,
.number-bet-card {
  height: 68px;
  min-height: 68px;
  padding: 6px 3px;
  border-radius: 13px;
}

.bet-card span,
.number-bet-card span {
  font-size: 14px;
  line-height: 1.05;
}

.bet-card strong,
.number-bet-card strong {
  font-size: 17px;
  line-height: 1.1;
}

.bet-card__amount,
.number-bet-card__amount {
  margin-top: 0;
  font-size: 10px !important;
}

.compact-bet-bar {
  height: 82px;
  margin-top: 9px;
  padding: 8px;
  border-radius: 16px;
}

.compact-bet-empty {
  font-size: 13px;
  color: rgba(231, 244, 255, 0.78);
}

.compact-bet-row {
  height: 22px;
  grid-template-columns: minmax(0, 1fr) auto auto;
}

.compact-bet-control-row {
  height: 36px;
  grid-template-columns: 124px minmax(0, 1fr) 68px;
}

.compact-bet-toggle,
.compact-input,
.compact-allin,
.compact-submit {
  height: 36px;
}

.compact-bet-toggle button {
  font-size: 10px;
}

.compact-bet-meta {
  height: 12px;
  margin-top: 2px;
}

.history-switch {
  margin: 10px 0 0;
  padding: 0 2px;
  gap: 8px;
}

.history-switch > button {
  height: 34px;
  padding: 0 4px 7px;
  border-bottom-width: 2px;
  font-size: 13px;
}

.history-board {
  margin-top: 8px;
  padding: 10px 8px;
  border-radius: 14px;
  max-height: 210px;
  overflow-x: hidden;
  overflow-y: hidden;
  background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
}

.history-list {
  max-height: 154px;
  overflow-y: auto;
}

.history-head,
.history-row {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) 90px;
  align-items: center;
  gap: 7px;
}

.history-head {
  padding: 0 0 8px;
  color: #122757;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.history-row {
  min-height: 42px;
  padding: 8px 0;
  color: #24385e;
  font-size: 11px;
  border-top: 1px solid #e7edf7;
}

.history-row > span:first-child {
  font-weight: 900;
  color: #0f2f6d;
}

.history-row > span:last-child {
  text-align: right;
  line-height: 1.25;
  color: #44556f;
}

.history-row__result {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.history-row__result em {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 0 9px;
  border-radius: 999px;
  background: #eef7eb;
  color: #338a28;
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
  white-space: nowrap;
}

.history-result-stack {
  display: grid;
  justify-items: center;
  gap: 3px;
  min-width: 0;
}

.history-dice {
  gap: 3px;
}

.history-dice__item {
  width: 18px;
  height: 18px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 1px;
  padding: 3px;
  border-radius: 5px;
  background:
    radial-gradient(circle at 28% 18%, rgba(255,255,255,0.9), rgba(255,255,255,0.08) 18%, transparent 36%),
    linear-gradient(145deg, #ff5949 0%, #e30d0d 56%, #9d0000 100%);
  border: 1px solid rgba(123, 0, 0, 0.35);
  box-shadow:
    inset 1px 1px 2px rgba(255,255,255,0.5),
    inset -1px -1px 2px rgba(62,0,0,0.45),
    0 1px 3px rgba(0,0,0,0.18);
}

.history-dice__item i {
  width: 3px;
  height: 3px;
  align-self: center;
  justify-self: center;
  border-radius: 999px;
  background:
    radial-gradient(circle at 30% 25%, #ffffff 0%, #ffffff 35%, #dfe7f0 74%, #aebdcc 100%);
  box-shadow: 0 0 1px rgba(255,255,255,0.95), inset 0 -0.5px 0.5px rgba(96,105,116,0.35);
  opacity: 0;
}

.history-dice__item--1 i:nth-child(5),
.history-dice__item--2 i:nth-child(1),
.history-dice__item--2 i:nth-child(9),
.history-dice__item--3 i:nth-child(1),
.history-dice__item--3 i:nth-child(5),
.history-dice__item--3 i:nth-child(9),
.history-dice__item--4 i:nth-child(1),
.history-dice__item--4 i:nth-child(3),
.history-dice__item--4 i:nth-child(7),
.history-dice__item--4 i:nth-child(9),
.history-dice__item--5 i:nth-child(1),
.history-dice__item--5 i:nth-child(3),
.history-dice__item--5 i:nth-child(5),
.history-dice__item--5 i:nth-child(7),
.history-dice__item--5 i:nth-child(9),
.history-dice__item--6 i:nth-child(1),
.history-dice__item--6 i:nth-child(3),
.history-dice__item--6 i:nth-child(4),
.history-dice__item--6 i:nth-child(6),
.history-dice__item--6 i:nth-child(7),
.history-dice__item--6 i:nth-child(9) {
  opacity: 1;
}

.history-result-stack__meta {
  max-width: 100%;
  color: #2b4670;
  font-size: 9px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-head--mine,
.history-row--mine {
  grid-template-columns: 46px minmax(0, 1fr) 72px 82px;
}

.history-row--mine .history-row__result {
  justify-content: flex-start;
}

.history-row__result--mine strong {
  font-size: 11px;
}

.history-row__result--mine em {
  min-height: 0;
  padding: 0;
  background: transparent;
  font-size: 10px;
}

.history-row__amount {
  text-align: right;
  font-size: 11px;
}

@media (max-width: 390px) {
  .compact-bet-control-row {
    grid-template-columns: 112px minmax(0, 1fr) 62px;
  }

  .history-head,
  .history-row {
    grid-template-columns: 52px minmax(0, 1fr) 78px;
    gap: 6px;
  }

  .history-head--mine,
  .history-row--mine {
    grid-template-columns: 42px minmax(0, 1fr) 62px 72px;
  }
}
</style>
