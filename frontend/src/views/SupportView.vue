<template>
  <section class="chat-page">
    <!-- Chat header -->
    <div class="chat-header">
      <button class="chat-header__menu" type="button" aria-label="Mở menu">•••</button>
      <div class="chat-header__brand">
        <img class="chat-header__logo" src="/img/the-venetian-wordmark.svg" alt="The Venetian" />
        <span>Chăm sóc khách hàng trực tuyến</span>
      </div>
      <button class="chat-header__close" type="button" aria-label="Đóng" @click="goBackHome">×</button>
    </div>
    <div class="chat-announcement">
      <span class="chat-announcement__icon">📣</span>
      <div class="chat-announcement__text">Hỗ trợ nạp, rút, khiếu nại cược và kiểm tra giao dịch nhanh cho hội viên The Venetian.</div>
    </div>

    <!-- Chat messages -->
    <div class="chat-messages" ref="messagesRef">
      <div v-if="loading" class="chat-loading">Đang tải tin nhắn...</div>
      <div v-if="chatError" class="chat-error">{{ chatError }}</div>

      <div class="chat-agent-line">CSKH THE VENETIAN</div>

      <div
        v-for="msg in displayMessages"
        :key="msg._id"
        class="chat-bubble"
        :class="`chat-bubble--${getMessageSide(msg)}`"
      >
        <span v-if="getMessageSide(msg) === 'admin'" class="chat-bubble__name">CSKH The Venetian Casino</span>
        <div class="chat-bubble__content">
          <template v-if="msg.messageType === 'image' && msg.imageUrl">
            <button class="chat-bubble__image-btn" type="button" @click="openChatImagePreview(resolveImageSrc(msg.imageUrl))">
              <img class="chat-bubble__image" :src="resolveImageSrc(msg.imageUrl)" alt="Ảnh" />
            </button>
            <div class="chat-bubble__image-actions">
              <button class="chat-bubble__image-link" type="button" @click="copyChatImage(resolveImageSrc(msg.imageUrl))">Sao chép ảnh</button>
              <a class="chat-bubble__image-link" :href="resolveImageSrc(msg.imageUrl)" target="_blank" rel="noopener" download>Tải ảnh</a>
            </div>
            <p v-if="msg.content" class="chat-bubble__text chat-bubble__text--caption">{{ msg.content }}</p>
          </template>
          <template v-else-if="msg.messageType === 'file' && msg.fileUrl">
            <div class="chat-bubble__file-card">
              <strong class="chat-bubble__file-name">{{ getChatFileName(msg) }}</strong>
              <span v-if="Number(msg.fileSize || 0) > 0" class="chat-bubble__file-size">{{ formatFileSize(msg.fileSize) }}</span>
              <div class="chat-bubble__file-actions">
                <a class="chat-bubble__image-link" :href="resolveFileSrc(msg.fileUrl)" target="_blank" rel="noopener">Mở tệp</a>
                <a class="chat-bubble__image-link" :href="resolveFileSrc(msg.fileUrl)" target="_blank" rel="noopener" :download="getChatFileName(msg)">Tải tệp</a>
              </div>
            </div>
            <p v-if="msg.content" class="chat-bubble__text chat-bubble__text--caption">{{ msg.content }}</p>
          </template>
          <template v-else>
            <p class="chat-bubble__text">{{ msg.content }}</p>
            <div v-if="shouldShowWelcomeVipTable(msg) && vipPrivilegeRows.length" class="chat-vip-card">
              <div class="chat-vip-card__crest"><span>♛</span><strong>VIP</strong></div>
              <h3>{{ vipPrivilegeTitle }}</h3>
              <p>{{ vipPrivilegeSubtitle }}</p>
              <div class="chat-vip-card__table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>TÍCH LŨY</th>
                      <th>CẤP VIP</th>
                      <th>THƯỞNG</th>
                      <th>HẠN MỨC</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in vipPrivilegeRows" :key="`${row.tich_luy}-${row.cap}-${row.thuong}-${row.han_muc}`">
                      <td>{{ row.tich_luy }}</td>
                      <td>{{ row.cap }}</td>
                      <td>{{ row.thuong }}</td>
                      <td>{{ row.han_muc }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div v-if="extractChatQrData(msg.content)" class="chat-qr-card">
              <img class="chat-qr-card__image" :src="buildChatQrUrl(extractChatQrData(msg.content))" alt="Mã QR chuyển khoản" />
              <div class="chat-qr-card__meta">
                <strong>{{ extractChatQrData(msg.content).bankLabel }}</strong>
                <span>STK: {{ extractChatQrData(msg.content).accountNumber }}</span>
                <small v-if="extractChatQrData(msg.content).accountName">{{ extractChatQrData(msg.content).accountName }}</small>
              </div>
            </div>
          </template>
        </div>
        <span class="chat-bubble__time">{{ fmtTime(msg.createdAt) }}</span>
      </div>

      <div v-if="isSupportTypingVisible" class="chat-bubble chat-bubble--admin chat-bubble--typing">
        <span class="chat-bubble__name">CSKH The Venetian Casino</span>
        <div class="chat-bubble__content chat-bubble__content--typing" aria-label="CSKH đang nhập">
          <span class="chat-typing__text">CSKH đang soạn tin nhắn</span>
          <span class="chat-typing__dots" aria-hidden="true">
            <span class="chat-typing__dot"></span>
            <span class="chat-typing__dot"></span>
            <span class="chat-typing__dot"></span>
          </span>
        </div>
      </div>

    </div>

  <!-- Chat input -->
  <div class="chat-input">
    <div v-if="pendingImagePreview" class="chat-input__preview">
      <img :src="pendingImagePreview" alt="Ảnh chờ gửi" class="chat-input__preview-image" />
      <button class="chat-input__preview-remove" type="button" @click="clearPendingImage">×</button>
    </div>
    <div v-else-if="pendingImageFile" class="chat-input__preview chat-input__preview--file">
      <div class="chat-input__preview-file">
        <strong>{{ pendingImageFile.name }}</strong>
        <span>{{ formatFileSize(pendingImageFile.size) }}</span>
      </div>
      <button class="chat-input__preview-remove" type="button" @click="clearPendingImage">×</button>
    </div>
    <input ref="attachRef" class="chat-input__file" type="file" accept="image/*,*/*" @change="onPickAttachment" />
    <div class="chat-input__helper">
      <span>Hỗ trợ trực tuyến chính thức của The Venetian</span>
    </div>
    <div class="chat-input__bar">
      <textarea
        v-model="chatInput"
        rows="2"
        class="chat-input__field"
        :placeholder="pendingImageFile ? 'Có thể nhập kèm lời nhắn hoặc bấm Gửi' : 'Nhập tin nhắn...'"
        @input="handleCustomerChatTyping"
        @keydown="handleChatInputKeydown"
      ></textarea>
      <div class="chat-input__icons">
        <button class="chat-input__icon" type="button" aria-label="Gắn ảnh hoặc tệp" :disabled="sendingImage || !userStore.isLoggedIn" @click="pickAttachment">Tệp</button>
        <button class="chat-input__icon chat-input__icon--send" type="button" :disabled="sending || sendingImage || (!chatInput.trim() && !pendingImageFile)" @click="sendMessage">Gửi</button>
      </div>
    </div>
  </div>

    <div v-if="chatImagePreviewUrl" class="chat-image-viewer" @click.self="closeChatImagePreview">
      <div class="chat-image-viewer__dialog">
        <button class="chat-image-viewer__close" type="button" @click="closeChatImagePreview">×</button>
        <img class="chat-image-viewer__image" :src="chatImagePreviewUrl" alt="Xem ảnh lớn" />
        <div class="chat-image-viewer__actions">
          <button class="chat-image-viewer__btn" type="button" @click="copyChatImage(chatImagePreviewUrl)">Sao chép ảnh</button>
          <a class="chat-image-viewer__btn chat-image-viewer__btn--link" :href="chatImagePreviewUrl" target="_blank" rel="noopener" download>Tải ảnh</a>
        </div>
        <p v-if="copyFeedback" class="chat-image-viewer__feedback">{{ copyFeedback }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch, API_BASE_URL } from '@/lib/api'
import { useUserStore } from '@/stores/user'
import { useSocketStore } from '@/stores/socket'
import { formatTimeVN } from '@/utils/vietnamTime'
import {
  VIP_PRIVILEGE_DEFAULT_SUBTITLE,
  VIP_PRIVILEGE_DEFAULT_TITLE,
  toVipPrivilegeDisplayRows
} from '@/constants/vipPrivilegeDefaults'

const userStore = useUserStore()
const socketStore = useSocketStore()
const router = useRouter()

const messagesRef = ref(null)
const attachRef = ref(null)
const chatInput = ref('')
const messages = ref([])
const loading = ref(false)
const sending = ref(false)
const sendingImage = ref(false)
const chatError = ref('')
const joinedRoomId = ref('')
const pendingImageFile = ref(null)
const pendingImagePreview = ref('')
const pendingAttachmentKind = ref('')
const attachmentPickNonce = ref(0)
const shouldStickToBottom = ref(true)
const localWelcomePreviewId = '__local_support_welcome__'
const chatImagePreviewUrl = ref('')
const copyFeedback = ref('')
const vipPrivilegeTitle = ref(VIP_PRIVILEGE_DEFAULT_TITLE)
const vipPrivilegeSubtitle = ref(VIP_PRIVILEGE_DEFAULT_SUBTITLE)
const vipPrivilegeRows = ref([])
const supportTypingPreview = ref(false)
const supportTypingActive = ref(false)
const supportTypingQueue = []
let supportTypingTimer = null
let supportTypingActiveTimer = null
let customerTypingTimer = null
let lastCustomerTypingState = false

const userId = computed(() => userStore.user?._id || null)
const roomId = computed(() => (userId.value ? `support:${userId.value}` : ''))
const canChat = computed(() => Boolean(userStore.isLoggedIn && roomId.value))
const displayMessages = computed(() => messages.value.filter((item) => !item?.isDeleted && !item?.deletedAt))
const isSupportTypingVisible = computed(() => supportTypingPreview.value || supportTypingActive.value)
const firstSupportMessageId = computed(() => {
  const firstSupportMessage = displayMessages.value.find((item) => {
    const side = getMessageSide(item)
    return side === 'admin' || side === 'system'
  })
  return firstSupportMessage?._id ? String(firstSupportMessage._id) : ''
})

const CHAT_QR_BANK_ALIASES = [
  { code: '970418', label: 'BIDV', aliases: ['bidv', 'bankdautuvaphattrien', 'dautuvaphattrien'] },
  { code: '970407', label: 'Techcombank', aliases: ['techcombank', 'tcb', 'techcom'] },
  { code: '970436', label: 'Vietcombank', aliases: ['vietcombank', 'vcb', 'vietcom'] },
  { code: '970415', label: 'VietinBank', aliases: ['vietinbank', 'vietin', 'ctg'] },
  { code: '970405', label: 'Agribank', aliases: ['agribank', 'agri'] },
  { code: '970422', label: 'MB Bank', aliases: ['mbbank', 'mb', 'mbb'] },
  { code: '970416', label: 'ACB', aliases: ['acb'] },
  { code: '970423', label: 'TPBank', aliases: ['tpbank', 'tpb'] },
  { code: '970403', label: 'Sacombank', aliases: ['sacombank', 'stb', 'sacom'] },
  { code: '970432', label: 'VPBank', aliases: ['vpbank', 'vpb'] },
  { code: '970437', label: 'HDBank', aliases: ['hdbank', 'hdb'] },
  { code: '970440', label: 'SeABank', aliases: ['seabank', 'sea'] },
  { code: '970443', label: 'SHB', aliases: ['shb'] },
  { code: '970448', label: 'OCB', aliases: ['ocb'] },
  { code: '970431', label: 'Eximbank', aliases: ['eximbank', 'eib', 'exim'] },
  { code: '970426', label: 'MSB', aliases: ['msb', 'maritimebank', 'maritime'] },
  { code: '970428', label: 'Nam A Bank', aliases: ['namabank', 'nama'] }
]

function fmtTime(v) {
  return formatTimeVN(v)
}

function isNearBottom() {
  const el = messagesRef.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 96
}

function handleMessagesScroll() {
  shouldStickToBottom.value = isNearBottom()
}

function scrollToBottom(force = false) {
  if (!messagesRef.value) return
  if (!force && !shouldStickToBottom.value) return
  messagesRef.value.scrollTop = messagesRef.value.scrollHeight
}

function clearSupportTypingActive() {
  if (supportTypingActiveTimer && typeof window !== 'undefined') {
    window.clearTimeout(supportTypingActiveTimer)
  }
  supportTypingActiveTimer = null
  supportTypingActive.value = false
}

function setSupportTypingActive(isTyping) {
  if (!isTyping) {
    clearSupportTypingActive()
    return
  }
  supportTypingActive.value = true
  nextTick(() => scrollToBottom())
  if (supportTypingActiveTimer && typeof window !== 'undefined') {
    window.clearTimeout(supportTypingActiveTimer)
  }
  if (typeof window !== 'undefined') {
    supportTypingActiveTimer = window.setTimeout(() => {
      supportTypingActive.value = false
      supportTypingActiveTimer = null
    }, 2600)
  }
}

function emitCustomerTypingState(isTyping) {
  if (!canChat.value || !userStore.token) return
  const socket = socketStore.socket || socketStore.connect()
  if (!socket) return
  socket.emit('chat_typing', {
    roomId: roomId.value,
    token: userStore.token,
    isTyping: Boolean(isTyping)
  }, () => {})
}

function stopCustomerTypingBroadcast() {
  if (customerTypingTimer && typeof window !== 'undefined') {
    window.clearTimeout(customerTypingTimer)
  }
  customerTypingTimer = null
  if (!lastCustomerTypingState) return
  lastCustomerTypingState = false
  emitCustomerTypingState(false)
}

function handleCustomerChatTyping() {
  if (!chatInput.value.trim()) {
    stopCustomerTypingBroadcast()
    return
  }
  if (!lastCustomerTypingState) {
    lastCustomerTypingState = true
    emitCustomerTypingState(true)
  }
  if (customerTypingTimer && typeof window !== 'undefined') {
    window.clearTimeout(customerTypingTimer)
  }
  if (typeof window !== 'undefined') {
    customerTypingTimer = window.setTimeout(() => {
      lastCustomerTypingState = false
      emitCustomerTypingState(false)
      customerTypingTimer = null
    }, 1300)
  }
}

function clearSupportTypingDelay() {
  if (supportTypingTimer && typeof window !== 'undefined') {
    window.clearTimeout(supportTypingTimer)
  }
  supportTypingTimer = null
  supportTypingPreview.value = false
  supportTypingQueue.splice(0)
}

function runNextSupportTypingMessage() {
  if (supportTypingTimer) return
  const nextMessage = supportTypingQueue.shift()
  if (!nextMessage) {
    supportTypingPreview.value = false
    return
  }

  if (messages.value.some((item) => String(item._id) === String(nextMessage._id))) {
    runNextSupportTypingMessage()
    return
  }

  if (typeof window === 'undefined') {
    appendMessageIfNeeded(nextMessage, { forceScroll: true })
    markSupportMessagesSeen()
    return
  }

  supportTypingPreview.value = true
  nextTick(() => scrollToBottom(true))
  const contentLength = String(nextMessage.content || '').length
  const delay = nextMessage.messageType === 'text'
    ? Math.min(1100, Math.max(520, contentLength * 18))
    : 640

  supportTypingTimer = window.setTimeout(() => {
    supportTypingTimer = null
    supportTypingPreview.value = false
    appendMessageIfNeeded(nextMessage, { forceScroll: true })
    markSupportMessagesSeen()
    playIncomingTone()
    notifyIncomingMessage(nextMessage)
    if (supportTypingQueue.length) runNextSupportTypingMessage()
  }, delay)
}

function queueSupportMessageWithTyping(message) {
  if (!message?._id || message.isDeleted || message.deletedAt) return
  const messageId = String(message._id)
  if (messages.value.some((item) => String(item._id) === messageId)) return
  if (supportTypingQueue.some((item) => String(item._id) === messageId)) return
  supportTypingQueue.push(message)
  runNextSupportTypingMessage()
}

function normalizeChatQrKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function extractChatQrData(content) {
  const text = String(content || '').trim()
  if (!text) return null
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return null
  const normalizedText = normalizeChatQrKey(text)

  let bankLabel = ''
  let bankCode = ''
  let accountNumber = ''
  let accountName = ''
  let amount = ''
  let addInfo = ''

  for (const line of lines) {
    const parts = line.split(/\s*[:\-]\s*/, 2)
    const rawLabel = parts.length > 1 ? parts[0] : ''
    const rawValue = parts.length > 1 ? parts[1] : line
    const key = normalizeChatQrKey(rawLabel)
    const value = String(rawValue || '').trim()
    if (!value) continue
    if (!bankLabel && /(nganhang|bank)/.test(key)) bankLabel = value
    else if (!accountNumber && /(sotaikhoan|stk|accountnumber|taikhoan)/.test(key)) accountNumber = value.replace(/[^\d]/g, '')
    else if (!accountName && /(chutaikhoan|tentk|accountname|tenchutk)/.test(key)) accountName = value
    else if (!amount && /(sotien|amount)/.test(key)) amount = value.replace(/[^\d]/g, '')
    else if (!addInfo && /(noidung|nd|addinfo|message)/.test(key)) addInfo = value
  }

  const matchedBank = CHAT_QR_BANK_ALIASES.find((bank) =>
    bank.aliases.some((alias) => normalizedText.includes(alias))
  )

  if (!bankLabel && matchedBank) {
    bankLabel = matchedBank.label
  }
  if (matchedBank) bankCode = matchedBank.code

  if (!accountNumber) {
    const matchedAccount = text.match(/(?:stk|sotk|sotaikhoan|taikhoan)?\s*[:\-]?\s*(\d{8,19})/i)
    if (matchedAccount?.[1]) accountNumber = matchedAccount[1]
  }

  if (!bankCode || !accountNumber) return null

  return { bankCode, bankLabel: bankLabel || matchedBank?.label || '', accountNumber, accountName, amount, addInfo }
}

function buildChatQrUrl(qrData) {
  if (!qrData?.bankCode || !qrData?.accountNumber) return ''
  const params = new URLSearchParams()
  if (qrData.amount) params.set('amount', qrData.amount)
  if (qrData.addInfo) params.set('addInfo', qrData.addInfo)
  if (qrData.accountName) params.set('accountName', qrData.accountName)
  const query = params.toString()
  return `https://img.vietqr.io/image/${qrData.bankCode}-${qrData.accountNumber}-compact2.png${query ? `?${query}` : ''}`
}

async function loadVipPrivileges() {
  try {
    const data = await apiFetch('/api/game/vip-privileges')
    vipPrivilegeTitle.value = String(data?.title || VIP_PRIVILEGE_DEFAULT_TITLE)
    vipPrivilegeSubtitle.value = String(data?.subtitle || VIP_PRIVILEGE_DEFAULT_SUBTITLE)
    vipPrivilegeRows.value = toVipPrivilegeDisplayRows(data?.rows)
  } catch {
    vipPrivilegeTitle.value = VIP_PRIVILEGE_DEFAULT_TITLE
    vipPrivilegeSubtitle.value = VIP_PRIVILEGE_DEFAULT_SUBTITLE
    vipPrivilegeRows.value = []
  }
}

function shouldShowWelcomeVipTable(msg) {
  if (!msg) return false
  if (String(msg.attachmentType || '').toLowerCase() === 'vip') return true
  if (String(msg.systemType || '').toLowerCase() === 'welcome_seed') return true
  return Boolean(firstSupportMessageId.value && String(msg._id || '') === firstSupportMessageId.value)
}

function normalizeChatMessage(raw = {}) {
  const senderId = raw.senderId || raw.sender_id || raw.userId || raw.adminId || null
  const rawRole = String(raw.senderRole || raw.sender_type || raw.senderType || raw.role || raw.sender || '').toLowerCase()
  let senderRole = rawRole
  if (senderRole === 'customer' || senderRole === 'member') senderRole = 'user'
  if (senderRole === 'support' || senderRole === 'staff' || senderRole === 'cskh') senderRole = 'admin'
  if (!senderRole) {
    senderRole = senderId && userId.value && String(senderId) === String(userId.value) ? 'user' : 'admin'
  }
  if (!['user', 'admin', 'system'].includes(senderRole)) {
    senderRole = senderId && userId.value && String(senderId) === String(userId.value) ? 'user' : 'admin'
  }

  const imageUrl = String(raw.imageUrl || raw.image_url || '').trim()
  const fileUrl = String(raw.fileUrl || raw.file_url || '').trim()
  const normalizedMessageType = String(raw.messageType || raw.message_type || '').toLowerCase()
  const normalizedAttachmentType = String(raw.attachmentType || raw.attachment_type || '').trim().toLowerCase()
  const attachmentType = ['none', 'image', 'sticker', 'vip'].includes(normalizedAttachmentType)
    ? normalizedAttachmentType
    : 'none'
  let messageType = 'text'
  if (normalizedMessageType === 'image' || imageUrl) messageType = 'image'
  else if (normalizedMessageType === 'file' || fileUrl) messageType = 'file'

  return {
    ...raw,
    _id: raw._id || raw.id || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    roomId: raw.roomId || raw.room_id || roomId.value,
    senderId,
    senderName: raw.senderName || raw.sender_name || raw.name || (senderRole === 'admin' ? 'Chăm sóc khách hàng' : ''),
    senderRole,
    attachmentType,
    messageType,
    content: String(raw.content ?? raw.message ?? raw.text ?? raw.body ?? ''),
    imageUrl,
    fileUrl,
    fileName: String(raw.fileName || raw.file_name || '').trim(),
    fileMime: String(raw.fileMime || raw.file_mime || '').trim(),
    fileSize: Number(raw.fileSize ?? raw.file_size ?? 0) || 0,
    seenByUserAt: raw.seenByUserAt || raw.seen_by_user_at || null,
    messageStatus: String(raw.messageStatus || raw.message_status || 'sent'),
    editedAt: raw.editedAt || raw.edited_at || null,
    deletedAt: raw.deletedAt || raw.deleted_at || null,
    isDeleted: Boolean(raw.isDeleted || raw.deletedAt || raw.deleted_at),
    isEdited: Boolean(raw.isEdited || raw.editedAt || raw.edited_at),
    createdAt: raw.createdAt || raw.created_at || raw.time || raw.timestamp || new Date().toISOString()
  }
}

function getMessageSide(msg) {
  const role = String(msg?.senderRole || '').toLowerCase()
  if (role === 'system') return 'system'
  if (role === 'admin') return 'admin'
  if (role === 'user') return 'user'
  if (msg?.senderId && userId.value && String(msg.senderId) === String(userId.value)) return 'user'
  return 'admin'
}

function makeLocalSupportMessage(content, systemType = '', attachmentType = 'none') {
  return normalizeChatMessage({
    _id: localWelcomePreviewId,
    roomId: roomId.value,
    senderId: null,
    senderName: 'Chăm sóc khách hàng',
    senderRole: 'system',
    messageType: 'text',
    attachmentType,
    content,
    imageUrl: '',
    systemType,
    createdAt: new Date().toISOString()
  })
}

async function loadMessages() {
  if (!canChat.value) {
    if (userStore.isLoggedIn) chatError.value = 'Không xác định được phòng CSKH của tài khoản này.'
    return
  }
  loading.value = true
  chatError.value = ''
  try {
    const data = await apiFetch(`/api/account/chat/${encodeURIComponent(roomId.value)}`, { headers: userStore.authHeaders })
    const serverItems = Array.isArray(data.items) ? data.items : []
    const previewWelcomeMessage = String(data.previewWelcomeMessage || '').trim()
    const previewWelcomeAttachmentType = String(data.previewWelcomeAttachmentType || 'none').trim().toLowerCase()
    messages.value = serverItems
      .map((item) => normalizeChatMessage(item))
      .filter((item) => !item.isDeleted && !item.deletedAt)
    if (!serverItems.length && previewWelcomeMessage) {
      messages.value = [makeLocalSupportMessage(previewWelcomeMessage, 'welcome_seed', previewWelcomeAttachmentType)]
    }
    if (!messages.value.length) {
      messages.value = [makeLocalSupportMessage('CSKH đã kết nối. Quý khách vui lòng để lại nội dung cần hỗ trợ.')]
    }
  } catch (err) {
    chatError.value = err?.message || 'Không tải được lịch sử CSKH. Vui lòng thử lại.'
    if (!messages.value.length) {
      messages.value = [makeLocalSupportMessage('Không tải được lịch sử cũ, quý khách vẫn có thể gửi nội dung cần hỗ trợ.')]
    }
  } finally {
    loading.value = false
    markSupportMessagesSeen()
    await nextTick()
    scrollToBottom(true)
  }
}

function appendMessageIfNeeded(message, options = {}) {
  const normalized = normalizeChatMessage(message)
  if (!normalized?._id) return
  if (normalized.isDeleted || normalized.deletedAt) return
  if (messages.value.some((item) => item._id === normalized._id)) return
  if (messages.value.some((item) => item._id === localWelcomePreviewId) && normalized.senderRole === 'user') {
    messages.value = messages.value.filter((item) => item._id !== localWelcomePreviewId)
  }
  const shouldForceScroll = Boolean(options.forceScroll)
  messages.value.push(normalized)
  nextTick(() => scrollToBottom(shouldForceScroll))
}

function playIncomingTone() {
  if (typeof window === 'undefined') return
  const AudioContextRef = window.AudioContext || window.webkitAudioContext
  if (!AudioContextRef) return

  try {
    const context = new AudioContextRef()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 932
    gain.gain.value = 0.03
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.12)
    oscillator.onended = () => {
      context.close().catch(() => {})
    }
  } catch {
    /* ignore audio errors */
  }
}

