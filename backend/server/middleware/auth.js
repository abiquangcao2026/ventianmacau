const User = require('../models/User')
const { verifyAccessToken, sanitizeUser } = require('../utils/auth')

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || ''
    const [scheme, token] = authHeader.split(' ')

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Bạn chưa đăng nhập' })
    }

    const payload = verifyAccessToken(token)
    const user = await User.findById(payload.sub)

    if (!user) {
      return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ' })
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Tài khoản đã bị khóa' })
    }

    req.auth = payload
    req.user = user
    req.safeUser = sanitizeUser(user)
    return next()
  } catch (error) {
    return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ' })
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền truy cập khu vực quản trị' })
  }

  return next()
}

module.exports = {
  requireAuth,
  requireAdmin
}
