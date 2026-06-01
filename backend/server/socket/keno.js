// file: server/socket/keno.js
const mongoose = require('mongoose')
const crypto = require('crypto')
const User = require('../models/User')
const Bet = require('../models/Bet')
const KenoRound = require('../models/KenoRound')
const SiteConfig = require('../models/SiteConfig')
const WalletService = require('../services/walletService')
const { verifyAccessToken } = require('../utils/auth')

const walletService = new WalletService()

const ROOM_DEFAULT = 'keno-1p'
const RESULT_DELAY_MS = 3500

const ROOM_SEEDS = {
  'keno-1p': 1000,
  'keno-3p': 3000,
  'keno-5p': 5000
}

const ROOM_PRESETS = {
  'keno-1p': {
    roomId: 'keno-1p',
    title: 'Keno 1P',
    roundDuration: 60,
    betLockSeconds: 5,
    minBet: 1000,
    maxBet: 50000,
    odds: { tai: 1.98, xiu: 1.98, odd: 1.98, even: 1.98 }
  },
  'keno-3p': {
    roomId: 'keno-3p',
    title: 'Keno 3P',
    roundDuration: 180,
    betLockSeconds: 6,
    minBet: 1000,
    maxBet: 80000,
    odds: { tai: 1.98, xiu: 1.98, odd: 1.98, even: 1.98 }
  },
  'keno-5p': {
    roomId: 'keno-5p',
    title: 'Keno 5P',
    roundDuration: 300,
    betLockSeconds: 8,
    minBet: 1000,
    maxBet: 100000,
    odds: { tai: 1.98, xiu: 1.98, odd: 1.98, even: 1.98 }
  }
}

const roundStatuses = {
  BETTING: 'betting',
  ROLLING: 'rolling',
  SETTLING: 'settling',
  SETTLED: 'settled'
}

const roomStates = new Map()
const roomLoops = new Map()
const roomCounters = new Map()
const roomReadyPromises = new Map()
const roomSettleLocks = new Set()

async function getKenoMaintenanceConfig() {
  const config = await SiteConfig.findOne({ key: 'main' }).lean()
  return {
    enabled: config?.kenoMaintenanceEnabled !== false,
    message: String(config?.kenoMaintenanceMessage || 'Game KENO đang bảo trì. Vui lòng quay lại sau.').trim()
  }
}

function resolveRoomId(roomId = ROOM_DEFAULT) {
  return ROOM_PRESETS[roomId] ? roomId : ROOM_DEFAULT
}

function getRoomConfig(roomId = ROOM_DEFAULT) {
  const resolved = resolveRoomId(roomId)
  return JSON.parse(JSON.stringify(ROOM_PRESETS[resolved]))
}

function normalizeForcedResult(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 99) return null
  return numeric
}

function rollNumber() {
  return Math.floor(Math.random() * 100) // 0..99
}

function buildSummary(resultNumber) {
  const num = Number(resultNumber)
  const taiXiu = num >= 50 ? 'tai' : 'xiu'
  const parity = num % 2 === 0 ? 'even' : 'odd'
  return {
    resultNumber: num,
    taiXiu,
    parity,
    winningGates: [taiXiu, parity]
  }
}

function toHistoryItem(round) {
  return {
    roundId: round.roundId,
    resultNumber: round.resultNumber,
    winningGates: round.winningGates || [],
    createdAt: round.settledAt || round.updatedAt || round.createdAt
  }
}

async function loadRoomHistory(roomId, limit = 20) {
  const rounds = await KenoRound.find({ roomId, status: roundStatuses.SETTLED })
    .sort({ settledAt: -1, createdAt: -1 })
    .limit(limit)
    .lean()
  return rounds.map(toHistoryItem)
}

async function ensureRoomCounter(roomId) {
  if (roomCounters.has(roomId)) return

  const latestRound = await KenoRound.findOne({ roomId }).sort({ createdAt: -1 }).select('roundId').lean()
  const latestNumeric = Number(latestRound?.roundId)
  const seed = ROOM_SEEDS[roomId] || ROOM_SEEDS[ROOM_DEFAULT]
  const nextRoundId = Number.isFinite(latestNumeric) && latestNumeric >= seed ? latestNumeric + 1 : seed
  roomCounters.set(roomId, nextRoundId)
}

