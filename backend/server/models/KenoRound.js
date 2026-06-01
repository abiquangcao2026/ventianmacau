// file: server/models/KenoRound.js
const mongoose = require('mongoose')

const kenoRoundSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true
    },
    roundId: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['betting', 'rolling', 'settling', 'settled'],
      default: 'betting',
      index: true
    },
    configSnapshot: {
      type: Object,
      default: null
    },
    roundStartTime: {
      type: Date,
      default: () => new Date()
    },
    betCloseTime: {
      type: Date,
      default: null
    },
    openedAt: {
      type: Date,
      default: null
    },
    bettingClosedAt: {
      type: Date,
      default: null
    },
    settledAt: {
      type: Date,
      default: null
    },
    resultNumber: {
      type: Number,
      default: null
    },
    winningGates: {
      type: [String],
      default: []
    },
    forcedResult: {
      type: Number,
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
    betTotalAmount: {
      type: Number,
      default: 0
    },
    betCount: {
      type: Number,
      default: 0
    },
    gateTotals: {
      type: Object,
      default: {}
    }
  },
  { timestamps: true }
)

kenoRoundSchema.index({ roomId: 1, createdAt: -1 })

module.exports = mongoose.model('KenoRound', kenoRoundSchema)

