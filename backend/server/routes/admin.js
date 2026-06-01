const express = require('express')
const bcrypt = require('bcrypt')
const User = require('../models/User')
const Bet = require('../models/Bet')
const SicboRound = require('../models/SicboRound')
const WalletTransaction = require('../models/WalletTransaction')
const UserAdminChangeLog = require('../models/UserAdminChangeLog')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const AdminService = require('../services/adminService')
const demoConfigService = require('../services/demoConfigService')
const WalletService = require('../services/walletService')
const {
  getAdminRoomState,
  setRoomForcedResult,
  syncRoomConfigToActiveState
} = require('../socket/sicbo')
const { emitAdminWalletNotify, emitUserWalletUpdate } = require('../socket/realtime')
const { sanitizeUser } = require('../utils/auth')
const { encryptSecret, decryptSecret } = require('../utils/passwordVault')
const { getSupportUserPresence, formatChatMessageForClient } = require('../socket/chat')

const router = express.Router()
const walletService = new WalletService()
const adminService = new AdminService()
const LIVE_SICBO_ROOM_IDS = ['sicbo-3p', 'sicbo-5p']

router.use(requireAuth, requireAdmin)

function normalizeLiveRoomId(rawRoomId) {
  return LIVE_SICBO_ROOM_IDS.includes(String(rawRoomId || '')) ? String(rawRoomId) : 'sicbo-3p'
}

function normalizeInviteCode(rawCode) {
  return String(rawCode || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function buildAdminSnapshot(user) {
  return {
    username: String(user?.username || ''),
    fullName: String(user?.fullName || '')
  }
}

function isValidPhoneNumber(rawValue) {
  const normalized = String(rawValue || '').trim()
  if (!normalized) return true

  const compact = normalized.replace(/[^\d+]/g, '')
  return /^(?:\+?84|0)\d{8,10}$/.test(compact)
}

async function writeUserChangeLog({ userId, adminUser, action, before = {}, after = {}, note = '' }) {
  if (!userId || !action) {
    return
  }

  await UserAdminChangeLog.create({
    userId,
    adminId: adminUser?._id || null,
    adminSnapshot: buildAdminSnapshot(adminUser),
    action,
    before,
    after,
    note: String(note || '').trim().slice(0, 220)
  })
}

router.get('/overview', async (req, res) => {
  try {
    const [users, pendingTransactions, totalUsers, activeUsers] = await Promise.all([
      User.find().sort({ createdAt: -1 }).limit(20).lean(),
      WalletTransaction.find({ status: 'pending' })
        .populate('userId', 'username fullName')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      User.countDocuments(),
      User.countDocuments({ status: 'active' })
    ])

    return res.json({
      stats: {
        totalUsers,
        activeUsers,
        pendingTransactions: pendingTransactions.length
      },
      users: users.map(sanitizeUser),
      pendingTransactions
    })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Không thể tải dashboard admin' })
  }
})

router.get('/users', async (req, res) => {
  try {
    const result = await adminService.getUsers({
      page: req.query.page,
      limit: req.query.limit,
      keyword: req.query.keyword
    })
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Khong the tai danh sach user' })
  }
})

router.get('/users/:id', async (req, res) => {
  try {
    const [user, changeLogs] = await Promise.all([
      adminService.getUserById(req.params.id),
      UserAdminChangeLog.find({ userId: req.params.id }).sort({ createdAt: -1 }).limit(30).lean()
    ])

    if (!user) {
      return res.status(404).json({ message: 'Khong tim thay nguoi dung' })
    }

    return res.json({ user, changeLogs })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Khong the tai thong tin user' })
  }
})

router.get('/users/:userId/history', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('_id').lean()
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }

    const history = await adminService.getUserHistory(req.params.userId, {
      mode: req.query.mode,
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit
    })

    return res.json(history)
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể tải lịch sử khách hàng' })
  }
})

router.patch('/users/:userId/profile', async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || '').trim().slice(0, 80)
    const phone = String(req.body?.phone || '').trim().slice(0, 30)
    const displayName = String(req.body?.displayName || '').trim().slice(0, 60)
    const characterName = String(req.body?.characterName || '').trim().slice(0, 60)
    const referredByCode = String(req.body?.referredByCode || '').trim().slice(0, 24)
    const inviteCode = normalizeInviteCode(req.body?.inviteCode || '')

    if (inviteCode && (inviteCode.length < 5 || inviteCode.length > 16)) {
      return res.status(400).json({ message: 'Mã mời phải từ 5-16 ký tự chữ hoa hoặc số' })
    }

    if (!isValidPhoneNumber(phone)) {
      return res.status(400).json({ message: 'Số điện thoại không hợp lệ' })
    }

    const duplicated = inviteCode
      ? await User.findOne({
          _id: { $ne: req.params.userId },
          inviteCode
        }).lean()
      : null

    if (duplicated) {
      return res.status(400).json({ message: 'Mã mời đã được sử dụng bởi người chơi khác' })
    }

    const user = await User.findById(req.params.userId)
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }

    const before = {
      fullName: String(user.fullName || ''),
      phone: String(user.phone || ''),
      displayName: String(user.displayName || ''),
      characterName: String(user.characterName || ''),
      referredByCode: String(user.referredByCode || ''),
      inviteCode: String(user.inviteCode || '')
    }

    user.fullName = fullName
    user.phone = phone
    user.displayName = displayName
    user.characterName = characterName
    user.referredByCode = referredByCode
    if (inviteCode) {
      user.inviteCode = inviteCode
    }
    await user.save()

    await writeUserChangeLog({
      userId: user._id,
      adminUser: req.user,
      action: 'profile_update',
      before,
      after: {
        fullName,
        phone,
        displayName,
        characterName,
        referredByCode,
        inviteCode: String(user.inviteCode || '')
      }
    })

    return res.json({ user: sanitizeUser(user) })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể cập nhật thông tin người chơi' })
  }
})