async function consumeNextRoundId(roomId) {
  await ensureRoomCounter(roomId)
  const next = roomCounters.get(roomId)
  roomCounters.set(roomId, next + 1)
  return String(next)
}

function getRoundStartAt(roundOrState) {
  return new Date(roundOrState.roundStartTime || roundOrState.openedAt || roundOrState.createdAt || Date.now())
}

function getBetCloseAt(roundStartAt, configSnapshot) {
  const roundDuration = Number(configSnapshot.roundDuration || 0)
  const betLockSeconds = Number(configSnapshot.betLockSeconds || 0)
  const openWindowSeconds = Math.max(roundDuration - betLockSeconds, 1)
  return new Date(roundStartAt.getTime() + openWindowSeconds * 1000)
}

function getRemainingTime(roundOrState) {
  const startedAt = getRoundStartAt(roundOrState).getTime()
  const durationMs = Number(roundOrState.configSnapshot?.roundDuration || 0) * 1000
  const remainingMs = startedAt + durationMs - Date.now()
  return Math.max(0, Math.ceil(remainingMs / 1000))
}

function createEmptyGateTotals(configSnapshot) {
  const odds = configSnapshot?.odds || {}
  return Object.fromEntries(Object.keys(odds).map((gate) => [gate, 0]))
}

function buildStateFromRound(round, history = []) {
  const roomId = resolveRoomId(round.roomId)
  const configSnapshot = round.configSnapshot && Object.keys(round.configSnapshot || {}).length
    ? round.configSnapshot
    : getRoomConfig(roomId)
  const roundStartAt = getRoundStartAt(round)
  const betCloseAt = round.betCloseTime ? new Date(round.betCloseTime) : getBetCloseAt(roundStartAt, configSnapshot)
  const timeLeft = getRemainingTime({ roundStartTime: roundStartAt, configSnapshot })
  const canBetByTime = Date.now() < betCloseAt.getTime()
  const bettingOpen = round.status === roundStatuses.BETTING && canBetByTime && timeLeft > 0

  return {
    roomId,
    roundDbId: String(round._id),
    roundId: round.roundId,
    status: round.status || roundStatuses.BETTING,
    timeLeft,
    bettingOpen,
    history,
    betTotalAmount: Number(round.betTotalAmount || 0),
    betCount: Number(round.betCount || 0),
    gateTotals: {
      ...createEmptyGateTotals(configSnapshot),
      ...(round.gateTotals || {})
    },
    configSnapshot,
    forcedResult: normalizeForcedResult(round.forcedResult),
    forcedNote: String(round.forcedNote || ''),
    resultNumber: typeof round.resultNumber === 'number' ? Number(round.resultNumber) : null,
    winningGates: round.winningGates || [],
    roundStartTime: roundStartAt,
    betCloseTime: betCloseAt,
    openedAt: round.openedAt || roundStartAt,
    bettingClosedAt: round.bettingClosedAt || null,
    settledAt: round.settledAt || null,
    summary: round.status === roundStatuses.SETTLED ? toHistoryItem(round) : null,
    settling: round.status === roundStatuses.SETTLING
  }
}

function buildRoomPayload(state) {
  const latestSummary = state.history?.[0] || null
  return {
    roomId: state.roomId,
    roundId: state.roundId,
    status: state.status,
    timeLeft: state.timeLeft,
    bettingOpen: state.bettingOpen,
    betTotalAmount: Number(state.betTotalAmount || 0),
    betCount: Number(state.betCount || 0),
    gateTotals: { ...(state.gateTotals || {}) },
    latestSummary,
    summary: state.summary || latestSummary,
    config: state.configSnapshot || getRoomConfig(state.roomId),
    resultNumber: state.resultNumber,
    winningGates: state.winningGates || []
  }
}

function buildAdminSnapshot(state) {
  return {
    ...buildRoomPayload(state),
    forcedResult: normalizeForcedResult(state.forcedResult),
    forcedNote: String(state.forcedNote || '')
  }
}

async function createRoundRecord(roomId) {
  const config = getRoomConfig(roomId)
  const roundId = await consumeNextRoundId(roomId)
  const roundStartTime = new Date()
  const betCloseTime = getBetCloseAt(roundStartTime, config)
  return KenoRound.create({
    roomId,
    roundId,
    status: roundStatuses.BETTING,
    configSnapshot: config,
    gateTotals: createEmptyGateTotals(config),
    roundStartTime,
    betCloseTime,
    openedAt: roundStartTime
  })
}

