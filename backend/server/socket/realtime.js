const User = require('../models/User')
const { verifyAccessToken } = require('../utils/auth')

const ADMIN_WALLET_ROOM = 'admin:wallet'

function buildUserRoomId(userId) {
  return `user:${String(userId || '').trim()}`
}

function getSocketToken(socket) {
  return String(socket?.handshake?.auth?.token || '').trim()
}

function syncSocketRealtimeSession(socket) {
  const rawToken = getSocketToken(socket)

  socket.data.authUserId = null
  socket.data.authRole = null

  if (!rawToken) {
    return null
  }

  try {
    const payload = verifyAccessToken(rawToken)
    const userId = String(payload?.sub || '').trim()
    const role = String(payload?.role || 'user').trim()

    if (!userId) {
      return null
    }

    socket.data.authUserId = userId
    socket.data.authRole = role
    socket.join(buildUserRoomId(userId))

    if (role === 'admin') {
      socket.join(ADMIN_WALLET_ROOM)
    }

    return { userId, role, payload }
  } catch {
    return null
  }
}

async function emitUserWalletUpdate(io, {
  userId,
  balance,
  reason = '',
  transactionType = '',
  status = '',
  amount = null
} = {}) {
  if (!io || !userId) {
    return null
  }

  let nextBalance = Number(balance)
  if (!Number.isFinite(nextBalance)) {
    const user = await User.findById(userId).select('balance').lean()
    nextBalance = Number(user?.balance || 0)
  }

  const payload = {
    userId: String(userId),
    balance: nextBalance,
    reason: String(reason || ''),
    transactionType: String(transactionType || ''),
    status: String(status || ''),
    amount: Number.isFinite(Number(amount)) ? Number(amount) : null,
    updatedAt: new Date().toISOString()
  }

  io.to(buildUserRoomId(userId)).emit('balance_update', { balance: nextBalance })
  io.to(buildUserRoomId(userId)).emit('wallet_update', payload)
  return payload
}

function emitAdminWalletNotify(io, payload = {}) {
  if (!io) {
    return
  }

  io.to(ADMIN_WALLET_ROOM).emit('wallet_admin_notify', {
    ...payload,
    occurredAt: new Date().toISOString()
  })
}

module.exports = {
  ADMIN_WALLET_ROOM,
  buildUserRoomId,
  syncSocketRealtimeSession,
  emitUserWalletUpdate,
  emitAdminWalletNotify
}