function notifyIncomingMessage(msg) {
  if (typeof window === 'undefined') return
  if (document.visibilityState === 'visible') return
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  let body = String(msg?.content || 'Bạn có tin nhắn mới.').slice(0, 120)
  if (msg?.messageType === 'image') body = 'Bạn nhận được 1 ảnh mới.'
  else if (msg?.messageType === 'file') body = 'Bạn nhận được 1 tệp mới.'

  try {
    new Notification('CSKH', { body })
  } catch {
    /* ignore notification errors */
  }
}

async function joinSupportRoom() {
  if (!canChat.value) return
  const socket = socketStore.connect()
  socketStore.ensureSocketAuth()
  await loadMessages()
  socket.emit('join_chat', { roomId: roomId.value, token: userStore.token }, (response) => {
    if (!response?.ok) {
      chatError.value = response?.message || 'Không kết nối được CSKH realtime.'
      return
    }
    chatError.value = ''
    joinedRoomId.value = roomId.value
  })
}

function sendMessage() {
  void submitPendingMessage()
}

function handleChatInputKeydown(event) {
  if (event.key !== 'Enter') return
  if (event.shiftKey) return
  event.preventDefault()
  sendMessage()
}

function goBackHome() {
  router.push('/')
}

function onChatMessage(msg) {
  const normalized = normalizeChatMessage(msg)
  if (normalized.roomId !== roomId.value) return
  if (normalized.isDeleted || normalized.deletedAt) return

  const isIncomingSupportMessage =
    normalized.senderId !== userId.value &&
    normalized.senderRole !== 'user'

  if (isIncomingSupportMessage) {
    clearSupportTypingActive()
    queueSupportMessageWithTyping(normalized)
    return
  }

  appendMessageIfNeeded(normalized, { forceScroll: getMessageSide(normalized) === 'user' })
}

