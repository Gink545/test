const crypto = require('crypto')

function b64url(input) {
  return Buffer.from(input).toString('base64url')
}

function signToken(payload, secret, expiresInSec = 60 * 60 * 24 * 7) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + expiresInSec }
  const h = b64url(JSON.stringify(header))
  const p = b64url(JSON.stringify(body))
  const data = `${h}.${p}`
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${sig}`
}

function verifyToken(token, secret) {
  const [h, p, s] = String(token || '').split('.')
  if (!h || !p || !s) throw new Error('token格式错误')
  const data = `${h}.${p}`
  const expect = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  if (expect !== s) throw new Error('token签名无效')
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'))
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp && payload.exp < now) throw new Error('token过期')
  return payload
}

module.exports = { signToken, verifyToken }