async function findUnfinishedRound(roomId) {
  return KenoRound.findOne({
    roomId,
    status: { $in: [roundStatuses.BETTING, roundStatuses.ROLLING, roundStatuses.SETTLING] }
  }).sort({ createdAt: -1 })
}

async function materializeRoomState(round) {
  const history = await loadRoomHistory(round.roomId)
  const state = buildStateFromRound(round, history)
  roomStates.set(round.roomId, state)
  return state
}

async function ensureRoomState(roomId = ROOM_DEFAULT) {
  const resolvedRoomId = resolveRoomId(roomId)

  if (roomStates.has(resolvedRoomId)) {
    const state = roomStates.get(resolvedRoomId)
    if (state.status === roundStatuses.BETTING) {
      state.timeLeft = getRemainingTime(state)
      state.bettingOpen = Date.now() < new Date(state.betCloseTime).getTime() && state.timeLeft > 0
    }
    return state
  }

  if (roomReadyPromises.has(resolvedRoomId)) {
    return roomReadyPromises.get(resolvedRoomId)
  }

  const bootPromise = (async () => {
    let unfinished = await findUnfinishedRound(resolvedRoomId)
    if (!unfinished) {
      unfinished = await createRoundRecord(resolvedRoomId)
    }
    return materializeRoomState(unfinished.toObject ? unfinished.toObject() : unfinished)
  })().finally(() => {
    roomReadyPromises.delete(resolvedRoomId)
  })

  roomReadyPromises.set(resolvedRoomId, bootPromise)
  return bootPromise
}

function acquireSettleLock(roomId) {
  if (roomSettleLocks.has(roomId)) return false
  roomSettleLocks.add(roomId)
  return true
}

function releaseSettleLock(roomId) {
  roomSettleLocks.delete(roomId)
}

function normalizeGate(gate) {
  const allowed = ['tai', 'xiu', 'odd', 'even']
  return allowed.includes(gate) ? gate : null
}

function normalizeClientBetId(clientBetId) {
  return String(clientBetId || '').trim().slice(0, 100)
}

function buildIdempotencyTransactionId({ userId, roomId, roundId, clientBetId }) {
  const seed = `${String(userId)}:${String(roomId)}:${String(roundId)}:${String(clientBetId)}`
  const hex = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 24)
  return new mongoose.Types.ObjectId(hex)
}

async function findExistingClientBet({ roomId, roundId, userId, clientBetId }) {
  if (!clientBetId) return null
  return Bet.findOne({
    roomId,
    roundId,
    userId,
    'resultSnapshot.clientBetId': clientBetId
  })
    .sort({ createdAt: -1 })
    .lean()
}

