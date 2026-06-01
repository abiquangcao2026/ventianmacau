const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const User = require('../models/User')
const AdminBank = require('../models/AdminBank')
const WalletTransaction = require('../models/WalletTransaction')
const demoConfigService = require('./demoConfigService')

class WalletService {
  isTransactionUnsupported(error) {
    const message = String(error?.message || '')
    return error?.code === 20 || message.includes('Transaction numbers are only allowed')
  }

  sessionOption(activeSession) {
    return activeSession ? { session: activeSession } : {}
  }

  async createWalletTransaction(record, session = null) {
    if (session) {
      await WalletTransaction.create([record], { session })
      return
    }

    await WalletTransaction.create(record)
  }

  validateAmount(amount) {
    const numericAmount = Number(amount)

    if (!numericAmount || numericAmount <= 0) {
      const error = new Error('Số tiền không hợp lệ')
      error.code = 'INVALID_AMOUNT'
      throw error
    }

    return numericAmount
  }

  async debitBalance({
    userId,
    amount,
    reason = 'bet',
    meta = {},
    type = 'bet',
    transactionId = null,
    session: existingSession = null
  }) {
    const numericAmount = this.validateAmount(amount)
    const session = existingSession || await mongoose.startSession()

    try {
      let nextBalance = 0

      const runWork = async (activeSession = null) => {
        // Atomic debit: only succeeds when current balance >= numericAmount.
        const updatedUser = await User.findOneAndUpdate(
          {
            _id: userId,
            balance: { $gte: numericAmount }
          },
          {
            $inc: { balance: -numericAmount }
          },
          {
            new: true,
            runValidators: true,
            ...this.sessionOption(activeSession)
          }
        )

        if (!updatedUser) {
          const exists = activeSession
            ? await User.exists({ _id: userId }).session(activeSession)
            : await User.exists({ _id: userId })

          if (!exists) {
            const error = new Error('Không tìm thấy người dùng')
            error.code = 'USER_NOT_FOUND'
            throw error
          }

          const error = new Error('Số dư không đủ')
          error.code = 'INSUFFICIENT_BALANCE'
          throw error
        }

        nextBalance = Number(updatedUser.balance || 0)
        const balanceBefore = nextBalance + numericAmount
        await this.createWalletTransaction(
          {
            ...(transactionId ? { _id: transactionId } : {}),
            userId,
            type,
            amount: -numericAmount,
            balanceBefore,
            balanceAfter: nextBalance,
            status: 'completed',
            reason,
            meta
          },
          activeSession
        )
      }

      if (existingSession) {
        await runWork(existingSession)
      } else {
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
      }

      return nextBalance
    } catch (error) {
      if (error?.code === 11000) {
        const duplicate = new Error('Yêu cầu đã được xử lý trước đó')
        duplicate.code = 'IDEMPOTENT_REPLAY'
        throw duplicate
      }

      throw error
    } finally {
      if (!existingSession) {
        await session.endSession()
      }
    }
  }

  async creditBalance({
    userId,
    amount,
    reason = 'win',
    meta = {},
    type = 'win',
    transactionId = null,
    session: existingSession = null
  }) {
    const numericAmount = this.validateAmount(amount)
    const session = existingSession || await mongoose.startSession()

    try {
      let nextBalance = 0

      const runWork = async (activeSession = null) => {
        const updatedUser = await User.findOneAndUpdate(
          { _id: userId },
          { $inc: { balance: numericAmount } },
          {
            new: true,
            runValidators: true,
            ...this.sessionOption(activeSession)
          }
        )

        if (!updatedUser) {
          const error = new Error('Không tìm thấy người dùng')
          error.code = 'USER_NOT_FOUND'
          throw error
        }

        nextBalance = Number(updatedUser.balance || 0)
        const balanceBefore = nextBalance - numericAmount
        await this.createWalletTransaction(
          {
            ...(transactionId ? { _id: transactionId } : {}),
            userId,
            type,
            amount: numericAmount,
            balanceBefore,
            balanceAfter: nextBalance,
            status: 'completed',
            reason,
            meta
          },
          activeSession
        )
      }

      if (existingSession) {
        await runWork(existingSession)
      } else {
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
      }

      return nextBalance
    } finally {
      if (!existingSession) {
        await session.endSession()
      }
    }
  }