function onChatTyping(payload) {
  if (String(payload?.roomId || '') !== roomId.value) return
  if (payload?.senderRole !== 'admin' && payload?.senderRole !== 'system') return
  setSupportTypingActive(Boolean(payload?.isTyping))
}

function mergeChatMessageUpdate(message) {
  const normalized = normalizeChatMessage(message)
  if (normalized.roomId !== roomId.value) return
  if (normalized.isDeleted || normalized.deletedAt) {
    const messageId = String(normalized._id)
    messages.value = messages.value.filter((item) => String(item._id) !== messageId)
    const queueIndex = supportTypingQueue.findIndex((item) => String(item._id) === messageId)
    if (queueIndex >= 0) supportTypingQueue.splice(queueIndex, 1)
    nextTick(() => scrollToBottom())
    return
  }
  const index = messages.value.findIndex((item) => String(item._id) === String(normalized._id))
  if (index >= 0) {
    messages.value[index] = { ...messages.value[index], ...normalized }
  } else {
    appendMessageIfNeeded(normalized)
  }
}

function markSupportMessagesSeen() {
  if (!canChat.value || !userStore.token) return
  const socket = socketStore.socket || socketStore.connect()
  if (!socket) return
  socket.emit('mark_chat_seen', { roomId: roomId.value, token: userStore.token }, () => {})
}

