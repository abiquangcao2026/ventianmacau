<template>
  <section class="admin-login">
    <transition name="admin-toast">
      <div v-if="notice.visible" class="admin-toast" :class="`admin-toast--${notice.type}`">
        <strong>{{ notice.title }}</strong>
        <span>{{ notice.message }}</span>
      </div>
    </transition>

    <div class="admin-login__backdrop"></div>

    <div class="admin-login__wrapper">
      <div class="admin-login__brand">
        <img src="/img/the-venetian-wordmark.svg" alt="The Venetian® Macau" class="admin-login__logo" />
        <p class="admin-login__tagline">Hệ thống quản trị</p>
        <span class="admin-login__domain">admin.casinovenetianmacau.com</span>
      </div>

      <form class="admin-login__card" @submit.prevent="submit">
        <h2 class="admin-login__title">Đăng nhập Admin</h2>

        <div class="admin-login__field">
          <label>Tài khoản</label>
          <input v-model.trim="form.username" type="text" placeholder="Nhập username" />
        </div>

        <div class="admin-login__field">
          <label>Mật khẩu</label>
          <div class="admin-login__pw-wrap">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Nhập mật khẩu"
            />
            <button type="button" class="admin-login__pw-toggle" @click="showPassword = !showPassword">
              {{ showPassword ? 'Ẩn' : 'Hiện' }}
            </button>
          </div>
        </div>

        <button :disabled="submitting" class="admin-login__submit" type="submit">
          {{ submitting ? 'Đang đăng nhập...' : 'Đăng nhập' }}
        </button>
      </form>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const form = reactive({ username: '', password: '' })
const submitting = ref(false)
const showPassword = ref(false)
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

  if (!cleaned) return 'Không thể đăng nhập quản trị. Vui lòng thử lại.'
  if (/không có quyền quản trị|khong co quyen quan tri/i.test(cleaned)) {
    return 'Tài khoản này không có quyền quản trị.'
  }
  if (/sai thong tin dang nhap|sai thông tin đăng nhập|invalid credentials/i.test(cleaned)) {
    return 'Sai tài khoản hoặc mật khẩu quản trị.'
  }
  if (/không kết nối được backend|network|failed to fetch/i.test(cleaned.toLowerCase())) {
    return 'Không kết nối được máy chủ quản trị. Vui lòng thử lại sau.'
  }

  return cleaned
}

async function submit() {
  if (!form.username || !form.password) {
    showNotice('error', 'Chưa thể đăng nhập', 'Vui lòng nhập đầy đủ tài khoản và mật khẩu quản trị.')
    return
  }

  submitting.value = true

  try {
    const user = await userStore.login(form)
    if (user.role !== 'admin') {
      userStore.logout()
      throw new Error('Tài khoản này không có quyền quản trị')
    }

    showNotice('success', 'Đăng nhập thành công', 'Đang chuyển bạn vào hệ thống quản trị.')
    await new Promise((resolve) => setTimeout(resolve, 420))
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/admin'
    await router.push(redirect)
  } catch (error) {
    showNotice('error', 'Đăng nhập không thành công', normalizeLoginError(error))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.admin-login {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  overflow: hidden;
  font-family: 'Lexend Deca', Roboto, Arial, sans-serif;
  background:
    linear-gradient(180deg, rgba(35, 26, 56, 0.18), rgba(25, 20, 46, 0.38)),
    radial-gradient(circle at 70% 18%, rgba(255, 94, 142, 0.75), transparent 12%),
    radial-gradient(circle at 20% 22%, rgba(245, 179, 70, 0.55), transparent 18%),
    url('/img/macau-skyline-by-night.jpg') center center / cover no-repeat;
}

.admin-toast {
  position: fixed;
  left: 50%;
  top: 24px;
  z-index: 4;
  width: min(420px, calc(100vw - 32px));
  transform: translateX(-50%);
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.24);
  box-shadow: 0 18px 42px rgba(8, 16, 36, 0.28);
  backdrop-filter: blur(12px);
}

.admin-toast strong {
  font-size: 14px;
}

.admin-toast span {
  font-size: 13px;
  line-height: 1.45;
}

.admin-toast--success {
  background: linear-gradient(180deg, rgba(19, 114, 84, 0.96), rgba(13, 88, 65, 0.96));
  color: #effff6;
}

.admin-toast--error {
  background: linear-gradient(180deg, rgba(126, 26, 43, 0.96), rgba(92, 18, 31, 0.96));
  color: #fff4f4;
}

.admin-login__backdrop {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(10, 15, 35, 0.5), rgba(8, 12, 30, 0.85) 100%);
}

.admin-login__wrapper {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 380px;
  padding: 0 20px;
}

.admin-login__brand {
  text-align: center;
  margin-bottom: 28px;
}

.admin-login__logo {
  width: 180px;
  margin: 0 auto 12px;
  filter: brightness(1.15);
}

.admin-login__tagline {
  margin: 0;
  font-size: 14px;
  color: rgba(255,255,255,0.6);
  font-weight: 500;
}

.admin-login__domain {
  display: inline-block;
  margin-top: 8px;
  padding: 4px 12px;
  border-radius: 6px;
  background: rgba(255,255,255,0.08);
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  letter-spacing: 0.02em;
}

.admin-login__card {
  padding: 28px 24px;
  border-radius: 16px;
  background: rgba(255,255,255,0.97);
  box-shadow: 0 20px 50px rgba(0,0,0,0.3);
}

.admin-login__title {
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  text-align: center;
}

.admin-login__field {
  margin-bottom: 16px;
}

.admin-login__field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.admin-login__field input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border: 1px solid #ddd;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
  color: #1a1a2e;
}

.admin-login__field input:focus {
  border-color: #6378ff;
}

.admin-login__pw-wrap {
  position: relative;
}

.admin-login__pw-toggle {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: #888;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.admin-login__submit {
  width: 100%;
  height: 46px;
  margin-top: 8px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #6378ff, #5266e0);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}

.admin-login__submit:hover {
  opacity: 0.92;
}

.admin-login__submit:disabled {
  opacity: 0.6;
}

@media (max-width: 420px) {
  .admin-login__wrapper {
    padding: 0 16px;
  }

  .admin-login__card {
    padding: 24px 18px;
  }
}

.admin-toast-enter-active,
.admin-toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.admin-toast-enter-from,
.admin-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}
</style>
