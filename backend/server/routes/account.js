const express = require('express')
const bcrypt = require('bcrypt')
const Bet = require('../models/Bet')
const UserAdminChangeLog = require('../models/UserAdminChangeLog')
const WalletTransaction = require('../models/WalletTransaction')
const { requireAuth } = require('../middleware/auth')
const WalletService = require('../services/walletService')
const { sanitizeUser } = require('../utils/auth')
const { encryptSecret } = require('../utils/passwordVault')
const {
  buildSupportRoomId,
  ensureSupportRoomSeed,
  getSupportChatTexts,
  sendSupportChatMessage,
  markSupportMessagesSeenByUser,
  formatChatMessageForClient
} = require('../socket/chat')
const { emitAdminWalletNotify, emitUserWalletUpdate } = require('../socket/realtime')
const { recordIncident } = require('../services/incidentLogger')

const router = express.Router()
const walletService = new WalletService()

router.use(requireAuth)

function buildActorSnapshot(user) {
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

async function writeAccountChangeLog({ user, action, before = {}, after = {}, note = '' }) {
  if (!user?._id) return

  await UserAdminChangeLog.create({
    userId: user._id,
    adminId: null,
    adminSnapshot: buildActorSnapshot(user),
    action,
    before,
    after,
    note: String(note || '').trim().slice(0, 220)
  })
}

router.get('/me', async (req, res) => {
  return res.json({
    user: req.safeUser
  })
})

router.get('/transactions', async (req, res) => {
  try {
    const group = String(req.query.group || 'all').trim().toLowerCase()
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 200)
    const filters = { userId: req.user._id }

    if (group === 'deposit') {
      filters.type = { $in: ['deposit_pending', 'deposit', 'deposit_rejected'] }
    } else if (group === 'withdraw') {
      filters.type = { $in: ['withdraw_pending', 'withdraw', 'withdraw_rejected'] }
    } else if (group === 'bets') {
      filters.type = { $in: ['bet', 'win', 'refund'] }
    }

    const items = await WalletTransaction.find(filters)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    return res.json({ items })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Không thể tải lịch sử giao dịch' })
  }
})

router.get('/bets', async (req, res) => {
  try {
    const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : ''
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100)
    const filters = { userId: req.user._id }

    if (roomId) {
      filters.roomId = roomId
    }

    const items = await Bet.find(filters)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    return res.json({ items })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Không thể tải lịch sử cược' })
  }
})

router.get('/bank', async (req, res) => {
  try {
    const bank = req.user.linkedBank || { bankName: '', bankAccount: '', accountName: '' }
    return res.json({ bank })
  } catch (error) {
    return res.status(500).json({ message: 'Không thể tải thông tin ngân hàng' })
  }
})

router.post('/bank', async (req, res) => {
  try {
    const { bankName, bankAccount, accountName } = req.body || {}
    const hasLinkedBank = Boolean(
      String(req.user?.linkedBank?.bankName || '').trim() &&
      String(req.user?.linkedBank?.bankAccount || '').trim()
    )

    if (!bankName || !bankAccount || !accountName) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin ngân hàng' })
    }

    if (hasLinkedBank) {
      return res.status(403).json({ message: 'Tài khoản ngân hàng đã liên kết. Vui lòng liên hệ CSKH để thay đổi.' })
    }

    req.user.linkedBank = {
      bankName: String(bankName).trim(),
      bankAccount: String(bankAccount).trim(),
      accountName: String(accountName).trim()
    }

    await req.user.save()

    return res.json({
      message: 'Liên kết ngân hàng thành công',
      bank: req.user.linkedBank
    })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể liên kết ngân hàng' })
  }
})

const ChatMessage = require('../models/ChatMessage')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const multer = require('multer')

const CHAT_UPLOAD_DIR = path.resolve(__dirname, '../../uploads/chat')
fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true })

const chatImageUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, CHAT_UPLOAD_DIR)
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname || '').slice(0, 10).toLowerCase() || '.png'
      const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic', '.heif', '.avif', '.bmp', '.svg', '.jfif'].includes(ext) ? ext : '.png'
      const token = crypto.randomBytes(10).toString('hex')
      cb(null, `chat_${Date.now()}_${token}${safeExt}`)
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024 // Mobile screenshots/photos can exceed 25MB on some devices.
  },
  fileFilter(req, file, cb) {
    const mime = String(file.mimetype || '').toLowerCase()
    const ext = path.extname(file.originalname || '').slice(0, 10).toLowerCase()
    const allowedExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic', '.heif', '.avif', '.bmp', '.svg', '.jfif']
    const ok = mime.startsWith('image/') || allowedExt.includes(ext) || !mime
    cb(ok ? null : new Error('Chỉ hỗ trợ tệp hình ảnh hợp lệ'), ok)
  }
})