router.patch('/users/:userId/password', async (req, res) => {
  try {
    const password = String(req.body?.password || '')
    const withdrawPassword = String(req.body?.withdrawPassword || '')
    const nextUpdate = {}

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: 'Mật khẩu đăng nhập tối thiểu 6 ký tự' })
      }
      nextUpdate.passwordHash = await bcrypt.hash(password, 10)
      nextUpdate.password_encrypted = encryptSecret(password)
    }

    if (withdrawPassword) {
      if (withdrawPassword.length < 4) {
        return res.status(400).json({ message: 'Mật khẩu rút tối thiểu 4 ký tự' })
      }
      nextUpdate.withdrawPasswordHash = await bcrypt.hash(withdrawPassword, 10)
      nextUpdate.withdraw_password_encrypted = encryptSecret(withdrawPassword)
    }

    if (!Object.keys(nextUpdate).length) {
      return res.status(400).json({ message: 'Vui lòng nhập mật khẩu mới cần thay đổi' })
    }

    const user = await User.findById(req.params.userId)
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }

    Object.assign(user, nextUpdate)
    await user.save()

    await writeUserChangeLog({
      userId: user._id,
      adminUser: req.user,
      action: 'security_update',
      after: {
        passwordChanged: Boolean(password),
        withdrawPasswordChanged: Boolean(withdrawPassword)
      }
    })

    return res.json({ user: sanitizeUser(user) })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể đổi mật khẩu người chơi' })
  }
})

router.get('/users/:userId/password', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('+password_encrypted +withdraw_password_encrypted username')

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }

    const password = decryptSecret(user.password_encrypted)
    const withdrawPassword = decryptSecret(user.withdraw_password_encrypted)

    await writeUserChangeLog({
      userId: user._id,
      adminUser: req.user,
      action: 'password_view',
      after: {
        passwordVisible: Boolean(password),
        withdrawPasswordVisible: Boolean(withdrawPassword)
      },
      note: 'Admin xem mật khẩu đã mã hóa'
    })

    return res.json({
      username: user.username,
      password,
      withdrawPassword,
      hasPassword: Boolean(password),
      hasWithdrawPassword: Boolean(withdrawPassword),
      message: password || withdrawPassword
        ? ''
        : 'Mật khẩu cũ đang lưu dạng hash nên không thể giải mã. Chỉ mật khẩu tạo/đổi sau bản cập nhật mới hiển thị được.'
    })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể xem mật khẩu người chơi' })
  }
})

router.patch('/users/:userId/bank', async (req, res) => {
  try {
    const bankName = String(req.body?.bankName || '').trim().slice(0, 80)
    const bankAccount = String(req.body?.bankAccount || '').trim().slice(0, 40)
    const accountName = String(req.body?.accountName || '').trim().slice(0, 80)

    const user = await User.findById(req.params.userId)
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }

    const before = {
      bankName: String(user.linkedBank?.bankName || ''),
      bankAccount: String(user.linkedBank?.bankAccount || ''),
      accountName: String(user.linkedBank?.accountName || '')
    }

    user.linkedBank = {
      bankName,
      bankAccount,
      accountName
    }
    user.markModified('linkedBank')
    await user.save()

    await writeUserChangeLog({
      userId: user._id,
      adminUser: req.user,
      action: 'bank_update',
      before,
      after: {
        bankName,
        bankAccount,
        accountName
      }
    })

    return res.json({ user: sanitizeUser(user) })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể cập nhật tài khoản ngân hàng' })
  }
})

router.patch('/users/:userId/status', async (req, res) => {
  try {
    const { status } = req.body || {}

    if (!['active', 'locked'].includes(status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ' })
    }

    const user = await User.findById(req.params.userId)
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }

    const before = { status: String(user.status || '') }
    user.status = status
    await user.save()

    await writeUserChangeLog({
      userId: user._id,
      adminUser: req.user,
      action: 'status_update',
      before,
      after: { status: String(user.status || '') }
    })

    return res.json({ user: sanitizeUser(user) })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Không thể cập nhật trạng thái' })
  }
})

