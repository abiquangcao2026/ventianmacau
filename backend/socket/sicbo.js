// file: server/socket/sicbo.js
const BetService = require('../services/betService')
const WalletService = require('../services/walletService')

const walletService = new WalletService()
const betService = new BetService({ walletService })

const ROOM_DEFAULT = 'sicbo-3p'
const ROUND_DURATION = 20
const BET_LOCK_SECONDS = 3
const RESULT_DELAY_MS = 3000

const roomStates = new Map()
const roomLoops = new Map()

function createInitialRoomState(roomId = ROOM_DEFAULT) {
  return {
    roomId,
    roundId: `round_${Date.now()}`,
    timeLeft: ROUND_DURATION,
    bettingOpen: true,
    result: null
  }
}

function getRoomState(roomId = ROOM_DEFAULT) {
  if (!roomStates.has(roomId)) {
    roomStates.set(roomId, createInitialRoomState(roomId))
  }
  return roomStates.get(roomId)
}

function resetRoom(roomId = ROOM_DEFAULT) {
  const next = createInitialRoomState(roomId)
  roomStates.set(roomId, next)
  return next
}

function rollDice() {
  const d1 = Math.ceil(Math.random() * 6)
  const d2 = Math.ceil(Math.random() * 6)
  const d3 = Math.ceil(Math.random() * 6)
  return [d1, d2, d3]
}

function getTotal(result) {
  return result.reduce((sum, value) => sum + value, 0)
}

function isTriple(result) {
  return result[0] === result[1] && result[1] === result[2]
}

function calculatePayout(gate, amount, result) {
  const total = getTotal(result)
  const triple = isTriple(result)
  const numericAmount = Number(amount)

  if (gate === 'tai') {
    if (!triple && total >= 11 && total <= 17) {
      return numericAmount * 2
    }
  }

  if (gate === 'xiu') {
    if (!triple && total >= 4 && total <= 10) {
      return numericAmount * 2
    }
  }

  if (gate === 'odd') {
    if (total % 2 === 1) {
      return numericAmount * 2
    }
  }

  if (gate === 'even') {
    if (total % 2 === 0) {
      return numericAmount * 2
    }
  }

  if (/^sum_\d+$/.test(gate)) {
    const target = Number(gate.split('_')[1])
    if (total === target) {
      const payoutTable = {
        4: 50,
        5: 18,
        6: 14,
        7: 12,
        8: 8,
        9: 6,
        10: 6,
        11: 6,
        12: 6,
        13: 8,
        14: 12,
        15: 14,
        16: 18,
        17: 50
      }
      return numericAmount * (payoutTable[target] + 1)
    }
  }

  return 0
}

async function settleRound(io, roomId, state) {
  const result = rollDice()
  const bets = await betService.getRoundBets(state.roundId, roomId)

  for (const bet of bets) {
    const payout = calculatePayout(bet.gate, bet.amount, result)

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
        }
      })

      await betService.settleBet({
        betId: bet._id,
        result,
        payout,
        status: 'won'
      })

      io.to(`user:${bet.userId}`).emit('balance_update', {
        balance: await getUserBalance(bet.userId)
      })
    } else {
      await betService.settleBet({
        betId: bet._id,
        result,
        payout: 0,
        status: 'lost'
      })
    }
  }

  io.to(roomId).emit('round_result', {
    roomId,
    roundId: state.roundId,
    result
  })
}

async function getUserBalance(userId) {
  const User = require('../models/User')
  const user = await User.findById(userId).lean()
  return Number(user?.balance || 0)
}

function emitRoundState(io, roomId) {
  const state = getRoomState(roomId)
  io.to(roomId).emit('round_state', {
    roomId: state.roomId,
    roundId: state.roundId,
    timeLeft: state.timeLeft,
    bettingOpen: state.bettingOpen,
    result: state.result
  })
}

function startRoomLoop(io, roomId = ROOM_DEFAULT) {
  if (roomLoops.has(roomId)) return

  getRoomState(roomId)
  emitRoundState(io, roomId)

  const timer = setInterval(async () => {
    const state = getRoomState(roomId)

    state.timeLeft -= 1

    if (state.timeLeft <= BET_LOCK_SECONDS) {
      state.bettingOpen = false
    }

    io.to(roomId).emit('timer_update', {
      roomId: state.roomId,
      roundId: state.roundId,
      timeLeft: state.timeLeft,
      bettingOpen: state.bettingOpen
    })

    if (state.timeLeft <= 0) {
      clearInterval(timer)
      roomLoops.delete(roomId)

      state.bettingOpen = false
      await settleRound(io, roomId, state)

      setTimeout(() => {
        resetRoom(roomId)
        startRoomLoop(io, roomId)
      }, RESULT_DELAY_MS)
    }
  }, 1000)

  roomLoops.set(roomId, timer)
}

function registerSicboHandlers(io, socket) {
  socket.on('join_sicbo_room', async ({ userId, roomId = ROOM_DEFAULT }) => {
    socket.join(roomId)

    if (userId) {
      socket.join(`user:${userId}`)
      const balance = await getUserBalance(userId)
      socket.emit('balance_update', { balance })
    }

    const state = getRoomState(roomId)
    socket.emit('round_state', {
      roomId: state.roomId,
      roundId: state.roundId,
      timeLeft: state.timeLeft,
      bettingOpen: state.bettingOpen,
      result: state.result
    })

    startRoomLoop(io, roomId)
  })

  socket.on('place_bet', async (payload, ack) => {
    try {
      const { userId, roomId = ROOM_DEFAULT, gate, amount } = payload || {}
      const state = getRoomState(roomId)

      if (!userId) {
        return ack?.({
          ok: false,
          code: 'USER_REQUIRED',
          message: 'Thiếu userId'
        })
      }

      if (!state.bettingOpen || state.timeLeft <= BET_LOCK_SECONDS) {
        return ack?.({
          ok: false,
          code: 'BET_CLOSED',
          message: 'Đã hết thời gian đặt cược'
        })
      }

      const result = await betService.placeBet({
        roundId: state.roundId,
        roomId,
        userId,
        gate,
        amount
      })

      io.to(`user:${userId}`).emit('balance_update', {
        balance: result.balance
      })

      return ack?.({
        ok: true,
        message: 'Đặt cược thành công',
        balance: result.balance,
        bet: result.bet
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
  startRoomLoop
}