async function placeKenoBet({ roomId, roundId, userId, gate, amount, clientBetId }) {
  const config = getRoomConfig(roomId)
  const normalizedGate = normalizeGate(gate)
  const numericAmount = Number(amount)
  const normalizedClientBetId = normalizeClientBetId(clientBetId)

  if (!normalizedGate) {
    const err = new Error('Cửa cược không hợp lệ')
    err.code = 'INVALID_GATE'
    throw err
  }

  if (!Number.isFinite(numericAmount) || numericAmount < config.minBet || numericAmount > config.maxBet) {
    const err = new Error(`Số tiền cược phải từ ${config.minBet} đến ${config.maxBet}`)
    err.code = 'INVALID_AMOUNT'
    throw err
  }

  const round = await KenoRound.findOne({ roomId, roundId })
  if (!round) {
    const err = new Error('Phiên cược không còn hợp lệ')
    err.code = 'ROUND_NOT_FOUND'
    throw err
  }

  const now = Date.now()
  const betCloseTime = round.betCloseTime ? new Date(round.betCloseTime).getTime() : 0
  if (round.status !== roundStatuses.BETTING || (betCloseTime > 0 && now >= betCloseTime)) {
    const err = new Error('Phiên cược đã đóng')
    err.code = 'BET_CLOSED'
    throw err
  }

  if (normalizedClientBetId) {
    const existing = await findExistingClientBet({
      roomId,
      roundId,
      userId,
      clientBetId: normalizedClientBetId
    })
    if (existing) {
      const user = await User.findById(userId).select('balance').lean()
      return {
        duplicate: true,
        bet: existing,
        balance: Number(user?.balance || 0),
        roundSnapshot: {
          betTotalAmount: Number(round.betTotalAmount || 0),
          betCount: Number(round.betCount || 0),
          gateTotals: { ...(round.gateTotals || {}) }
        }
      }
    }
  }

  const balance = await walletService.debitBalance({
    userId,
    amount: numericAmount,
    reason: 'keno_bet',
    meta: { roundId, roomId, gate: normalizedGate, clientBetId: normalizedClientBetId || undefined },
    type: 'bet',
    transactionId: normalizedClientBetId
      ? buildIdempotencyTransactionId({ userId, roomId, roundId, clientBetId: normalizedClientBetId })
      : null
  })

  const bet = await Bet.create({
    roundId,
    roomId,
    userId,
    gate: normalizedGate,
    amount: numericAmount,
    resultSnapshot: normalizedClientBetId ? { clientBetId: normalizedClientBetId } : null,
    status: 'placed'
  })

  const nextGateTotals = {
    ...(round.gateTotals || {}),
    [normalizedGate]: Number(round.gateTotals?.[normalizedGate] || 0) + numericAmount
  }

  round.betTotalAmount = Number(round.betTotalAmount || 0) + numericAmount
  round.betCount = Number(round.betCount || 0) + 1
  round.gateTotals = nextGateTotals
  round.markModified('gateTotals')
  await round.save()

  return {
    duplicate: false,
    bet,
    balance,
    roundSnapshot: {
      betTotalAmount: Number(round.betTotalAmount || 0),
      betCount: Number(round.betCount || 0),
      gateTotals: { ...(round.gateTotals || {}) }
    }
  }
}

async function settleRound(io, roomId, state) {
  const settledUserIds = new Set()

  state.settling = true
  state.bettingOpen = false
  state.timeLeft = 0
  state.status = roundStatuses.SETTLING

  const roundDoc = await KenoRound.findById(state.roundDbId)
  if (!roundDoc || roundDoc.status === roundStatuses.SETTLED) {
    state.settling = false
    return null
  }

  roundDoc.status = roundStatuses.SETTLING
  roundDoc.bettingClosedAt = roundDoc.bettingClosedAt || state.bettingClosedAt || new Date()
  await roundDoc.save()

  const forced = normalizeForcedResult(roundDoc.forcedResult ?? state.forcedResult)
  const resultNumber = forced !== null ? forced : rollNumber()
  const summary = buildSummary(resultNumber)
  const winningGates = summary.winningGates

  const config = roundDoc.configSnapshot && Object.keys(roundDoc.configSnapshot || {}).length
    ? roundDoc.configSnapshot
    : getRoomConfig(roomId)

  const odds = config.odds || {}

  const bets = await Bet.find({
    roomId,
    roundId: state.roundId,
    status: 'placed'
  }).lean()

  for (const bet of bets) {
    const payout = winningGates.includes(bet.gate) ? Number(bet.amount || 0) * Number(odds[bet.gate] || 0) : 0

    if (payout > 0) {
      await walletService.creditBalance({
        userId: bet.userId,
        amount: payout,
        reason: 'keno_win',
        meta: { roundId: state.roundId, roomId, gate: bet.gate, resultNumber },
        type: 'win'
      })
      await Bet.findByIdAndUpdate(bet._id, { payout, status: 'won', resultSnapshot: { resultNumber } })
    } else {
      await Bet.findByIdAndUpdate(bet._id, { payout: 0, status: 'lost', resultSnapshot: { resultNumber } })
    }

    settledUserIds.add(String(bet.userId))
  }

  const settledAt = new Date()
  roundDoc.status = roundStatuses.SETTLED
  roundDoc.resultNumber = resultNumber
  roundDoc.winningGates = winningGates
  roundDoc.settledAt = settledAt
  await roundDoc.save()

  if (settledUserIds.size > 0) {
    const users = await User.find({ _id: { $in: Array.from(settledUserIds) } })
      .select('_id balance')
      .lean()
    for (const user of users) {
      io.to(`user:${user._id}`).emit('balance_update', { balance: Number(user?.balance || 0) })
    }
  }

  const history = await loadRoomHistory(roomId)
  state.history = history
  state.status = roundStatuses.SETTLED
  state.resultNumber = resultNumber
  state.winningGates = winningGates
  state.summary = history?.[0] || null
  state.settledAt = settledAt
  state.settling = false

  return { resultNumber, winningGates, history }
}