router.post('/users/:userId/adjust-balance', async (req, res) => {
  try {
    const { kind, amount, note } = req.body || {}
    const normalizedKind = String(kind || '').trim()
    const numericAmount = Number(amount || 0)

    if (!['credit', 'debit', 'bonus'].includes(normalizedKind)) {
      return res.status(400).json({ message: 'Loại điều chỉnh không hợp lệ' })
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: 'Số tiền không hợp lệ' })
    }

    const user = await User.findById(req.params.userId)
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }

    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Không thể điều chỉnh số dư của admin' })
    }

    const meta = {
      adminId: String(req.user._id),
      note: String(note || '').trim()
    }

    let balance = 0
    if (normalizedKind === 'debit') {
      balance = await walletService.debitBalance({
        userId: user._id,
        amount: numericAmount,
        reason: 'admin_debit',
        type: 'admin_debit',
        meta
      })
    } else {
      balance = await walletService.creditBalance({
        userId: user._id,
        amount: numericAmount,
        reason: normalizedKind === 'bonus' ? 'admin_bonus' : 'admin_credit',
        type: normalizedKind === 'bonus' ? 'admin_bonus' : 'admin_credit',
        meta
      })
    }

    const io = req.app.get('io')
    await emitUserWalletUpdate(io, {
      userId: user._id,
      balance,
      reason: normalizedKind === 'bonus' ? 'admin_bonus' : `admin_${normalizedKind}`,
      transactionType: normalizedKind === 'bonus' ? 'admin_bonus' : `admin_${normalizedKind}`,
      status: 'completed',
      amount: numericAmount
    })
    emitAdminWalletNotify(io, {
      event: normalizedKind === 'bonus' ? 'admin_bonus' : `admin_${normalizedKind}`,
      actorAdminId: String(req.user._id),
      userId: String(user._id),
      username: user.username || '',
      amount: numericAmount,
      balance,
      status: 'completed',
      transactionType: normalizedKind === 'bonus' ? 'admin_bonus' : `admin_${normalizedKind}`
    })

    return res.json({ success: true, balance })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể điều chỉnh số dư' })
  }
})

router.patch('/users/:userId/vip', async (req, res) => {
  try {
    const vipLevel = Number(req.body?.vipLevel || 0)

    if (!Number.isFinite(vipLevel) || vipLevel < 0 || !Number.isInteger(vipLevel)) {
      return res.status(400).json({ message: 'VIP không hợp lệ' })
    }

    const user = await User.findById(req.params.userId)
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }

    const before = { vipLevel: Number(user.vipLevel || 0) }
    user.vipLevel = vipLevel
    await user.save()

    await writeUserChangeLog({
      userId: user._id,
      adminUser: req.user,
      action: 'vip_update',
      before,
      after: { vipLevel }
    })

    return res.json({ user: sanitizeUser(user) })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể cập nhật VIP' })
  }
})

router.patch('/users/:userId/chat-profile', async (req, res) => {
  try {
    const displayName = String(req.body?.displayName || '').trim().slice(0, 60)
    const characterName = String(req.body?.characterName || '').trim().slice(0, 60)
    const chatTag = String(req.body?.chatTag || '').trim()

    if (!['', 'moi_ngon', 'cho_lam_thit', 'da_thit_xong_7_mon'].includes(chatTag)) {
      return res.status(400).json({ message: 'Nhãn khách hàng không hợp lệ' })
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      {
        displayName,
        characterName,
        chatTag
      },
      { new: true }
    )

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }

    return res.json({ user: sanitizeUser(user) })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể cập nhật tên chat' })
  }
})

router.get('/transactions', async (req, res) => {
  try {
    const result = await adminService.getTransactions({
      page: req.query.page,
      limit: req.query.limit,
      group: req.query.group
    })
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Khong the tai giao dich' })
  }
})

router.get('/game-history', async (req, res) => {
  try {
    const result = await adminService.getGameHistory({
      page: req.query.page,
      limit: req.query.limit,
      roomId: req.query.roomId
    })
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Khong the tai lich su game' })
  }
})

router.get('/round-history', async (req, res) => {
  try {
    const result = await adminService.getRoundHistory({
      page: req.query.page,
      limit: req.query.limit
    })
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Khong the tai lich su round' })
  }
})

router.get('/game-summary', async (req, res) => {
  try {
    const items = await adminService.getGameSummary()
    return res.json({ items })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Khong the tai tong hop game' })
  }
})

