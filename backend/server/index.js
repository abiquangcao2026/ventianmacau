// file: server/index.js
require('dotenv').config()
const path = require('path')
const express = require('express')
const http = require('http')
const cors = require('cors')
const { Server } = require('socket.io')
const bcrypt = require('bcrypt')

const connectDB = require('./config/db')
const authRoutes = require('./routes/auth')
const accountRoutes = require('./routes/account')
const adminRoutes = require('./routes/admin')
const gameRoutes = require('./routes/game')
const User = require('./models/User')
const { registerSicboHandlers, startRoomLoop } = require('./socket/sicbo')
const { registerKenoHandlers, startRoomLoop: startKenoRoomLoop } = require('./socket/keno')
const { registerChatHandlers } = require('./socket/chat')
const { syncSocketRealtimeSession } = require('./socket/realtime')
const { recordIncident } = require('./services/incidentLogger')

function parseAllowedOrigins() {
  const defaults = ['http://localhost:5173', 'http://127.0.0.1:5173']
  const raw = String(process.env.FRONTEND_ORIGINS || '').trim()
  if (!raw) {
    return defaults
  }

  const fromEnv = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return Array.from(new Set([...defaults, ...fromEnv]))
}

function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) {
    return true
  }

  return allowedOrigins.includes(origin)
}

