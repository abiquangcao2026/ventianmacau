const mongoose = require('mongoose')
const User = require('../models/User')
const SicboRound = require('../models/SicboRound')
const BetService = require('../services/betService')
const demoConfigService = require('../services/demoConfigService')
const WalletService = require('../services/walletService')
const { verifyAccessToken } = require('../utils/auth')

const walletService = new WalletService()
const betService = new BetService({ walletService })

const ROOM_DEFAULT = 'sicbo-3p'
const RESULT_DELAY_MS = 0
const SICBO_ROUND_SLOT_SECONDS = 300
const ROOM_SEEDS = {
  'sicbo-3p': 130,
  'sicbo-5p': 530
}
const SOCKET_RATE_LIMIT_WINDOW_MS = 1500
const SOCKET_MIN_BET_INTERVAL_MS = 180
const SOCKET_MAX_BETS_PER_WINDOW = 4
const SOCKET_IP_RATE_LIMIT_WINDOW_MS = 3000
const SOCKET_IP_MAX_BETS_PER_WINDOW = 20
const SOCKET_CONNECT_WINDOW_MS = 10000
const SOCKET_CONNECT_MAX_PER_WINDOW = 30
const SOCKET_MAX_ACTIVE_PER_IP = 80
const SOCKET_GUARD_CLEANUP_MS = 60000
const SOCKET_DEBUG = process.env.SOCKET_DEBUG !== '0'

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
const socketBetGuards = new Map()
const socketIpBetGuards = new Map()
const socketConnectionGuards = new Map()
const ipActiveConnections = new Map()
let socketGuardCleanupTimer = null

async function getSicboMaintenanceConfig() {
  const SiteConfig = require('../models/SiteConfig')
  const config = await SiteConfig.findOne({ key: 'main' }).lean()
  return {
    enabled: Boolean(config?.sicboMaintenanceEnabled),
    message: String(config?.sicboMaintenanceMessage || 'Game Xúc sắc đang bảo trì. Vui lòng quay lại sau.').trim() || 'Game Xúc sắc đang bảo trì. Vui lòng quay lại sau.'
  }
}

function debugLog(...args) {
  if (!SOCKET_DEBUG) {
    return
  }

  console.log(...args)
}

function isTransactionUnsupported(error) {
  const message = String(error?.message || '')
  return error?.code === 20 || message.includes('Transaction numbers are only allowed')
}

function getRoomConfig(roomId = ROOM_DEFAULT) {
  return demoConfigService.getSicboConfig(roomId)
}

function getRoomSeed(roomId = ROOM_DEFAULT) {
  return ROOM_SEEDS[roomId] || ROOM_SEEDS[ROOM_DEFAULT]
}

function createEmptyGateTotals(roomId = ROOM_DEFAULT) {
  const config = getRoomConfig(roomId)
  return Object.fromEntries(Object.keys(config.odds || {}).map((gate) => [gate, 0]))
}

function normalizeForcedResult(result) {
  if (!Array.isArray(result) || result.length !== 3) {
    return null
  }

  const normalized = result.map((value) => Number(value))
  const isValid = normalized.every((value) => Number.isInteger(value) && value >= 1 && value <= 6)
  return isValid ? normalized : null
}

function getRoundStartAt(stateOrRound) {
  return new Date(
    stateOrRound.roundStartTime ||
      stateOrRound.openedAt ||
      stateOrRound.createdAt ||
      Date.now()
  )
}

function getRoundDurationSeconds(stateOrRound) {
  return SICBO_ROUND_SLOT_SECONDS
}

function getScheduledRoundWindow(dateValue = Date.now()) {
  const timestamp = dateValue instanceof Date ? dateValue.getTime() : Number(dateValue || Date.now())
  const durationMs = SICBO_ROUND_SLOT_SECONDS * 1000
  const startMs = Math.floor(timestamp / durationMs) * durationMs
  return {
    startAt: new Date(startMs),
    endAt: new Date(startMs + durationMs)
  }
}

function isSameSlotStart(left, right) {
  return new Date(left || 0).getTime() === new Date(right || 0).getTime()
}

function getBetCloseAt(roundStartAt, configSnapshot) {
  const roundDuration = getRoundDurationSeconds({ configSnapshot })
  const betLockSeconds = Number(configSnapshot.betLockSeconds || 0)
  const openWindowSeconds = Math.max(roundDuration - betLockSeconds, 1)
  return new Date(roundStartAt.getTime() + openWindowSeconds * 1000)
}

function getRemainingTimeFromRound(stateOrRound) {
  const startedAt = getRoundStartAt(stateOrRound).getTime()
  const roundDurationMs = getRoundDurationSeconds(stateOrRound) * 1000
  const remainingMs = startedAt + roundDurationMs - Date.now()
  return Math.max(0, Math.ceil(remainingMs / 1000))
}

function resolveConfig(configOrRoomId = ROOM_DEFAULT) {
  return typeof configOrRoomId === 'string' ? getRoomConfig(configOrRoomId) : configOrRoomId
}

function getTotal(result) {
  return result.reduce((sum, value) => sum + value, 0)
}

function isTriple(result) {
  return result[0] === result[1] && result[1] === result[2]
}

