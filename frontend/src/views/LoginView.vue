<template>
  <section class="member-auth">
    <transition name="auth-toast">
      <div v-if="notice.visible" class="auth-toast" :class="`auth-toast--${notice.type}`">
        <strong>{{ notice.title }}</strong>
        <span>{{ notice.message }}</span>
      </div>
    </transition>

    <div class="member-auth__frame">
      <div class="member-auth__panel">
        <img class="member-auth__logo" alt="The Venetian" src="/img/the-venetian-wordmark.svg" />
        <h1>ĐĂNG NHẬP</h1>

        <form class="member-auth__form" @submit.prevent="submit">
          <input v-model.trim="form.username" type="text" placeholder="Tên đăng nhập" />

          <div class="member-auth__password">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Mật khẩu"
            />
            <button type="button" @click="showPassword = !showPassword">
              {{ showPassword ? 'Ẩn' : 'Hiện' }}
            </button>
          </div>

          <button :disabled="submitting" class="member-auth__submit" type="submit">
            {{ submitting ? 'Đang đăng nhập' : 'Đăng nhập' }}
          </button>
        </form>

        <RouterLink class="member-auth__link" to="/signup">
          Chưa có tài khoản? <strong>Đăng ký</strong>
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const form = reactive({
  username: '',
  password: ''
})
const showPassword = ref(false)
const submitting = ref(false)
const notice = reactive({
  visible: false,
  type: 'success',
  title: '',
  message: ''
})
let noticeTimer = null

function showNotice(type, title, message) {
  notice.visible = true
  notice.type = type
  notice.title = title
  notice.message = message
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.visible = false
  }, 2600)
}

function normalizeLoginError(error) {
  const raw = String(error?.message || '').trim()
  const cleaned = raw.replace(/^HTTP\s+\d+\s*:?\s*/i, '').trim()

  if (!cleaned) return 'Không thể đăng nhập. Vui lòng thử lại.'
  if (/sai thong tin dang nhap|sai thông tin đăng nhập|invalid credentials/i.test(cleaned)) {
    return 'Sai tài khoản hoặc mật khẩu. Vui lòng kiểm tra lại.'
  }
  if (/khong co quyen|không có quyền/i.test(cleaned)) {
    return 'Tài khoản này không có quyền truy cập khu vực này.'
  }
  if (/không kết nối được backend|network|failed to fetch/i.test(cleaned.toLowerCase())) {
    return 'Không kết nối được máy chủ. Vui lòng thử lại sau ít phút.'
  }

  return cleaned
}

async function submit() {
  if (!form.username || !form.password) {
    showNotice('error', 'Chưa thể đăng nhập', 'Vui lòng nhập đầy đủ tài khoản và mật khẩu.')
    return
  }

  submitting.value = true

  try {
    const user = await userStore.login(form)
    showNotice('success', 'Đăng nhập thành công', 'Đang chuyển bạn vào sảnh trò chơi.')
    await new Promise((resolve) => setTimeout(resolve, 420))
    const redirect =
      typeof route.query.redirect === 'string'
        ? route.query.redirect
        : user.role === 'admin'
          ? '/admin'
          : '/'
    await router.push(redirect)
  } catch (error) {
    showNotice('error', 'Đăng nhập không thành công', normalizeLoginError(error))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.member-auth {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 0 16px;
  background: #ffffff;
}

.auth-toast {
  position: fixed;
  left: 50%;
  top: 24px;
  z-index: 40;
  width: min(420px, calc(100vw - 32px));
  transform: translateX(-50%);
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.24);
  box-shadow: 0 18px 42px rgba(8, 16, 36, 0.26);
  backdrop-filter: blur(12px);
}

.auth-toast strong {
  font-size: 14px;
  letter-spacing: 0.02em;
}

.auth-toast span {
  font-size: 13px;
  line-height: 1.45;
}

.auth-toast--success {
  background: linear-gradient(180deg, rgba(19, 114, 84, 0.96), rgba(13, 88, 65, 0.96));
  color: #effff6;
}

.auth-toast--error {
  background: linear-gradient(180deg, rgba(126, 26, 43, 0.96), rgba(92, 18, 31, 0.96));
  color: #fff4f4;
}

.member-auth__frame {
  width: 100%;
  max-width: 520px;
  min-height: 100vh;
  display: grid;
  align-items: center;
  padding: 24px 22px 56px;
  background: linear-gradient(180deg, #eef1f5 0%, #8393ae 44%, #2e4a79 100%);
}

.member-auth__panel {
  margin: 0 auto;
  width: 100%;
  max-width: 470px;
  padding-top: 24px;
}

.member-auth__logo {
  width: 170px;
  margin: 0 auto 28px;
}

.member-auth__panel h1 {
  margin: 0 0 22px;
  text-align: center;
  font-size: 28px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.06em;
}

.member-auth__form {
  display: grid;
  gap: 16px;
}

.member-auth__form input {
  width: 100%;
  height: 60px;
  padding: 0 18px;
  border: none;
  border-radius: 18px;
  background: #ffffff;
  color: #2b3b55;
  font-size: 15px;
  outline: none;
}

.member-auth__form input::placeholder {
  color: #b0b5bf;
}

.member-auth__password {
  position: relative;
}

.member-auth__password button {
  position: absolute;
  top: 50%;
  right: 16px;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: #7a8191;
  font-size: 12px;
  font-weight: 700;
}

.member-auth__submit {
  margin-top: 30px;
  height: 56px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(180deg, #2d88d7, #0a8fc2);
  color: #ffffff;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.member-auth__link {
  display: block;
  margin-top: 48px;
  text-align: center;
  color: #ffffff;
  font-size: 16px;
  text-decoration: none;
}

.member-auth__link strong {
  font-weight: 800;
}

@media (max-width: 520px) {
  .member-auth {
    padding: 0;
  }

  .member-auth__frame {
    max-width: 100%;
    padding-left: 22px;
    padding-right: 22px;
  }
}

.auth-toast-enter-active,
.auth-toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.auth-toast-enter-from,
.auth-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}
</style>