async function openNextRound(io, roomId) {
  const nextRound = await createRoundRecord(roomId)
  const nextState = await materializeRoomState(nextRound.toObject ? nextRound.toObject() : nextRound)
  io.to(roomId).emit('keno_round_state', buildRoomPayload(nextState))
  return nextState
}

async function startRoomLoop(io, roomId = ROOM_DEFAULT) {
  const resolvedRoomId = resolveRoomId(roomId)
  if (roomLoops.has(resolvedRoomId)) return roomLoops.get(resolvedRoomId)

  await ensureRoomState(resolvedRoomId)

  const timer = setInterval(async () => {
    try {
      const state = await ensureRoomState(resolvedRoomId)
      if (!state) return

      state.timeLeft = getRemainingTime(state)

      // Close betting window
      const betCloseTime = new Date(state.betCloseTime).getTime()
      if (state.status === roundStatuses.BETTING && (Date.now() >= betCloseTime || state.timeLeft <= Number(state.configSnapshot.betLockSeconds || 0))) {
        state.bettingOpen = false
        state.status = roundStatuses.ROLLING
        state.bettingClosedAt = state.bettingClosedAt || new Date()
        await KenoRound.findByIdAndUpdate(state.roundDbId, { status: roundStatuses.ROLLING, bettingClosedAt: state.bettingClosedAt })
      }

      io.to(resolvedRoomId).emit('keno_timer_update', {
        roomId: state.roomId,
        roundId: state.roundId,
        status: state.status,
        timeLeft: state.timeLeft,
        bettingOpen: state.bettingOpen,
        betTotalAmount: Number(state.betTotalAmount || 0),
        betCount: Number(state.betCount || 0),
        betCloseTime: state.betCloseTime
      })

      if (state.timeLeft <= 0 && state.status !== roundStatuses.SETTLED) {
        if (!acquireSettleLock(resolvedRoomId)) return

        try {
          const result = await settleRound(io, resolvedRoomId, state)
          if (result) {
            io.to(resolvedRoomId).emit('keno_round_result', {
              roomId: state.roomId,
              roundId: state.roundId,
              resultNumber: result.resultNumber,
              winningGates: result.winningGates,
              history: result.history
            })
          }

          clearInterval(timer)
          roomLoops.delete(resolvedRoomId)

          setTimeout(async () => {
            try {
              await openNextRound(io, resolvedRoomId)
              await startRoomLoop(io, resolvedRoomId)
            } catch (err) {
              console.error(`[Keno:${resolvedRoomId}] next round error`, err)
            }
          }, RESULT_DELAY_MS)
        } finally {
          releaseSettleLock(resolvedRoomId)
        }
      }
    } catch (err) {
      console.error(`[Keno:${resolvedRoomId}] loop error`, err)
    }
  }, 1000)

  roomLoops.set(resolvedRoomId, timer)
  return timer
}

async function getAdminRoomState(roomId = ROOM_DEFAULT) {
  const state = await ensureRoomState(resolveRoomId(roomId))
  return buildAdminSnapshot(state)
}

async function setRoomForcedResult({ roomId = ROOM_DEFAULT, forcedResult = null, adminUserId = null, forcedNote = '' }) {
  const resolvedRoomId = resolveRoomId(roomId)
  const state = await ensureRoomState(resolvedRoomId)
  const roundDoc = await KenoRound.findById(state.roundDbId)

  if (!roundDoc || roundDoc.status !== roundStatuses.BETTING) {
    throw new Error('Không có phiên betting đang mở để chỉnh kết quả')
  }

  const betCloseTime = new Date(roundDoc.betCloseTime || state.betCloseTime || 0).getTime()
  if (betCloseTime > 0 && Date.now() >= betCloseTime) {
    throw new Error('Đã quá thời gian đặt cược, không thể force kết quả')
  }

  const normalized = normalizeForcedResult(forcedResult)
  roundDoc.forcedResult = normalized
  roundDoc.forcedBy = normalized !== null ? adminUserId : null
  roundDoc.forcedNote = String(forcedNote || '').trim().slice(0, 200)
  await roundDoc.save()

  state.forcedResult = normalized
  state.forcedNote = roundDoc.forcedNote

  return buildAdminSnapshot(state)
}

