// file: server/models/Bet.js
const mongoose = require('mongoose')

const betSchema = new mongoose.Schema(
  {
    roundId: {
      type: String,
      required: true,
      index: true
    },
    roomId: {
      type: String,
      required: true,
      default: 'sicbo-3p',
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    gate: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 1
    },
    payout: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['placed', 'won', 'lost', 'refunded'],
      default: 'placed'
    },
    resultSnapshot: {
      type: Object,
      default: null
    }
  },
  {
    timestamps: true
  }
)

module.exports = mongoose.model('Bet', betSchema)