router.get('/live-bets', async (req, res) => {
  try {
    const roomId = normalizeLiveRoomId(req.query.roomId)

    const roomSnapshots = await Promise.all(
      LIVE_SICBO_ROOM_IDS.map(async (id) => {
        const state = await getAdminRoomState(id)
        return {
          roomId: id,
          roundId: state?.roundId || '--',
          bettingOpen: Boolean(state?.bettingOpen),
          timeLeft: Number(state?.timeLeft || 0),
          betTotalAmount: Number(state?.betTotalAmount || 0),
          betCount: Number(state?.betCount || 0),
          result: Array.isArray(state?.result) ? state.result : [],
          summary: state?.summary || null
        }
      })
    )

    const state = await getAdminRoomState(roomId)
    const currentRoundId = String(state?.roundId || '')

    const [currentBets, recentBets, rounds] = await Promise.all([
      currentRoundId
        ? Bet.find({ roomId, roundId: currentRoundId, status: 'placed' })
          .populate('userId', 'userCode username fullName')
          .sort({ createdAt: -1 })
          .limit(100)
          .lean()
        : [],
      Bet.find({ roomId })
        .populate('userId', 'userCode username fullName')
        .sort({ createdAt: -1 })
        .limit(80)
        .lean(),
      SicboRound.find({ roomId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
    ])

    return res.json({
      roomId,
      rooms: roomSnapshots,
      state,
      currentBets,
      recentBets,
      rounds
    })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Khong the tai du lieu dang choi' })
  }
})

router.get('/revenue', async (req, res) => {
  try {
    const stats = await adminService.getRevenue()
    return res.json({ stats })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Khong the tai doanh thu' })
  }
})

router.get('/invite-codes', async (req, res) => {
  try {
    const items = await adminService.getInviteCodes()
    return res.json({ items })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Khong the tai ma moi' })
  }
})

router.patch('/invite-codes/:userId', async (req, res) => {
  try {
    const beforeUser = await User.findById(req.params.userId).select('inviteCode').lean()
    const item = await adminService.updateInviteCode(req.params.userId, req.body?.inviteCode)

    await SicboRound.writeAuditLog({
      adminId: req.user._id,
      action: 'set_invite_code',
      before: { inviteCode: beforeUser?.inviteCode || '' },
      after: { inviteCode: item.inviteCode },
      meta: { userId: item.userId }
    })

    return res.json({ item })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Khong the cap nhat ma moi' })
  }
})

router.post('/invite-codes/:userId/regenerate', async (req, res) => {
  try {
    const beforeUser = await User.findById(req.params.userId).select('inviteCode').lean()
    const item = await adminService.regenerateInviteCode(req.params.userId)

    await SicboRound.writeAuditLog({
      adminId: req.user._id,
      action: 'regenerate_invite_code',
      before: { inviteCode: beforeUser?.inviteCode || '' },
      after: { inviteCode: item.inviteCode },
      meta: { userId: item.userId }
    })

    return res.json({ item })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Khong the tao lai ma moi' })
  }
})

router.get('/odds-settings', async (req, res) => {
  return res.json({
    config: demoConfigService.getSicboConfig(req.query.roomId),
    rooms: demoConfigService.listSicboConfigs().map((item) => ({
      roomId: item.roomId,
      title: item.title
    }))
  })
})

router.patch('/odds-settings', async (req, res) => {
  try {
    const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : 'sicbo-3p'
    const before = demoConfigService.getSicboConfig(roomId)
    const config = await demoConfigService.updateSicboConfig(req.body || {}, roomId)
    const io = req.app.get('io')
    const state = await syncRoomConfigToActiveState(io, config.roomId || roomId)

    await SicboRound.writeAuditLog({
      roomId: config.roomId || roomId,
      adminId: req.user._id,
      action: 'set_odds',
      before,
      after: config
    })

    return res.json({ config, state })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Khong the cap nhat keo' })
  }
})

router.post('/odds-settings/reset', async (req, res) => {
  try {
    const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : 'sicbo-3p'
    const before = demoConfigService.getSicboConfig(roomId)
    const config = await demoConfigService.resetSicboConfig(roomId)
    const io = req.app.get('io')
    const state = await syncRoomConfigToActiveState(io, config.roomId || roomId)

    await SicboRound.writeAuditLog({
      roomId: config.roomId,
      adminId: req.user._id,
      action: 'reset_odds',
      before,
      after: config
    })

    return res.json({ config, state })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Khong the reset set keo' })
  }
})

router.post('/odds-settings/copy', async (req, res) => {
  try {
    const fromRoomId = typeof req.body?.fromRoomId === 'string' ? req.body.fromRoomId : 'sicbo-3p'
    const toRoomId = typeof req.body?.toRoomId === 'string' ? req.body.toRoomId : 'sicbo-5p'
    const before = demoConfigService.getSicboConfig(toRoomId)
    const config = await demoConfigService.copySicboConfig(fromRoomId, toRoomId)
    const io = req.app.get('io')
    const state = await syncRoomConfigToActiveState(io, config.roomId || toRoomId)

    await SicboRound.writeAuditLog({
      roomId: config.roomId,
      adminId: req.user._id,
      action: 'copy_odds',
      before,
      after: config,
      meta: { fromRoomId, toRoomId }
    })

    return res.json({ config, state })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Khong the copy set keo' })
  }
})

router.get('/sicbo-control', async (req, res) => {
  try {
    const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : 'sicbo-3p'
    const state = await getAdminRoomState(roomId)
    return res.json({ state })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Khong the tai dieu khien Sicbo' })
  }
})

router.patch('/sicbo-control', async (req, res) => {
  try {
    const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : 'sicbo-3p'
    const state = await setRoomForcedResult({
      roomId,
      forcedResult: req.body?.forcedResult ?? null,
      adminUserId: req.user._id,
      forcedNote: req.body?.forcedNote || ''
    })

    return res.json({ state })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Khong the cap nhat ket qua Sicbo' })
  }
})

router.get('/payout-settings', async (req, res) => {
  return res.json({ config: demoConfigService.getPayoutPolicy() })
})

router.patch('/payout-settings', async (req, res) => {
  try {
    const before = demoConfigService.getPayoutPolicy()
    const config = await demoConfigService.updatePayoutPolicy(req.body || {})

    await SicboRound.writeAuditLog({
      adminId: req.user._id,
      action: 'set_payout_policy',
      before,
      after: config
    })

    return res.json({ config })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Khong the cap nhat tra thuong' })
  }
})

router.get('/admins', async (req, res) => {
  try {
    const items = await demoConfigService.getAdminUsers()
    return res.json({ items })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Khong the tai danh sach admin' })
  }
})

router.post('/admins', async (req, res) => {
  try {
    const admin = await demoConfigService.createAdminUser(req.body || {})

    await SicboRound.writeAuditLog({
      adminId: req.user._id,
      action: 'create_admin',
      before: {},
      after: {
        adminId: admin._id,
        username: admin.username,
        status: admin.status
      }
    })

    return res.status(201).json({ admin })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Khong the tao tai khoan admin' })
  }
})

router.patch('/admins/:adminId/status', async (req, res) => {
  try {
    const nextStatus = req.body?.status
    const before = await User.findById(req.params.adminId).select('status username').lean()
    const admin = await demoConfigService.setAdminStatus(req.params.adminId, nextStatus, req.user._id)

    await SicboRound.writeAuditLog({
      adminId: req.user._id,
      action: 'set_admin_status',
      before: before || {},
      after: {
        adminId: admin._id,
        username: admin.username,
        status: admin.status
      }
    })

    return res.json({ admin })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Khong the cap nhat admin status' })
  }
})

router.patch('/admins/:adminId/password', async (req, res) => {
  try {
    const admin = await demoConfigService.resetAdminPassword(req.params.adminId, req.body?.password)

    await SicboRound.writeAuditLog({
      adminId: req.user._id,
      action: 'reset_admin_password',
      before: {},
      after: {
        adminId: admin._id,
        username: admin.username
      }
    })

    return res.json({ admin })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Khong the reset mat khau admin' })
  }
})

const ChatMessage = require('../models/ChatMessage')
const IncidentLog = require('../models/IncidentLog')
const SiteConfig = require('../models/SiteConfig')
const AdminBank = require('../models/AdminBank')
const { getStartOfVietnamDay } = require('../utils/vietnamTime')

function normalizeVipPrivilegeRow(input = {}) {
  return {
    tich_luy: String(input.tich_luy ?? input.accumulated ?? '').trim(),
    cap: String(input.cap ?? input.level ?? '').trim(),
    thuong: String(input.thuong ?? input.reward ?? '').trim(),
    han_muc: String(input.han_muc ?? input.limit ?? '').trim()
  }
}

function normalizeVipPrivilegeRows(rows, fallbackRows = []) {
  const source = Array.isArray(rows) ? rows : fallbackRows
  const normalized = source.map((row) => normalizeVipPrivilegeRow(row))

  if (!normalized.length) {
    throw new Error('Bảng đặc quyền VIP phải có ít nhất 1 dòng')
  }

  normalized.forEach((row, index) => {
    if (!row.tich_luy || !row.cap || !row.thuong || !row.han_muc) {
      throw new Error(`Dòng VIP ${index + 1} không được để trống`)
    }
  })

  return normalized
}

function normalizeIncidentStatus(rawStatus) {
  const normalized = String(rawStatus || '').trim().toLowerCase()
  if (['open', 'investigating', 'resolved', 'ignored'].includes(normalized)) {
    return normalized
  }
  return ''
}

function normalizeIncidentSource(rawSource) {
  const normalized = String(rawSource || '').trim().toLowerCase()
  if (['api', 'socket', 'upload', 'process', 'system'].includes(normalized)) {
    return normalized
  }
  return ''
}

function normalizeIncidentLevel(rawLevel) {
  const normalized = String(rawLevel || '').trim().toLowerCase()
  if (['error', 'warn', 'info'].includes(normalized)) {
    return normalized
  }
  return ''
}

router.get('/incidents/stats', async (req, res) => {
  try {
    const start24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [total, last24h, grouped] = await Promise.all([
      IncidentLog.countDocuments({}),
      IncidentLog.countDocuments({ createdAt: { $gte: start24h } }),
      IncidentLog.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ])

    const byStatus = {
      open: 0,
      investigating: 0,
      resolved: 0,
      ignored: 0
    }
    for (const item of grouped || []) {
      const key = normalizeIncidentStatus(item?._id)
      if (!key) continue
      byStatus[key] = Number(item?.count || 0)
    }

    return res.json({
      stats: {
        total: Number(total || 0),
        last24h: Number(last24h || 0),
        ...byStatus
      }
    })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Không thể tải thống kê sự cố' })
  }
})

router.get('/incidents', async (req, res) => {
  try {
    const status = normalizeIncidentStatus(req.query?.status)
    const source = normalizeIncidentSource(req.query?.source)
    const level = normalizeIncidentLevel(req.query?.level)
    const keyword = String(req.query?.keyword || '').trim()
    const page = Math.max(Number(req.query?.page || 1), 1)
    const limit = Math.min(Math.max(Number(req.query?.limit || 40), 1), 200)
    const skip = (page - 1) * limit

    const filters = {}
    if (status) filters.status = status
    if (source) filters.source = source
    if (level) filters.level = level
    if (keyword) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filters.$or = [
        { message: new RegExp(escaped, 'i') },
        { code: new RegExp(escaped, 'i') },
        { 'request.path': new RegExp(escaped, 'i') },
        { 'context.roomId': new RegExp(escaped, 'i') }
      ]
    }

    const [items, total] = await Promise.all([
      IncidentLog.find(filters)
        .sort({ lastSeenAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('resolvedBy', 'username fullName')
        .lean(),
      IncidentLog.countDocuments(filters)
    ])

    return res.json({
      items,
      paging: {
        page,
        limit,
        total: Number(total || 0),
        pages: Math.max(Math.ceil(Number(total || 0) / limit), 1)
      }
    })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Không thể tải danh sách sự cố' })
  }
})

router.patch('/incidents/:incidentId/status', async (req, res) => {
  try {
    const status = normalizeIncidentStatus(req.body?.status)
    const note = String(req.body?.note || '').trim().slice(0, 1000)
    if (!status) {
      return res.status(400).json({ message: 'Trạng thái sự cố không hợp lệ' })
    }

    const incident = await IncidentLog.findById(req.params.incidentId)
    if (!incident) {
      return res.status(404).json({ message: 'Không tìm thấy sự cố' })
    }

    incident.status = status
    incident.resolvedNote = note
    if (status === 'resolved' || status === 'ignored') {
      incident.resolvedAt = new Date()
      incident.resolvedBy = req.user?._id || null
    } else {
      incident.resolvedAt = null
      incident.resolvedBy = null
    }

    await incident.save()
    await incident.populate('resolvedBy', 'username fullName')
    return res.json({ item: incident })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể cập nhật trạng thái sự cố' })
  }
})

router.get('/chat/stats', async (req, res) => {
  try {
    const startOfDay = getStartOfVietnamDay(new Date())

    const [todayCount, pendingReplyRooms] = await Promise.all([
      ChatMessage.countDocuments({ createdAt: { $gte: startOfDay } }),
      ChatMessage.aggregate([
        { $match: { roomId: { $regex: /^support:/ } } },
        { $group: {
          _id: '$roomId',
          lastUserAt: {
            $max: {
              $cond: [{ $eq: ['$senderRole', 'user'] }, '$createdAt', null]
            }
          },
          lastAdminAt: {
            $max: {
              $cond: [{ $eq: ['$senderRole', 'admin'] }, '$createdAt', null]
            }
          }
        }},
        { $project: {
          roomId: '$_id',
          needsReply: { $gt: ['$lastUserAt', '$lastAdminAt'] }
        }},
        { $match: { needsReply: true } }
      ])
    ])

    return res.json({
      stats: {
        todayMessages: Number(todayCount || 0),
        pendingRooms: Number(pendingReplyRooms?.length || 0)
      }
    })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
})

router.get('/chat/rooms', async (req, res) => {
  try {
    const rooms = await ChatMessage.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: {
        _id: '$roomId',
        lastMessage: { $first: '$content' },
        lastSender: { $first: '$senderName' },
        lastSenderRole: { $first: '$senderRole' },
        lastMessageType: { $first: '$messageType' },
        lastImageUrl: { $first: '$imageUrl' },
        lastFileName: { $first: '$fileName' },
        updatedAt: { $first: '$createdAt' },
        count: { $sum: 1 },
        lastUserAt: {
          $max: {
            $cond: [{ $eq: ['$senderRole', 'user'] }, '$createdAt', null]
          }
        },
        lastAdminAt: {
          $max: {
            $cond: [{ $eq: ['$senderRole', 'admin'] }, '$createdAt', null]
          }
        }
      }},
      { $sort: { updatedAt: -1 } }
    ])

    const supportUserIds = rooms
      .map((r) => String(r._id || ''))
      .filter((roomId) => roomId.startsWith('support:'))
      .map((roomId) => roomId.slice('support:'.length))
      .filter(Boolean)

    const supportUsers = await User.find({ _id: { $in: supportUserIds } })
      .select('userCode username fullName displayName characterName chatTag phone role balance status vipLevel lastLoginIp lastLoginAt createdAt updatedAt')
      .lean()

    const userMap = new Map(supportUsers.map((u) => [String(u._id), u]))

    const items = rooms.map(r => {
      const roomId = String(r._id || '')
      const roomUserId = roomId.startsWith('support:') ? roomId.slice('support:'.length) : ''
      const roomUser = roomUserId ? userMap.get(roomUserId) : null

      const label = roomUser
        ? (roomUser.displayName || roomUser.characterName || roomUser.fullName || roomUser.username)
        : (roomId === 'support' ? 'Hỗ trợ chung' : `Phòng: ${roomId}`)

      return ({
        roomId,
        roomUserId: roomUser ? String(roomUser._id) : null,
        user: roomUser
          ? {
              ...sanitizeUser(roomUser),
              ...getSupportUserPresence(roomUser._id)
            }
          : null,
        title: roomUser ? `${label} (@${roomUser.username})` : label,
        needsReply: r.lastSenderRole === 'user' || (r.lastUserAt && (!r.lastAdminAt || new Date(r.lastUserAt).getTime() > new Date(r.lastAdminAt).getTime())),
        lastMessageType: r.lastMessageType || 'text',
        lastImageUrl: r.lastImageUrl || '',
        lastMessage: `${r.lastSender}: ${String(
          r.lastMessageType === 'image'
            ? '[Ảnh]'
            : r.lastMessageType === 'file'
              ? `[Tệp] ${r.lastFileName || r.lastMessage || ''}`
              : (r.lastMessage || '')
        ).trim()}`.slice(0, 120),
        count: r.count,
        updatedAt: r.updatedAt
      })
    })

    return res.json({ items })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
})

router.get('/chat/messages/:roomId', async (req, res) => {
  try {
    const items = await ChatMessage.find({ roomId: req.params.roomId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()

    const roomId = String(req.params.roomId || '')
    const roomUserId = roomId.startsWith('support:') ? roomId.slice('support:'.length) : ''
    const roomUser = roomUserId
      ? await User.findById(roomUserId)
          .select('userCode username fullName displayName characterName chatTag phone role balance status vipLevel lastLoginIp lastLoginAt createdAt updatedAt')
          .lean()
      : null

    return res.json({
      items: items.reverse().map((item) => formatChatMessageForClient(item)),
      roomUser: roomUser
        ? {
            ...sanitizeUser(roomUser),
            ...getSupportUserPresence(roomUser._id)
          }
        : null
    })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
})

router.get('/chat-mobile/rooms', async (req, res) => {
  // Reuse same chat system
  const rooms = await ChatMessage.aggregate([
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$roomId',
        lastMessage: { $first: '$content' },
        lastSender: { $first: '$senderName' },
        lastMessageType: { $first: '$messageType' },
        lastFileName: { $first: '$fileName' },
        updatedAt: { $first: '$createdAt' },
        count: { $sum: 1 }
      }
    },
    { $sort: { updatedAt: -1 } }
  ])
  const items = rooms.map((r) => {
    const preview = r.lastMessageType === 'image'
      ? '[Ảnh]'
      : r.lastMessageType === 'file'
        ? `[Tệp] ${r.lastFileName || r.lastMessage || ''}`
        : (r.lastMessage || '')
    return {
      roomId: r._id,
      title: r._id === 'support' ? 'Hỗ trợ chung' : r._id,
      lastMessage: `${r.lastSender}: ${preview}`.slice(0, 80),
      count: r.count
    }
  })
  if (!items.find(i => i.roomId === 'support')) items.unshift({ roomId: 'support', title: 'Hỗ trợ chung', lastMessage: '', count: 0 })
  return res.json({ items })
})

router.get('/chat-mobile/messages/:roomId', async (req, res) => {
  const items = await ChatMessage.find({ roomId: req.params.roomId }).sort({ createdAt: -1 }).limit(100).lean()
  return res.json({ items: items.reverse().map((item) => formatChatMessageForClient(item)) })
})

router.post('/transactions/:transactionId/approve', async (req, res) => {
  try {
    const result = await walletService.approveTransaction({
      transactionId: req.params.transactionId,
      adminUserId: req.user._id
    })

    const io = req.app.get('io')
    const targetUser = await User.findById(result.transaction.userId).select('username').lean()
    await emitUserWalletUpdate(io, {
      userId: result.transaction.userId,
      balance: result.transaction.balanceAfter,
      reason: `${result.transaction.type}_approved`,
      transactionType: result.transaction.type,
      status: result.transaction.status || 'completed',
      amount: result.transaction.amount
    })
    emitAdminWalletNotify(io, {
      event: 'transaction_approved',
      actorAdminId: String(req.user._id),
      userId: String(result.transaction.userId),
      username: targetUser?.username || '',
      amount: Number(result.transaction.amount || 0),
      balance: Number(result.transaction.balanceAfter || 0),
      status: result.transaction.status || 'completed',
      transactionType: result.transaction.type
    })

    return res.json(result)
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể duyệt yêu cầu' })
  }
})

router.post('/transactions/:transactionId/reject', async (req, res) => {
  try {
    const result = await walletService.rejectTransaction({
      transactionId: req.params.transactionId,
      adminUserId: req.user._id,
      note: req.body?.note || ''
    })

    const io = req.app.get('io')
    const targetUser = await User.findById(result.transaction.userId).select('username balance').lean()
    await emitUserWalletUpdate(io, {
      userId: result.transaction.userId,
      balance: Number(targetUser?.balance || result.transaction.balanceAfter || 0),
      reason: `${result.transaction.type}_rejected`,
      transactionType: result.transaction.type,
      status: 'rejected',
      amount: result.transaction.amount
    })
    emitAdminWalletNotify(io, {
      event: 'transaction_rejected',
      actorAdminId: String(req.user._id),
      userId: String(result.transaction.userId),
      username: targetUser?.username || '',
      amount: Number(result.transaction.amount || 0),
      balance: Number(targetUser?.balance || result.transaction.balanceAfter || 0),
      status: 'rejected',
      transactionType: result.transaction.type
    })

    return res.json(result)
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể từ chối yêu cầu' })
  }
})

// === Site Config ===
router.get('/site-config', async (req, res) => {
  try {
    let config = await SiteConfig.findOne({ key: 'main' }).lean()
    if (!config) {
      config = await SiteConfig.create({ key: 'main' })
      config = config.toObject()
    }
    config.vipPrivilegeRows = normalizeVipPrivilegeRows(
      config.vipPrivilegeRows,
      SiteConfig.defaultVipPrivilegeRows()
    )
    return res.json({ config })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
})

router.patch('/site-config', async (req, res) => {
  try {
    const allowed = [
      'oddsDoi','oddsXs3p','oddsHaiTrung3p','oddsBaTrung3p','oddsLoiCltx3p',
      'oddsXs5p','oddsHaiTrung5p','oddsBaTrung5p','oddsLoiCltx5p','oddsLoiKeno5p',
      'referralCode','seoTitle','seoDescription','homeBanner','siteBrandName','siteAdminCaption','siteLogoUrl',
      'vipPrivilegeTitle','vipPrivilegeSubtitle','vipPrivilegeRows',
      'supportWelcomeMessage','supportWelcomeAttachmentType','supportWelcomeAttachmentUrl',
      'supportAutoReplyMessage','supportAutoReplyAttachmentType','supportAutoReplyAttachmentUrl',
      'supportAwayEnabled','supportNotifySound','supportNotifyVolume','supportAwayMessage','supportAwayAttachmentType','supportAwayAttachmentUrl',
      'systemSoundMessage','systemSoundDeposit','systemSoundWithdraw','systemSoundFeedback','systemSoundAlert','systemSoundSicbo',
      'adminWelcomeVoiceEnabled','adminWelcomeVoiceText','adminWelcomeVoiceVolume',
      'supportQuickReplyOneLabel','supportQuickReplyOne','supportQuickReplyOneAttachmentType','supportQuickReplyOneAttachmentUrl',
      'supportQuickReplyTwoLabel','supportQuickReplyTwo','supportQuickReplyTwoAttachmentType','supportQuickReplyTwoAttachmentUrl',
      'supportQuickReplyThreeLabel','supportQuickReplyThree','supportQuickReplyThreeAttachmentType','supportQuickReplyThreeAttachmentUrl',
      'supportQuickReplyFourLabel','supportQuickReplyFour','supportQuickReplyFourAttachmentType','supportQuickReplyFourAttachmentUrl',
      'supportQuickReplyFiveLabel','supportQuickReplyFive','supportQuickReplyFiveAttachmentType','supportQuickReplyFiveAttachmentUrl',
      'supportQuickReplyVipLabel','supportQuickReplyVipAttachmentType','supportQuickReplyVipAttachmentUrl',
      'kenoMaintenanceEnabled','kenoMaintenanceMessage','sicboMaintenanceEnabled','sicboMaintenanceMessage'
    ]
    const update = {}
    for (const key of allowed) {
      if (req.body[key] === undefined) continue
      if (key === 'vipPrivilegeRows') {
        update[key] = normalizeVipPrivilegeRows(req.body[key], SiteConfig.defaultVipPrivilegeRows())
        continue
      }
      update[key] = ['supportAwayEnabled', 'kenoMaintenanceEnabled', 'sicboMaintenanceEnabled', 'adminWelcomeVoiceEnabled'].includes(key)
        ? Boolean(req.body[key])
        : String(req.body[key])
    }

    if (typeof update.referralCode === 'string') {
      update.referralCode = String(update.referralCode || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
    }
    const config = await SiteConfig.findOneAndUpdate(
      { key: 'main' },
      { $set: update },
      { new: true, upsert: true }
    ).lean()
    config.vipPrivilegeRows = normalizeVipPrivilegeRows(
      config.vipPrivilegeRows,
      SiteConfig.defaultVipPrivilegeRows()
    )
    return res.json({ config })
  } catch (err) {
    return res.status(400).json({ message: err.message })
  }
})

// === Admin Bank Accounts ===
router.get('/bank-accounts', async (req, res) => {
  try {
    const items = await AdminBank.find().sort({ createdAt: -1 }).lean()
    return res.json({ items })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
})

router.post('/bank-accounts', async (req, res) => {
  try {
    const { accountName, bankName, bankAccount, transferNote } = req.body || {}
    if (!accountName || !bankName || !bankAccount) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' })
    }
    const item = await AdminBank.create({ accountName, bankName, bankAccount, transferNote: transferNote || '' })
    return res.json({ item })
  } catch (err) {
    return res.status(400).json({ message: err.message })
  }
})

router.delete('/bank-accounts/:id', async (req, res) => {
  try {
    await AdminBank.findByIdAndDelete(req.params.id)
    return res.json({ ok: true })
  } catch (err) {
    return res.status(400).json({ message: err.message })
  }
})

module.exports = router
