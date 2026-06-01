const ChatMessage = require('../models/ChatMessage')
const SiteConfig = require('../models/SiteConfig')
const { verifyAccessToken } = require('../utils/auth')
const User = require('../models/User')
const { recordIncident } = require('../services/incidentLogger')

const ADMIN_NOTIFY_ROOM = 'chat:__admins__'
const SUPPORT_WELCOME_TEXT =
  'Xin chào! Chăm sóc khách hàng đã kết nối. Vui lòng để lại nội dung, hệ thống sẽ chuyển ngay cho CSKH.'
const SUPPORT_AUTO_REPLY_TEXT =
  'CSKH đã nhận được tin nhắn của bạn. Vui lòng chờ phản hồi trong giây lát.'
const SUPPORT_AWAY_TEMPLATE =
  'Hiện tại lượng khách truy cập vào CSKH đang rất nhiều. Số thứ tự hỗ trợ của quý khách là #{queueNumber}. Vui lòng chờ trong khoảng {etaMinutes}-{etaMaxMinutes} phút để kết nối trực tiếp với CSKH.'
const onlineSupportUsers = new Map()

function markSupportUserOnline(userId) {
  const key = String(userId || '')
  if (!key) return
  const current = onlineSupportUsers.get(key) || { count: 0, lastSeenAt: null }
  onlineSupportUsers.set(key, {
    count: Number(current.count || 0) + 1,
    lastSeenAt: current.lastSeenAt || new Date().toISOString()
  })
}

function markSupportUserOffline(userId) {
  const key = String(userId || '')
  if (!key) return
  const current = onlineSupportUsers.get(key)
  if (!current) return
  const nextCount = Number(current.count || 0) - 1
  if (nextCount > 0) {
    onlineSupportUsers.set(key, {
      count: nextCount,
      lastSeenAt: new Date().toISOString()
    })
    return
  }

  onlineSupportUsers.set(key, {
    count: 0,
    lastSeenAt: new Date().toISOString()
  })
}

function getSupportUserPresence(userId) {
  const key = String(userId || '')
  const current = onlineSupportUsers.get(key)
  return {
    isOnline: Boolean(current && Number(current.count || 0) > 0),
    lastSeenAt: current?.lastSeenAt || null
  }
}

async function getSupportChatTexts() {
  const config = await SiteConfig.findOne({ key: 'main' })
    .select(
      [
        'supportWelcomeMessage',
        'supportWelcomeAttachmentType',
        'supportWelcomeAttachmentUrl',
        'supportAutoReplyMessage',
        'supportAutoReplyAttachmentType',
        'supportAutoReplyAttachmentUrl',
        'supportAwayEnabled',
        'supportAwayMessage',
        'supportAwayAttachmentType',
        'supportAwayAttachmentUrl'
      ].join(' ')
    )
    .lean()

  return {
    welcomeMessage: String(config?.supportWelcomeMessage || SUPPORT_WELCOME_TEXT).trim(),
    welcomeAttachmentType: String(config?.supportWelcomeAttachmentType || 'vip').trim(),
    welcomeAttachmentUrl: String(config?.supportWelcomeAttachmentUrl || '').trim(),
    autoReplyMessage: String(config?.supportAutoReplyMessage || SUPPORT_AUTO_REPLY_TEXT).trim(),
    autoReplyAttachmentType: String(config?.supportAutoReplyAttachmentType || 'none').trim(),
    autoReplyAttachmentUrl: String(config?.supportAutoReplyAttachmentUrl || '').trim(),
    awayEnabled: Boolean(config?.supportAwayEnabled),
    awayMessage: String(config?.supportAwayMessage || SUPPORT_AWAY_TEMPLATE).trim(),
    awayAttachmentType: String(config?.supportAwayAttachmentType || 'none').trim(),
    awayAttachmentUrl: String(config?.supportAwayAttachmentUrl || '').trim()
  }
}

function buildSupportRoomId(userId) {
  return `support:${String(userId || '')}`
}

