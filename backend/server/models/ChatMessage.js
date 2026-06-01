const mongoose = require('mongoose')

const chatMessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true
    },
    // For support rooms `support:<userId>`, store the userId for easy joins in admin.
    roomUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    senderName: {
      type: String,
      required: true
    },
    senderRole: {
      type: String,
      enum: ['user', 'admin', 'system'],
      default: 'user'
    },
    clientMessageId: {
      type: String,
      default: '',
      maxlength: 80
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file'],
      default: 'text'
    },
    attachmentType: {
      type: String,
      enum: ['none', 'image', 'sticker', 'vip'],
      default: 'none'
    },
    content: {
      type: String,
      default: '',
      maxlength: 2000
    },
    imageUrl: {
      type: String,
      default: '',
      maxlength: 500
    },
    fileUrl: {
      type: String,
      default: '',
      maxlength: 500
    },
    fileName: {
      type: String,
      default: '',
      maxlength: 260
    },
    fileMime: {
      type: String,
      default: '',
      maxlength: 120
    },
    fileSize: {
      type: Number,
      default: 0
    },
    systemType: {
      type: String,
      enum: ['', 'welcome_seed', 'auto_reply_first', 'away_reply'],
      default: ''
    },
    visibleAfterFirstUserReply: {
      type: Boolean,
      default: false
    },
    seenByUserAt: {
      type: Date,
      default: null,
      index: true
    },
    editedAt: {
      type: Date,
      default: null
    },
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    originalContent: {
      type: String,
      default: '',
      maxlength: 2000,
      select: false
    },
    senderMeta: {
      username: { type: String, default: '' },
      userCode: { type: String, default: '' },
      displayName: { type: String, default: '' },
      characterName: { type: String, default: '' }
    }
  },
  {
    timestamps: true
  }
)

chatMessageSchema.index({ roomId: 1, createdAt: -1 })

module.exports = mongoose.model('ChatMessage', chatMessageSchema)
