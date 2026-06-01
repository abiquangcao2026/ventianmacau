const mongoose = require('mongoose')

const walletTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: [
        'deposit_pending',
        'deposit',
        'deposit_rejected',
        'withdraw_pending',
        'withdraw',
        'withdraw_rejected',
        'admin_credit',
        'admin_debit',
        'admin_bonus',
        'bet',
        'win',
        'refund'
      ],
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true
    },
    balanceBefore: {
      type: Number,
      default: 0
    },
    balanceAfter: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'completed',
      index: true
    },
    reason: {
      type: String,
      default: ''
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
)

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema)