function countOccurrences(result, face) {
  return result.filter((value) => Number(value) === Number(face)).length
}

function rollDice() {
  return Array.from({ length: 3 }, () => Math.ceil(Math.random() * 6))
}

function toHistoryItem(round) {
  return {
    roundId: round.roundId,
    result: round.result || [],
    total: Number(round.total || 0),
    outcome: round.outcome || '',
    parity: round.parity || '',
    isTriple: Boolean(round.isTriple),
    winningGates: round.winningGates || [],
    createdAt: round.settledAt || round.updatedAt || round.createdAt
  }
}

async function loadRoomHistory(roomId = ROOM_DEFAULT, limit = 20) {
  const rounds = await SicboRound.find({
    roomId,
    status: roundStatuses.SETTLED
  })
    .sort({ settledAt: -1, createdAt: -1 })
    .limit(limit)
    .lean()

  return rounds.map(toHistoryItem)
}

async function ensureRoomCounter(roomId = ROOM_DEFAULT) {
  if (roomCounters.has(roomId)) {
    return
  }

  const latestRound = await SicboRound.findOne({ roomId }).sort({ createdAt: -1 }).select('roundId').lean()
  const latestNumericRoundId = Number(latestRound?.roundId)
  const nextRoundId =
    Number.isFinite(latestNumericRoundId) && latestNumericRoundId >= getRoomSeed(roomId)
      ? latestNumericRoundId + 1
      : getRoomSeed(roomId)

  roomCounters.set(roomId, nextRoundId)
}

async function consumeNextRoundId(roomId = ROOM_DEFAULT) {
  await ensureRoomCounter(roomId)
  const nextRoundId = roomCounters.get(roomId)
  roomCounters.set(roomId, nextRoundId + 1)
  return String(nextRoundId)
}

function buildRoundSummary(result, configOrRoomId = ROOM_DEFAULT) {
  const total = getTotal(result)
  const triple = isTriple(result)
  const config = resolveConfig(configOrRoomId)
  const winningGates = []

  if (!triple && total >= 11 && total <= 17) winningGates.push('tai')
  if (!triple && total >= 4 && total <= 10) winningGates.push('xiu')
  if (total % 2 === 1) winningGates.push('odd')
  if (total % 2 === 0) winningGates.push('even')

  for (const gate of Object.keys(config.odds || {})) {
    if (gate.startsWith('double_') && calculatePayout(gate, 1, result, config) > 0) {
      winningGates.push(gate)
    }
    if (gate.startsWith('triple_') && calculatePayout(gate, 1, result, config) > 0) {
      winningGates.push(gate)
    }
  }

  return {
    total,
    isTriple: triple,
    outcome: triple ? 'bao' : total >= 11 && total <= 17 ? 'tai' : 'xiu',
    parity: total % 2 === 0 ? 'even' : 'odd',
    winningGates
  }
}

function buildStateFromRound(round, history = []) {
  const roomId = round.roomId || ROOM_DEFAULT
  const configSnapshot =
    round.configSnapshot && Object.keys(round.configSnapshot || {}).length > 0
      ? round.configSnapshot
      : getRoomConfig(roomId)
  const roundStartAt = getRoundStartAt(round)
  const betCloseAt = round.betCloseTime
    ? new Date(round.betCloseTime)
    : getBetCloseAt(roundStartAt, configSnapshot)
  const timeLeft = getRemainingTimeFromRound({
    roundStartTime: roundStartAt,
    configSnapshot
  })
  const canBetByTime = Date.now() < betCloseAt.getTime()
  const bettingOpen = round.status === roundStatuses.BETTING && canBetByTime && timeLeft > 0

  return {
    roomId,
    roundDbId: String(round._id),
    roundId: round.roundId,
    status: round.status || roundStatuses.BETTING,
    timeLeft,
    bettingOpen,
    result: round.result || null,
    total: Number(round.total || 0),
    history,
    betTotalAmount: Number(round.betTotalAmount || 0),
    betCount: Number(round.betCount || 0),
    gateTotals: {
      ...createEmptyGateTotals(roomId),
      ...(round.gateTotals || {})
    },
    configSnapshot,
    forcedResult: normalizeForcedResult(round.forcedResult),
    forcedNote: String(round.forcedNote || ''),
    roundStartTime: roundStartAt,
    betCloseTime: betCloseAt,
    openedAt: round.openedAt || roundStartAt,
    bettingClosedAt: round.bettingClosedAt || null,
    settledAt: round.settledAt || null,
    summary: round.status === roundStatuses.SETTLED ? toHistoryItem(round) : null,
    settling: round.status === roundStatuses.SETTLING
  }
}

function buildRoundStatePayload(state) {
  const latestSummary = state.history?.[0] || null

  return {
    roomId: state.roomId,
    roundId: state.roundId,
    status: state.status,
    timeLeft: state.timeLeft,
    bettingOpen: state.bettingOpen,
    result: state.result,
    total: state.total,
    history: state.history || [],
    betTotalAmount: Number(state.betTotalAmount || 0),
    betCount: Number(state.betCount || 0),
    gateTotals: { ...(state.gateTotals || {}) },
    latestSummary,
    summary: state.summary || latestSummary,
    roundStartTime: state.roundStartTime,
    betCloseTime: state.betCloseTime,
    openedAt: state.openedAt,
    bettingClosedAt: state.bettingClosedAt,
    settledAt: state.settledAt,
    config: state.configSnapshot || getRoomConfig(state.roomId)
  }
}