function resolveImageSrc(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `${String(API_BASE_URL || '').replace(/\/+$/, '')}${raw.startsWith('/') ? raw : `/${raw}`}`
}

function triggerFilePicker(targetRef) {
  if (!targetRef?.value) return
  targetRef.value.value = ''
  targetRef.value.click()
}

function pickAttachment() {
  if (!canChat.value || sendingImage.value) return
  triggerFilePicker(attachRef)
}

function clearPendingImage() {
  pendingImageFile.value = null
  pendingAttachmentKind.value = ''
  if (pendingImagePreview.value && pendingImagePreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(pendingImagePreview.value)
  }
  pendingImagePreview.value = ''
}

function openChatImagePreview(url) {
  chatImagePreviewUrl.value = String(url || '').trim()
  copyFeedback.value = ''
}

function closeChatImagePreview() {
  chatImagePreviewUrl.value = ''
  copyFeedback.value = ''
}

function resolveFileSrc(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `${String(API_BASE_URL || '').replace(/\/+$/, '')}${raw.startsWith('/') ? raw : `/${raw}`}`
}

function getChatFileName(msg) {
  const explicitName = String(msg?.fileName || '').trim()
  if (explicitName) return explicitName
  const fromContent = String(msg?.content || '').trim()
  if (fromContent) return fromContent
  const fileUrl = String(msg?.fileUrl || '').trim()
  if (!fileUrl) return 'Tệp đính kèm'
  try {
    const pathPart = fileUrl.split('?')[0].split('#')[0]
    const fromPath = decodeURIComponent(pathPart.split('/').pop() || '').trim()
    return fromPath || 'Tệp đính kèm'
  } catch {
    return 'Tệp đính kèm'
  }
}

