const mongoose = require('mongoose')
const crypto = require('crypto')
const Bet = require('../models/Bet')
const SicboRound = require('../models/SicboRound')
const User = require('../models/User')
const demoConfigService = require('./demoConfigService')

const DEFAULT_MAX_BETS_PER_USER_PER_ROUND = 25

class BetService {
  constructor({ walletService }) {
    this.walletService = walletService
  }

  isTransactionUnsupported(error) {
    const message = String(error?.message || '')
    return error?.code === 20 || message.includes('Transaction numbers are only allowed')
  }

  getRoundBetLimit(round, config) {
    const fromRound = Number(round?.configSnapshot?.maxBetsPerUserPerRound || 0)
    if (fromRound > 0) return fromRound

    const fromConfig = Number(config?.maxBetsPerUserPerRound || 0)
    if (fromConfig > 0) return fromConfig

    return DEFAULT_MAX_BETS_PER_USER_PER_ROUND
  }

  normalizeClientBetId(clientBetId) {
    const normalized = String(clientBetId || '').trim()
    if (!normalized) {
      return ''
    }

    return normalized.slice(0, 100)
  }

  buildIdempotencyTransactionId({ userId, roomId, roundId, clientBetId }) {
    const seed = `${String(userId)}:${String(roomId)}:${String(roundId)}:${String(clientBetId)}`
    const hex = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 24)
    return new mongoose.Types.ObjectId(hex)
  }

  async findExistingClientBet({ roomId, roundId, userId, clientBetId, session = null }) {
    if (!clientBetId) {
      return null
    }

    let query = Bet.findOne({
      roomId,
      roundId,
      userId,
      'resultSnapshot.clientBetId': clientBetId
    })
      .sort({ createdAt: -1 })
      .lean()

    if (session) {
      query = query.session(session)
    }

    return query
  }

  async placeBet({ roundId, roomId = 'sicbo-3p', userId, gate, amount, clientBetId }) {
    const numericAmount = Number(amount)
    const normalizedClientBetId = this.normalizeClientBetId(clientBetId)
    const config = demoConfigService.getSicboConfig(roomId)
    const allowedGates = Object.keys(config.odds || {})

    if (!roundId) {
      const error = new Error('Thiếu roundId')
      error.code = 'INVALID_ROUND'
      throw error
    }

    if (!gate || !allowedGates.includes(gate)) {
      const error = new Error('Thiếu cửa cược')
      error.code = 'INVALID_GATE'
      throw error
    }

    const hasMaxBet = Number(config.maxBet || 0) > 0
    if (
      !numericAmount ||
      numericAmount < config.minBet ||
      (hasMaxBet && numericAmount > config.maxBet)
    ) {
      const message = hasMaxBet
        ? `Số tiền cược phải từ ${config.minBet} đến ${config.maxBet}`
        : `Số tiền cược tối thiểu là ${config.minBet}`
      const error = new Error(message)
      error.code = 'INVALID_AMOUNT'
      throw error
    }

    const session = await mongoose.startSession()

    try {
      let balance = 0
      let bet = null
      let roundSnapshot = null
      let duplicate = false

      const runWork = async (activeSession = null) => {
        let roundQuery = SicboRound.findOne({
          roomId,
          roundId
        })
        if (activeSession) {
          roundQuery = roundQuery.session(activeSession)
        }
        const round = await roundQuery

        if (!round) {
          const error = new Error('Phiên cược không còn hợp lệ')
          error.code = 'ROUND_NOT_FOUND'
          throw error
        }

        const now = Date.now()
        const betCloseTime = round.betCloseTime ? new Date(round.betCloseTime).getTime() : 0
        if (round.status !== 'betting' || (betCloseTime > 0 && now >= betCloseTime)) {
          const error = new Error('Phiên cược đã đóng')
          error.code = 'BET_CLOSED'
          throw error
        }

        const existingClientBet = await this.findExistingClientBet({
          roomId,
          roundId,
          userId,
          clientBetId: normalizedClientBetId,
          session: activeSession
        })
        if (existingClientBet) {
          duplicate = true
          bet = existingClientBet
          let userQuery = User.findById(userId).select('balance')
          if (activeSession) {
            userQuery = userQuery.session(activeSession)
          }
          const user = await userQuery.lean()
          balance = Number(user?.balance || 0)
          roundSnapshot = {
            betTotalAmount: Number(round.betTotalAmount || 0),
            betCount: Number(round.betCount || 0),
            gateTotals: { ...(round.gateTotals || {}) }
          }
          return
        }

        const maxBetsPerRound = this.getRoundBetLimit(round, config)
        let existingBetCountQuery = Bet.countDocuments({
          roomId,
          roundId,
          userId
        })
        if (activeSession) {
          existingBetCountQuery = existingBetCountQuery.session(activeSession)
        }
        const existingBetCount = await existingBetCountQuery

        if (existingBetCount >= maxBetsPerRound) {
          const error = new Error(`Bạn đã đạt giới hạn ${maxBetsPerRound} lệnh trong một phiên`)
          error.code = 'ROUND_BET_LIMIT_REACHED'
          throw error
        }

        balance = await this.walletService.debitBalance({
          userId,
          amount: numericAmount,
          reason: 'sicbo_bet',
          meta: {
            roundId,
            roomId,
            gate,
            clientBetId: normalizedClientBetId || undefined
          },
          type: 'bet',
          transactionId: normalizedClientBetId
            ? this.buildIdempotencyTransactionId({
                userId,
                roomId,
                roundId,
                clientBetId: normalizedClientBetId
              })
            : null,
          session: activeSession
        })

        bet = new Bet({
          roundId,
          roomId,
          userId,
          gate,
          amount: numericAmount,
          resultSnapshot: normalizedClientBetId ? { clientBetId: normalizedClientBetId } : null,
          status: 'placed'
        })

        if (activeSession) {
          await bet.save({ session: activeSession })
        } else {
          await bet.save()
        }

        round.betTotalAmount = Number(round.betTotalAmount || 0) + numericAmount
        round.betCount = Number(round.betCount || 0) + 1
        round.gateTotals = {
          ...(round.gateTotals || {}),
          [gate]: Number(round.gateTotals?.[gate] || 0) + numericAmount
        }
        round.markModified('gateTotals')
        if (activeSession) {
          await round.save({ session: activeSession })
        } else {
          await round.save()
        }

        roundSnapshot = {
          betTotalAmount: Number(round.betTotalAmount || 0),
          betCount: Number(round.betCount || 0),
          gateTotals: { ...(round.gateTotals || {}) }
        }
      }

      try {
        await session.withTransaction(async () => {
          await runWork(session)
        })
      } catch (error) {
        if (!this.isTransactionUnsupported(error)) {
          throw error
        }

        // Fallback for standalone MongoDB in dev/demo environments.
        await runWork(null)
      }

      return {
        balance,
        bet,
        duplicate,
        roundSnapshot
      }
    } catch (error) {
      if (error?.code === 'IDEMPOTENT_REPLAY' && normalizedClientBetId) {
        const [existingBet, user, round] = await Promise.all([
          this.findExistingClientBet({
            roomId,
            roundId,
            userId,
            clientBetId: normalizedClientBetId
          }),
          User.findById(userId).select('balance').lean(),
          SicboRound.findOne({ roomId, roundId }).select('betTotalAmount betCount gateTotals').lean()
        ])

        if (existingBet) {
          return {
            balance: Number(user?.balance || 0),
            bet: existingBet,
            duplicate: true,
            roundSnapshot: {
              betTotalAmount: Number(round?.betTotalAmount || 0),
              betCount: Number(round?.betCount || 0),
              gateTotals: { ...(round?.gateTotals || {}) }
            }
          }
        }
      }

      throw error
    } finally {
      await session.endSession()
    }
  }

  async getRoundBets(roundId, roomId = 'sicbo-3p', { session = null, lean = true } = {}) {
    let query = Bet.find({
      roundId,
      roomId,
      status: 'placed'
    })

    if (session) {
      query = query.session(session)
    }

    if (lean) {
      return query.lean()
    }

    return query
  }

  async settleBet({ betId, result, payout, status, session = null }) {
    return Bet.findByIdAndUpdate(
      betId,
      {
        payout: Number(payout || 0),
        status,
        resultSnapshot: result
      },
      { new: true, session }
    )
  }
}

module.exports = BetService
