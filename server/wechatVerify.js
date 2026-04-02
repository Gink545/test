const fs = require('fs')
const crypto = require('crypto')

function verifyWechatPaySignature(req, certPath) {
  if (!certPath) return false
  const serial = req.header('Wechatpay-Serial')
  const signature = req.header('Wechatpay-Signature')
  const timestamp = req.header('Wechatpay-Timestamp')
  const nonce = req.header('Wechatpay-Nonce')
  if (!serial || !signature || !timestamp || !nonce) return false

  const body = JSON.stringify(req.body || {})
  const message = `${timestamp}\n${nonce}\n${body}\n`
  const cert = fs.readFileSync(certPath, 'utf8')
  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(message)
  return verifier.verify(cert, signature, 'base64')
}

module.exports = { verifyWechatPaySignature }