function formatFileSize(size) {
  const value = Number(size)
  if (!Number.isFinite(value) || value <= 0) return '0 KB'
  if (value < 1024) return `${value} B`
  const kiloBytes = value / 1024
  if (kiloBytes < 1024) return `${kiloBytes.toFixed(kiloBytes < 10 ? 1 : 0)} KB`
  const megaBytes = kiloBytes / 1024
  if (megaBytes < 1024) return `${megaBytes.toFixed(megaBytes < 10 ? 1 : 0)} MB`
  const gigaBytes = megaBytes / 1024
  return `${gigaBytes.toFixed(gigaBytes < 10 ? 1 : 0)} GB`
}

function hasImageExtension(name) {
  return /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif)$/i.test(String(name || '').toLowerCase())
}

function isImageFile(file) {
  if (!file) return false
  const mime = String(file.type || '').toLowerCase()
  if (mime.startsWith('image/')) return true
  return hasImageExtension(file.name)
}

function isProbablyImageMeta(fileName, fileMime) {
  const mime = String(fileMime || '').toLowerCase().trim()
  if (mime.startsWith('image/')) return true
  return hasImageExtension(fileName)
}

async function canRenderImageFile(file) {
  if (typeof window === 'undefined' || !file) return false
  const objectUrl = URL.createObjectURL(file)
  try {
    await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(true)
      image.onerror = () => reject(new Error('image-load-failed'))
      image.src = objectUrl
    })
    return true
  } catch {
    return false
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function detectAttachmentKind(file) {
  if (!file) return ''
  if (isImageFile(file)) return 'image'
  const mime = String(file.type || '').trim().toLowerCase()
  if (!mime || mime === 'application/octet-stream' || mime === 'binary/octet-stream') {
    const previewableImage = await canRenderImageFile(file)
    if (previewableImage) return 'image'
  }
  return 'file'
}

async function copyChatImage(url) {
  const imageUrl = String(url || '').trim()
  if (!imageUrl) return

  try {
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    if (typeof window !== 'undefined' && window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([new window.ClipboardItem({ [blob.type || 'image/png']: blob })])
      copyFeedback.value = 'Đã sao chép ảnh'
      return
    }
    throw new Error('clipboard-unavailable')
  } catch {
    try {
      await navigator.clipboard.writeText(imageUrl)
      copyFeedback.value = 'Đã sao chép liên kết ảnh'
    } catch {
      copyFeedback.value = 'Không thể sao chép ảnh'
    }
  }
}

async function uploadPendingImage() {
  if (!pendingImageFile.value) return ''

  const form = new FormData()
  form.append('image', pendingImageFile.value)

  const res = await fetch(`${String(API_BASE_URL || '').replace(/\/+$/, '')}/api/account/chat/upload-image`, {
    method: 'POST',
    headers: {
      ...userStore.authHeaders
    },
    body: form
  })

  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json?.message || `HTTP ${res.status}`)
  }

  const data = await res.json().catch(() => ({}))
  return String(data?.imageUrl || '').trim()
}

async function uploadPendingFile() {
  if (!pendingImageFile.value) return null

  const form = new FormData()
  form.append('file', pendingImageFile.value)

  const res = await fetch(`${String(API_BASE_URL || '').replace(/\/+$/, '')}/api/account/chat/upload-file`, {
    method: 'POST',
    headers: {
      ...userStore.authHeaders
    },
    body: form
  })

  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json?.message || `HTTP ${res.status}`)
  }

  const data = await res.json().catch(() => ({}))
  return {
    fileUrl: String(data?.fileUrl || '').trim(),
    fileName: String(data?.fileName || pendingImageFile.value?.name || '').trim(),
    fileMime: String(data?.fileMime || pendingImageFile.value?.type || '').trim(),
    fileSize: Number(data?.fileSize ?? pendingImageFile.value?.size ?? 0) || 0
  }
}

async function uploadPendingImageWithFallback() {
  let primaryError = null
  try {
    const imageUrl = await uploadPendingImage()
    if (imageUrl) return imageUrl
    primaryError = new Error('Upload ảnh thất bại')
  } catch (error) {
    primaryError = error
  }

  try {
    const uploadedFile = await uploadPendingFile()
    if (uploadedFile?.fileUrl && isProbablyImageMeta(uploadedFile.fileName, uploadedFile.fileMime)) {
      return uploadedFile.fileUrl
    }
  } catch {
    /* keep primary error */
  }

  throw primaryError || new Error('Upload ảnh thất bại')
}

function emitChatMessageViaSocket(payload) {
  return new Promise((resolve, reject) => {
    const socket = socketStore.connect()
    socketStore.ensureSocketAuth()
    if (!socket?.connected) {
      reject(new Error('Socket đang kết nối lại'))
      return
    }
    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('Gửi tin nhắn quá thời gian, vui lòng thử lại.'))
    }, 3000)

    socket.emit('send_chat_message', payload, (response) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      if (!response?.ok) {
        reject(new Error(response?.message || 'Không gửi được tin nhắn.'))
        return
      }
      resolve(response.message)
    })
  })
}

async function sendChatMessageViaHttp(payload) {
  const data = await apiFetch('/api/account/chat/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...userStore.authHeaders
    },
    body: JSON.stringify(payload || {})
  })
  return data?.message || null
}

async function emitChatMessage(payload) {
  try {
    return await emitChatMessageViaSocket(payload)
  } catch (socketError) {
    const message = String(socketError?.message || '').toLowerCase()
    const canFallback = /socket|thời gian|timeout|connect|disconnect/i.test(message) || !socketStore.connected
    if (!canFallback) {
      throw socketError
    }
    return sendChatMessageViaHttp(payload)
  }
}

function generateClientMessageId() {
  const seed = Math.random().toString(36).slice(2, 10)
  return `chat_${Date.now()}_${seed}`
}

