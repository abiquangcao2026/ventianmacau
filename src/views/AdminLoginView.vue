<template>
  <section class="admin-login">
    <div class="admin-login__backdrop"></div>

    <form class="admin-login__card" @submit.prevent="submit">
      <div class="admin-login__field">
        <input v-model.trim="form.username" type="text" placeholder="admin1" />
      </div>

      <div class="admin-login__field admin-login__field--password">
        <input
          v-model="form.password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Abc1799"
        />
        <button type="button" @click="showPassword = !showPassword">
          {{ showPassword ? 'Ẩn' : 'Hiện' }}
        </button>
      </div>

      <button :disabled="submitting" class="admin-login__submit" type="submit">
        {{ submitting ? 'Đang đăng nhập' : 'Đăng nhập' }}
      </button>

      <p v-if="message" class="admin-login__message">{{ message }}</p>
    </form>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const form = reactive({
  username: '',
  password: ''
})
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
    message.value = error.message || 'Không thể đăng nhập admin'
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
  font-family: Roboto, Arial, sans-serif;
  background:
    linear-gradient(180deg, rgba(35, 26, 56, 0.18), rgba(25, 20, 46, 0.38)),
    radial-gradient(circle at 70% 18%, rgba(255, 94, 142, 0.75), transparent 12%),
    radial-gradient(circle at 20% 22%, rgba(245, 179, 70, 0.55), transparent 18%),
    url('/img/macau-skyline-by-night.jpg') center center / cover no-repeat;
}

.admin-login__backdrop {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(163, 185, 255, 0.18), rgba(23, 29, 58, 0.38) 30%, rgba(13, 18, 33, 0.78) 100%);
}

.admin-login__backdrop::before,
.admin-login__backdrop::after {
  content: '';
  position: absolute;
  inset: auto 0 0;
  height: 44%;
  background:
    linear-gradient(90deg, rgba(0, 0, 0, 0.18) 0 10%, transparent 10% 12%, rgba(0, 0, 0, 0.25) 12% 18%, transparent 18% 20%, rgba(0, 0, 0, 0.14) 20% 28%, transparent 28% 30%, rgba(0, 0, 0, 0.28) 30% 40%, transparent 40% 42%, rgba(0, 0, 0, 0.16) 42% 48%, transparent 48% 54%, rgba(0, 0, 0, 0.25) 54% 60%, transparent 60% 66%, rgba(0, 0, 0, 0.18) 66% 72%, transparent 72% 78%, rgba(0, 0, 0, 0.3) 78% 86%, transparent 86% 100%);
  opacity: 0.72;
}

.admin-login__backdrop::after {
  inset: auto 0 44%;
  height: 18%;
  background:
    linear-gradient(90deg, rgba(255, 181, 74, 0.75) 0 4px, transparent 4px 100%),
    linear-gradient(180deg, rgba(255, 205, 129, 0.35), transparent);
  background-size: 160px 100%;
  opacity: 0.5;
}

.admin-login__card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 230px;
  padding: 16px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.24);
}

.admin-login__field + .admin-login__field {
  margin-top: 10px;
}

.admin-login__field input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #d9dee8;
  border-radius: 4px;
  outline: none;
}

.admin-login__field--password {
  position: relative;
}

.admin-login__field--password button {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: #7f8590;
  font-size: 11px;
}

.admin-login__submit {
  width: 100%;
  height: 34px;
  margin-top: 14px;
  border: none;
  border-radius: 5px;
  background: #2f80ed;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.admin-login__message {
  margin: 10px 0 0;
  color: #df3a3a;
  font-size: 11px;
  line-height: 1.4;
}
</style>