const CHAT_BLOCKED_FILE_EXTENSIONS = new Set([
  '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.ps1', '.vbs', '.js', '.jar', '.sh', '.apk', '.ipa'
])

const chatFileUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, CHAT_UPLOAD_DIR)
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname || '').slice(0, 16).toLowerCase()
      const safeExt = ext && !CHAT_BLOCKED_FILE_EXTENSIONS.has(ext) ? ext : '.bin'
      const token = crypto.randomBytes(10).toString('hex')
      cb(null, `chat_file_${Date.now()}_${token}${safeExt}`)
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').slice(0, 16).toLowerCase()
    const mime = String(file.mimetype || '').toLowerCase()
    if (CHAT_BLOCKED_FILE_EXTENSIONS.has(ext)) {
      return cb(new Error('Định dạng tệp không được hỗ trợ'))
    }
    const allowedMime =
      !mime ||
      mime.startsWith('image/') ||
      mime.startsWith('video/') ||
      mime.startsWith('audio/') ||
      mime.startsWith('text/') ||
      mime.startsWith('application/') ||
      mime === 'application/octet-stream' ||
      mime === 'binary/octet-stream'

    if (!allowedMime) {
      return cb(new Error('Loại tệp không được hỗ trợ'))
    }
    return cb(null, true)
  }
})

function handleChatImageUpload(req, res, next) {
  chatImageUpload.single('image')(req, res, (err) => {
    if (!err) return next()
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Ảnh quá lớn. Vui lòng chọn ảnh dưới 50MB.'
      : (err.message || 'Không thể upload ảnh')
    void recordIncident({
      source: 'upload',
      level: 'warn',
      code: 'CHAT_UPLOAD_IMAGE_REJECTED',
      message,
      error: err,
      req,
      context: {
        userId: req.user?._id || null
      },
      metadata: {
        endpoint: '/api/account/chat/upload-image'
      }
    })
    return res.status(400).json({ message })
  })
}

function handleChatFileUpload(req, res, next) {
  chatFileUpload.single('file')(req, res, (err) => {
    if (!err) return next()
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Tệp quá lớn. Vui lòng chọn tệp dưới 50MB.'
      : (err.message || 'Không thể upload tệp')
    void recordIncident({
      source: 'upload',
      level: 'warn',
      code: 'CHAT_UPLOAD_FILE_REJECTED',
      message,
      error: err,
      req,
      context: {
        userId: req.user?._id || null
      },
      metadata: {
        endpoint: '/api/account/chat/upload-file'
      }
    })
    return res.status(400).json({ message })
  })
}

router.post('/chat/upload-image', handleChatImageUpload, async (req, res) => {
  try {
    if (!req.file?.filename) {
      return res.status(400).json({ message: 'Không có ảnh' })
    }

    return res.json({
      imageUrl: `/uploads/chat/${req.file.filename}`
    })
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Không thể upload ảnh' })
  }
})

router.post('/chat/upload-file', handleChatFileUpload, async (req, res) => {
  try {
    if (!req.file?.filename) {
      return res.status(400).json({ message: 'Không có tệp' })
    }

    return res.json({
      fileUrl: `/uploads/chat/${req.file.filename}`,
      fileName: String(req.file.originalname || req.file.filename).trim().slice(0, 260),
      fileMime: String(req.file.mimetype || '').trim().slice(0, 120),
      fileSize: Number(req.file.size || 0) || 0
    })
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Không thể upload tệp' })
  }
})

router.post('/chat/send', async (req, res) => {
  try {
    const roomId = String(req.body?.roomId || '').trim()
    if (!roomId) {
      return res.status(400).json({ message: 'Thiếu thông tin' })
    }

    const payload = await sendSupportChatMessage({
      io: req.app.get('io'),
      roomId,
      user: req.user,
      content: req.body?.content,
      messageType: req.body?.messageType,
      imageUrl: req.body?.imageUrl,
      fileUrl: req.body?.fileUrl,
      fileName: req.body?.fileName,
      fileMime: req.body?.fileMime,
      fileSize: req.body?.fileSize,
      clientMessageId: req.body?.clientMessageId
    })

    return res.json({ ok: true, message: payload })
  } catch (err) {
    const message = String(err?.message || 'Không gửi được tin nhắn')
    const status = /không có quyền|phiên đăng nhập/i.test(message)
      ? 403
      : /thiếu|trống|không hợp lệ/i.test(message)
        ? 400
        : 500
    void recordIncident({
      source: 'api',
      level: status >= 500 ? 'error' : 'warn',
      code: 'CHAT_SEND_HTTP_FAILED',
      message,
      error: err,
      req,
      context: {
        userId: req.user?._id || null,
        roomId: String(req.body?.roomId || '')
      },
      metadata: {
        endpoint: '/api/account/chat/send',
        status
      }
    })
    return res.status(status).json({ message })
  }
})