async function submitPendingMessage() {
  const text = chatInput.value.trim()
  if ((!text && !pendingImageFile.value) || sending.value || sendingImage.value) return
  if (!canChat.value) {
    chatError.value = 'Vui lòng đăng nhập lại để nhắn tin với CSKH.'
    return
  }
  chatError.value = ''
  stopCustomerTypingBroadcast()
  const clientMessageId = generateClientMessageId()

  if (pendingImageFile.value) {
    sendingImage.value = true
    try {
      const attachmentKind = pendingAttachmentKind.value || await detectAttachmentKind(pendingImageFile.value)
      pendingAttachmentKind.value = attachmentKind || 'file'

      if (pendingAttachmentKind.value === 'image') {
        const imageUrl = await uploadPendingImageWithFallback()
        if (!imageUrl) throw new Error('Upload ảnh thất bại')

        const sentMessage = await emitChatMessage({
          roomId: roomId.value,
          content: text,
          imageUrl,
          token: userStore.token,
          messageType: 'image',
          clientMessageId
        })
        appendMessageIfNeeded(sentMessage, { forceScroll: true })
      } else {
        const uploadedFile = await uploadPendingFile()
        if (!uploadedFile?.fileUrl) throw new Error('Upload tệp thất bại')

        const sentMessage = await emitChatMessage({
          roomId: roomId.value,
          content: text,
          fileUrl: uploadedFile.fileUrl,
          fileName: uploadedFile.fileName,
          fileMime: uploadedFile.fileMime,
          fileSize: uploadedFile.fileSize,
          token: userStore.token,
          messageType: 'file',
          clientMessageId
        })
        appendMessageIfNeeded(sentMessage, { forceScroll: true })
      }
      chatInput.value = ''
      clearPendingImage()
    } catch (err) {
      chatError.value = err?.message || 'Không gửi được tệp đính kèm.'
    } finally {
      sendingImage.value = false
    }
    return
  }

  sending.value = true
  try {
    const sentMessage = await emitChatMessage({
      roomId: roomId.value,
      content: text,
      token: userStore.token,
      messageType: 'text',
      clientMessageId
    })
    appendMessageIfNeeded(sentMessage, { forceScroll: true })
    chatInput.value = ''
  } catch (err) {
    chatError.value = err?.message || 'Không gửi được tin nhắn.'
  } finally {
    sending.value = false
  }
}

async function onPickAttachment(e) {
  const file = e?.target?.files?.[0]
  if (e?.target) {
    e.target.value = ''
  }
  if (!file || sendingImage.value || !canChat.value) return

  clearPendingImage()
  const pickNonce = Date.now() + Math.random()
  attachmentPickNonce.value = pickNonce
  pendingImageFile.value = file

  const fastImageGuess = isImageFile(file)
  if (fastImageGuess) {
    pendingAttachmentKind.value = 'image'
    pendingImagePreview.value = URL.createObjectURL(file)
    return
  }

  pendingAttachmentKind.value = 'file'
  const resolvedKind = await detectAttachmentKind(file)
  if (attachmentPickNonce.value !== pickNonce || pendingImageFile.value !== file) {
    return
  }
  pendingAttachmentKind.value = resolvedKind || 'file'
  if (pendingAttachmentKind.value === 'image') {
    if (pendingImagePreview.value && pendingImagePreview.value.startsWith('blob:')) {
      URL.revokeObjectURL(pendingImagePreview.value)
    }
    pendingImagePreview.value = URL.createObjectURL(file)
  }
}

onMounted(async () => {
  void loadVipPrivileges()

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }

  if (userStore.isLoggedIn) {
    const socket = socketStore.connect()
    socket.off('chat_message', onChatMessage)
    socket.off('chat_message_updated', mergeChatMessageUpdate)
    socket.off('chat_message_deleted', mergeChatMessageUpdate)
    socket.off('chat_typing', onChatTyping)
    socket.off('connect', joinSupportRoom)
    socket.on('chat_message', onChatMessage)
    socket.on('chat_message_updated', mergeChatMessageUpdate)
    socket.on('chat_message_deleted', mergeChatMessageUpdate)
    socket.on('chat_typing', onChatTyping)
    socket.on('connect', joinSupportRoom)
    await joinSupportRoom()
  }

  nextTick(() => {
    messagesRef.value?.addEventListener('scroll', handleMessagesScroll, { passive: true })
  })
})

onBeforeUnmount(() => {
  clearPendingImage()
  clearSupportTypingDelay()
  clearSupportTypingActive()
  stopCustomerTypingBroadcast()
  messagesRef.value?.removeEventListener('scroll', handleMessagesScroll)
  const socket = socketStore.socket
  if (socket) {
    socket.emit('leave_chat', { roomId: joinedRoomId.value || roomId.value })
    socket.off('chat_message', onChatMessage)
    socket.off('chat_message_updated', mergeChatMessageUpdate)
    socket.off('chat_message_deleted', mergeChatMessageUpdate)
    socket.off('chat_typing', onChatTyping)
    socket.off('connect', joinSupportRoom)
  }
})

watch(roomId, async (nextRoomId, prevRoomId) => {
  const socket = socketStore.socket
  if (!nextRoomId) return
  if (prevRoomId) {
    stopCustomerTypingBroadcast()
    clearSupportTypingActive()
    socket?.emit('leave_chat', { roomId: prevRoomId })
  }
  if (userStore.isLoggedIn) {
    await joinSupportRoom()
  }
})
</script>

<style scoped>
/* TỔNG THỂ KHUNG CHAT */
.chat-page {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  flex: 1 1 auto;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  height: calc(100dvh - var(--member-header-height, 64px) - var(--member-nav-height, 86px));
  background: #ffffff;
  color: #10233d;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  overflow: hidden;
}

.chat-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 12px 12px 10px;
  background: #1788ff;
  color: #fff;
}

.chat-header__menu,
.chat-header__close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 24px;
  line-height: 1;
  padding: 0;
}

.chat-header__brand {
  display: grid;
  justify-items: center;
  gap: 4px;
}

.chat-header__logo {
  display: block;
  width: 138px;
  max-width: 100%;
  height: auto;
  object-fit: contain;
}

.chat-header__brand span {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255,255,255,0.94);
}

.chat-announcement {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 10px;
  background: #fff8e8;
  border-bottom: 1px solid #f1e6c8;
  min-width: 0;
}

.chat-announcement__icon {
  color: #1788ff;
  font-size: 18px;
}

