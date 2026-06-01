// file: server/models/User.js
const mongoose = require('mongoose')

function generateCode(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
}

function normalizeReferralForUserCode(rawValue) {
  const normalized = String(rawValue || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10)

  return normalized || '0000'
}

function buildUserCodeCandidate(referredByCode = '') {
  const prefix = normalizeReferralForUserCode(referredByCode)
  const suffix = String(Math.floor(Math.random() * 99999) + 1).padStart(2, '0')
  return `MGT${prefix}-NCS${suffix}`
}

const userSchema = new mongoose.Schema(
  {
    userCode: {
      type: String,
      unique: true,
      trim: true,
      index: true
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    password_encrypted: {
      type: String,
      default: '',
      select: false
    },
    withdrawPasswordHash: {
      type: String,
      default: ''
    },
    withdraw_password_encrypted: {
      type: String,
      default: '',
      select: false
    },
    fullName: {
      type: String,
      trim: true,
      default: ''
    },
    // "Tên gợi nhớ" - nickname for CSKH/admin readability.
    displayName: {
      type: String,
      trim: true,
      default: ''
    },
    // "Tên nhân vật" - in-game character name.
    characterName: {
      type: String,
      trim: true,
      default: ''
    },
    chatTag: {
      type: String,
      enum: ['', 'moi_ngon', 'cho_lam_thit', 'da_thit_xong_7_mon'],
      default: '',
      index: true
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    referredByCode: {
      type: String,
      trim: true,
      default: ''
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      index: true
    },
    inviteCode: {
      type: String,
      unique: true,
      trim: true,
      index: true,
      default: () => generateCode('REF')
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['active', 'locked'],
      default: 'active',
      index: true
    },
    linkedBank: {
      bankName: { type: String, trim: true, default: '' },
      bankAccount: { type: String, trim: true, default: '' },
      accountName: { type: String, trim: true, default: '' }
    },
    vipLevel: {
      type: Number,
      default: 0,
      min: 0
    },
    lastLoginIp: {
      type: String,
      trim: true,
      default: ''
    },
    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
)

userSchema.pre('validate', async function setDerivedCodes() {
  if (!this.inviteCode) {
    this.inviteCode = generateCode('REF')
  }

  if (!this.userCode) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const candidate = buildUserCodeCandidate(this.referredByCode)
      // eslint-disable-next-line no-await-in-loop
      const exists = await this.constructor.exists({
        _id: { $ne: this._id },
        userCode: candidate
      })

      if (!exists) {
        this.userCode = candidate
        break
      }
    }

    if (!this.userCode) {
      this.userCode = `${buildUserCodeCandidate(this.referredByCode)}${Date.now().toString().slice(-2)}`
    }
  }
})

module.exports = mongoose.model('User', userSchema)