  async createDepositRequest({ userId, amount, bankCode, transferContent }) {
    const numericAmount = this.validateAmount(amount)
    const [user, latestAdminBank] = await Promise.all([
      User.findById(userId).lean(),
      AdminBank.findOne().sort({ createdAt: -1 }).lean()
    ])
    const payoutPolicy = demoConfigService.getPayoutPolicy()

    if (!user) {
      throw new Error('Không tìm thấy người dùng')
    }

    const receiverSource = latestAdminBank
      ? {
          bankName: latestAdminBank.bankName,
          bankAccount: latestAdminBank.bankAccount,
          accountName: latestAdminBank.accountName,
          transferNote: latestAdminBank.transferNote
        }
      : {
          bankName: payoutPolicy.depositReceiverBank,
          bankAccount: payoutPolicy.depositReceiverAccountNumber,
          accountName: payoutPolicy.depositReceiverAccountName,
          transferNote: payoutPolicy.depositQrContentPrefix
        }

    const receiverMeta = {
      receiverBankName: String(receiverSource.bankName || '').trim(),
      receiverBankAccount: String(receiverSource.bankAccount || '').trim(),
      receiverAccountName: String(receiverSource.accountName || '').trim(),
      receiverTransferNote: String(receiverSource.transferNote || '').trim()
    }

    if (payoutPolicy.autoApproveDeposit) {
      const balance = await this.creditBalance({
        userId,
        amount: numericAmount,
        reason: 'deposit_auto_approved',
        type: 'deposit',
        meta: {
          bankCode,
          transferContent,
          autoApproved: true,
          ...receiverMeta
        }
      })

      return {
        success: true,
        autoApproved: true,
        balance
      }
    }

    const request = await WalletTransaction.create({
      userId,
      type: 'deposit_pending',
      amount: numericAmount,
      balanceBefore: Number(user.balance || 0),
      balanceAfter: Number(user.balance || 0),
      status: 'pending',
      reason: 'deposit_request',
      meta: {
        bankCode,
        transferContent,
        ...receiverMeta
      }
    })

    return {
      success: true,
      request
    }
  }

  async createWithdrawRequest({
    userId,
    amount,
    bankName,
    bankAccount,
    accountName,
    withdrawPassword
  }) {
    const numericAmount = this.validateAmount(amount)
    const user = await User.findById(userId)
    const payoutPolicy = demoConfigService.getPayoutPolicy()

    if (!user) {
      throw new Error('Không tìm thấy người dùng')
    }

    const normalizedLinkedBank = user.linkedBank || {}
    const normalizedBankName = String(bankName || normalizedLinkedBank.bankName || '').trim()
    const normalizedBankAccount = String(bankAccount || normalizedLinkedBank.bankAccount || '').trim()
    const normalizedAccountName = String(accountName || normalizedLinkedBank.accountName || '').trim()

    if (!normalizedBankName || !normalizedBankAccount || !normalizedAccountName) {
      throw new Error('Vui lòng liên kết ngân hàng trước khi rút tiền')
    }

    if (user.balance < numericAmount) {
      throw new Error('Số dư không đủ')
    }

    if (!user.withdrawPasswordHash) {
      throw new Error('Tài khoản chưa được thiết lập mật khẩu rút tiền')
    }

    if (!withdrawPassword) {
      throw new Error('Vui lòng nhập mật khẩu rút tiền')
    }

    const matched = await bcrypt.compare(String(withdrawPassword), user.withdrawPasswordHash)
    if (!matched) {
      throw new Error('Mật khẩu rút tiền không đúng')
    }

    if (numericAmount > payoutPolicy.dailyWithdrawLimit) {
      throw new Error('Vượt hạn mức rút tiền trong ngày của bản demo')
    }

    const pendingWithdrawCount = await WalletTransaction.countDocuments({
      userId: user._id,
      type: 'withdraw_pending',
      status: 'pending'
    })

    if (pendingWithdrawCount >= payoutPolicy.maxPendingWithdrawals) {
      throw new Error('Đã đạt số lượng yêu cầu rút đang chờ tối đa')
    }

    if (payoutPolicy.autoApproveWithdraw) {
      const feeAmount = Math.round(numericAmount * payoutPolicy.withdrawFeeRate)
      const totalDebit = numericAmount + feeAmount
      const balance = await this.debitBalance({
        userId,
        amount: totalDebit,
        reason: 'withdraw_auto_approved',
        type: 'withdraw',
        meta: {
          bankName: normalizedBankName,
          bankAccount: normalizedBankAccount,
          accountName: normalizedAccountName,
          feeAmount,
          autoApproved: true
        }
      })

      return {
        success: true,
        autoApproved: true,
        balance,
        feeAmount
      }
    }

    const session = await mongoose.startSession()
    let request = null
    let nextBalance = Number(user.balance || 0)

    try {
      const runWork = async (activeSession = null) => {
        const updatedUser = await User.findOneAndUpdate(
          {
            _id: user._id,
            balance: { $gte: numericAmount }
          },
          {
            $inc: { balance: -numericAmount }
          },
          {
            new: true,
            runValidators: true,
            ...this.sessionOption(activeSession)
          }
        )

        if (!updatedUser) {
          throw new Error('Số dư không đủ')
        }

        nextBalance = Number(updatedUser.balance || 0)
        const payload = {
          userId,
          type: 'withdraw_pending',
          amount: numericAmount,
          balanceBefore: nextBalance + numericAmount,
          balanceAfter: nextBalance,
          status: 'pending',
          reason: 'withdraw_request',
          meta: {
            bankName: normalizedBankName,
            bankAccount: normalizedBankAccount,
            accountName: normalizedAccountName
          }
        }

        if (activeSession) {
          const created = await WalletTransaction.create([payload], { session: activeSession })
          request = created[0]
          return
        }

        request = await WalletTransaction.create(payload)
      }

      try {
        await session.withTransaction(async () => {
          await runWork(session)
        })
      } catch (error) {
        if (!this.isTransactionUnsupported(error)) {
          throw error
        }

        await runWork(null)
      }
    } finally {
      await session.endSession()
    }

    return {
      success: true,
      request,
      balance: nextBalance
    }
  }