function buildAdminRoomSnapshot(state) {
  return {
    ...buildRoundStatePayload(state),
    forcedResult: normalizeForcedResult(state.forcedResult),
    forcedNote: String(state.forcedNote || '')
  }
}

function buildBettingSnapshot(state) {
  return {
    roomId: state.roomId,
    roundId: state.roundId,
    status: state.status,
    betTotalAmount: Number(state.betTotalAmount || 0),
    betCount: Number(state.betCount || 0),
    gateTotals: { ...(state.gateTotals || {}) }
  }
}

async function createRoundRecord(roomId = ROOM_DEFAULT) {
  const config = getRoomConfig(roomId)
  const roundId = await consumeNextRoundId(roomId)
  const scheduledWindow = getScheduledRoundWindow(Date.now())
  const roundStartTime = scheduledWindow.startAt
  const betCloseTime = getBetCloseAt(roundStartTime, config)

  return SicboRound.create({
    roomId,
    roundId,
    status: roundStatuses.BETTING,
    configSnapshot: config,
    gateTotals: createEmptyGateTotals(roomId),
    roundStartTime,
    betCloseTime,
    openedAt: roundStartTime
  })
}

async function materializeRoomState(round) {
  const history = await loadRoomHistory(round.roomId)
  const state = buildStateFromRound(round, history)
  roomStates.set(round.roomId, state)
  return state
}

async function findUnfinishedRound(roomId = ROOM_DEFAULT) {
  return SicboRound.findOne({
    roomId,
    status: { $in: [roundStatuses.BETTING, roundStatuses.ROLLING, roundStatuses.SETTLING] }
  }).sort({ createdAt: -1 })
}

async function ensureRoomState(roomId = ROOM_DEFAULT) {
  if (roomStates.has(roomId)) {
    const state = roomStates.get(roomId)
    if (state.status === roundStatuses.BETTING) {
      state.timeLeft = getRemainingTimeFromRound(state)
      state.bettingOpen = Date.now() < new Date(state.betCloseTime).getTime() && state.timeLeft > 0
    }
    return state
  }

  if (roomReadyPromises.has(roomId)) {
    return roomReadyPromises.get(roomId)
  }

  const bootPromise = (async () => {
    let unfinished = await findUnfinishedRound(roomId)
    if (!unfinished) {
      unfinished = await createRoundRecord(roomId)
    } else {
      const config = getRoomConfig(roomId)
      const scheduledWindow = getScheduledRoundWindow(Date.now())
      const roundStartTime = getRoundStartAt(unfinished)
      const nextBetCloseTime = getBetCloseAt(roundStartTime, config)
      const shouldSnapToCurrentSlot =
        unfinished.status === roundStatuses.BETTING &&
        Number(unfinished.betCount || 0) === 0 &&
        !isSameSlotStart(roundStartTime, scheduledWindow.startAt)

      if (shouldSnapToCurrentSlot) {
        unfinished.roundStartTime = scheduledWindow.startAt
        unfinished.openedAt = scheduledWindow.startAt
        unfinished.betCloseTime = getBetCloseAt(scheduledWindow.startAt, config)
        unfinished.configSnapshot = config
        await unfinished.save()
      } else if (
        !isSameSlotStart(nextBetCloseTime, unfinished.betCloseTime) ||
        JSON.stringify(unfinished.configSnapshot || {}) !== JSON.stringify(config)
      ) {
        unfinished.betCloseTime = nextBetCloseTime
        unfinished.configSnapshot = config
        await unfinished.save()
      }
    }
    return materializeRoomState(unfinished.toObject ? unfinished.toObject() : unfinished)
  })().finally(() => {
    roomReadyPromises.delete(roomId)
  })

  roomReadyPromises.set(roomId, bootPromise)
  return bootPromise
}

function getRoomState(roomId = ROOM_DEFAULT) {
  return roomStates.get(roomId) || null
}

async function syncRoomConfigToActiveState(io, roomId = ROOM_DEFAULT) {
  const latestConfig = getRoomConfig(roomId)
  const resolvedRoomId = String(latestConfig?.roomId || roomId || ROOM_DEFAULT)
  const state = await ensureRoomState(resolvedRoomId)

  if (!state) {
    return null
  }

  const roundStartAt = getRoundStartAt(state)
  const nextBetCloseTime = getBetCloseAt(roundStartAt, latestConfig)
  const nextTimeLeft = getRemainingTimeFromRound({
    roundStartTime: roundStartAt,
    configSnapshot: latestConfig
  })

  state.configSnapshot = latestConfig
  state.betCloseTime = nextBetCloseTime
  state.timeLeft = nextTimeLeft
  state.gateTotals = {
    ...createEmptyGateTotals(resolvedRoomId),
    ...(state.gateTotals || {})
  }

  if (state.status === roundStatuses.BETTING) {
    state.bettingOpen = Date.now() < new Date(nextBetCloseTime).getTime() && nextTimeLeft > 0
  }

  if (state.roundDbId && mongoose.Types.ObjectId.isValid(String(state.roundDbId))) {
    await SicboRound.findByIdAndUpdate(state.roundDbId, {
      $set: {
        configSnapshot: latestConfig,
        betCloseTime: nextBetCloseTime
      }
    })
  }

  const payload = buildRoundStatePayload(state)
  if (io && typeof io.to === 'function') {
    io.to(resolvedRoomId).emit('round_state', payload)
  }

  return payload
}

