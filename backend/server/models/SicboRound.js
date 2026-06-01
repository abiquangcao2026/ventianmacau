const mongoose = require('mongoose')

const roundStatuses = ['betting', 'rolling', 'settling', 'settled', 'cancelled']

const sicboRoundSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
      default: 'sicbo-3p'
    },
    roundId: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: roundStatuses,
      default: 'betting',
      index: true
    },
    configSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    result: {
      type: [Number],
      default: null
    },
    total: {
      type: Number,
      default: 0
    },
    betTotalAmount: {
      type: Number,
      default: 0
    },
    betCount: {
      type: Number,
      default: 0
    },
    gateTotals: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    winningGates: {
      type: [String],
      default: []
    },
    outcome: {
      type: String,
      default: ''
    },
    parity: {
      type: String,
      default: ''
    },
    isTriple: {
      type: Boolean,
      default: false
    },
    forcedResult: {
      type: [Number],
      default: null
    },
    forcedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    forcedNote: {
      type: String,
      default: ''
    },
    roundStartTime: {
      type: Date,
      default: Date.now
    },
    betCloseTime: {
      type: Date,
      default: null,
      index: true
    },
    openedAt: {
      type: Date,
      default: Date.now
    },
    bettingClosedAt: {
      type: Date,
      default: null
    },
    settledAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
)

const sicboAuditSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      default: ''
    },
    roundId: {
      type: String,
      default: ''
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      index: true
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
)

sicboRoundSchema.index({ roomId: 1, roundId: 1 }, { unique: true })
sicboRoundSchema.index({ roomId: 1, status: 1, createdAt: -1 })

const SicboAdminAudit =
  mongoose.models.SicboAdminAudit || mongoose.model('SicboAdminAudit', sicboAuditSchema)

sicboRoundSchema.statics.writeAuditLog = async function writeAuditLog(payload = {}) {
  const {
    roomId = '',
    roundId = '',
    adminId,
    action,
    before = {},
    after = {},
    meta = {}
  } = payload

  if (!adminId || !action) {
    return null
  }

  return SicboAdminAudit.create({
    roomId,
    roundId,
    adminId,
    action,
    before,
    after,
    meta,
    timestamp: new Date()
  })
}

sicboRoundSchema.statics.listAuditLogs = async function listAuditLogs(query = {}) {
  const filters = {}
  if (query.roomId) filters.roomId = query.roomId
  if (query.action) filters.action = query.action
  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500)

  return SicboAdminAudit.find(filters)
    .populate('adminId', 'username fullName')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean()
}

module.exports = mongoose.models.SicboRound || mongoose.model('SicboRound', sicboRoundSchema)
