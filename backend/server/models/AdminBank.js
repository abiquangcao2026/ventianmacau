const mongoose = require('mongoose')

const adminBankSchema = new mongoose.Schema(
  {
    accountName: { type: String, required: true, trim: true },
    bankName: { type: String, required: true, trim: true },
    bankAccount: { type: String, required: true, trim: true },
    transferNote: { type: String, default: '', trim: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
)

module.exports = mongoose.model('AdminBank', adminBankSchema)
