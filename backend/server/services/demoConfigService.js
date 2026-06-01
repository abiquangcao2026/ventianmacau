const bcrypt = require('bcrypt')
const User = require('../models/User')

const defaultOdds = {
  tai: 1.98,
  xiu: 1.98,
  odd: 1.98,
  even: 1.98,
  double_1: 5.8,
  double_2: 5.8,
  double_3: 5.8,
  double_4: 5.8,
  double_5: 5.8,
  double_6: 5.8,
  triple_1: 24,
  triple_2: 24,
  triple_3: 24,
  triple_4: 24,
  triple_5: 24,
  triple_6: 24
}

const defaultRoomPresets = {
  'sicbo-3p': {
    roomId: 'sicbo-3p',
    title: 'Xúc sắc 3P',
    roundDuration: 300,
    betLockSeconds: 10,
    minBet: 10,
    maxBet: 0,
    chipOptions: [10, 50, 100, 500, 1000, 5000, 10000, 50000],
    odds: { ...defaultOdds }
  },
  'sicbo-5p': {
    roomId: 'sicbo-5p',
    title: 'Xúc sắc 5P',
    roundDuration: 300,
    betLockSeconds: 10,
    minBet: 10,
    maxBet: 0,
    chipOptions: [10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000],
    odds: { ...defaultOdds }
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function resolveNumericSetting(nextValue, currentValue) {
  if (nextValue === undefined || nextValue === null || nextValue === '') {
    return Number(currentValue || 0)
  }

  return Number(nextValue)
}

const FIXED_SICBO_ROUND_DURATION = 300

const state = {
  sicboRooms: deepClone(defaultRoomPresets),
  payoutPolicy: {
    withdrawFeeRate: 0,
    dailyWithdrawLimit: 50000000,
    autoApproveDeposit: false,
    autoApproveWithdraw: false,
    maxPendingWithdrawals: 1,
    depositReceiverBank: 'Vietcombank',
    depositReceiverAccountNumber: '9999999999',
    depositReceiverAccountName: 'CORONA CASINO',
    depositQrContentPrefix: 'NAP'
  }
}

class DemoConfigService {
  resolveRoomId(roomId = 'sicbo-3p') {
    return state.sicboRooms[roomId] ? roomId : 'sicbo-3p'
  }

  normalizeSicboConfig(roomId, payload = {}) {
    const current = state.sicboRooms[this.resolveRoomId(roomId)]
    const next = {
      ...current,
      ...payload,
      roomId: current.roomId,
      title: current.title,
      odds: {
        ...current.odds,
        ...(payload.odds || {})
      }
    }

    next.roundDuration = FIXED_SICBO_ROUND_DURATION
    next.betLockSeconds = resolveNumericSetting(next.betLockSeconds, current.betLockSeconds)
    next.minBet = resolveNumericSetting(next.minBet, current.minBet)
    next.maxBet = resolveNumericSetting(next.maxBet, current.maxBet)
    next.chipOptions = Array.isArray(next.chipOptions)
      ? next.chipOptions.map((value) => Number(value)).filter((value) => value > 0)
      : current.chipOptions

    next.odds = Object.fromEntries(
      Object.entries(next.odds).map(([key, value]) => [key, Number(value || current.odds[key] || 0)])
    )

    if (!Number.isFinite(next.roundDuration) || next.roundDuration < 30 || next.roundDuration > 900) {
      throw new Error('roundDuration phai trong khoang 30-900 giay')
    }

    if (!Number.isFinite(next.betLockSeconds) || next.betLockSeconds < 1) {
      throw new Error('betLockSeconds phai lon hon 0')
    }

    if (next.betLockSeconds >= next.roundDuration) {
      throw new Error('betLockSeconds phai nho hon roundDuration')
    }

    if (!Number.isFinite(next.minBet) || next.minBet < 1) {
      throw new Error('minBet phai lon hon 0')
    }

    if (!Number.isFinite(next.maxBet) || next.maxBet < 0) {
      throw new Error('maxBet khong hop le')
    }

    if (next.maxBet > 0 && next.maxBet < next.minBet) {
      throw new Error('maxBet phai lon hon hoac bang minBet')
    }

    const hasMaxBet = next.maxBet > 0
    next.chipOptions = Array.from(new Set(next.chipOptions))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b)
      .filter((value) => value >= next.minBet && (!hasMaxBet || value <= next.maxBet))

    if (next.chipOptions.length === 0) {
      throw new Error('chipOptions phai co it nhat 1 muc hop le')
    }

    next.odds = Object.fromEntries(
      Object.entries(next.odds).map(([key, value]) => {
        const normalized = Number(value)
        if (!Number.isFinite(normalized) || normalized <= 0 || normalized > 1000) {
          throw new Error(`Odds cua ${key} khong hop le`)
        }
        return [key, normalized]
      })
    )

    return next
  }

  listSicboConfigs() {
    return Object.values(state.sicboRooms).map((config) => JSON.parse(JSON.stringify(config)))
  }

  getSicboConfig(roomId = 'sicbo-3p') {
    const resolvedRoomId = this.resolveRoomId(roomId)
    return JSON.parse(JSON.stringify(state.sicboRooms[resolvedRoomId]))
  }

  updateSicboConfig(payload = {}, roomId = 'sicbo-3p') {
    const resolvedRoomId = this.resolveRoomId(roomId)
    state.sicboRooms[resolvedRoomId] = this.normalizeSicboConfig(resolvedRoomId, payload)
    return this.getSicboConfig(resolvedRoomId)
  }

  resetSicboConfig(roomId = 'sicbo-3p') {
    const resolvedRoomId = this.resolveRoomId(roomId)
    const preset = deepClone(defaultRoomPresets[resolvedRoomId])
    state.sicboRooms[resolvedRoomId] = this.normalizeSicboConfig(resolvedRoomId, preset)
    return this.getSicboConfig(resolvedRoomId)
  }

  copySicboConfig(fromRoomId = 'sicbo-3p', toRoomId = 'sicbo-5p') {
    const sourceRoomId = this.resolveRoomId(fromRoomId)
    const targetRoomId = this.resolveRoomId(toRoomId)

    if (sourceRoomId === targetRoomId) {
      throw new Error('Room nguon va room dich khong duoc giong nhau')
    }

    const source = state.sicboRooms[sourceRoomId]
    const target = state.sicboRooms[targetRoomId]
    const payload = {
      roundDuration: source.roundDuration,
      betLockSeconds: source.betLockSeconds,
      minBet: source.minBet,
      maxBet: source.maxBet,
      chipOptions: source.chipOptions,
      odds: source.odds,
      title: target.title
    }

    state.sicboRooms[targetRoomId] = this.normalizeSicboConfig(targetRoomId, payload)
    return this.getSicboConfig(targetRoomId)
  }

  getPayoutPolicy() {
    return JSON.parse(JSON.stringify(state.payoutPolicy))
  }

  updatePayoutPolicy(payload = {}) {
    const next = {
      ...state.payoutPolicy,
      ...payload
    }

    next.withdrawFeeRate = Number(next.withdrawFeeRate || 0)
    next.dailyWithdrawLimit = Number(next.dailyWithdrawLimit || state.payoutPolicy.dailyWithdrawLimit)
    next.maxPendingWithdrawals = Number(
      next.maxPendingWithdrawals || state.payoutPolicy.maxPendingWithdrawals
    )
    next.maxPendingWithdrawals = Math.max(1, Math.floor(next.maxPendingWithdrawals))
    next.autoApproveDeposit = Boolean(next.autoApproveDeposit)
    next.autoApproveWithdraw = Boolean(next.autoApproveWithdraw)
    next.depositReceiverBank = String(next.depositReceiverBank || state.payoutPolicy.depositReceiverBank)
      .trim()
      .slice(0, 80)
    next.depositReceiverAccountNumber = String(
      next.depositReceiverAccountNumber || state.payoutPolicy.depositReceiverAccountNumber
    )
      .trim()
      .replace(/\s+/g, '')
      .slice(0, 40)
    next.depositReceiverAccountName = String(
      next.depositReceiverAccountName || state.payoutPolicy.depositReceiverAccountName
    )
      .trim()
      .slice(0, 120)
    next.depositQrContentPrefix = String(
      next.depositQrContentPrefix || state.payoutPolicy.depositQrContentPrefix
    )
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 20)

    if (!next.depositReceiverAccountNumber) {
      throw new Error('depositReceiverAccountNumber khong duoc de trong')
    }

    if (!next.depositReceiverBank) {
      throw new Error('depositReceiverBank khong duoc de trong')
    }

    if (!next.depositReceiverAccountName) {
      throw new Error('depositReceiverAccountName khong duoc de trong')
    }

    if (!next.depositQrContentPrefix) {
      throw new Error('depositQrContentPrefix khong hop le')
    }

    state.payoutPolicy = next
    return this.getPayoutPolicy()
  }

  async getAdminUsers() {
    const admins = await User.find({ role: 'admin' })
      .select('userCode username fullName phone status createdAt updatedAt')
      .sort({ createdAt: 1 })
      .lean()

    return admins.map((admin) => ({
      ...admin,
      scopes: ['dashboard', 'transactions', 'users', 'chat']
    }))
  }

  async createAdminUser(payload = {}) {
    const username = String(payload.username || '').trim().toLowerCase()
    const password = String(payload.password || '')
    const fullName = String(payload.fullName || '').trim()
    const phone = String(payload.phone || '').trim()
    const status = payload.status === 'locked' ? 'locked' : 'active'

    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      throw new Error('Username admin phai 3-30 ky tu, chi gom chu so va ._-')
    }

    if (password.length < 6) {
      throw new Error('Mat khau admin toi thieu 6 ky tu')
    }

    const exists = await User.findOne({ username }).lean()
    if (exists) {
      throw new Error('Username admin da ton tai')
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const admin = await User.create({
      username,
      passwordHash,
      fullName,
      phone,
      role: 'admin',
      status,
      balance: 0
    })

    return User.findById(admin._id)
      .select('userCode username fullName phone status createdAt updatedAt')
      .lean()
  }

  async setAdminStatus(adminId, status, actorAdminId) {
    if (!['active', 'locked'].includes(status)) {
      throw new Error('Trang thai admin khong hop le')
    }

    const admin = await User.findOne({ _id: adminId, role: 'admin' })
    if (!admin) {
      throw new Error('Khong tim thay tai khoan admin')
    }

    if (String(actorAdminId || '') === String(admin._id) && status === 'locked') {
      throw new Error('Khong duoc khoa chinh tai khoan admin dang dang nhap')
    }

    if (status === 'locked' && admin.status !== 'locked') {
      const activeAdmins = await User.countDocuments({ role: 'admin', status: 'active' })
      if (activeAdmins <= 1) {
        throw new Error('Khong the khoa admin cuoi cung dang hoat dong')
      }
    }

    admin.status = status
    await admin.save()

    return User.findById(admin._id)
      .select('userCode username fullName phone status createdAt updatedAt')
      .lean()
  }

  async resetAdminPassword(adminId, newPassword) {
    const password = String(newPassword || '')
    if (password.length < 6) {
      throw new Error('Mat khau moi toi thieu 6 ky tu')
    }

    const admin = await User.findOne({ _id: adminId, role: 'admin' })
    if (!admin) {
      throw new Error('Khong tim thay tai khoan admin')
    }

    admin.passwordHash = await bcrypt.hash(password, 10)
    await admin.save()

    return User.findById(admin._id)
      .select('userCode username fullName phone status createdAt updatedAt')
      .lean()
  }
}

module.exports = new DemoConfigService()
