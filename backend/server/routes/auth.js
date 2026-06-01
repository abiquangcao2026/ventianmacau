const express = require('express')
const bcrypt = require('bcrypt')
const User = require('../models/User')
const SiteConfig = require('../models/SiteConfig')
const { requireAuth } = require('../middleware/auth')
const { signAccessToken, sanitizeUser } = require('../utils/auth')
const { encryptSecret } = require('../utils/passwordVault')

const router = express.Router()

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return (req.socket && req.socket.remoteAddress) ? String(req.socket.remoteAddress) : ''
}

function normalizeReferralCode(rawCode) {
  return String(rawCode || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

router.post('/signup', async (req, res) => {
  try {
    const {
      username,
      password,
      fullName,
      displayName,
      characterName,
      phone,
      withdrawPassword,
      referralCode
    } = req.body || {}

    if (!username || String(username).trim().length < 3) {
      return res.status(400).json({ message: 'Tên đăng nhập tối thiểu 3 ký tự' })
    }

    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: 'Mật khẩu tối thiểu 6 ký tự' })
    }

    if (!withdrawPassword || String(withdrawPassword).length < 4) {
      return res.status(400).json({ message: 'Mật khẩu rút tiền tối thiểu 4 ký tự' })
    }

    if (!referralCode || !String(referralCode).trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập mã mời để đăng ký tài khoản' })
    }

    const normalizedUsername = String(username).trim().toLowerCase()
    const existingUser = await User.findOne({ username: normalizedUsername }).lean()

    if (existingUser) {
      return res.status(409).json({ message: 'Tên đăng nhập đã tồn tại' })
    }

    let normalizedReferralCode = normalizeReferralCode(referralCode)
    // Be tolerant to legacy data where inviteCode might not be normalized/stored uppercase.
    const referredByUser = await User.findOne({
      inviteCode: new RegExp(`^${normalizedReferralCode}$`, 'i')
    }).lean()
    if (!referredByUser) {
      const siteConfig = await SiteConfig.findOne({ key: 'main' }).select('referralCode').lean()
      const siteReferralCode = normalizeReferralCode(siteConfig?.referralCode || '')
      if (!siteReferralCode || siteReferralCode !== normalizedReferralCode) {
        return res.status(400).json({ message: 'Mã mời không hợp lệ' })
      }
    }

    const passwordHash = await bcrypt.hash(String(password), 10)
    const withdrawPasswordHash = await bcrypt.hash(String(withdrawPassword), 10)
    const normalizedDisplayName = String(displayName || '').trim()
    const normalizedCharacterName = String(characterName || '').trim()
    const normalizedFullName = String(fullName || '').trim() || normalizedDisplayName
    const user = await User.create({
      username: normalizedUsername,
      passwordHash,
      password_encrypted: encryptSecret(password),
      withdrawPasswordHash,
      withdraw_password_encrypted: encryptSecret(withdrawPassword),
      fullName: normalizedFullName,
      displayName: normalizedDisplayName,
      characterName: normalizedCharacterName,
      phone: String(phone || '').trim(),
      referredByCode: normalizedReferralCode,
      role: 'user'
    })

    return res.status(201).json({
      token: signAccessToken(user),
      user: sanitizeUser(user)
    })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Không thể tạo tài khoản' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {}

    if (!username || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập tên đăng nhập và mật khẩu' })
    }

    const normalizedUsername = String(username).trim().toLowerCase()
    const user = await User.findOne({ username: normalizedUsername })

    if (!user) {
      return res.status(401).json({ message: 'Sai thông tin đăng nhập' })
    }

    const matched = await bcrypt.compare(String(password), user.passwordHash)
    if (!matched) {
      return res.status(401).json({ message: 'Sai thông tin đăng nhập' })
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Tài khoản đã bị khóa' })
    }

    user.lastLoginIp = getClientIp(req)
    user.lastLoginAt = new Date()
    await user.save()

    return res.json({
      token: signAccessToken(user),
      user: sanitizeUser(user)
    })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Đăng nhập thất bại' })
  }
})

router.get('/me', requireAuth, async (req, res) => {
  return res.json({
    user: req.safeUser
  })
})

module.exports = router