function hasRoomSettleLock(roomId = ROOM_DEFAULT) {
  return roomSettleLocks.has(roomId)
}

function acquireRoomSettleLock(roomId = ROOM_DEFAULT) {
  if (roomSettleLocks.has(roomId)) {
    return false
  }

  roomSettleLocks.add(roomId)
  return true
}

function releaseRoomSettleLock(roomId = ROOM_DEFAULT) {
  roomSettleLocks.delete(roomId)
}

function getClientIp(socket) {
  const forwardedFor = socket.handshake?.headers?.['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim()
  }

  return String(socket.handshake?.address || socket.conn?.remoteAddress || 'unknown')
}

function checkSocketConnectionRateLimit(socket) {
  const ip = getClientIp(socket)
  const now = Date.now()
  const activeConnections = Number(ipActiveConnections.get(ip) || 0)

  if (activeConnections >= SOCKET_MAX_ACTIVE_PER_IP) {
    return {
      ok: false,
      ip,
      code: 'TOO_MANY_CONNECTIONS',
      message: 'Quá nhiều kết nối từ cùng IP'
    }
  }

  const guard = socketConnectionGuards.get(ip) || {
    windowStart: now,
    windowCount: 0,
    lastSeen: now
  }

  if (now - guard.windowStart > SOCKET_CONNECT_WINDOW_MS) {
    guard.windowStart = now
    guard.windowCount = 0
  }

  guard.windowCount += 1
  guard.lastSeen = now
  socketConnectionGuards.set(ip, guard)

  if (guard.windowCount > SOCKET_CONNECT_MAX_PER_WINDOW) {
    return {
      ok: false,
      ip,
      code: 'CONNECTION_RATE_LIMIT',
      message: 'Kết nối quá nhanh, vui lòng thử lại'
    }
  }

  ipActiveConnections.set(ip, activeConnections + 1)
  socket.data.clientIp = ip
  return { ok: true, ip }
}

function releaseSocketConnectionGuard(socket) {
  const ip = socket.data?.clientIp || getClientIp(socket)
  const current = Number(ipActiveConnections.get(ip) || 0)
  if (current <= 1) {
    ipActiveConnections.delete(ip)
  } else {
    ipActiveConnections.set(ip, current - 1)
  }
}

function checkIpBetRateLimit({ ip, roomId }) {
  const key = `${ip}:${roomId}`
  const now = Date.now()
  const guard =
    socketIpBetGuards.get(key) || {
      windowStart: now,
      windowCount: 0,
      lastSeen: now
    }

  if (now - guard.windowStart > SOCKET_IP_RATE_LIMIT_WINDOW_MS) {
    guard.windowStart = now
    guard.windowCount = 0
  }

  guard.windowCount += 1
  guard.lastSeen = now
  socketIpBetGuards.set(key, guard)

  if (guard.windowCount > SOCKET_IP_MAX_BETS_PER_WINDOW) {
    const error = new Error('IP gửi cược quá dày, vui lòng chậm lại')
    error.code = 'IP_RATE_LIMIT'
    throw error
  }
}

function startSocketGuardCleanup() {
  if (socketGuardCleanupTimer) {
    return
  }

  socketGuardCleanupTimer = setInterval(() => {
    const now = Date.now()

    for (const [key, guard] of socketBetGuards.entries()) {
      const expiredWindow = now - Number(guard.windowStart || 0) > SOCKET_RATE_LIMIT_WINDOW_MS * 4
      const expiredBet = now - Number(guard.lastBetAt || 0) > SOCKET_RATE_LIMIT_WINDOW_MS * 4
      if (expiredWindow && expiredBet) {
        socketBetGuards.delete(key)
      }
    }

    for (const [key, guard] of socketIpBetGuards.entries()) {
      if (now - Number(guard.lastSeen || 0) > SOCKET_IP_RATE_LIMIT_WINDOW_MS * 4) {
        socketIpBetGuards.delete(key)
      }
    }

    for (const [ip, guard] of socketConnectionGuards.entries()) {
      if (now - Number(guard.lastSeen || 0) > SOCKET_CONNECT_WINDOW_MS * 6) {
        socketConnectionGuards.delete(ip)
      }
    }
  }, SOCKET_GUARD_CLEANUP_MS)

  socketGuardCleanupTimer.unref?.()
}

function syncSocketAuth(socket) {
  const rawToken = socket.handshake?.auth?.token
  if (!rawToken) {
    socket.data.authUserId = null
    socket.data.authRole = null
    return null
  }

  try {
    const payload = verifyAccessToken(rawToken)
    socket.data.authUserId = payload.sub
    socket.data.authRole = payload.role
    return payload.sub
  } catch {
    socket.data.authUserId = null
    socket.data.authRole = null
    return null
  }
}

