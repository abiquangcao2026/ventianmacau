const mongoose = require('mongoose')

const userAdminChangeLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    adminSnapshot: {
      username: {
        type: String,
        default: ''
      },
      fullName: {
        type: String,
        default: ''
      }
    },
    action: {
      type: String,
      enum: ['account_created', 'profile_update', 'bank_update', 'security_update', 'status_update', 'vip_update', 'password_view'],
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
    note: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
)

module.exports =
  mongoose.models.UserAdminChangeLog ||
  mongoose.model('UserAdminChangeLog', userAdminChangeLogSchema)
