const jwt = require('jsonwebtoken')

function getJwtSecret() {
  return process.env.JWT_SECRET || 'casino-game-dev-secret'
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      username: user.username,
      role: user.role
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  )
}

function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret())
}

function sanitizeUser(user) {
  if (!user) return null

  return {
    _id: user._id,
    userCode: user.userCode || '',
    username: user.username,
    fullName: user.fullName || '',
    displayName: user.displayName || '',
    characterName: user.characterName || '',
    chatTag: user.chatTag || '',
    phone: user.phone || '',
    inviteCode: user.inviteCode || '',
    referredByCode: user.referredByCode || '',
    hasWithdrawPassword: Boolean(user.withdrawPasswordHash),
    role: user.role,
    balance: Number(user.balance || 0),
    status: user.status,
    linkedBank: user.linkedBank || { bankName: '', bankAccount: '', accountName: '' },
    vipLevel: Number(user.vipLevel || 0),
    lastLoginIp: String(user.lastLoginIp || ''),
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  sanitizeUser
}
