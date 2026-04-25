// file: src/stores/socket.js
import { defineStore } from 'pinia'
import { io } from 'socket.io-client'
import { useUserStore } from '@/stores/user'

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

function isLocalHostname(hostname) {
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(String(hostname || '').toLowerCase())
}

function resolveSocketUrl(rawValue) {
  if (typeof window === 'undefined') {
    return trimTrailingSlash(rawValue || 'http://localhost:3000')
  }

  const runtimeOrigin = trimTrailingSlash(window.location.origin)
  const normalized = trimTrailingSlash(rawValue)

  if (!normalized) {
    return runtimeOrigin
  }

  try {
    const parsed = new URL(normalized)
    if (!isLocalHostname(window.location.hostname) && isLocalHostname(parsed.hostname)) {
      return runtimeOrigin
    }
  } catch {
    return trimTrailingSlash(new URL(normalized, runtimeOrigin).toString())
  }

  return normalized
}

const SOCKET_URL = resolveSocketUrl(import.meta.env.VITE_SOCKET_URL)
const SOCKET_PATH = '/socket.io'

function buildSocketErrorMessage(error) {
  const transportDetail =
    error?.description?.message ||
    error?.description?.context?.statusText ||
    error?.description?.type ||
    ''

  if (transportDetail) {
    return `${error?.message || 'Socket error'} (${transportDetail})`
  }

  return error?.message || 'Không kết nối được socket realtime'
}

export const useSocketStore = defineStore('socket', {
  state: () => ({
    socket: null,
    connecting: false,
    connected: false,
    authToken: '',
    lastError: '',
    lastEventAt: null,
    activeRoomId: 'sicbo-3p',
    roundState: {
      roomId: 'sicbo-3p',
      roundId: null,
      timeLeft: 0,
      bettingOpen: false,
      result: null,
      total: 0,
      history: [],
      config: null,
      summary: null,
      betTotalAmount: 0,
      betCount: 0,
      gateTotals: {},
      openedAt: null,
      bettingClosedAt: null,
      settledAt: null
    }
  }),

  actions: {
    setSocketError(message = '') {
      this.lastError = String(message || '')
    },

    hydrateRoundState(payload = {}) {
      this.roundState = {
        ...this.roundState,
        ...payload,
        gateTotals: {
          ...(this.roundState.gateTotals || {}),
          ...(payload.gateTotals || {})
        }
      }
      this.lastEventAt = Date.now()
    },

    ensureSocketAuth() {
      const userStore = useUserStore()
      const nextToken = userStore.token || ''

      if (!this.socket) {
        this.authToken = nextToken
        return
      }

      if (this.authToken === nextToken) {
        return
      }

      this.authToken = nextToken
      this.socket.auth = nextToken ? { token: nextToken } : {}

      const shouldReconnect = this.socket.connected || this.socket.active
      if (shouldReconnect) {
        this.socket.disconnect()
      }
      this.socket.connect()
    },

    connect() {
      const userStore = useUserStore()
      const nextToken = userStore.token || ''

      if (this.socket) {
        this.ensureSocketAuth()
        return this.socket
      }

      this.authToken = nextToken
      this.connecting = true
      this.setSocketError('')
      this.socket = io(SOCKET_URL, {
        path: SOCKET_PATH,
        auth: nextToken ? { token: nextToken } : {},
        transports: ['websocket', 'polling'],
        upgrade: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        timeout: 10000
      })

      this.socket.on('connect', () => {
        this.connecting = false
        this.connected = true
        this.setSocketError('')
        console.info('[socket] connected', {
          id: this.socket.id,
          url: SOCKET_URL,
          path: SOCKET_PATH
        })
        if (this.activeRoomId) {
          console.info('[socket] emit join_sicbo_room', {
            roomId: this.activeRoomId
          })
          this.socket.emit('join_sicbo_room', {
            roomId: this.activeRoomId
          })
        }
      })

      this.socket.on('disconnect', (reason) => {
        this.connecting = false
        this.connected = false
        console.warn('[socket] disconnect', reason)
      })

      this.socket.on('connect_error', (error) => {
        this.connecting = false
        this.connected = false
        const message = buildSocketErrorMessage(error)
        this.setSocketError(message)
        console.error('[socket] connect_error', {
          message,
          raw: error
        })
      })

      this.socket.on('socket_error', (payload) => {
        const message = String(payload?.message || 'Socket error')
        this.setSocketError(message)
        console.error('[socket] socket_error', payload)
      })

      this.socket.on('round_state', (payload) => {
        if (payload?.roomId && payload.roomId !== this.activeRoomId) return
        console.info('[socket] round_state received', {
          roomId: payload?.roomId,
          roundId: payload?.roundId,
          timeLeft: payload?.timeLeft
        })
        this.hydrateRoundState(payload)
      })

      this.socket.on('timer_update', (payload) => {
        if (payload?.roomId && payload.roomId !== this.activeRoomId) return
        console.info('[socket] timer_update received', {
          roomId: payload?.roomId,
          roundId: payload?.roundId,
          timeLeft: payload?.timeLeft
        })
        this.hydrateRoundState(payload)
      })

      this.socket.on('betting_snapshot', (payload) => {
        if (payload?.roomId && payload.roomId !== this.activeRoomId) return
        this.hydrateRoundState(payload)
      })

      this.socket.on('round_result', (payload) => {
        if (payload?.roomId && payload.roomId !== this.activeRoomId) return

        this.hydrateRoundState({
          ...payload,
          result: payload.result,
          roundId: payload.roundId,
          total: payload.total,
          history: payload.history || this.roundState.history
        })

        const userStoreRef = useUserStore()
        userStoreRef.pushGameHistory(payload)
      })

      this.socket.on('balance_update', ({ balance }) => {
        const userStoreRef = useUserStore()
        userStoreRef.setBalance(balance)
      })

      return this.socket
    },

    disconnect() {
      if (this.socket) {
        this.socket.disconnect()
        this.socket = null
        this.connecting = false
        this.connected = false
      }
    },

    joinSicboRoom(userId, roomId = 'sicbo-3p') {
      this.connect()
      this.ensureSocketAuth()

      if (this.activeRoomId && this.activeRoomId !== roomId) {
        this.socket.emit('leave_sicbo_room', {
          roomId: this.activeRoomId
        })
      }

      this.activeRoomId = roomId

      console.info('[socket] emit join_sicbo_room', {
        roomId,
        hasToken: Boolean(this.authToken),
        userId: userId || null
      })
      this.socket.emit('join_sicbo_room', {
        roomId
      })
    },

    placeBet(payload) {
      return new Promise((resolve) => {
        this.connect()
        this.ensureSocketAuth()

        this.socket.emit('place_bet', payload, (response) => {
          resolve(response)
        })
      })
    }
  }
})
