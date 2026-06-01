const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'

function getVaultSecret() {
  return (
    process.env.PASSWORD_ENCRYPTION_SECRET ||
    process.env.SECRET_KEY ||
    process.env.JWT_SECRET ||
    'casino-game-dev-secret'
  )
}

function buildKey() {
  return crypto.createHash('sha256').update(String(getVaultSecret())).digest()
}

function encryptSecret(rawValue) {
  const value = String(rawValue || '')
  if (!value) return ''

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, buildKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return ['v1', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':')
}

function decryptSecret(payload) {
  const value = String(payload || '')
  if (!value) return ''

  const [version, ivRaw, tagRaw, encryptedRaw] = value.split(':')
  if (version !== 'v1' || !ivRaw || !tagRaw || !encryptedRaw) return ''

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, buildKey(), Buffer.from(ivRaw, 'base64'))
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, 'base64')),
      decipher.final()
    ])
    return decrypted.toString('utf8')
  } catch {
    return ''
  }
}

module.exports = {
  encryptSecret,
  decryptSecret
}
