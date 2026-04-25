<template>
  <section class="member-auth">
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

        <p v-if="message" class="member-auth__message">{{ message }}</p>

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
const message = ref('')

async function submit() {
  submitting.value = true
  message.value = ''

  try {
    const user = await userStore.login(form)
    const redirect =
      typeof route.query.redirect === 'string'
        ? route.query.redirect
        : user.role === 'admin'
          ? '/admin'
          : '/'
    await router.push(redirect)
  } catch (error) {
    message.value = error.message || 'Không thể đăng nhập'
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

.member-auth__message {
  margin: 18px 0 0;
  text-align: center;
  color: #ffffff;
  font-size: 14px;
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
</style>
