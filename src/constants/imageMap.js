// file: src/stores/socket.js
import { defineStore } from 'pinia'
import { io } from 'socket.io-client'
import { useUserStore } from '@/stores/user'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

export const useSocketStore = defineStore('socket', {
  state: () => ({
    socket: null,
    connected: false,
    roundState: {
      roomId: 'sicbo-3p',
      roundId: null,
      timeLeft: 0,
      bettingOpen: false,
      result: null
    }
  }),

  actions: {
    connect() {
      if (this.socket) return this.socket

      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
        autoConnect: true
      })

      this.socket.on('connect', () => {
        this.connected = true
      })

      this.socket.on('disconnect', () => {
        this.connected = false
      })

      this.socket.on('round_state', (payload) => {
        this.roundState = {
          ...this.roundState,
          ...payload
        }
      })

      this.socket.on('timer_update', (payload) => {
        this.roundState = {
          ...this.roundState,
          ...payload
        }
      })

      this.socket.on('round_result', (payload) => {
        this.roundState = {
          ...this.roundState,
          result: payload.result,
          roundId: payload.roundId
        }

        const userStore = useUserStore()
        userStore.pushGameHistory(payload)
      })

      this.socket.on('balance_update', ({ balance }) => {
        const userStore = useUserStore()
        userStore.setBalance(balance)
      })

      return this.socket
    },

    disconnect() {
      if (this.socket) {
        this.socket.disconnect()
        this.socket = null
        this.connected = false
      }
    },

    joinSicboRoom(userId, roomId = 'sicbo-3p') {
      if (!this.socket) this.connect()

      this.socket.emit('join_sicbo_room', {
        userId,
        roomId
      })
    },

    placeBet(payload) {
      return new Promise((resolve) => {
        if (!this.socket) this.connect()

        this.socket.emit('place_bet', payload, (response) => {
          resolve(response)
        })
      })
    }
  }
})