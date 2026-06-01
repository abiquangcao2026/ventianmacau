// file: src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import '@/assets/base-casino.css'
import { CLIENT_BUILD_ID } from './lib/api'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

if (typeof window !== 'undefined') {
  window.__VENETIAN_BUILD__ = CLIENT_BUILD_ID
}

app.mount('#app')