async function getActiveSocketUser(socket) {
  const userId = syncSocketAuth(socket)
  if (!userId) {
    return null
  }

  const user = await User.findById(userId).lean()
  if (!user || user.status !== 'active') {
    return null
  }

  socket.data.authUserId = String(user._id)
  socket.data.authRole = user.role
  return user
}

function calculatePayout(gate, amount, result, configOrRoomId = ROOM_DEFAULT) {
  const config = resolveConfig(configOrRoomId)
  const total = getTotal(result)
  const triple = isTriple(result)
  const numericAmount = Number(amount)
  const baseOdds = Number(config.odds?.[gate] || 0)

  if (gate === 'tai' && !triple && total >= 11 && total <= 17) return numericAmount * baseOdds
  if (gate === 'xiu' && !triple && total >= 4 && total <= 10) return numericAmount * baseOdds
  if (gate === 'odd' && total % 2 === 1) return numericAmount * baseOdds
  if (gate === 'even' && total % 2 === 0) return numericAmount * baseOdds

  if (gate.startsWith('double_')) {
    const face = Number(gate.split('_')[1])
    if (!triple && countOccurrences(result, face) === 2) {
      return numericAmount * baseOdds
    }
  }

  if (gate.startsWith('triple_')) {
    const face = Number(gate.split('_')[1])
    if (triple && countOccurrences(result, face) === 3) {
      return numericAmount * baseOdds
    }
  }

  return 0
}

function checkSocketBetRateLimit({ userId, roomId, roundId }) {
  const key = `${userId}:${roomId}`
  const now = Date.now()
  const guard =
    socketBetGuards.get(key) || {
      roundId: '',
      lastBetAt: 0,
      windowStart: now,
      windowCount: 0,
      lastSeen: now
    }

  if (guard.roundId !== roundId) {
    guard.roundId = roundId
    guard.windowStart = now
    guard.windowCount = 0
    guard.lastBetAt = 0
  }

  if (now - guard.lastBetAt < SOCKET_MIN_BET_INTERVAL_MS) {
    const error = new Error('Thao tác cược quá nhanh, vui lòng thử lại')
    error.code = 'BET_RATE_LIMIT'
    throw error
  }

  if (now - guard.windowStart > SOCKET_RATE_LIMIT_WINDOW_MS) {
    guard.windowStart = now
    guard.windowCount = 0
  }

  guard.windowCount += 1
  guard.lastBetAt = now
  guard.lastSeen = now
  socketBetGuards.set(key, guard)

  if (guard.windowCount > SOCKET_MAX_BETS_PER_WINDOW) {
    const error = new Error('Bạn đang gửi cược quá dày, vui lòng chậm lại')
    error.code = 'BET_RATE_LIMIT'
    throw error
  }
}

async function markBettingClosed(state, newStatus = roundStatuses.ROLLING) {
  if (!state.roundDbId) {
    return
  }

  if (!state.bettingClosedAt) {
    state.bettingClosedAt = new Date()
  }
  state.bettingOpen = false
  state.status = newStatus

  await SicboRound.findByIdAndUpdate(state.roundDbId, {
    status: newStatus,
    bettingClosedAt: state.bettingClosedAt
  })
}

