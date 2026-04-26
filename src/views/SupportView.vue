<template>
  <section class="chat-page">
    <!-- Chat header -->
    <div class="chat-header">
      <div class="chat-header__avatar">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#ff6b35"/>
          <path d="M7 8h10M7 12h6M7 16h8" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="chat-header__info">
        <strong>The Venetian®</strong>
        <span>Hỗ trợ trực tuyến</span>
      </div>
    </div>

    <!-- Chat messages -->
    <div class="chat-messages" ref="messagesRef">
      <!-- System welcome -->
      <div class="chat-bubble chat-bubble--bot">
        <div class="chat-bubble__content">
          <p>Xin chào! Chào mừng bạn đến với <strong>The Venetian® Macau Casino</strong>. Nhân viên hỗ trợ sẵn sàng giúp bạn 24/7.</p>
        </div>
      </div>

      <div v-if="loading" class="chat-loading">Đang tải tin nhắn...</div>

      <div
        v-for="msg in messages"
        :key="msg._id"
        class="chat-bubble"
        :class="msg.senderId === userId ? 'chat-bubble--user' : 'chat-bubble--bot'"
      >
        <span v-if="msg.senderId !== userId" class="chat-bubble__name">{{ msg.senderRole === 'admin' ? 'Chăm sóc khách hàng' : msg.senderName }}</span>
        <div class="chat-bubble__content">
          <template v-if="msg.messageType === 'image' && msg.imageUrl">
            <img class="chat-bubble__image" :src="resolveImageSrc(msg.imageUrl)" alt="Ảnh" />
          </template>
          <p v-else>{{ msg.content }}</p>
        </div>
        <span class="chat-bubble__time">{{ fmtTime(msg.createdAt) }}</span>
      </div>
    </div>

  <!-- Chat input -->
  <div class="chat-input">
    <input
      ref="fileRef"
      class="chat-input__file"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      @change="onPickImage"
    />
    <button class="chat-input__attach" type="button" :disabled="sendingImage || !userStore.isLoggedIn" @click="pickImage">
      Ảnh
    </button>
    <input
      v-model.trim="chatInput"
      type="text"
      class="chat-input__field"
      placeholder="Nhập tin nhắn..."
      @keyup.enter="sendMessage"
    />
      <button class="chat-input__send" type="button" :disabled="sending" @click="sendMessage">
        Gửi
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { apiFetch, API_BASE_URL } from '@/lib/api'
import { useUserStore } from '@/stores/user'
import { useSocketStore } from '@/stores/socket'

const userStore = useUserStore()
const socketStore = useSocketStore()

const messagesRef = ref(null)
const fileRef = ref(null)
const chatInput = ref('')
const messages = ref([])
const loading = ref(false)
const sending = ref(false)
const sendingImage = ref(false)

const userId = computed(() => userStore.user?._id || null)
const roomId = computed(() => (userId.value ? `support:${userId.value}` : ''))

