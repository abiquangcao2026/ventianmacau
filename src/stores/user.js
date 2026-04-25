// file: src/stores/user.js
import { defineStore } from 'pinia'
import { apiFetch } from '@/lib/api'

const STORAGE_KEY = 'casino_auth_token'

function mapTransactionType(type) {
  switch (type) {
    case 'deposit_pending':
      return 'Yêu cầu nạp tiền'
    case 'deposit':
      return 'Nạp tiền thành công'
    case 'deposit_rejected':
      return 'Từ chối nạp tiền'
    case 'withdraw_pending':
      return 'Yêu cầu rút tiền'
    case 'withdraw':
      return 'Rút tiền thành công'
    case 'withdraw_rejected':
      return 'Từ chối rút tiền'
    case 'bet':
      return 'Đặt cược'
    case 'win':
      return 'Thắng cược'
    case 'refund':
      return 'Hoàn cược'
    default:
      return 'Giao dịch'
  }
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem(STORAGE_KEY) || '',
    user: null,
    balance: 0,
    transactions: [],
    loadingTransactions: false,
    gameHistory: [],
    loadingProfile: false,
    initialized: false
  }),

  getters: {
    isLoggedIn: (state) => Boolean(state.user?._id && state.token),
    isAdmin: (state) => state.user?.role === 'admin',
    authHeaders: (state) =>
      state.token
        ? {
            Authorization: `Bearer ${state.token}`
          }
        : {}
  },

  actions: {
    persistToken(token) {
      this.token = token || ''
      if (this.token) {
        localStorage.setItem(STORAGE_KEY, this.token)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    },

    setUser(user) {
      this.user = user || null
      this.balance = Number(user?.balance || 0)
    },

    setBalance(balance) {
      this.balance = Number(balance || 0)
      if (this.user) {
        this.user.balance = this.balance
      }
    },

    pushGameHistory(item) {
      this.gameHistory.unshift(item)
      if (this.gameHistory.length > 20) {
        this.gameHistory = this.gameHistory.slice(0, 20)
      }
    },

    setTransactions(items) {
      this.transactions = (items || []).map((item) => ({
        ...item,
        typeLabel: mapTransactionType(item.type)
      }))
    },

    logout() {
      this.persistToken('')
      this.user = null
      this.balance = 0
      this.transactions = []
      this.gameHistory = []
      this.initialized = true
    },

    async login(payload) {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      this.persistToken(data.token)
      this.setUser(data.user)
      this.initialized = true
      return data.user
    },

    async signup(payload) {
      const data = await apiFetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      this.persistToken(data.token)
      this.setUser(data.user)
      this.initialized = true
      return data.user
    },

    async restoreSession() {
      if (!this.token) {
        this.initialized = true
        return null
      }

      this.loadingProfile = true
      try {
        const data = await apiFetch('/api/auth/me', {
          headers: this.authHeaders
        })

        this.setUser(data.user)
        this.initialized = true
        return data.user
      } catch (error) {
        this.logout()
        return null
      } finally {
        this.loadingProfile = false
      }
    },

    async fetchMe() {
      const data = await apiFetch('/api/account/me', {
        headers: this.authHeaders
      })

      this.setUser(data.user)
      return data.user
    },

    async fetchTransactions() {
      this.loadingTransactions = true
      try {
        const data = await apiFetch('/api/account/transactions', {
          headers: this.authHeaders
        })
        this.setTransactions(data.items || [])
        return data.items || []
      } finally {
        this.loadingTransactions = false
      }
    },

    async createDepositRequest(payload) {
      const data = await apiFetch('/api/account/deposit-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.authHeaders
        },
        body: JSON.stringify(payload)
      })

      await this.fetchTransactions()
      return data
    },

    async createWithdrawRequest(payload) {
      const data = await apiFetch('/api/account/withdraw-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.authHeaders
        },
        body: JSON.stringify(payload)
      })

      if (typeof data.balance !== 'undefined') {
        this.setBalance(data.balance)
      }

      await this.fetchTransactions()
      return data
    }
  }
})
