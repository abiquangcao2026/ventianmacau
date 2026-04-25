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
        <strong>The Venetian</strong>
        <span>Hỗ trợ</span>
      </div>
    </div>

    <!-- Chat messages -->
    <div class="chat-messages" ref="messagesRef">
      <div class="chat-date">
        <span>Hôm nay</span>
      </div>

      <!-- Welcome message -->
      <div class="chat-bubble chat-bubble--bot">
        <div class="chat-bubble__content">
          <p>Xin chào! Chào mừng bạn đến với The Venetian Casino. Chúng tôi hỗ trợ bạn 24/7.</p>
        </div>
        <span class="chat-bubble__time">{{ currentTime }}</span>
      </div>

      <!-- Promo image -->
      <div class="chat-bubble chat-bubble--bot">
        <div class="chat-bubble__content chat-bubble__content--image">
          <img src="/img/slide6.73e796c.jpg" alt="Casino" />
        </div>
      </div>

      <!-- VIP info -->
      <div class="chat-bubble chat-bubble--bot">
        <div class="chat-bubble__content">
          <p><strong>Nâng cấp đặc quyền VIP</strong></p>
          <p>Bảng tích lũy thưởng nạp khi nâng cấp VIP:</p>
          <div class="vip-table">
            <div class="vip-row vip-row--header">
              <span>Tích lũy</span>
              <span>Cấp</span>
              <span>Thưởng</span>
              <span>Hạn mức</span>
            </div>
            <div class="vip-row">
              <span>2.000</span><span>VIP 1</span><span>100$</span><span>5.000$</span>
            </div>
            <div class="vip-row">
              <span>5.000</span><span>VIP 2</span><span>200$</span><span>10.000$</span>
            </div>
            <div class="vip-row">
              <span>10.000</span><span>VIP 3</span><span>500$</span><span>30.000$</span>
            </div>
            <div class="vip-row">
              <span>50.000</span><span>VIP 4</span><span>1.000$</span><span>80.000$</span>
            </div>
            <div class="vip-row">
              <span>100.000</span><span>VIP 5</span><span>3.000$</span><span>200.000$</span>
            </div>
            <div class="vip-row">
              <span>200.000</span><span>VIP 6</span><span>5.000$</span><span>400.000$</span>
            </div>
            <div class="vip-row">
              <span>500.000</span><span>VIP 7</span><span>20.000$</span><span>1.000.000$</span>
            </div>
          </div>
        </div>
      </div>

      <!-- User messages -->
      <div v-for="msg in userMessages" :key="msg.id" class="chat-bubble" :class="msg.isBot ? 'chat-bubble--bot' : 'chat-bubble--user'">
        <div class="chat-bubble__content">
          <p>{{ msg.text }}</p>
        </div>
        <span class="chat-bubble__time">{{ msg.time }}</span>
      </div>
    </div>

    <!-- Chat input -->
    <div class="chat-input">
      <button class="chat-input__btn" type="button">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="3" y="3" width="18" height="18" rx="4"/>
          <circle cx="8" cy="10" r="1.5" fill="currentColor"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      </button>
      <button class="chat-input__btn" type="button">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M14 9V5a3 3 0 00-6 0v4"/>
          <path d="M5 9h14l-1 10H6L5 9z"/>
          <circle cx="9" cy="14" r="1" fill="currentColor"/>
          <circle cx="15" cy="14" r="1" fill="currentColor"/>
        </svg>
      </button>
      <input
        v-model.trim="chatInput"
        type="text"
        class="chat-input__field"
        placeholder="Vui lòng nhập"
        @keyup.enter="sendMessage"
      />
      <button class="chat-input__send" type="button" @click="sendMessage">
        Gửi đi
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'

const messagesRef = ref(null)
const chatInput = ref('')
const userMessages = ref([])

const currentTime = computed(() => {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
})

function getTimeNow() {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
}

let msgId = 0

async function sendMessage() {
  const text = chatInput.value.trim()
  if (!text) return

  userMessages.value.push({
    id: ++msgId,
    text,
    isBot: false,
    time: getTimeNow()
  })

  chatInput.value = ''

  await nextTick()
  scrollToBottom()

  // Auto-reply after a short delay
  setTimeout(async () => {
    userMessages.value.push({
      id: ++msgId,
      text: 'Cảm ơn bạn đã liên hệ. Nhân viên CSKH sẽ hỗ trợ bạn trong thời gian sớm nhất!',
      isBot: true,
      time: getTimeNow()
    })
    await nextTick()
    scrollToBottom()
  }, 800)
}

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

onMounted(scrollToBottom)
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 152px);
  background: #f5f5f5;
  color: #333;
}

/* Header */
.chat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
}

.chat-header__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #fff3ee;
  flex-shrink: 0;
}

.chat-header__info {
  display: flex;
  flex-direction: column;
}

.chat-header__info strong {
  font-size: 15px;
  color: #1a1a2e;
}

.chat-header__info span {
  font-size: 12px;
  color: #999;
}

/* Messages */
.chat-messages {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-date {
  text-align: center;
  padding: 8px 0;
}

.chat-date span {
  font-size: 12px;
  color: #999;
  background: #eee;
  padding: 4px 14px;
  border-radius: 12px;
}

/* Bubble */
.chat-bubble {
  display: flex;
  flex-direction: column;
  max-width: 85%;
}

.chat-bubble--bot {
  align-self: flex-start;
}

.chat-bubble--user {
  align-self: flex-end;
}

.chat-bubble__content {
  padding: 12px 14px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.5;
}

.chat-bubble--bot .chat-bubble__content {
  background: #fff;
  color: #333;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.chat-bubble--user .chat-bubble__content {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.chat-bubble__content p {
  margin: 0;
}

.chat-bubble__content p + p {
  margin-top: 6px;
}

.chat-bubble__content--image {
  padding: 4px;
  overflow: hidden;
}

.chat-bubble__content--image img {
  width: 100%;
  max-width: 300px;
  border-radius: 12px;
  display: block;
}

.chat-bubble__time {
  font-size: 11px;
  color: #aaa;
  margin-top: 4px;
  padding: 0 4px;
}

.chat-bubble--user .chat-bubble__time {
  text-align: right;
}

/* VIP table */
.vip-table {
  margin-top: 10px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #eee;
}

.vip-row {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr 0.8fr 1fr;
  gap: 0;
}

.vip-row span {
  padding: 8px 6px;
  font-size: 11px;
  border-bottom: 1px solid #f0f0f0;
  text-align: center;
}

.vip-row--header {
  background: #f8f0dd;
}

.vip-row--header span {
  font-weight: 700;
  font-size: 10px;
  color: #8b6914;
  text-transform: uppercase;
}

/* Input */
.chat-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #fff;
  border-top: 1px solid #e8e8e8;
}

.chat-input__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  flex-shrink: 0;
}

.chat-input__field {
  flex: 1;
  height: 38px;
  padding: 0 14px;
  border: 1px solid #e0e0e0;
  border-radius: 19px;
  background: #f8f8f8;
  color: #333;
  font-size: 14px;
  outline: none;
}

.chat-input__field::placeholder {
  color: #bbb;
}

.chat-input__send {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  color: #333;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.chat-input__send:active {
  background: #f0f0f0;
}
</style>
