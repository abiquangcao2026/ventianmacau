// file: server/routes/account.js
const express = require('express')
const User = require('../models/User')
const WalletTransaction = require('../models/WalletTransaction')
const WalletService = require('../services/walletService')

const router = express.Router()
const walletService = new WalletService()

router.get('/me/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).lean()

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }

    return res.json({
      user: {
        _id: user._id,
        username: user.username,
        balance: user.balance,
        status: user.status
      }
    })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Lỗi máy chủ' })
  }
})

router.get('/transactions/:userId', async (req, res) => {
  try {
    const items = await WalletTransaction.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    return res.json({ items })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Lỗi máy chủ' })
  }
})

router.post('/deposit-request', async (req, res) => {
  try {
    const { userId, amount, bankCode, transferContent } = req.body

    const result = await walletService.createDepositRequest({
      userId,
      amount,
      bankCode,
      transferContent
    })

    return res.json(result)
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể tạo yêu cầu nạp tiền' })
  }
})

router.post('/withdraw-request', async (req, res) => {
  try {
    const { userId, amount, bankName, bankAccount, accountName } = req.body

    const result = await walletService.createWithdrawRequest({
      userId,
      amount,
      bankName,
      bankAccount,
      accountName
    })

    return res.json(result)
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể tạo yêu cầu rút tiền' })
  }
})

module.exports = router