.chat-announcement__text {
  font-size: 13px;
  color: #4d4d4d;
  min-width: 0;
  white-space: normal;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-agent-line {
  font-size: 13px;
  color: #111827;
  margin-bottom: 2px;
}

.chat-messages {
  min-height: 0;
  min-width: 0;
  padding: 10px 8px 18px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #ffffff;
  position: relative;
  z-index: 1;
}

.chat-bubble {
  display: flex;
  flex-direction: column;
  max-width: min(82%, calc(100% - 16px));
  min-width: 0;
  overflow: hidden;
}

.chat-bubble--bot { align-self: flex-start; }
.chat-bubble--admin { align-self: flex-start; }
.chat-bubble--user { align-self: flex-end; }
.chat-bubble--system {
  align-self: center;
  max-width: min(92%, 420px);
  text-align: center;
}

.chat-bubble__name {
  font-size: 11px;
  color: #7d8aa4;
  margin-bottom: 4px;
  font-weight: 700;
}

.chat-bubble__content {
  max-width: 100%;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.55;
  box-shadow: 0 2px 10px rgba(26, 38, 67, 0.05);
  overflow-wrap: anywhere;
  overflow: hidden;
}

.chat-bubble--bot .chat-bubble__content {
  background: #dfeaf6;
  color: #26344c;
  border-radius: 8px 8px 8px 2px;
  border: 1px solid #d2dceb;
}

.chat-bubble--admin .chat-bubble__content {
  background: #dfeaf6;
  color: #26344c;
  border-radius: 8px 8px 8px 2px;
  border: 1px solid #d2dceb;
}

.chat-bubble--typing {
  animation: chatTypingAppear 0.16s ease both;
}

.chat-bubble__content--typing {
  width: auto;
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  overflow: visible;
  font-weight: 700;
}

.chat-typing__text {
  color: inherit;
  white-space: nowrap;
}

.chat-typing__dots {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.chat-typing__dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #1788ff;
  opacity: 0.45;
  animation: chatTypingDot 1s ease-in-out infinite;
}

.chat-typing__dot:nth-child(2) {
  animation-delay: 0.14s;
}

.chat-typing__dot:nth-child(3) {
  animation-delay: 0.28s;
}

.chat-bubble--user .chat-bubble__content {
  background: linear-gradient(135deg, #1788ff, #0f6ed6);
  color: #fff;
  border-radius: 8px 8px 2px 8px;
}

.chat-bubble--system .chat-bubble__content {
  background: #eef5ff;
  color: #24415f;
  border: 1px solid #d8e7fb;
  border-radius: 999px;
  box-shadow: none;
}

.chat-bubble--system .chat-bubble__time {
  align-self: center;
}

.chat-bubble__text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-bubble__text--caption {
  margin-top: 10px;
}

.chat-bubble__text--deleted {
  color: #70819f;
  font-style: italic;
}

.chat-bubble__time em {
  font-style: normal;
}

@keyframes chatTypingAppear {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes chatTypingDot {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.38;
  }
  40% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.chat-qr-card {
  margin-top: 8px;
  padding: 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.24);
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.chat-bubble--bot .chat-qr-card {
  background: #f7fbff;
  border-color: #dfe8f5;
}

.chat-qr-card__image {
  width: 96px;
  height: 96px;
  border-radius: 12px;
  background: #fff;
  object-fit: cover;
  padding: 6px;
}

.chat-qr-card__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.chat-qr-card__meta strong,
.chat-qr-card__meta span,
.chat-qr-card__meta small {
  color: inherit;
}

.chat-bubble__time {
  font-size: 10px;
  color: #7f8ba3;
  margin-top: 5px;
}

.chat-error {
  align-self: stretch;
  padding: 9px 12px;
  border-radius: 12px;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  color: #b91c1c;
  font-size: 12px;
  font-weight: 700;
}

.chat-input {
  display: grid;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 8px 10px calc(10px + env(safe-area-inset-bottom, 0px));
  background: #fff;
  border-top: 1px solid #dce5f1;
  box-shadow: 0 -8px 18px rgba(12, 23, 45, 0.08);
  position: relative;
  z-index: 6;
}

.chat-input__preview {
  position: relative;
  flex: 0 0 100%;
  width: 100%;
  padding: 2px 0 4px;
}

.chat-input__preview--file {
  padding: 0 0 2px;
}

.chat-input__preview-file {
  width: min(100%, 320px);
  padding: 10px 12px;
  border: 1px solid #d9e4f2;
  border-radius: 12px;
  background: #f7fbff;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chat-input__preview-file strong {
  font-size: 13px;
  color: #113054;
  word-break: break-word;
}

.chat-input__preview-file span {
  font-size: 11px;
  color: #547097;
  font-weight: 700;
}

.chat-input__preview-image {
  display: block;
  width: 92px;
  height: 92px;
  border-radius: 16px;
  object-fit: cover;
  border: 1px solid #e2e6ef;
  box-shadow: 0 8px 18px rgba(22, 30, 50, 0.08);
}

.chat-input__preview-remove {
  position: absolute;
  top: 2px;
  left: 84px;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 999px;
  background: rgba(0, 20, 52, 0.9);
  color: #fff;
  font-size: 20px;
  line-height: 1;
}

.chat-input__helper {
  font-size: 12px;
  color: #344767;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-input__bar {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.chat-input__field {
  flex: 1 1 0;
  width: 100%;
  min-width: 0;
  min-height: 44px;
  max-height: 120px;
  padding: 10px 14px;
  border: 1px solid #d4ddeb;
  border-radius: 18px;
  background: #fff;
  font-size: 14px;
  color: #1f2f48;
  resize: none;
  line-height: 1.45;
  font-family: inherit;
}

.chat-input__field:focus {
  border-color: #4977c2;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(73, 119, 194, 0.12);
}

.chat-input__icons {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.chat-input__attach-wrap {
  position: relative;
}

.chat-input__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid #cfe0f6;
  border-radius: 999px;
  background: #f7fbff;
  color: #16406f;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.chat-input__icon--send {
  min-width: 76px;
  margin-left: auto;
  border-color: #0f7bef;
  background: linear-gradient(135deg, #198dff, #0f6ed6);
  color: #fff;
  box-shadow: 0 8px 18px rgba(15, 110, 214, 0.22);
}

.chat-input__icon--send:disabled {
  opacity: 0.45;
}

.chat-input__attach-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  min-width: 176px;
  max-width: calc(100vw - 24px);
  display: grid;
  gap: 6px;
  padding: 8px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid #dce5f1;
  box-shadow: 0 14px 32px rgba(17, 24, 39, 0.14);
  z-index: 20;
}

.chat-input__attach-menu-item {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid #e1e8f4;
  border-radius: 10px;
  background: #f8fbff;
  color: #23406c;
  font-size: 13px;
  font-weight: 700;
  text-align: left;
}

.chat-input__file {
  display: none;
}

.chat-input__attach-group {
  display: none;
}

.chat-input__attach {
  display: none;
}

.chat-input__attach:disabled {
  opacity: 1;
}

.chat-bubble__image {
  display: block;
  max-width: min(240px, 100%);
  max-height: 240px;
  border-radius: 14px;
  object-fit: cover;
}

.chat-bubble__image-btn {
  display: block;
  max-width: 100%;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  cursor: zoom-in;
}

.chat-bubble__image-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.chat-bubble__file-card {
  display: grid;
  gap: 7px;
  width: min(100%, 280px);
  padding: 9px 10px;
  border-radius: 12px;
  border: 1px solid rgba(29, 67, 115, 0.22);
  background: rgba(255, 255, 255, 0.84);
}

.chat-bubble__file-name {
  font-size: 13px;
  line-height: 1.35;
  color: #16385f;
  overflow-wrap: anywhere;
}

.chat-bubble__file-size {
  font-size: 11px;
  color: #4f6785;
  font-weight: 700;
}

.chat-bubble__file-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chat-bubble--user .chat-bubble__file-card {
  border-color: rgba(255, 255, 255, 0.32);
  background: rgba(255, 255, 255, 0.12);
}

.chat-bubble--user .chat-bubble__file-name,
.chat-bubble--user .chat-bubble__file-size {
  color: #fff;
}

.chat-bubble__image-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(0, 34, 80, 0.14);
  background: rgba(255, 255, 255, 0.86);
  color: #21406b;
  font-size: 11px;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}

.chat-bubble--user .chat-bubble__image-link {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.26);
  color: #fff;
}

.chat-bubble--admin .chat-bubble__image-link {
  background: rgba(255, 255, 255, 0.86);
  border-color: rgba(0, 34, 80, 0.14);
  color: #21406b;
}

.chat-image-viewer {
  position: fixed;
  inset: 0;
  z-index: 10020;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(4, 10, 21, 0.82);
  overflow-y: auto;
}

.chat-image-viewer__dialog {
  position: relative;
  width: min(100%, 920px);
  max-height: calc(100dvh - 40px);
  padding: 18px;
  border-radius: 22px;
  background: #ffffff;
  box-shadow: 0 26px 70px rgba(0, 0, 0, 0.35);
}

.chat-image-viewer__close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 999px;
  background: rgba(9, 20, 40, 0.9);
  color: #fff;
  font-size: 24px;
  cursor: pointer;
}

