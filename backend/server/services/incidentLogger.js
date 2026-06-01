const crypto = require('crypto')
const IncidentLog = require('../models/IncidentLog')

const REDACT_KEYS = ['password', 'withdrawpassword', 'token', 'authorization', 'cookie', 'secret']
const DEDUP_WINDOW_MS = 5 * 60 * 1000

function safeToString(value, maxLength = 2000) {
  return String(value || '').trim().slice(0, maxLength)
}

function isRedactKey(key) {
  const normalized = String(key || '').toLowerCase()
  return REDACT_KEYS.some((item) => normalized.includes(item))
}

function sanitizeValue(value, depth = 0) {
  if (depth > 4) return '[depth-limited]'
  if (value === null || value === undefined) return value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') return value.slice(0, 1200)
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1))

  if (typeof value === 'object') {
    const output = {}
    for (const [key, item] of Object.entries(value).slice(0, 40)) {
      if (isRedactKey(key)) {
        output[key] = '[redacted]'
      } else {
        output[key] = sanitizeValue(item, depth + 1)
      }
    }
    return output
  }

  return safeToString(value, 500)
}

function buildRequestSnapshot(req) {
  if (!req) return {}
  return {
    method: safeToString(req.method, 20),
    path: safeToString(req.originalUrl || req.path, 300),
    ip: safeToString(req.ip || req.socket?.remoteAddress || '', 100),
    userAgent: safeToString(req.headers?.['user-agent'], 400),
    origin: safeToString(req.headers?.origin, 200),
    referer: safeToString(req.headers?.referer, 300),
    query: sanitizeValue(req.query || {}),
    bodyPreview: sanitizeValue(req.body || {})
  }
}

function buildFingerprint(payload = {}) {
  const base = [
    safeToString(payload.source, 30),
    safeToString(payload.level, 10),
    safeToString(payload.code, 100),
    safeToString(payload.message, 500),
    safeToString(payload.request?.path, 220),
    safeToString(payload.context?.roomId, 80),
    safeToString(payload.context?.socketId, 80),
    safeToString(payload.context?.userId, 80)
  ].join('|')
  return crypto.createHash('sha1').update(base).digest('hex')
}

function mapErrorToStack(error) {
  if (!error) return ''
  if (typeof error.stack === 'string') return error.stack.slice(0, 20000)
  return safeToString(error.message || error, 20000)
}

async function recordIncident(payload = {}) {
  try {
    const now = new Date()
    const source = ['api', 'socket', 'upload', 'process', 'system'].includes(payload.source) ? payload.source : 'system'
    const level = ['error', 'warn', 'info'].includes(payload.level) ? payload.level : 'error'
    const message = safeToString(payload.message || payload.error?.message || 'Unknown incident', 2000)
    const fingerprint = buildFingerprint({
      ...payload,
      source,
      level,
      message
    })

    const baseDoc = {
      source,
      level,
      code: safeToString(payload.code, 100),
      message,
      fingerprint,
      request: sanitizeValue(payload.request || {}),
      context: {
        userId: payload.context?.userId || null,
        roomId: safeToString(payload.context?.roomId, 120),
        socketId: safeToString(payload.context?.socketId, 120)
      },
      metadata: sanitizeValue(payload.metadata || {}),
      stack: mapErrorToStack(payload.error || payload.stack),
      lastSeenAt: now
    }

    if (payload.req) {
      baseDoc.request = buildRequestSnapshot(payload.req)
    }

    const existing = await IncidentLog.findOne({
      fingerprint,
      createdAt: { $gte: new Date(now.getTime() - DEDUP_WINDOW_MS) }
    })
      .sort({ createdAt: -1 })
      .select('_id count status')

    if (existing?._id) {
      existing.count = Number(existing.count || 1) + 1
      existing.lastSeenAt = now
      if (!existing.status || existing.status === 'resolved') {
        existing.status = 'open'
      }
      await existing.save()
      return existing
    }

    return IncidentLog.create({
      ...baseDoc,
      firstSeenAt: now,
      count: 1,
      status: 'open'
    })
  } catch (error) {
    console.error('[incident] failed to record incident', error?.message || error)
    return null
  }
}

module.exports = {
  recordIncident,
  sanitizeValue,
  buildRequestSnapshot
}