  async approveTransaction({ transactionId, adminUserId }) {
    const transaction = await WalletTransaction.findById(transactionId)

    if (!transaction) {
      throw new Error('Không tìm thấy giao dịch')
    }

    if (transaction.status !== 'pending') {
      throw new Error('Yêu cầu này đã được xử lý')
    }

    if (transaction.type === 'deposit_pending') {
      const requestMeta = transaction.meta && typeof transaction.meta === 'object'
        ? { ...transaction.meta }
        : {}
      const balance = await this.creditBalance({
        userId: transaction.userId,
        amount: transaction.amount,
        reason: 'deposit_approved',
        type: 'deposit',
        meta: {
          ...requestMeta,
          sourceRequestId: transaction._id
        }
      })

      transaction.status = 'approved'
      transaction.reviewedBy = adminUserId
      transaction.reviewedAt = new Date()
      transaction.balanceAfter = balance
      await transaction.save()

      return {
        success: true,
        transaction
      }
    }

    if (transaction.type === 'withdraw_pending') {
      const user = await User.findById(transaction.userId).select('balance')
      transaction.status = 'completed'
      transaction.type = 'withdraw'
      transaction.reviewedBy = adminUserId
      transaction.reviewedAt = new Date()
      transaction.reason = 'withdraw_approved'
      transaction.balanceAfter = Number(user?.balance || transaction.balanceAfter || 0)
      await transaction.save()

      return {
        success: true,
        transaction
      }
    }

    throw new Error('Loại giao dịch này không hỗ trợ duyệt')
  }

  async rejectTransaction({ transactionId, adminUserId, note = '' }) {
    const transaction = await WalletTransaction.findById(transactionId)

    if (!transaction) {
      throw new Error('Không tìm thấy giao dịch')
    }

    if (transaction.status !== 'pending') {
      throw new Error('Yêu cầu này đã được xử lý')
    }

    const normalizedNote = String(note || '').trim() || 'Liên hệ CSKH để kiểm tra'

    if (transaction.type === 'withdraw_pending') {
      const updatedUser = await User.findOneAndUpdate(
        { _id: transaction.userId },
        { $inc: { balance: Number(transaction.amount || 0) } },
        { new: true, runValidators: true }
      )

      if (!updatedUser) {
        throw new Error('Không tìm thấy người dùng')
      }

      transaction.status = 'rejected'
      transaction.reviewedBy = adminUserId
      transaction.reviewedAt = new Date()
      transaction.type = 'withdraw_rejected'
      transaction.balanceAfter = Number(updatedUser.balance || 0)
      transaction.meta = {
        ...(transaction.meta || {}),
        adminNote: normalizedNote
      }
      await transaction.save()

      return {
        success: true,
        transaction
      }
    }

    transaction.status = 'rejected'
    transaction.reviewedBy = adminUserId
    transaction.reviewedAt = new Date()
    transaction.type = 'deposit_rejected'
    transaction.meta = {
      ...(transaction.meta || {}),
      adminNote: normalizedNote
    }

    await transaction.save()

    return {
      success: true,
      transaction
    }
  }
}

module.exports = WalletService
