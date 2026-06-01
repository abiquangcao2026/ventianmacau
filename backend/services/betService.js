// file: server/services/betService.js
const Bet = require('../models/Bet')

class BetService {
  constructor({ walletService }) {
    this.walletService = walletService
  }

  async placeBet({ roundId, roomId = 'sicbo-3p', userId, gate, amount }) {
    const numericAmount = Number(amount)

    if (!roundId) {
      const error = new Error('Thiếu roundId')
      error.code = 'INVALID_ROUND'
      throw error
    }

    if (!gate) {
      const error = new Error('Thiếu cửa cược')
      error.code = 'INVALID_GATE'
      throw error
    }

    if (!numericAmount || numericAmount <= 0) {
      const error = new Error('Số tiền cược không hợp lệ')
      error.code = 'INVALID_AMOUNT'
      throw error
    }

    const balance = await this.walletService.debitBalance({
      userId,
      amount: numericAmount,
      reason: 'sicbo_bet',
      meta: { roundId, roomId, gate }
    })

    const bet = await Bet.create({
      roundId,
      roomId,
      userId,
      gate,
      amount: numericAmount,
      status: 'placed'
    })

    return {
      balance,
      bet
    }
  }

  async getRoundBets(roundId, roomId = 'sicbo-3p') {
    return Bet.find({
      roundId,
      roomId,
      status: 'placed'
    }).lean()
  }

  async settleBet({ betId, result, payout, status }) {
    return Bet.findByIdAndUpdate(
      betId,
      {
        payout: Number(payout || 0),
        status,
        resultSnapshot: result
      },
      { new: true }
    )
  }
}

module.exports = BetService