function isMaintenanceEnabled() {
  const raw = String(process.env.MAINTENANCE_MODE || '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes'
}

let processIncidentHandlersInstalled = false
function installProcessIncidentHandlers() {
  if (processIncidentHandlersInstalled) return
  processIncidentHandlersInstalled = true

  process.on('unhandledRejection', (reason) => {
    void recordIncident({
      source: 'process',
      level: 'error',
      code: 'UNHANDLED_REJECTION',
      message: reason?.message || 'Unhandled promise rejection',
      error: reason,
      metadata: {
        type: 'unhandledRejection'
      }
    })
  })

  process.on('uncaughtException', (error) => {
    void recordIncident({
      source: 'process',
      level: 'error',
      code: 'UNCAUGHT_EXCEPTION',
      message: error?.message || 'Uncaught exception',
      error,
      metadata: {
        type: 'uncaughtException'
      }
    })
  })
}

async function ensureAdminAccount() {
  const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  const adminFullName = process.env.ADMIN_FULL_NAME || 'System Admin'

  const existingAdmin = await User.findOne({ username: adminUsername })
  if (existingAdmin) {
    let shouldSave = false

    if (existingAdmin.role !== 'admin') {
      existingAdmin.role = 'admin'
      shouldSave = true
    }

    if (existingAdmin.status !== 'active') {
      existingAdmin.status = 'active'
      shouldSave = true
    }

    if (String(existingAdmin.fullName || '').trim() !== String(adminFullName).trim()) {
      existingAdmin.fullName = adminFullName
      shouldSave = true
    }

    const matched = await bcrypt.compare(adminPassword, existingAdmin.passwordHash || '')
    if (!matched) {
      existingAdmin.passwordHash = await bcrypt.hash(adminPassword, 10)
      shouldSave = true
    }

    if (shouldSave) {
      await existingAdmin.save()
    }

    return
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10)
  await User.create({
    username: adminUsername,
    passwordHash,
    fullName: adminFullName,
    role: 'admin',
    balance: 0
  })

  console.log(`[Admin] Seeded default admin account: ${adminUsername}`)
}

async function bootstrap() {
  installProcessIncidentHandlers()
  await connectDB()
  await ensureAdminAccount()

  const app = express()
  const server = http.createServer(app)
  const allowedOrigins = parseAllowedOrigins()

  const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }

  const io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin(origin, callback) {
        if (isOriginAllowed(origin, allowedOrigins)) {
          return callback(null, true)
        }

        console.warn('[socket] unexpected origin, allowing for compatibility', origin)
        return callback(null, true)
      },
      methods: corsOptions.methods,
      allowedHeaders: corsOptions.allowedHeaders
    }
  })

  app.use(cors(corsOptions))
  app.options(/.*/, cors(corsOptions))
  app.use(express.json())

  app.use('/api/auth', authRoutes)
  app.use('/api/account', accountRoutes)
  app.use('/api/admin', adminRoutes)
  app.use('/api/game', gameRoutes)

  // Serve uploaded assets (chat images, etc.)
  const uploadsPath = path.resolve(__dirname, '../uploads')
  app.use('/uploads', express.static(uploadsPath))

  // Serve frontend static files (production)
  const distPath = path.resolve(__dirname, '../../frontend/dist')
  const distAssetsPath = path.join(distPath, 'assets')
  const maintenancePath = path.join(distPath, 'maintenance.html')
  app.use((req, res, next) => {
    if (!isMaintenanceEnabled()) {
      return next()
    }

    if (
      req.path.startsWith('/api/') ||
      req.path.startsWith('/uploads/') ||
      req.path.startsWith('/assets/') ||
      req.path.startsWith('/socket.io')
    ) {
      return next()
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    return res.status(503).sendFile(maintenancePath)
  })

  const assetStaticOptions = {
    fallthrough: false,
    index: false,
    setHeaders(res, filePath) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')

      if (filePath.endsWith('.js')) {
        res.type('application/javascript; charset=utf-8')
      } else if (filePath.endsWith('.css')) {
        res.type('text/css; charset=utf-8')
      } else if (filePath.endsWith('.html')) {
        res.type('text/html; charset=utf-8')
      }
    }
  }

  const distStaticOptions = {
    fallthrough: true,
    index: false,
    setHeaders(res, filePath) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')

      if (filePath.endsWith('.js')) {
        res.type('application/javascript; charset=utf-8')
      } else if (filePath.endsWith('.css')) {
        res.type('text/css; charset=utf-8')
      } else if (filePath.endsWith('.html')) {
        res.type('text/html; charset=utf-8')
      }
    }
  }

  app.use('/assets', express.static(distAssetsPath, assetStaticOptions))
  app.use(express.static(distPath, distStaticOptions))

  // SPA fallback — only for app routes, never for file-like requests
  app.get(/^(?!\/api\/|\/uploads\/|\/assets\/).*/, (req, res, next) => {
    if (path.extname(req.path || '')) {
      return next()
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    return res.sendFile(path.join(distPath, 'index.html'))
  })
  app.set('io', io)

  app.use((req, res) => {
    return res.status(404).json({ message: 'Route not found' })
  })

  app.use((err, req, res, _next) => {
    const isJsonSyntaxError = err instanceof SyntaxError && typeof err?.status === 'number' && err.status === 400 && 'body' in err
    const statusCode = isJsonSyntaxError
      ? 400
      : Math.min(Math.max(Number(err?.status || err?.statusCode || 500), 400), 599)
    const message = isJsonSyntaxError
      ? 'JSON không hợp lệ'
      : (statusCode >= 500 ? 'Máy chủ đang bận, vui lòng thử lại.' : String(err?.message || 'Yêu cầu không hợp lệ'))

    void recordIncident({
      source: 'api',
      level: statusCode >= 500 ? 'error' : 'warn',
      code: err?.code || (isJsonSyntaxError ? 'INVALID_JSON' : 'API_ERROR'),
      message,
      error: err,
      req,
      context: {
        userId: req.user?._id || null
      },
      metadata: {
        statusCode
      }
    })

    if (statusCode >= 500) {
      console.error('[api] unhandled error', err)
    }

    return res.status(statusCode).json({ message })
  })

  io.on('connection', (socket) => {
    syncSocketRealtimeSession(socket)
    console.log('[socket] connected', {
      id: socket.id,
      origin: socket.handshake?.headers?.origin || '',
      address: socket.handshake?.address || ''
    })
    registerSicboHandlers(io, socket)
    registerKenoHandlers(io, socket)
    registerChatHandlers(io, socket)
  })

  await Promise.all([
    startRoomLoop(io, 'sicbo-3p'),
    startRoomLoop(io, 'sicbo-5p'),
    startKenoRoomLoop(io, 'keno-1p'),
    startKenoRoomLoop(io, 'keno-3p'),
    startKenoRoomLoop(io, 'keno-5p')
  ])

  const PORT = process.env.PORT || 3000
  server.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT}`)
  })
}

bootstrap().catch((error) => {
  void recordIncident({
    source: 'process',
    level: 'error',
    code: 'BOOTSTRAP_FAILED',
    message: error?.message || 'Bootstrap failed',
    error
  })
  console.error('[Bootstrap Error]', error)
  process.exit(1)
})