async function settleRound(io, roomId, state) {
  const settledUserIds = new Set()
  const session = await mongoose.startSession()
  let settledRound = null

  const runSettleWork = async (activeSession = null) => {
    let roundQuery = SicboRound.findById(state.roundDbId)
    if (activeSession) {
      roundQuery = roundQuery.session(activeSession)
    }
    const roundDoc = await roundQuery
    if (!roundDoc || roundDoc.status === roundStatuses.SETTLED || roundDoc.status === 'cancelled') {
      return
    }

    if (state.status !== roundStatuses.SETTLING) {
      state.status = roundStatuses.SETTLING
    }

    roundDoc.status = roundStatuses.SETTLING
    roundDoc.bettingClosedAt = state.bettingClosedAt || roundDoc.bettingClosedAt || new Date()
    if (activeSession) {
      await roundDoc.save({ session: activeSession })
    } else {
      await roundDoc.save()
    }

    const forcedResult = normalizeForcedResult(roundDoc.forcedResult || state.forcedResult)
    const existingResult = normalizeForcedResult(roundDoc.result)
    const result = forcedResult || existingResult || rollDice()
    const summaryPayload = buildRoundSummary(result, state.configSnapshot || roomId)
    const total = Number(summaryPayload.total || 0)
    const bets = await betService.getRoundBets(state.roundId, roomId, {
      session: activeSession,
      lean: true
    })

    for (const bet of bets) {
      const payout = calculatePayout(bet.gate, bet.amount, result, state.configSnapshot || roomId)

      if (payout > 0) {
        await walletService.creditBalance({
          userId: bet.userId,
          amount: payout,
          reason: 'sicbo_win',
          meta: {
            roundId: state.roundId,
            roomId,
            gate: bet.gate,
            result
          },
          type: 'win',
          session: activeSession
        })

        // Bet status is only updated after credit succeeds.
        await betService.settleBet({
          betId: bet._id,
          result,
          payout,
          status: 'won',
          session: activeSession
        })
      } else {
        await betService.settleBet({
          betId: bet._id,
          result,
          payout: 0,
          status: 'lost',
          session: activeSession
        })
      }

      settledUserIds.add(String(bet.userId))
    }

    const settledAt = new Date()
    roundDoc.status = roundStatuses.SETTLED
    roundDoc.result = result
    roundDoc.total = total
    roundDoc.betTotalAmount = Number(roundDoc.betTotalAmount || state.betTotalAmount || 0)
    roundDoc.betCount = Number(roundDoc.betCount || state.betCount || 0)
    roundDoc.gateTotals = {
      ...createEmptyGateTotals(roomId),
      ...(roundDoc.gateTotals || {})
    }
    roundDoc.winningGates = summaryPayload.winningGates
    roundDoc.outcome = summaryPayload.outcome
    roundDoc.parity = summaryPayload.parity
    roundDoc.isTriple = Boolean(summaryPayload.isTriple)
    roundDoc.bettingClosedAt = roundDoc.bettingClosedAt || state.bettingClosedAt || new Date()
    roundDoc.settledAt = settledAt
    roundDoc.markModified('gateTotals')
    if (activeSession) {
      await roundDoc.save({ session: activeSession })
    } else {
      await roundDoc.save()
    }

    settledRound = roundDoc.toObject()
  }

  try {
    debugLog('[sicbo] settle round', {
      roomId,
      roundId: state.roundId,
      status: state.status,
      timeLeft: state.timeLeft
    })
    state.settling = true
    state.bettingOpen = false
    state.timeLeft = 0

    try {
      await session.withTransaction(async () => {
        await runSettleWork(session)
      })
    } catch (error) {
      if (!isTransactionUnsupported(error)) {
        throw error
      }

      debugLog('[sicbo] settle fallback no transaction', {
        roomId,
        roundId: state.roundId
      })
      await runSettleWork(null)
    }
  } catch (error) {
    state.settling = false
    throw error
  } finally {
    await session.endSession()
  }

  if (!settledRound) {
    state.settling = false
    return
  }

  if (settledUserIds.size > 0) {
    const users = await User.find({ _id: { $in: Array.from(settledUserIds) } })
      .select('_id balance')
      .lean()

    for (const user of users) {
      io.to(`user:${user._id}`).emit('balance_update', {
        balance: Number(user?.balance || 0)
      })
    }
  }

  const history = await loadRoomHistory(roomId)
  state.history = history
  state.status = roundStatuses.SETTLED
  state.result = settledRound.result || []
  state.total = Number(settledRound.total || 0)
  state.betTotalAmount = Number(settledRound.betTotalAmount || 0)
  state.betCount = Number(settledRound.betCount || 0)
  state.gateTotals = {
    ...createEmptyGateTotals(roomId),
    ...(settledRound.gateTotals || {})
  }
  state.summary = toHistoryItem(settledRound)
  state.settledAt = settledRound.settledAt || new Date()
  state.bettingClosedAt = settledRound.bettingClosedAt || state.bettingClosedAt || new Date()
  state.forcedResult = normalizeForcedResult(settledRound.forcedResult)
  state.forcedNote = String(settledRound.forcedNote || '')
  state.settling = false

  io.to(roomId).emit('round_result', {
    roomId,
    roundId: state.roundId,
    status: state.status,
    result: state.result,
    total: state.total,
    history: state.history,
    betTotalAmount: Number(state.betTotalAmount || 0),
    betCount: Number(state.betCount || 0),
    gateTotals: { ...(state.gateTotals || {}) },
    summary: state.summary,
    roundStartTime: state.roundStartTime,
    betCloseTime: state.betCloseTime,
    openedAt: state.openedAt,
    bettingClosedAt: state.bettingClosedAt,
    settledAt: state.settledAt
  })
}

async function openNextRound(io, roomId = ROOM_DEFAULT) {
  const scheduledWindow = getScheduledRoundWindow(Date.now())
  let nextRound = await SicboRound.findOne({
    roomId,
    roundStartTime: scheduledWindow.startAt
  }).sort({ createdAt: -1 })

  if (!nextRound || nextRound.status === 'cancelled') {
    nextRound = await createRoundRecord(roomId)
  }

  const nextState = await materializeRoomState(nextRound.toObject ? nextRound.toObject() : nextRound)
  debugLog('[sicbo] open next round', {
    roomId,
    roundId: nextState.roundId,
    timeLeft: nextState.timeLeft
  })
  io.to(roomId).emit('round_state', buildRoundStatePayload(nextState))
  return nextState
}

async function maybeCloseBettingWindow(state) {
  if (state.status !== roundStatuses.BETTING) {
    return
  }

  const now = Date.now()
  const betCloseTime = new Date(state.betCloseTime).getTime()
  const shouldClose = now >= betCloseTime || state.timeLeft <= Number(state.configSnapshot.betLockSeconds || 0)
  if (!shouldClose) {
    return
  }

  await markBettingClosed(state, roundStatuses.ROLLING)
}