router.get('/chat/:roomId', async (req, res) => {
  try {
    const roomId = String(req.params.roomId || '')

    // Users can only read their own CSKH room. Admins can read any room.
    if (req.user?.role !== 'admin') {
      const expected = buildSupportRoomId(req.user?._id)
      if (roomId !== expected) {
        return res.status(403).json({ message: 'Không có quyền truy cập phòng chat' })
      }
    }

    const welcomeSeed = await ensureSupportRoomSeed(roomId, req.app.get('io'))
    const items = await ChatMessage.find({ roomId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
    const hasUserReply = items.some((item) => item.senderRole === 'user')
    const filteredItems = req.user?.role === 'admin' || hasUserReply
      ? items
      : items.filter((item) => !item.visibleAfterFirstUserReply)
    const supportTexts = await getSupportChatTexts()
    const configuredWelcomeAttachmentType = String(supportTexts?.welcomeAttachmentType || 'vip').trim().toLowerCase()
    const requiredWelcomeAttachmentType =
      !configuredWelcomeAttachmentType || configuredWelcomeAttachmentType === 'none'
        ? 'vip'
        : configuredWelcomeAttachmentType
    const normalizedItems = filteredItems.map((item) => {
      if (item.systemType === 'welcome_seed') {
        const currentType = String(item?.attachmentType || '').trim().toLowerCase()
        return {
          ...item,
          attachmentType: currentType && currentType !== 'none'
            ? currentType
            : requiredWelcomeAttachmentType
        }
      }

      if (item?.attachmentType) return item
      if (item?.senderRole !== 'system') return item

      if (item.systemType === 'auto_reply_first') {
        return {
          ...item,
          attachmentType: String(supportTexts?.autoReplyAttachmentType || 'none').trim().toLowerCase()
        }
      }

      if (item.systemType === 'away_reply') {
        return {
          ...item,
          attachmentType: String(supportTexts?.awayAttachmentType || 'none').trim().toLowerCase()
        }
      }

      return item
    })

    if (req.user?.role !== 'admin') {
      await markSupportMessagesSeenByUser({
        roomId,
        user: req.user,
        io: req.app.get('io')
      })
    }

    const previewWelcomeMessage =
      !hasUserReply && req.user?.role !== 'admin'
        ? String(
            welcomeSeed?.content ||
            items.find((item) => item.systemType === 'welcome_seed')?.content ||
            supportTexts.welcomeMessage ||
          ''
        ).trim()
        : ''
    const previewWelcomeAttachmentType =
      !hasUserReply && req.user?.role !== 'admin'
        ? (() => {
            const rawType = String(
              welcomeSeed?.attachmentType ||
              items.find((item) => item.systemType === 'welcome_seed')?.attachmentType ||
              requiredWelcomeAttachmentType
            ).trim().toLowerCase()
            return rawType && rawType !== 'none' ? rawType : requiredWelcomeAttachmentType
          })()
        : 'none'

    return res.json({
      items: normalizedItems.reverse().map((item) => formatChatMessageForClient(item)),
      previewWelcomeMessage,
      previewWelcomeAttachmentType
    })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
})

router.patch('/profile', async (req, res) => {
  try {
    const displayName = String(req.body?.displayName || '').trim().slice(0, 60)
    const characterName = String(req.body?.characterName || '').trim().slice(0, 60)
    const fullName = String(req.body?.fullName || '').trim().slice(0, 80)
    const phone = String(req.body?.phone || '').trim().slice(0, 20)
    if (!isValidPhoneNumber(phone)) {
      return res.status(400).json({ message: 'Số điện thoại không hợp lệ' })
    }
    const before = {
      fullName: String(req.user.fullName || ''),
      phone: String(req.user.phone || ''),
      displayName: String(req.user.displayName || ''),
      characterName: String(req.user.characterName || '')
    }

    req.user.displayName = displayName
    req.user.characterName = characterName
    req.user.fullName = fullName
    req.user.phone = phone

    await req.user.save()
    await writeAccountChangeLog({
      user: req.user,
      action: 'profile_update',
      before,
      after: {
        fullName,
        phone,
        displayName,
        characterName
      },
      note: 'Khách hàng tự cập nhật thông tin'
    })

    return res.json({
      message: 'Đã cập nhật hồ sơ',
      user: sanitizeUser(req.user)
    })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể cập nhật hồ sơ' })
  }
})

router.patch('/security', async (req, res) => {
  try {
    const password = String(req.body?.password || '')
    const withdrawPassword = String(req.body?.withdrawPassword || '')

    if (!password && !withdrawPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập ít nhất một mật khẩu mới' })
    }

    if (password && password.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu đăng nhập tối thiểu 6 ký tự' })
    }

    if (withdrawPassword && withdrawPassword.length < 4) {
      return res.status(400).json({ message: 'Mật khẩu rút tiền tối thiểu 4 ký tự' })
    }

    if (password) {
      req.user.passwordHash = await bcrypt.hash(password, 10)
      req.user.password_encrypted = encryptSecret(password)
    }

    if (withdrawPassword) {
      req.user.withdrawPasswordHash = await bcrypt.hash(withdrawPassword, 10)
      req.user.withdraw_password_encrypted = encryptSecret(withdrawPassword)
    }

    await req.user.save()
    await writeAccountChangeLog({
      user: req.user,
      action: 'security_update',
      after: {
        passwordChanged: Boolean(password),
        withdrawPasswordChanged: Boolean(withdrawPassword)
      },
      note: 'Khách hàng tự đổi mật khẩu'
    })

    return res.json({
      message: 'Đã cập nhật bảo mật',
      user: sanitizeUser(req.user)
    })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể cập nhật bảo mật' })
  }
})

router.post('/deposit-request', async (req, res) => {
  try {
    const { amount, bankCode, transferContent } = req.body || {}
    const result = await walletService.createDepositRequest({
      userId: req.user._id,
      amount,
      bankCode,
      transferContent
    })

    const io = req.app.get('io')
    if (result?.autoApproved) {
      await emitUserWalletUpdate(io, {
        userId: req.user._id,
        balance: result.balance,
        reason: 'deposit_auto_approved',
        transactionType: 'deposit',
        status: 'completed',
        amount
      })
    } else {
      await emitUserWalletUpdate(io, {
        userId: req.user._id,
        reason: 'deposit_request_created',
        transactionType: 'deposit_pending',
        status: 'pending',
        amount
      })
    }

    emitAdminWalletNotify(io, {
      event: result?.autoApproved ? 'deposit_auto_approved' : 'deposit_request_created',
      userId: String(req.user._id),
      username: req.user.username || '',
      amount: Number(amount || 0),
      status: result?.autoApproved ? 'completed' : 'pending',
      transactionType: result?.autoApproved ? 'deposit' : 'deposit_pending'
    })

    return res.json(result)
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể tạo yêu cầu nạp tiền' })
  }
})

router.post('/withdraw-request', async (req, res) => {
  try {
    const { amount, bankName, bankAccount, accountName, withdrawPassword } = req.body || {}
    const result = await walletService.createWithdrawRequest({
      userId: req.user._id,
      amount,
      bankName,
      bankAccount,
      accountName,
      withdrawPassword
    })

    const io = req.app.get('io')
    if (result?.autoApproved) {
      await emitUserWalletUpdate(io, {
        userId: req.user._id,
        balance: result.balance,
        reason: 'withdraw_auto_approved',
        transactionType: 'withdraw',
        status: 'completed',
        amount
      })
    } else {
      await emitUserWalletUpdate(io, {
        userId: req.user._id,
        balance: result.balance,
        reason: 'withdraw_request_created',
        transactionType: 'withdraw_pending',
        status: 'pending',
        amount
      })
    }

    emitAdminWalletNotify(io, {
      event: result?.autoApproved ? 'withdraw_auto_approved' : 'withdraw_request_created',
      userId: String(req.user._id),
      username: req.user.username || '',
      amount: Number(amount || 0),
      balance: Number(result?.balance || req.user.balance || 0),
      status: result?.autoApproved ? 'completed' : 'pending',
      transactionType: result?.autoApproved ? 'withdraw' : 'withdraw_pending'
    })

    return res.json(result)
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Không thể tạo yêu cầu rút tiền' })
  }
})

module.exports = router