.chat-image-viewer__image {
  display: block;
  width: 100%;
  max-height: calc(100dvh - 140px);
  object-fit: contain;
  border-radius: 16px;
  background: #f5f8ff;
}

.chat-image-viewer__actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 14px;
}

.chat-image-viewer__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 140px;
  padding: 10px 14px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #1f6dff, #0c47b7);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}

.chat-image-viewer__btn--link {
  background: linear-gradient(135deg, #f1c95d, #d99b1c);
  color: #1f2840;
}

.chat-image-viewer__feedback {
  margin: 10px 0 0;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: #24529a;
}

@media (max-width: 768px) {
  .chat-page {
    width: 100%;
    max-width: none;
    height: calc(100dvh - var(--member-header-height, 58px) - var(--member-nav-height, 86px));
    overflow-x: hidden;
  }

  .chat-header {
    padding: 10px 8px 8px;
  }

  .chat-messages {
    padding: 10px 8px 14px;
    overflow-x: hidden;
  }

  .chat-bubble {
    max-width: calc(100% - 14px);
  }

  .chat-bubble--user {
    align-self: flex-end;
  }

  .chat-bubble--bot {
    align-self: flex-start;
  }

  .chat-bubble__content {
    max-width: 100%;
  }

  .chat-bubble__image {
    max-width: min(220px, 100%);
    height: auto;
  }

  .chat-qr-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .chat-input__bar {
    display: grid;
    gap: 8px;
  }

  .chat-input__icons {
    position: static;
    right: auto;
    bottom: auto;
    z-index: auto;
    display: flex;
    width: 100%;
    gap: 6px;
  }

  .chat-input {
    padding: 8px 8px calc(12px + env(safe-area-inset-bottom, 0px));
    overflow: visible;
  }

  .chat-input__helper {
    font-size: 11px;
  }

  .chat-input__field {
    min-height: 52px;
    padding: 10px 12px;
    font-size: 13px;
  }

  .chat-input__icon {
    min-width: 54px;
    height: 36px;
    padding: 0 10px;
    font-size: 12px;
  }

  .chat-input__icon--send {
    min-width: 68px;
    margin-left: 0;
  }

  .chat-input__attach-wrap {
    position: static;
  }

  .chat-input__attach-menu {
    left: 8px;
    right: 8px;
    min-width: 164px;
    width: auto;
    max-width: none;
  }

  .chat-image-viewer {
    padding: 12px;
  }

  .chat-image-viewer__dialog {
    max-height: calc(100dvh - 24px);
    padding: 14px;
  }

  .chat-image-viewer__actions {
    flex-wrap: wrap;
  }
}

/* Mobile readability guard: prevent chat bubbles from collapsing into thin lines. */
.chat-messages {
  gap: 12px;
}

.chat-agent-line {
  font-size: 12px;
  font-weight: 800;
  color: #334155;
}

.chat-bubble {
  max-width: min(86%, calc(100% - 18px));
  overflow: visible;
}

.chat-bubble__name {
  font-size: 12px;
  line-height: 1.3;
  color: #52627a;
}

.chat-bubble__content {
  display: block;
  min-width: 96px;
  min-height: 38px;
  padding: 11px 13px;
  overflow: visible;
  font-size: 15px;
  line-height: 1.55;
}

.chat-bubble__text {
  display: block;
  min-height: 1.45em;
  margin: 0;
  color: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
  letter-spacing: normal;
  text-shadow: none;
}

.chat-bubble--admin .chat-bubble__content,
.chat-bubble--bot .chat-bubble__content {
  background: #e7f0fb;
  color: #0f172a;
  border-color: #cbdceb;
}

.chat-bubble--user .chat-bubble__content {
  background: linear-gradient(135deg, #198dff, #0868d8);
  color: #ffffff;
}

.chat-bubble--system .chat-bubble__content {
  min-width: 140px;
  min-height: 32px;
  padding: 8px 12px;
  background: #eef5ff;
  color: #16365f;
}

.chat-bubble__time {
  font-size: 11px;
  line-height: 1.2;
}

.chat-vip-card {
  position: relative;
  overflow: hidden;
  width: min(100%, 312px);
  margin-top: 10px;
  padding: 12px;
  border-radius: 18px;
  background:
    radial-gradient(circle at 14% 0%, rgba(255, 214, 102, 0.22), transparent 30%),
    linear-gradient(180deg, #121b2c 0%, #07101d 100%);
  color: #ffe28a;
  border: 1px solid rgba(245, 198, 89, 0.52);
  box-shadow:
    0 12px 26px rgba(0, 0, 0, 0.24),
    inset 0 0 28px rgba(245, 198, 89, 0.08);
  text-align: left;
}

.chat-vip-card__crest {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 6px;
  color: #ffd96a;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.chat-vip-card h3 {
  margin: 0;
  color: #ffe28a;
  font-size: 14px;
  line-height: 1.25;
  font-weight: 900;
  text-align: center;
  text-transform: uppercase;
  text-shadow: 0 2px 10px rgba(255, 210, 89, 0.28);
}

.chat-vip-card p {
  margin: 4px 0 8px;
  color: rgba(255, 246, 201, 0.78);
  font-size: 10px;
  line-height: 1.35;
  text-align: center;
}

.chat-vip-card__table-wrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid rgba(245, 198, 89, 0.36);
  border-radius: 10px;
  background: rgba(7, 16, 29, 0.78);
  -webkit-overflow-scrolling: touch;
}

.chat-vip-card table {
  width: 100%;
  min-width: 248px;
  border-collapse: collapse;
  background: transparent;
  color: #ffe28a;
}

.chat-vip-card th {
  padding: 7px 5px;
  background: linear-gradient(180deg, rgba(123, 76, 18, 0.96), rgba(65, 39, 13, 0.98));
  color: #ffe36c;
  font-size: 8px;
  font-weight: 900;
  text-align: center;
  white-space: nowrap;
  text-shadow: 0 1px 5px rgba(0, 0, 0, 0.5);
}

.chat-vip-card td {
  padding: 7px 5px;
  border-top: 1px solid rgba(245, 198, 89, 0.24);
  border-right: 1px solid rgba(245, 198, 89, 0.18);
  color: #ffd95d;
  font-size: 9px;
  font-weight: 950;
  text-align: center;
  white-space: nowrap;
  background: rgba(7, 16, 29, 0.72);
  text-shadow: 0 1px 6px rgba(255, 214, 102, 0.2);
}

.chat-vip-card td:nth-child(2) {
  color: #fff1a8;
}

@media (max-width: 480px) {
  .chat-page {
    height: calc(100dvh - var(--member-header-height, 58px) - var(--member-nav-height, 86px));
  }

  .chat-messages {
    padding: 12px 10px 16px;
  }

  .chat-bubble {
    max-width: min(88%, calc(100% - 12px));
  }

  .chat-bubble__content {
    min-width: 112px;
    padding: 12px 13px;
    font-size: 15px;
  }

  .chat-vip-card {
    width: min(100%, 286px);
  }
}
</style>