async function startRoomLoop(io, roomId = ROOM_DEFAULT) {
  if (roomLoops.has(roomId)) {
    return roomLoops.get(roomId)
  }

  debugLog('[sicbo] start loop', { roomId })
  await ensureRoomState(roomId)

  const timer = setInterval(async () => {
    try {
      const state = await ensureRoomState(roomId)
      if (!state) return

      state.timeLeft = getRemainingTimeFromRound(state)
      if (state.status === roundStatuses.SETTLING && state.timeLeft <= 0 && !hasRoomSettleLock(roomId)) {
        // Recover stuck rounds (e.g., server restarted while settling).
        state.settling = false
      }
      debugLog('[sicbo] loop tick', {
        roomId: state.roomId,
        roundId: state.roundId,
        status: state.status,
        timeLeft: state.timeLeft
      })
      await maybeCloseBettingWindow(state)

      io.to(roomId).emit('timer_update', {
        roomId: state.roomId,
        roundId: state.roundId,
        status: state.status,
        timeLeft: state.timeLeft,
        bettingOpen: state.bettingOpen,
        betTotalAmount: Number(state.betTotalAmount || 0),
        betCount: Number(state.betCount || 0),
        betCloseTime: state.betCloseTime
      })
      debugLog('[sicbo] timer_update', {
        roomId: state.roomId,
        roundId: state.roundId,
        timeLeft: state.timeLeft,
        bettingOpen: state.bettingOpen
      })

      if (state.timeLeft <= 0 && state.status !== roundStatuses.SETTLED && state.status !== 'cancelled') {
        if (!acquireRoomSettleLock(roomId)) {
          return
        }

        try {
          await settleRound(io, roomId, state)

          clearInterval(timer)
          roomLoops.delete(roomId)

          setTimeout(async () => {
            try {
              await openNextRound(io, roomId)
              await startRoomLoop(io, roomId)
            } catch (error) {
              console.error(`[Sicbo:${roomId}] Next round error`, error)
            }
          }, RESULT_DELAY_MS)
        } catch (error) {
          console.error(`[Sicbo:${roomId}] settle retry error`, error)
        } finally {
          releaseRoomSettleLock(roomId)
        }
      }
    } catch (error) {
      console.error(`[Sicbo:${roomId}] Loop error`, error)
    }
  }, 1000)

  roomLoops.set(roomId, timer)
  return timer
}

async function setRoomForcedResult({
  roomId = ROOM_DEFAULT,
  forcedResult = null,
  adminUserId = null,
  forcedNote = ''
}) {
  const state = await ensureRoomState(roomId)
  const roundDoc = await SicboRound.findById(state.roundDbId)

  if (!roundDoc || roundDoc.status !== roundStatuses.BETTING) {
    throw new Error('Không có phiên betting đang mở để chỉnh kết quả')
  }

  const betCloseTime = new Date(roundDoc.betCloseTime || state.betCloseTime || 0).getTime()
  if (betCloseTime > 0 && Date.now() >= betCloseTime) {
    throw new Error('Đã quá thời gian đặt cược, không thể force kết quả')
  }

  const normalizedForcedResult = normalizeForcedResult(forcedResult)
  const before = {
    forcedResult: normalizeForcedResult(roundDoc.forcedResult),
    forcedNote: roundDoc.forcedNote || ''
  }
  roundDoc.forcedResult = normalizedForcedResult
  roundDoc.forcedBy = normalizedForcedResult ? adminUserId : null
  roundDoc.forcedNote = normalizedForcedResult ? String(forcedNote || '').trim() : ''
  await roundDoc.save()

  await SicboRound.writeAuditLog({
    roomId,
    roundId: roundDoc.roundId,
    adminId: adminUserId,
    action: 'force_result',
    before,
    after: {
      forcedResult: normalizeForcedResult(roundDoc.forcedResult),
      forcedNote: roundDoc.forcedNote || ''
    }
  })

  state.forcedResult = normalizedForcedResult
  state.forcedNote = String(roundDoc.forcedNote || '')

  return buildAdminRoomSnapshot(state)
}

async function getAdminRoomState(roomId = ROOM_DEFAULT) {
  const state = await ensureRoomState(roomId)
  return buildAdminRoomSnapshot(state)
}

async function validateJoinRoom(socket, roomId) {
  const user = await getActiveSocketUser(socket)
  if (!user) {
    socket.emit('socket_error', {
      code: 'AUTH_REQUIRED',
      message: 'Phiên đăng nhập không hợp lệ'
    })
    return null
  }

  const maintenance = await getSicboMaintenanceConfig()
  if (maintenance.enabled) {
    socket.emit('socket_error', {
      code: 'SICBO_MAINTENANCE',
      message: maintenance.message
    })
    return null
  }

  const normalizedRoomId = ['sicbo-3p', 'sicbo-5p'].includes(roomId) ? roomId : ROOM_DEFAULT
  return { user, roomId: normalizedRoomId }
}