async function getActiveSocketUser(socket) {
  const rawToken = socket.handshake?.auth?.token
  if (!rawToken) return null
  try {
    const payload = verifyAccessToken(rawToken)
    const user = await User.findById(payload.sub).lean()
    if (!user || user.status !== 'active') return null
    return user
  } catch {
    return null
  }
}

function registerKenoHandlers(io, socket) {
  socket.on('join_keno_room', async ({ roomId = ROOM_DEFAULT } = {}, ack) => {
    const safeAck = typeof ack === 'function' ? ack : () => {}
    const user = await getActiveSocketUser(socket)
    if (!user) return safeAck({ ok: false, message: 'Vui lòng đăng nhập' })
    const maintenance = await getKenoMaintenanceConfig()
    if (maintenance.enabled) return safeAck({ ok: false, message: maintenance.message, maintenance: true })

    const resolvedRoomId = resolveRoomId(roomId)
    const previousRoomId = socket.data?.kenoRoomId
    if (previousRoomId && previousRoomId !== resolvedRoomId) {
      socket.leave(previousRoomId)
    }

    socket.data.kenoRoomId = resolvedRoomId
    socket.join(resolvedRoomId)
    socket.join(`user:${user._id}`)

    socket.emit('balance_update', { balance: Number(user.balance || 0) })

    const state = await ensureRoomState(resolvedRoomId)
    socket.emit('keno_round_state', buildRoomPayload(state))
    socket.emit('keno_betting_snapshot', {
      roomId: state.roomId,
      roundId: state.roundId,
      betTotalAmount: Number(state.betTotalAmount || 0),
      betCount: Number(state.betCount || 0),
      gateTotals: { ...(state.gateTotals || {}) }
    })

    await startRoomLoop(io, resolvedRoomId)
    return safeAck({ ok: true })
  })

  socket.on('leave_keno_room', ({ roomId } = {}) => {
    const targetRoomId = roomId || socket.data?.kenoRoomId
    if (targetRoomId) socket.leave(targetRoomId)
    if (socket.data?.kenoRoomId === targetRoomId) socket.data.kenoRoomId = null
  })

  socket.on('place_keno_bet', async (payload, ack) => {
    const safeAck = typeof ack === 'function' ? ack : () => {}
    try {
      const user = await getActiveSocketUser(socket)
      if (!user) return safeAck({ ok: false, message: 'Vui lòng đăng nhập' })
      const maintenance = await getKenoMaintenanceConfig()
      if (maintenance.enabled) return safeAck({ ok: false, message: maintenance.message, maintenance: true })

      const requestedRoomId = payload?.roomId || socket.data?.kenoRoomId || ROOM_DEFAULT
      const roomId = resolveRoomId(requestedRoomId)
      const state = await ensureRoomState(roomId)
      if (state.status !== roundStatuses.BETTING || !state.bettingOpen) {
        return safeAck({ ok: false, message: 'Phiên cược đã đóng' })
      }

      const result = await placeKenoBet({
        roomId,
        roundId: state.roundId,
        userId: user._id,
        gate: payload?.gate,
        amount: payload?.amount,
        clientBetId: payload?.clientBetId
      })

      // Sync in-memory snapshot (best-effort)
      if (result.roundSnapshot) {
        state.betTotalAmount = Number(result.roundSnapshot.betTotalAmount || state.betTotalAmount || 0)
        state.betCount = Number(result.roundSnapshot.betCount || state.betCount || 0)
        state.gateTotals = { ...createEmptyGateTotals(state.configSnapshot), ...(result.roundSnapshot.gateTotals || {}) }
      }

      io.to(`user:${user._id}`).emit('balance_update', { balance: Number(result.balance || 0) })
      io.to(roomId).emit('keno_betting_snapshot', {
        roomId,
        roundId: state.roundId,
        betTotalAmount: Number(state.betTotalAmount || 0),
        betCount: Number(state.betCount || 0),
        gateTotals: { ...(state.gateTotals || {}) }
      })

      return safeAck({ ok: true, balance: result.balance, duplicate: result.duplicate })
    } catch (err) {
      return safeAck({ ok: false, message: err.message || 'Không thể đặt cược' })
    }
  })
}

module.exports = {
  registerKenoHandlers,
  startRoomLoop,
  getAdminRoomState,
  setRoomForcedResult
}
