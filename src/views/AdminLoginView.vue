<template>
  <section class="admin-login">
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

        <p v-if="message" class="admin-login__message">{{ message }}</p>
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
const message = ref('')

async function submit() {
  submitting.value = true
  message.value = ''

  try {
    const user = await userStore.login(form)
    if (user.role !== 'admin') {
      userStore.logout()
      throw new Error('Tài khoản này không có quyền quản trị')
    }

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/admin'
    await router.push(redirect)
  } catch (error) {
    message.value = error.message || 'Không thể đăng nhập'
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

.admin-login__message {
  margin: 14px 0 0;
  text-align: center;
  color: #df3a3a;
  font-size: 13px;
}

@media (max-width: 420px) {
  .admin-login__wrapper {
    padding: 0 16px;
  }

  .admin-login__card {
    padding: 24px 18px;
  }
}
</style>