function parseSupportRoomUserId(roomId) {
  const raw = String(roomId || '')
  if (!raw.startsWith('support:')) return null
  const suffix = raw.slice('support:'.length).trim()
  return suffix || null
}

function inferFileNameFromUrl(fileUrl) {
  const raw = String(fileUrl || '').trim()
  if (!raw) return ''
  try {
    const pathPart = raw.split('?')[0].split('#')[0]
    return decodeURIComponent(pathPart.split('/').pop() || '').trim()
  } catch {
    return ''
  }
}

function isUserAllowedRoom(user, roomId) {
  if (!user) return false
  if (user.role === 'admin') return true
  return String(roomId) === buildSupportRoomId(user._id)
}

function toClientPayload(messageDoc) {
  const isDeleted = Boolean(messageDoc.deletedAt)
  const senderRole = messageDoc.senderRole
  const seenByUserAt = messageDoc.seenByUserAt || null
  return {
    _id: messageDoc._id,
    roomId: messageDoc.roomId,
    roomUserId: messageDoc.roomUserId ? String(messageDoc.roomUserId) : null,
    senderId: messageDoc.senderId ? String(messageDoc.senderId) : null,
    senderName: messageDoc.senderName,
    senderRole,
    clientMessageId: String(messageDoc.clientMessageId || ''),
    content: isDeleted ? '' : messageDoc.content,
    messageType: isDeleted ? 'text' : messageDoc.messageType,
    attachmentType: isDeleted ? 'none' : String(messageDoc.attachmentType || 'none'),
    imageUrl: isDeleted ? '' : messageDoc.imageUrl,
    fileUrl: isDeleted ? '' : (messageDoc.fileUrl || ''),
    fileName: isDeleted ? '' : (messageDoc.fileName || ''),
    fileMime: isDeleted ? '' : (messageDoc.fileMime || ''),
    fileSize: isDeleted ? 0 : Number(messageDoc.fileSize || 0),
    systemType: messageDoc.systemType || '',
    visibleAfterFirstUserReply: Boolean(messageDoc.visibleAfterFirstUserReply),
    seenByUserAt,
    messageStatus: senderRole === 'admin' && seenByUserAt ? 'seen' : 'sent',
    editedAt: messageDoc.editedAt || null,
    deletedAt: messageDoc.deletedAt || null,
    deletedBy: messageDoc.deletedBy ? String(messageDoc.deletedBy) : null,
    isDeleted,
    isEdited: Boolean(messageDoc.editedAt),
    senderMeta: messageDoc.senderMeta || {},
    createdAt: messageDoc.createdAt
  }
}

async function markSupportMessagesSeenByUser({ roomId, user, io } = {}) {
  const normalizedRoomId = String(roomId || '').trim()
  if (!normalizedRoomId || !user || user.role === 'admin') {
    return null
  }
  if (!isUserAllowedRoom(user, normalizedRoomId)) {
    throw new Error('Không có quyền truy cập phòng chat')
  }

  const seenAt = new Date()
  const result = await ChatMessage.updateMany(
    {
      roomId: normalizedRoomId,
      senderRole: 'admin',
      seenByUserAt: null,
      deletedAt: null
    },
    { $set: { seenByUserAt: seenAt } }
  )

  const modifiedCount = Number(result?.modifiedCount || result?.nModified || 0)
  if (modifiedCount > 0) {
    const payload = {
      roomId: normalizedRoomId,
      seenAt,
      modifiedCount
    }
    io?.to(ADMIN_NOTIFY_ROOM).emit('chat_seen_update', payload)
    io?.to(`chat:${normalizedRoomId}`).emit('chat_seen_update', payload)
  }

  return { seenAt, modifiedCount }
}

