const mongoose = require('mongoose')

const incidentLogSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: ['api', 'socket', 'upload', 'process', 'system'],
      default: 'system',
      index: true
    },
    level: {
      type: String,
      enum: ['error', 'warn', 'info'],
      default: 'error',
      index: true
    },
    code: {
      type: String,
      default: '',
      maxlength: 100,
      index: true
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000
    },
    fingerprint: {
      type: String,
      default: '',
      maxlength: 64,
      index: true
    },
    count: {
      type: Number,
      default: 1
    },
    status: {
      type: String,
      enum: ['open', 'investigating', 'resolved', 'ignored'],
      default: 'open',
      index: true
    },
    resolvedNote: {
      type: String,
      default: '',
      maxlength: 1000
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    firstSeenAt: {
      type: Date,
      default: Date.now
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    context: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      roomId: { type: String, default: '' },
      socketId: { type: String, default: '' }
    },
    request: {
      method: { type: String, default: '' },
      path: { type: String, default: '' },
      ip: { type: String, default: '' },
      userAgent: { type: String, default: '' },
      origin: { type: String, default: '' },
      referer: { type: String, default: '' },
      query: { type: mongoose.Schema.Types.Mixed, default: {} },
      bodyPreview: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    stack: {
      type: String,
      default: '',
      maxlength: 20000
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
)

incidentLogSchema.index({ createdAt: -1 })
incidentLogSchema.index({ source: 1, level: 1, status: 1, createdAt: -1 })

module.exports =
  mongoose.models.IncidentLog ||
  mongoose.model('IncidentLog', incidentLogSchema)
