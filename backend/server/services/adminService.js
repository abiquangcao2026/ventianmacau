const crypto = require('crypto')
const User = require('../models/User')
const Bet = require('../models/Bet')
const SicboRound = require('../models/SicboRound')
const WalletTransaction = require('../models/WalletTransaction')
const { sanitizeUser } = require('../utils/auth')
const mongoose = require('mongoose')

const CHAT_ROOMS = [
  {
    roomId: 'support-general',
    title: 'Ho tro chung',
    lastMessage: 'Can kiem tra giao dich nap tien.',
    unreadCount: 2,
    updatedAt: new Date('2026-04-23T12:00:00.000Z').toISOString()
  },
  {
    roomId: 'vip-mobile',
    title: 'CSKH mobile',
    lastMessage: 'Nguoi choi yeu cau mo khoa tai khoan.',
    unreadCount: 1,
    updatedAt: new Date('2026-04-23T12:05:00.000Z').toISOString()
  }
]

const CHAT_MESSAGES = {
  'support-general': [
    {
      id: 'm1',
      sender: 'user:guest001',
      content: 'Em da nap tien nhung chua vao vi.',
      createdAt: '2026-04-23T11:58:00.000Z'
    },
    {
      id: 'm2',
      sender: 'admin:support',
      content: 'Da tiep nhan, admin se kiem tra giao dich cho ban.',
      createdAt: '2026-04-23T12:01:00.000Z'
    }
  ],
  'vip-mobile': [
    {
      id: 'm3',
      sender: 'user:vip102',
      content: 'Tai khoan em bi khoa, nho kiem tra.',
      createdAt: '2026-04-23T12:03:00.000Z'
    }
  ]
}