async function createSystemSupportMessage(roomId, content, io, options = {}) {
  const roomUserId = parseSupportRoomUserId(roomId)
  const attachmentType = String(options.attachmentType || 'none').trim().toLowerCase()
  const normalizedAttachmentType =
    attachmentType === 'image' || attachmentType === 'sticker' || attachmentType === 'vip'
      ? attachmentType
      : 'none'
  const attachmentUrl = String(options.attachmentUrl || '').trim()
  const messageType = normalizedAttachmentType === 'image' || normalizedAttachmentType === 'sticker'
    ? 'image'
    : 'text'
  const messageDoc = await ChatMessage.create({
    roomId,
    roomUserId: roomUserId || null,
    senderId: null,
    senderName: 'Chăm sóc khách hàng',
    senderRole: 'system',
    messageType,
    attachmentType: normalizedAttachmentType,
    content: String(content || '').trim().slice(0, 2000),
    imageUrl: messageType === 'image' ? attachmentUrl.slice(0, 500) : '',
    fileUrl: '',
    fileName: '',
    fileMime: '',
    fileSize: 0,
    systemType: String(options.systemType || '').trim(),
    visibleAfterFirstUserReply: Boolean(options.visibleAfterFirstUserReply),
    senderMeta: {}
  })

  const payload = toClientPayload(messageDoc)
  if (io) {
    io.to(`chat:${roomId}`).emit('chat_message', payload)
  }
  return payload
}

async function ensureSupportRoomSeed(roomId, io) {
  if (!parseSupportRoomUserId(roomId)) {
    return null
  }

  const exists = await ChatMessage.findOne({ roomId }).select('_id').lean()
  if (exists) {
    return null
  }

  const { welcomeMessage, welcomeAttachmentType, welcomeAttachmentUrl } = await getSupportChatTexts()
  if (!welcomeMessage && !welcomeAttachmentUrl) {
    return null
  }

  const requiredWelcomeAttachmentType =
    String(welcomeAttachmentType || 'none').trim().toLowerCase() === 'none'
      ? 'vip'
      : welcomeAttachmentType

  return createSystemSupportMessage(roomId, welcomeMessage, io, {
    systemType: 'welcome_seed',
    visibleAfterFirstUserReply: true,
    attachmentType: requiredWelcomeAttachmentType,
    attachmentUrl: welcomeAttachmentUrl
  })
}

async function maybeSendFirstAutoReply(roomId, io) {
  if (!parseSupportRoomUserId(roomId)) {
    return null
  }

  const { autoReplyMessage, autoReplyAttachmentType, autoReplyAttachmentUrl } = await getSupportChatTexts()
  if (!autoReplyMessage && !autoReplyAttachmentUrl) {
    return null
  }

  const userMessageCount = await ChatMessage.countDocuments({
    roomId,
    senderRole: 'user'
  })

  if (userMessageCount !== 1) {
    return null
  }

  return createSystemSupportMessage(roomId, autoReplyMessage, io, {
    systemType: 'auto_reply_first',
    attachmentType: autoReplyAttachmentType,
    attachmentUrl: autoReplyAttachmentUrl
  })
}

