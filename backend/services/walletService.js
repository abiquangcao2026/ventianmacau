// file: server/services/walletService.js
const mongoose = require('mongoose')
const User = require('../models/User')
const WalletTransaction = require('../models/WalletTransaction')

class WalletService {
  async debitBalance({ userId, amount, reason = 'bet', meta = {} }) {
    const numericAmount = Number(amount)

    if (!numericAmount || numericAmount <= 0) {
      const error = new Error('Số tiền không hợp lệ')
      error.code = 'INVALID_AMOUNT'
      throw error
    }

    const session = await mongoose.startSession()

    try {
      let nextBalance = 0

      await session.withTransaction(async () => {
        const user = await User.findById(userId).session(session)

        if (!user) {
          const error = new Error('Không tìm thấy người dùng')
          error.code = 'USER_NOT_FOUND'
          throw error
        }

        if (user.balance < numericAmount) {
          const error = new Error('Số dư không đủ')
          error.code = 'INSUFFICIENT_BALANCE'
          throw error
        }

        const balanceBefore = user.balance
        user.balance = balanceBefore - numericAmount
        nextBalance = user.balance

        await user.save({ session })

        await WalletTransaction.create(
          [
            {
              userId,
              type: 'bet',
              amount: -numericAmount,
              balanceBefore,
              balanceAfter: nextBalance,
              reason,
              meta
            }
          ],
          { session }
        )
      })

      return nextBalance
    } finally {
      await session.endSession()
    }
  }

  async creditBalance({ userId, amount, reason = 'win', meta = {} }) {
    const numericAmount = Number(amount)

    if (!numericAmount || numericAmount <= 0) {
      const error = new Error('Số tiền không hợp lệ')
      error.code = 'INVALID_AMOUNT'
      throw error
    }

    const session = await mongoose.startSession()

    try {
      let nextBalance = 0

      await session.withTransaction(async () => {
        const user = await User.findById(userId).session(session)

        if (!user) {
          const error = new Error('Không tìm thấy người dùng')
          error.code = 'USER_NOT_FOUND'
          throw error
        }

        const balanceBefore = user.balance
        user.balance = balanceBefore + numericAmount
        nextBalance = user.balance

        await user.save({ session })

        await WalletTransaction.create(
          [
            {
              userId,
              type: 'win',
              amount: numericAmount,
              balanceBefore,
              balanceAfter: nextBalance,
              reason,
              meta
            }
          ],
          { session }
        )
      })

      return nextBalance
    } finally {
      await session.endSession()
    }
  }

  async createDepositRequest({ userId, amount, bankCode, transferContent }) {
    const numericAmount = Number(amount)

    if (!numericAmount || numericAmount <= 0) {
      const error = new Error('Số tiền không hợp lệ')
      error.code = 'INVALID_AMOUNT'
      throw error
    }

    return {
      success: true,
      request: {
        userId,
        type: 'deposit_pending',
        amount: numericAmount,
        bankCode,
        transferContent,
        createdAt: new Date().toISOString()
      }
    }
  }

  async createWithdrawRequest({ userId, amount, bankName, bankAccount, accountName }) {
    const numericAmount = Number(amount)

    if (!numericAmount || numericAmount <= 0) {
      const error = new Error('Số tiền không hợp lệ')
      error.code = 'INVALID_AMOUNT'
      throw error
    }

    const session = await mongoose.startSession()

    try {
      let nextBalance = 0

      await session.withTransaction(async () => {
        const user = await User.findById(userId).session(session)

        if (!user) {
          const error = new Error('Không tìm thấy người dùng')
          error.code = 'USER_NOT_FOUND'
          throw error
        }

        if (user.balance < numericAmount) {
          const error = new Error('Số dư không đủ')
          error.code = 'INSUFFICIENT_BALANCE'
          throw error
        }

        const balanceBefore = user.balance
        user.balance = balanceBefore - numericAmount
        nextBalance = user.balance

        await user.save({ session })

        await WalletTransaction.create(
          [
            {
              userId,
              type: 'withdraw',
              amount: -numericAmount,
              balanceBefore,
              balanceAfter: nextBalance,
              reason: 'withdraw_request',
              meta: {
                bankName,
                bankAccount,
                accountName,
                status: 'pending'
              }
            }
          ],
          { session }
        )
      })

      return {
        success: true,
        balance: nextBalance
      }
    } finally {
      await session.endSession()
    }
  }
}

module.exports = WalletService