function registerSicboHandlers(io, socket) {
  debugLog('[socket] connected', {
    id: socket.id,
    ip: getClientIp(socket)
  })
  startSocketGuardCleanup()

  const connectionGuard = checkSocketConnectionRateLimit(socket)
  if (!connectionGuard.ok) {
    socket.emit('socket_error', {
      code: connectionGuard.code,
      message: connectionGuard.message
    })
    setTimeout(() => {
      socket.disconnect(true)
    }, 0)
    return
  }

  socket.on('disconnect', () => {
    const authUserId = socket.data?.authUserId
    if (authUserId) {
      for (const key of socketBetGuards.keys()) {
        if (key.startsWith(`${authUserId}:`)) {
          socketBetGuards.delete(key)
        }
      }
    }

    releaseSocketConnectionGuard(socket)
  })

  socket.on('join_sicbo_room', async ({ roomId = ROOM_DEFAULT } = {}) => {
    const joinContext = await validateJoinRoom(socket, roomId)
    if (!joinContext) return

    const { user, roomId: normalizedRoomId } = joinContext
    debugLog('[sicbo] join room', {
      socketId: socket.id,
      userId: String(user._id),
      roomId: normalizedRoomId
    })
    const previousRoomId = socket.data?.sicboRoomId
    if (previousRoomId && previousRoomId !== normalizedRoomId) {
      socket.leave(previousRoomId)
    }

    socket.data.sicboRoomId = normalizedRoomId
    socket.join(normalizedRoomId)
    socket.join(`user:${user._id}`)

    socket.emit('balance_update', { balance: Number(user.balance || 0) })

    const state = await ensureRoomState(normalizedRoomId)
    socket.emit('round_state', buildRoundStatePayload(state))
    socket.emit('betting_snapshot', buildBettingSnapshot(state))

    await startRoomLoop(io, normalizedRoomId)
  })

  socket.on('leave_sicbo_room', ({ roomId } = {}) => {
    const targetRoomId = roomId || socket.data?.sicboRoomId
    if (targetRoomId) {
      socket.leave(targetRoomId)
    }

    if (socket.data?.sicboRoomId === targetRoomId) {
      socket.data.sicboRoomId = null
    }
  })

  socket.on('place_bet', async (payload, ack) => {
    try {
      const user = await getActiveSocketUser(socket)
      const maintenance = await getSicboMaintenanceConfig()
      const requestedRoomId = payload?.roomId || socket.data?.sicboRoomId || ROOM_DEFAULT
      const roomId = ['sicbo-3p', 'sicbo-5p'].includes(requestedRoomId) ? requestedRoomId : ROOM_DEFAULT
      const state = await ensureRoomState(roomId)
      const amount = Number(payload?.amount || 0)
      const gate = payload?.gate
      const clientBetId = typeof payload?.clientBetId === 'string' ? payload.clientBetId : ''
      const ip = socket.data?.clientIp || getClientIp(socket)

      if (!user) {
        return ack?.({
          ok: false,
          code: 'AUTH_REQUIRED',
          message: 'Vui lòng đăng nhập để đặt cược'
        })
      }

      if (maintenance.enabled) {
        return ack?.({
          ok: false,
          code: 'SICBO_MAINTENANCE',
          maintenance: true,
          message: maintenance.message
        })
      }

      if (state.status !== roundStatuses.BETTING) {
        return ack?.({
          ok: false,
          code: 'ROUND_NOT_BETTING',
          message: 'Phiên cược đã đóng'
        })
      }

      if (Date.now() >= new Date(state.betCloseTime).getTime() || !state.bettingOpen) {
        return ack?.({
          ok: false,
          code: 'BET_CLOSED',
          message: 'Đã hết thời gian đặt cược'
        })
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return ack?.({
          ok: false,
          code: 'INVALID_AMOUNT',
          message: 'Số tiền cược không hợp lệ'
        })
      }

      if (Number(user.balance || 0) < amount) {
        return ack?.({
          ok: false,
          code: 'INSUFFICIENT_BALANCE',
          message: 'Số dư không đủ để đặt cược'
        })
      }

      const result = await betService.placeBet({
        roundId: state.roundId,
        roomId,
        userId: user._id,
        gate,
        amount,
        clientBetId
      })

      if (result.roundSnapshot) {
        state.betTotalAmount = Number(result.roundSnapshot.betTotalAmount || 0)
        state.betCount = Number(result.roundSnapshot.betCount || 0)
        state.gateTotals = {
          ...createEmptyGateTotals(roomId),
          ...(result.roundSnapshot.gateTotals || {})
        }
      }

      io.to(`user:${user._id}`).emit('balance_update', {
        balance: result.balance
      })
      io.to(roomId).emit('betting_snapshot', buildBettingSnapshot(state))

      return ack?.({
        ok: true,
        message: result.duplicate ? 'Lệnh cược đã tồn tại, bỏ qua trùng lặp' : 'Đặt cược thành công',
        balance: result.balance,
        bet: result.bet,
        duplicate: Boolean(result.duplicate)
      })
    } catch (error) {
      return ack?.({
        ok: false,
        code: error.code || 'BET_ERROR',
        message: error.message || 'Đặt cược thất bại'
      })
    }
  })
}

module.exports = {
  registerSicboHandlers,
  startRoomLoop,
  ensureRoomState,
  getRoomState,
  syncRoomConfigToActiveState,
  buildRoundStatePayload,
  getAdminRoomState,
  setRoomForcedResult
}