function buildAwayMessage(template) {
  const queueNumber = Math.floor(Math.random() * 91) + 10
  const etaMinutes = Math.floor(Math.random() * 6) + 2
  const etaMaxMinutes = etaMinutes + Math.floor(Math.random() * 6) + 2
  return String(template || SUPPORT_AWAY_TEMPLATE)
    .replace(/#\{queueNumber\}/g, String(queueNumber))
    .replace(/\{queueNumber\}/g, String(queueNumber))
    .replace(/\{etaMinutes\}/g, String(etaMinutes))
    .replace(/\{etaMaxMinutes\}/g, String(etaMaxMinutes))
}

async function maybeSendAwayReply(roomId, io) {
  if (!parseSupportRoomUserId(roomId)) {
    return null
  }

  const { awayEnabled, awayMessage, awayAttachmentType, awayAttachmentUrl } = await getSupportChatTexts()
  if (!awayEnabled) {
    return null
  }

  const latestAdminMessage = await ChatMessage.findOne({
    roomId,
    senderRole: 'admin'
  })
    .sort({ createdAt: -1 })
    .select('createdAt')
    .lean()

  const latestUserMessage = await ChatMessage.findOne({
    roomId,
    senderRole: 'user'
  })
    .sort({ createdAt: -1 })
    .select('createdAt')
    .lean()

  if (!latestUserMessage?.createdAt) {
    return null
  }

  if (latestAdminMessage?.createdAt) {
    const lastAdminAt = new Date(latestAdminMessage.createdAt).getTime()
    const lastUserAt = new Date(latestUserMessage.createdAt).getTime()
    if (lastAdminAt >= lastUserAt) {
      return null
    }
  }

  return createSystemSupportMessage(roomId, buildAwayMessage(awayMessage), io, {
    systemType: 'away_reply',
    attachmentType: awayAttachmentType,
    attachmentUrl: awayAttachmentUrl
  })
}

function normalizeClientMessageId(rawValue) {
  return String(rawValue || '')
    .trim()
    .slice(0, 80)
    .replace(/[^a-zA-Z0-9:_-]/g, '')
}

function normalizeOutgoingChatPayload(input = {}) {
  const normalizedType = input.messageType === 'image' ? 'image' : (input.messageType === 'file' ? 'file' : 'text')
  const trimmed = String(input.content || '').trim().slice(0, 2000)
  const normalizedImageUrl = String(input.imageUrl || '').trim().slice(0, 500)
  const normalizedFileUrl = String(input.fileUrl || '').trim().slice(0, 500)
  const normalizedFileName = String(input.fileName || '').trim().slice(0, 260) || inferFileNameFromUrl(normalizedFileUrl)
  const normalizedFileMime = String(input.fileMime || '').trim().slice(0, 120)
  const normalizedFileSize = Math.max(0, Math.min(Number(input.fileSize || 0) || 0, 100 * 1024 * 1024))
  const normalizedClientMessageId = normalizeClientMessageId(input.clientMessageId)

  return {
    normalizedType,
    trimmed,
    normalizedImageUrl,
    normalizedFileUrl,
    normalizedFileName,
    normalizedFileMime,
    normalizedFileSize,
    normalizedClientMessageId
  }
}

function validateOutgoingChatPayload(normalized = {}) {
  if (normalized.normalizedType === 'text' && !normalized.trimmed) {
    throw new Error('Tin nhắn trống')
  }

  if (normalized.normalizedType === 'image') {
    if (!normalized.normalizedImageUrl) {
      throw new Error('Thiếu ảnh')
    }
    if (!normalized.normalizedImageUrl.startsWith('/uploads/chat/') && !normalized.normalizedImageUrl.startsWith('/img/support-stickers/')) {
      throw new Error('Ảnh không hợp lệ')
    }
  }

  if (normalized.normalizedType === 'file') {
    if (!normalized.normalizedFileUrl) {
      throw new Error('Thiếu tệp')
    }
    if (!normalized.normalizedFileUrl.startsWith('/uploads/chat/')) {
      throw new Error('Tệp không hợp lệ')
    }
  }
}

function buildSenderName(user) {
  if (user.role === 'admin') {
    return `[Admin] ${user.displayName || user.fullName || user.username}`
  }

  return `${user.displayName || user.characterName || user.username}${user.userCode ? ' (' + user.userCode + ')' : ''}`
}

async function sendSupportChatMessage({
  io,
  roomId,
  user,
  content,
  messageType,
  imageUrl,
  fileUrl,
  fileName,
  fileMime,
  fileSize,
  clientMessageId
} = {}) {
  const normalizedRoomId = String(roomId || '').trim()
  if (!normalizedRoomId) {
    throw new Error('Thiếu thông tin')
  }
  if (!user) {
    throw new Error('Phiên đăng nhập không hợp lệ')
  }
  if (!isUserAllowedRoom(user, normalizedRoomId)) {
    throw new Error('Không có quyền truy cập phòng chat')
  }

  const normalized = normalizeOutgoingChatPayload({
    content,
    messageType,
    imageUrl,
    fileUrl,
    fileName,
    fileMime,
    fileSize,
    clientMessageId
  })
  validateOutgoingChatPayload(normalized)

  await ensureSupportRoomSeed(normalizedRoomId, io)

  if (normalized.normalizedClientMessageId) {
    const existing = await ChatMessage.findOne({
      roomId: normalizedRoomId,
      senderId: user._id,
      clientMessageId: normalized.normalizedClientMessageId
    })
      .sort({ createdAt: -1 })
      .lean()

    if (existing?._id) {
      return toClientPayload(existing)
    }
  }

  const senderName = buildSenderName(user)
  const roomUserId = parseSupportRoomUserId(normalizedRoomId)
  const normalizedContent = normalized.normalizedType === 'file'
    ? (normalized.trimmed || normalized.normalizedFileName || 'Tệp đính kèm')
    : normalized.trimmed

  const msg = await ChatMessage.create({
    roomId: normalizedRoomId,
    roomUserId: roomUserId || null,
    senderId: user._id,
    senderName,
    senderRole: user.role === 'admin' ? 'admin' : 'user',
    clientMessageId: normalized.normalizedClientMessageId,
    messageType: normalized.normalizedType,
    attachmentType: 'none',
    content: normalizedContent,
    imageUrl: normalized.normalizedType === 'image' ? normalized.normalizedImageUrl : '',
    fileUrl: normalized.normalizedType === 'file' ? normalized.normalizedFileUrl : '',
    fileName: normalized.normalizedType === 'file' ? normalized.normalizedFileName : '',
    fileMime: normalized.normalizedType === 'file' ? normalized.normalizedFileMime : '',
    fileSize: normalized.normalizedType === 'file' ? normalized.normalizedFileSize : 0,
    senderMeta: {
      username: user.username || '',
      userCode: user.userCode || '',
      displayName: user.displayName || '',
      characterName: user.characterName || ''
    }
  })

  const payload = toClientPayload(msg)
  io?.to(`chat:${normalizedRoomId}`).emit('chat_message', payload)

  if (payload.senderRole === 'user') {
    io?.to(ADMIN_NOTIFY_ROOM).emit('chat_notify', {
      roomId: payload.roomId,
      roomUserId: payload.roomUserId,
      senderName: payload.senderName,
      senderMeta: payload.senderMeta || {},
      messageType: payload.messageType,
      content: payload.messageType === 'file'
        ? String(payload.fileName || payload.content || '[Tệp]').slice(0, 120)
        : String(payload.content || '').slice(0, 120),
      imageUrl: payload.imageUrl || '',
      fileUrl: payload.fileUrl || '',
      fileName: payload.fileName || '',
      fileMime: payload.fileMime || '',
      fileSize: Number(payload.fileSize || 0),
      createdAt: payload.createdAt
    })
    const supportTexts = await getSupportChatTexts()
    if (supportTexts.awayEnabled) {
      await maybeSendAwayReply(normalizedRoomId, io)
    } else {
      await maybeSendFirstAutoReply(normalizedRoomId, io)
    }
  }

  return payload
}

async function loadSocketAdmin(token) {
  if (!token) {
    throw new Error('Thiếu token')
  }
  const payload = verifyAccessToken(token)
  const user = await User.findById(payload.sub).lean()
  if (!user || user.role !== 'admin') {
    throw new Error('Không có quyền')
  }
  return user
}

function registerChatHandlers(io, socket) {
  socket.on('join_chat_admin', async ({ token } = {}, ack) => {
    const safeAck = typeof ack === 'function' ? ack : () => {}
    if (!token) return safeAck({ ok: false, message: 'Thiếu token' })

    try {
      const payload = verifyAccessToken(token)
      const user = await User.findById(payload.sub).lean()
      if (!user || user.role !== 'admin') {
        return safeAck({ ok: false, message: 'Không có quyền' })
      }

      socket.join(ADMIN_NOTIFY_ROOM)
      return safeAck({ ok: true })
    } catch {
      return safeAck({ ok: false, message: 'Token không hợp lệ' })
    }
  })

  socket.on('join_chat', async ({ roomId, token } = {}, ack) => {
    const safeAck = typeof ack === 'function' ? ack : () => {}
    if (!roomId || !token) return safeAck({ ok: false, message: 'Thiếu thông tin' })

    let user
    try {
      const payload = verifyAccessToken(token)
      user = await User.findById(payload.sub).lean()
      if (!user) throw new Error('User not found')
    } catch {
      return safeAck({ ok: false, message: 'Phiên đăng nhập không hợp lệ' })
    }

    if (!isUserAllowedRoom(user, roomId)) {
      return safeAck({ ok: false, message: 'Không có quyền truy cập phòng chat' })
    }

    if (user.role !== 'admin') {
      markSupportUserOnline(user._id)
      socket.data.supportChatUserId = String(user._id)
    }

    await ensureSupportRoomSeed(roomId, io)
    const chatRoom = `chat:${roomId}`
    socket.join(chatRoom)
    return safeAck({ ok: true })
  })

  socket.on('leave_chat', ({ roomId } = {}) => {
    if (!roomId) return
    socket.leave(`chat:${roomId}`)
  })

  socket.on('disconnect', () => {
    if (socket.data?.supportChatUserId) {
      markSupportUserOffline(socket.data.supportChatUserId)
      socket.data.supportChatUserId = null
    }
  })

  socket.on('chat_typing', async ({ roomId, token, isTyping } = {}, ack) => {
    const safeAck = typeof ack === 'function' ? ack : () => {}
    const normalizedRoomId = String(roomId || '').trim()
    if (!normalizedRoomId || !token) {
      return safeAck({ ok: false, message: 'Thiếu thông tin' })
    }

    try {
      const payload = verifyAccessToken(token)
      const user = await User.findById(payload.sub).lean()
      if (!user) throw new Error('User not found')
      if (!isUserAllowedRoom(user, normalizedRoomId)) {
        return safeAck({ ok: false, message: 'Không có quyền truy cập phòng chat' })
      }

      const typingPayload = {
        roomId: normalizedRoomId,
        senderRole: user.role === 'admin' ? 'admin' : 'user',
        senderName: buildSenderName(user),
        isTyping: Boolean(isTyping),
        updatedAt: new Date().toISOString()
      }

      socket.to(`chat:${normalizedRoomId}`).emit('chat_typing', typingPayload)
      return safeAck({ ok: true })
    } catch {
      return safeAck({ ok: false, message: 'Phiên đăng nhập không hợp lệ' })
    }
  })

  socket.on('send_chat_message', async ({ roomId, content, token, messageType, imageUrl, fileUrl, fileName, fileMime, fileSize, clientMessageId } = {}, ack) => {
    const safeAck = typeof ack === 'function' ? ack : () => {}

    if (!roomId || !token) {
      return safeAck({ ok: false, message: 'Thiếu thông tin' })
    }

    let user
    try {
      const payload = verifyAccessToken(token)
      user = await User.findById(payload.sub).lean()
      if (!user) throw new Error('User not found')
    } catch {
      return safeAck({ ok: false, message: 'Phiên đăng nhập không hợp lệ' })
    }

    try {
      const payload = await sendSupportChatMessage({
        io,
        roomId,
        user,
        content,
        messageType,
        imageUrl,
        fileUrl,
        fileName,
        fileMime,
        fileSize,
        clientMessageId
      })
      return safeAck({ ok: true, message: payload })
    } catch (err) {
      void recordIncident({
        source: 'socket',
        level: 'error',
        code: 'CHAT_SEND_MESSAGE_FAILED',
        message: err?.message || 'Lỗi gửi tin nhắn socket',
        error: err,
        context: {
          userId: user?._id || null,
          roomId,
          socketId: socket.id
        },
        metadata: {
          event: 'send_chat_message',
          messageType: String(messageType || ''),
          hasImage: Boolean(imageUrl),
          hasFile: Boolean(fileUrl),
          clientMessageId: String(clientMessageId || '')
        }
      })
      return safeAck({ ok: false, message: err.message || 'Lỗi gửi tin nhắn' })
    }
  })

  socket.on('edit_chat_message', async ({ messageId, content, token } = {}, ack) => {
    const safeAck = typeof ack === 'function' ? ack : () => {}
    try {
      const admin = await loadSocketAdmin(token)
      const trimmedContent = String(content || '').trim().slice(0, 2000)
      if (!messageId || !trimmedContent) {
        return safeAck({ ok: false, message: 'Thiếu nội dung chỉnh sửa' })
      }

      const message = await ChatMessage.findById(messageId)
      if (!message || message.deletedAt) {
        return safeAck({ ok: false, message: 'Tin nhắn không tồn tại hoặc đã bị xóa' })
      }
      if (message.senderRole !== 'admin') {
        return safeAck({ ok: false, message: 'Chỉ được sửa tin nhắn CSKH đã gửi' })
      }

      message.content = trimmedContent
      message.editedAt = new Date()
      message.editedBy = admin._id
      await message.save()

      const payload = toClientPayload(message)
      io?.to(`chat:${message.roomId}`).emit('chat_message_updated', payload)
      io?.to(ADMIN_NOTIFY_ROOM).emit('chat_message_updated', payload)
      return safeAck({ ok: true, message: payload })
    } catch (err) {
      return safeAck({ ok: false, message: err.message || 'Không thể sửa tin nhắn' })
    }
  })

  socket.on('delete_chat_message', async ({ messageId, token } = {}, ack) => {
    const safeAck = typeof ack === 'function' ? ack : () => {}
    try {
      const admin = await loadSocketAdmin(token)
      if (!messageId) {
        return safeAck({ ok: false, message: 'Thiếu tin nhắn cần xóa' })
      }

      const message = await ChatMessage.findById(messageId).select('+originalContent')
      if (!message || message.deletedAt) {
        return safeAck({ ok: false, message: 'Tin nhắn không tồn tại hoặc đã bị xóa' })
      }
      if (message.senderRole !== 'admin') {
        return safeAck({ ok: false, message: 'Chỉ được xóa tin nhắn CSKH đã gửi' })
      }

      message.originalContent = message.originalContent || message.content || ''
      message.content = ''
      message.imageUrl = ''
      message.fileUrl = ''
      message.fileName = ''
      message.fileMime = ''
      message.fileSize = 0
      message.messageType = 'text'
      message.attachmentType = 'none'
      message.deletedAt = new Date()
      message.deletedBy = admin._id
      await message.save()

      const payload = toClientPayload(message)
      io?.to(`chat:${message.roomId}`).emit('chat_message_deleted', payload)
      io?.to(ADMIN_NOTIFY_ROOM).emit('chat_message_deleted', payload)
      return safeAck({ ok: true, message: payload })
    } catch (err) {
      return safeAck({ ok: false, message: err.message || 'Không thể xóa tin nhắn' })
    }
  })

  socket.on('mark_chat_seen', async ({ roomId, token } = {}, ack) => {
    const safeAck = typeof ack === 'function' ? ack : () => {}
    if (!roomId || !token) return safeAck({ ok: false, message: 'Thiếu thông tin' })

    try {
      const payload = verifyAccessToken(token)
      const user = await User.findById(payload.sub).lean()
      if (!user) throw new Error('User not found')
      const result = await markSupportMessagesSeenByUser({ roomId, user, io })
      return safeAck({ ok: true, seenAt: result?.seenAt || null, modifiedCount: result?.modifiedCount || 0 })
    } catch (err) {
      return safeAck({ ok: false, message: err.message || 'Không thể cập nhật đã xem' })
    }
  })
}

module.exports = {
  registerChatHandlers,
  buildSupportRoomId,
  ensureSupportRoomSeed,
  getSupportUserPresence,
  getSupportChatTexts,
  sendSupportChatMessage,
  markSupportMessagesSeenByUser,
  formatChatMessageForClient: toClientPayload
}