function fmtTime(v) {
  if (!v) return ''
  const d = new Date(v)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

async function loadMessages() {
  if (!userStore.isLoggedIn) return
  loading.value = true
  try {
    const data = await apiFetch(`/api/account/chat/${encodeURIComponent(roomId.value)}`, { headers: userStore.authHeaders })
    messages.value = data.items || []
  } catch {
    // API might not exist for user — ignore
    messages.value = []
  } finally {
    loading.value = false
    await nextTick()
    scrollToBottom()
  }
}

function sendMessage() {
  const text = chatInput.value.trim()
  if (!text || !userStore.isLoggedIn || sending.value) return

  sending.value = true
  const socket = socketStore.connect()

  socket.emit('send_chat_message', {
    roomId: roomId.value,
    content: text,
    token: userStore.token,
    messageType: 'text'
  }, () => {
    sending.value = false
  })

  chatInput.value = ''
}

function onChatMessage(msg) {
  if (msg.roomId !== roomId.value) return
  // Avoid duplicates
  if (messages.value.some(m => m._id === msg._id)) return
  messages.value.push(msg)
  nextTick(scrollToBottom)
}

function resolveImageSrc(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `${String(API_BASE_URL || '').replace(/\\/+$/, '')}${raw.startsWith('/') ? raw : `/${raw}`}`
}

function pickImage() {
  if (!fileRef.value) return
  fileRef.value.value = ''
  fileRef.value.click()
}

async function onPickImage(e) {
  const file = e?.target?.files?.[0]
  if (!file || sendingImage.value || !userStore.isLoggedIn) return

  sendingImage.value = true
  try {
    const form = new FormData()
    form.append('image', file)

    const res = await fetch(`${String(API_BASE_URL || '').replace(/\\/+$/, '')}/api/account/chat/upload-image`, {
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
    const imageUrl = String(data?.imageUrl || '').trim()
    if (!imageUrl) throw new Error('Upload ảnh thất bại')

    const socket = socketStore.connect()
    socket.emit('send_chat_message', {
      roomId: roomId.value,
      content: '',
      imageUrl,
      token: userStore.token,
      messageType: 'image'
    }, () => {
      sendingImage.value = false
    })
  } catch {
    sendingImage.value = false
  }
}

onMounted(async () => {
  await loadMessages()

  if (userStore.isLoggedIn) {
    const socket = socketStore.connect()
    socket.emit('join_chat', { roomId: roomId.value, token: userStore.token })
    socket.on('chat_message', onChatMessage)
  }
})

onBeforeUnmount(() => {
  const socket = socketStore.socket
  if (socket) {
    socket.emit('leave_chat', { roomId: roomId.value })
    socket.off('chat_message', onChatMessage)
  }
})
</script>

<style scoped>
/* TỔNG THỂ KHUNG CHAT */
.chat-page {
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - 152px);
  background: #f8f9fa; /* Nền sáng sang trọng */
  color: #333;
  font-family: 'Inter', sans-serif;
}

/* HEADER: Navy & Gold chuẩn Venetian */
.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 16px;
  background: linear-gradient(135deg, #001a33 0%, #003366 100%);
  border-bottom: 1.5px solid #d4af37; /* Viền Gold mảnh */
}

.chat-header__avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #d4af37; /* Màu vàng kim loại */
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
}

.chat-header__info strong {
  display: block;
  font-size: 16px;
  color: #d4af37; /* Chữ Gold */
  letter-spacing: 1px;
  text-transform: uppercase;
}

.chat-header__info span {
  font-size: 11px;
  color: #ffffff;
  opacity: 0.8;
  letter-spacing: 0.5px;
}

/* NỘI DUNG TIN NHẮN */
.chat-messages {
  flex: 1;
  padding: 20px 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
  background: #ffffff;
}

.chat-bubble {
  display: flex;
  flex-direction: column;
  max-width: 80%;
}

.chat-bubble--bot { align-self: flex-start; }
.chat-bubble--user { align-self: flex-end; }

.chat-bubble__name {
  font-size: 11px;
  color: #d4af37; /* Tên bot màu Gold */
  margin-bottom: 4px;
  font-weight: 600;
}

.chat-bubble__content {
  padding: 12px 16px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.6;
  box-shadow: 0 4px 15px rgba(0,0,0,0.04);
}

/* Bubble Bot: Trắng tinh tế */
.chat-bubble--bot .chat-bubble__content {
  background: #f1f3f5;
  color: #2c3e50;
  border-bottom-left-radius: 4px;
  border: 1px solid #e9ecef;
}

/* Bubble User: Navy sang trọng */
.chat-bubble--user .chat-bubble__content {
  background: linear-gradient(135deg, #001f3f, #003366);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.chat-bubble__time {
  font-size: 10px;
  color: #adb5bd;
  margin-top: 5px;
}

/* INPUT AREA: Sạch sẽ & Tinh xảo */
.chat-input {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px 12px;
  background: #ffffff;
  border-top: 1px solid #f1f3f5;
  position: sticky;
  bottom: calc(78px + env(safe-area-inset-bottom, 0px));
}

.chat-input__field {
  flex: 1;
  height: 44px;
  padding: 0 18px;
  border: 1px solid #dee2e6;
  border-radius: 25px;
  background: #f8f9fa;
  font-size: 14px;
  transition: all 0.3s ease;
}

.chat-input__field:focus {
  border-color: #d4af37;
  background: #fff;
  box-shadow: 0 0 8px rgba(212, 175, 55, 0.2);
}

.chat-input__send {
  padding: 0 22px;
  height: 40px;
  border: none;
  border-radius: 20px;
  background: linear-gradient(135deg, #d4af37, #b8860b); /* Nút gửi màu Gold */
  color: #001f3f;
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(184, 134, 11, 0.3);
}

.chat-input__send:disabled {
  opacity: 0.4;
  background: #ced4da;
}

.chat-input__file {
  display: none;
}

.chat-input__attach {
  flex: 0 0 auto;
  height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(0,0,0,0.08);
  background: #f1f3f5;
  border-radius: 20px;
  font-weight: 800;
  color: #1a1a2e;
  cursor: pointer;
}

.chat-input__attach:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat-bubble__image {
  display: block;
  max-width: 240px;
  max-height: 240px;
  border-radius: 14px;
  object-fit: cover;
}
</style>