function parseVietnamDateBoundary(rawValue, endOfDay = false) {
  const raw = String(rawValue || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null
  }

  const date = new Date(`${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function buildDateFilter({ from, to } = {}) {
  const createdAt = {}
  const fromDate = parseVietnamDateBoundary(from, false)
  const toDate = parseVietnamDateBoundary(to, true)

  if (fromDate) createdAt.$gte = fromDate
  if (toDate) createdAt.$lte = toDate

  return Object.keys(createdAt).length ? { createdAt } : {}
}

function normalizeHistoryMode(rawMode) {
  const mode = String(rawMode || 'all').trim().toLowerCase()
  return ['all', 'deposit', 'withdraw', 'wallet', 'bet'].includes(mode) ? mode : 'all'
}

function normalizePagination({ page, limit } = {}) {
  const nextPage = Math.max(1, Number.parseInt(page, 10) || 1)
  const nextLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20))
  return { page: nextPage, limit: nextLimit, skip: (nextPage - 1) * nextLimit }
}

function normalizeTransactionGroup(rawGroup) {
  const group = String(rawGroup || 'all').trim().toLowerCase()
  return ['all', 'deposit', 'withdraw'].includes(group) ? group : 'all'
}

function escapeRegex(rawValue) {
  return String(rawValue || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeMeta(meta) {
  return meta && typeof meta === 'object' ? { ...meta } : {}
}

async function enrichDepositPaymentMeta(items = []) {
  const sourceIds = [
    ...new Set(
      items
        .filter((item) => item?.type === 'deposit')
        .map((item) => String(item?.meta?.sourceRequestId || '').trim())
        .filter((id) => mongoose.isValidObjectId(id))
    )
  ]

  if (!sourceIds.length) {
    return items
  }

  const sourceRequests = await WalletTransaction.find({ _id: { $in: sourceIds } })
    .select('meta')
    .lean()
  const sourceMetaById = new Map(sourceRequests.map((item) => [String(item._id), normalizeMeta(item.meta)]))

  return items.map((item) => {
    const meta = normalizeMeta(item.meta)
    const sourceMeta = sourceMetaById.get(String(meta.sourceRequestId || ''))
    if (!sourceMeta) {
      return item
    }
    return {
      ...item,
      meta: {
        ...sourceMeta,
        ...meta
      }
    }
  })
}

class AdminService {
  async buildUserWalletMetricsMap() {
    const metrics = await WalletTransaction.aggregate([
      {
        $match: {
          type: { $in: ['deposit', 'withdraw', 'admin_credit', 'admin_debit', 'admin_bonus'] }
        }
      },
      {
        $group: {
          _id: '$userId',
          totalDeposit: {
            $sum: {
              $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0]
            }
          },
          totalWithdraw: {
            $sum: {
              $cond: [{ $eq: ['$type', 'withdraw'] }, { $abs: '$amount' }, 0]
            }
          },
          adminCreditTotal: {
            $sum: {
              $cond: [{ $eq: ['$type', 'admin_credit'] }, '$amount', 0]
            }
          },
          adminDebitTotal: {
            $sum: {
              $cond: [{ $eq: ['$type', 'admin_debit'] }, { $abs: '$amount' }, 0]
            }
          },
          adminBonusTotal: {
            $sum: {
              $cond: [{ $eq: ['$type', 'admin_bonus'] }, '$amount', 0]
            }
          }
        }
      }
    ])

    return new Map(
      metrics.map((item) => [
        String(item._id),
        {
          totalDeposit: Number(item.totalDeposit || 0),
          totalWithdraw: Number(item.totalWithdraw || 0),
          adminCreditTotal: Number(item.adminCreditTotal || 0),
          adminDebitTotal: Number(item.adminDebitTotal || 0),
          adminBonusTotal: Number(item.adminBonusTotal || 0)
        }
      ])
    )
  }

  async buildUserBetMetricsMap() {
    const metrics = await Bet.aggregate([
      {
        $group: {
          _id: '$userId',
          totalBetAmount: { $sum: '$amount' },
          totalWinAmount: { $sum: '$payout' }
        }
      }
    ])

    return new Map(
      metrics.map((item) => [
        String(item._id),
        {
          totalBetAmount: Number(item.totalBetAmount || 0),
          totalWinAmount: Number(item.totalWinAmount || 0)
        }
      ])
    )
  }

  async getUsers(options = {}) {
    const { page, limit, skip } = normalizePagination(options)
    const keyword = String(options.keyword || '').trim()
    const safeKeyword = escapeRegex(keyword)
    const query = keyword
      ? {
          $or: [
            { userCode: new RegExp(safeKeyword, 'i') },
            { username: new RegExp(safeKeyword, 'i') },
            { fullName: new RegExp(safeKeyword, 'i') },
            { phone: new RegExp(safeKeyword, 'i') },
            { inviteCode: new RegExp(safeKeyword, 'i') },
            { referredByCode: new RegExp(safeKeyword, 'i') },
            { lastLoginIp: new RegExp(safeKeyword, 'i') }
          ]
        }
      : {}

    const [users, total, walletMetricsMap, betMetricsMap] = await Promise.all([
      User.find(query)
        .sort({ lastLoginAt: -1, updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
      this.buildUserWalletMetricsMap(),
      this.buildUserBetMetricsMap()
    ])

    const items = users.map((user) => {
      const walletMetrics = walletMetricsMap.get(String(user._id)) || {
        totalDeposit: 0,
        totalWithdraw: 0,
        adminCreditTotal: 0,
        adminDebitTotal: 0,
        adminBonusTotal: 0
      }

      const betMetrics = betMetricsMap.get(String(user._id)) || {
        totalBetAmount: 0,
        totalWinAmount: 0
      }

      return {
        ...sanitizeUser(user),
        totalDeposit: walletMetrics.totalDeposit,
        totalWithdraw: walletMetrics.totalWithdraw,
        adminCreditTotal: walletMetrics.adminCreditTotal,
        adminDebitTotal: walletMetrics.adminDebitTotal,
        adminBonusTotal: walletMetrics.adminBonusTotal,
        totalBetAmount: betMetrics.totalBetAmount,
        totalWinAmount: betMetrics.totalWinAmount
      }
    })

    return {
      items,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit))
    }
  }

  async getUserById(userId) {
    const depositTypes = ['deposit_pending', 'deposit', 'deposit_rejected']
    const withdrawTypes = ['withdraw_pending', 'withdraw', 'withdraw_rejected']
    const [user, walletMetricsMap, betMetricsMap, recentTransactions, recentDepositTransactions, recentWithdrawTransactions, recentBets] = await Promise.all([
      User.findById(userId).lean(),
      this.buildUserWalletMetricsMap(),
      this.buildUserBetMetricsMap(),
      WalletTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      WalletTransaction.find({ userId, type: { $in: depositTypes } })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      WalletTransaction.find({ userId, type: { $in: withdrawTypes } })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Bet.find({ userId })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean()
    ])

    if (!user) {
      return null
    }

    const walletMetrics = walletMetricsMap.get(String(user._id)) || {
      totalDeposit: 0,
      totalWithdraw: 0,
      adminCreditTotal: 0,
      adminDebitTotal: 0,
      adminBonusTotal: 0
    }

    const betMetrics = betMetricsMap.get(String(user._id)) || {
      totalBetAmount: 0,
      totalWinAmount: 0
    }
    const enrichedRecentTransactions = await enrichDepositPaymentMeta(recentTransactions)
    const enrichedRecentDepositTransactions = await enrichDepositPaymentMeta(recentDepositTransactions)

    return {
      ...sanitizeUser(user),
      totalDeposit: walletMetrics.totalDeposit,
      totalWithdraw: walletMetrics.totalWithdraw,
      adminCreditTotal: walletMetrics.adminCreditTotal,
      adminDebitTotal: walletMetrics.adminDebitTotal,
      adminBonusTotal: walletMetrics.adminBonusTotal,
      totalBetAmount: betMetrics.totalBetAmount,
      totalWinAmount: betMetrics.totalWinAmount,
      recentTransactions: enrichedRecentTransactions,
      recentDepositTransactions: enrichedRecentDepositTransactions,
      recentWithdrawTransactions,
      recentBets
    }
  }

  async getUserHistory(userId, options = {}) {
    const mode = normalizeHistoryMode(options.mode)
    const limit = Math.min(Math.max(Number(options.limit || 200), 1), 500)
    const dateFilter = buildDateFilter(options)
    const depositTypes = ['deposit_pending', 'deposit', 'deposit_rejected']
    const withdrawTypes = ['withdraw_pending', 'withdraw', 'withdraw_rejected']

    let walletTypes = null
    if (mode === 'deposit') walletTypes = depositTypes
    if (mode === 'withdraw') walletTypes = withdrawTypes

    const walletQuery = {
      userId,
      ...dateFilter
    }
    if (walletTypes) {
      walletQuery.type = { $in: walletTypes }
    }

    const betQuery = {
      userId,
      ...dateFilter
    }

    const shouldLoadWallet = mode !== 'bet'
    const shouldLoadBets = mode === 'all' || mode === 'bet'

    const [walletTransactions, bets] = await Promise.all([
      shouldLoadWallet
        ? WalletTransaction.find(walletQuery).sort({ createdAt: -1 }).limit(limit).lean()
        : Promise.resolve([]),
      shouldLoadBets
        ? Bet.find(betQuery).sort({ createdAt: -1 }).limit(limit).lean()
        : Promise.resolve([])
    ])

    const enrichedWalletTransactions = await enrichDepositPaymentMeta(walletTransactions)
    const walletItems = enrichedWalletTransactions.map((tx) => ({
      source: 'wallet',
      _id: tx._id,
      type: tx.type,
      amount: Number(tx.amount || 0),
      status: tx.status || '',
      balanceBefore: Number(tx.balanceBefore || 0),
      balanceAfter: Number(tx.balanceAfter || 0),
      reason: tx.reason || '',
      meta: tx.meta || {},
      createdAt: tx.createdAt
    }))

    const betItems = bets.map((bet) => ({
      source: 'bet',
      _id: bet._id,
      type: 'bet_record',
      roomId: bet.roomId || '',
      roundId: bet.roundId || '',
      gate: bet.gate || '',
      amount: Number(bet.amount || 0),
      payout: Number(bet.payout || 0),
      status: bet.status || '',
      resultSnapshot: bet.resultSnapshot || null,
      createdAt: bet.createdAt
    }))

    const items = [...walletItems, ...betItems]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, limit)

    return {
      mode,
      from: String(options.from || '').trim(),
      to: String(options.to || '').trim(),
      limit,
      total: items.length,
      items
    }
  }

  async getTransactions(options = {}) {
    const { page, limit, skip } = normalizePagination(options)
    const group = normalizeTransactionGroup(options.group)
    const query = {}

    if (group === 'deposit') {
      query.type = { $in: ['deposit_pending', 'deposit', 'deposit_rejected'] }
    } else if (group === 'withdraw') {
      query.type = { $in: ['withdraw_pending', 'withdraw', 'withdraw_rejected'] }
    }

    const [rawItems, total] = await Promise.all([
      WalletTransaction.find(query)
        .populate('userId', 'userCode username fullName phone')
        .populate('reviewedBy', 'username fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WalletTransaction.countDocuments(query)
    ])
    const items = await enrichDepositPaymentMeta(rawItems)

    return {
      items,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      group
    }
  }

  async getRevenue() {
    const [walletStats, betStats, totalUsers, activeUsers] = await Promise.all([
      WalletTransaction.aggregate([
        {
          $group: {
            _id: '$type',
            total: { $sum: { $abs: '$amount' } }
          }
        }
      ]),
      Bet.aggregate([
        {
          $group: {
            _id: null,
            totalBetAmount: { $sum: '$amount' },
            totalPayout: { $sum: '$payout' },
            totalRounds: { $sum: 1 }
          }
        }
      ]),
      User.countDocuments(),
      User.countDocuments({ status: 'active' })
    ])

    const walletMap = Object.fromEntries(
      walletStats.map((item) => [item._id, Number(item.total || 0)])
    )
    const betSummary = betStats[0] || {
      totalBetAmount: 0,
      totalPayout: 0,
      totalRounds: 0
    }

    return {
      totalUsers,
      activeUsers,
      totalDeposit: walletMap.deposit || 0,
      totalWithdraw: walletMap.withdraw || 0,
      totalBetAmount: Number(betSummary.totalBetAmount || 0),
      totalPayout: Number(betSummary.totalPayout || 0),
      netGamingRevenue:
        Number(betSummary.totalBetAmount || 0) - Number(betSummary.totalPayout || 0),
      totalRounds: Number(betSummary.totalRounds || 0)
    }
  }

  async getGameSummary() {
    const [roomStats, gateStats, latestRounds] = await Promise.all([
      Bet.aggregate([
        {
          $group: {
            _id: '$roomId',
            totalBetAmount: { $sum: '$amount' },
            totalPayout: { $sum: '$payout' },
            totalBets: { $sum: 1 },
            totalWonBets: {
              $sum: {
                $cond: [{ $eq: ['$status', 'won'] }, 1, 0]
              }
            }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]),
      Bet.aggregate([
        {
          $group: {
            _id: {
              roomId: '$roomId',
              gate: '$gate'
            },
            totalAmount: { $sum: '$amount' },
            totalPayout: { $sum: '$payout' },
            totalBets: { $sum: 1 }
          }
        },
        {
          $sort: { totalAmount: -1 }
        }
      ]),
      Bet.aggregate([
        {
          $sort: { createdAt: -1 }
        },
        {
          $group: {
            _id: '$roomId',
            latestRoundId: { $first: '$roundId' },
            latestCreatedAt: { $first: '$createdAt' }
          }
        }
      ])
    ])

    const latestRoundMap = new Map(
      latestRounds.map((item) => [item._id, item])
    )

    const gateLeaderboard = gateStats.reduce((accumulator, item) => {
      const roomId = item._id.roomId
      if (!accumulator[roomId]) {
        accumulator[roomId] = []
      }

      if (accumulator[roomId].length < 5) {
        accumulator[roomId].push({
          gate: item._id.gate,
          totalAmount: Number(item.totalAmount || 0),
          totalPayout: Number(item.totalPayout || 0),
          totalBets: Number(item.totalBets || 0)
        })
      }

      return accumulator
    }, {})

    return roomStats.map((item) => {
      const latestRound = latestRoundMap.get(item._id)

      return {
        roomId: item._id,
        totalBetAmount: Number(item.totalBetAmount || 0),
        totalPayout: Number(item.totalPayout || 0),
        netGamingRevenue: Number(item.totalBetAmount || 0) - Number(item.totalPayout || 0),
        totalBets: Number(item.totalBets || 0),
        totalWonBets: Number(item.totalWonBets || 0),
        latestRoundId: latestRound?.latestRoundId || '--',
        latestCreatedAt: latestRound?.latestCreatedAt || null,
        topGates: gateLeaderboard[item._id] || []
      }
    })
  }

  async getGameHistory(options = {}) {
    const { page, limit, skip } = normalizePagination(options)
    const roomId = String(options.roomId || '').trim()
    const query = roomId ? { roomId } : {}
    const [items, total] = await Promise.all([
      Bet.find(query)
        .populate('userId', 'userCode username fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Bet.countDocuments(query)
    ])

    return {
      items,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit))
    }
  }

  async getRoundHistory(options = {}) {
    const { page, limit, skip } = normalizePagination(options)
    const [items, total] = await Promise.all([
      SicboRound.find()
        .populate('forcedBy', 'username fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SicboRound.countDocuments()
    ])

    return {
      items,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit))
    }
  }

  formatInviteCodeItem(user) {
    return {
      userId: user._id,
      userCode: user.userCode || '',
      username: user.username,
      fullName: user.fullName || '',
      inviteCode: user.inviteCode || '',
      createdAt: user.createdAt
    }
  }

  normalizeInviteCode(rawCode) {
    return String(rawCode || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
  }

  buildRandomInviteCode() {
    const suffix = crypto.randomBytes(4).toString('hex').toUpperCase()
    return `REF${suffix}`
  }

  async getInviteCodes() {
    const users = await User.find({}, 'userCode username fullName inviteCode createdAt username').lean()

    return users.map((user) => this.formatInviteCodeItem(user))
  }

  async updateInviteCode(userId, inviteCode) {
    const normalizedInviteCode = this.normalizeInviteCode(inviteCode)
    if (normalizedInviteCode.length < 5 || normalizedInviteCode.length > 16) {
      throw new Error('Ma moi phai tu 5-16 ky tu chu hoa hoac so')
    }

    const duplicated = await User.findOne({
      inviteCode: normalizedInviteCode,
      _id: { $ne: userId }
    }).lean()

    if (duplicated) {
      throw new Error('Ma moi da ton tai')
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { inviteCode: normalizedInviteCode },
      { new: true, select: 'userCode username fullName inviteCode createdAt' }
    ).lean()

    if (!user) {
      throw new Error('Khong tim thay user de cap nhat ma moi')
    }

    return this.formatInviteCodeItem(user)
  }

  async regenerateInviteCode(userId) {
    const user = await User.findById(userId).select('userCode username fullName inviteCode createdAt')
    if (!user) {
      throw new Error('Khong tim thay user de tao lai ma moi')
    }

    let nextCode = ''
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const candidate = this.buildRandomInviteCode()
      // eslint-disable-next-line no-await-in-loop
      const exists = await User.exists({ inviteCode: candidate, _id: { $ne: user._id } })
      if (!exists) {
        nextCode = candidate
        break
      }
    }

    if (!nextCode) {
      throw new Error('Khong the tao ma moi moi, vui long thu lai')
    }

    user.inviteCode = nextCode
    await user.save()

    return this.formatInviteCodeItem(user)
  }

  getChatRooms() {
    return CHAT_ROOMS
  }

  getChatMessages(roomId) {
    return CHAT_MESSAGES[roomId] || []
  }
}

module.exports = AdminService
