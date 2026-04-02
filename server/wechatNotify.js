const crypto = require('crypto')
const config = require('./config')

function decryptResource(resource) {
  if (!resource) throw new Error('缺少 resource')
  if (!config.wx.apiV3Key || config.wx.apiV3Key.length !== 32) {
    throw new Error('WX_API_V3_KEY 未配置或长度不是 32 字节')
  }

  const key = Buffer.from(config.wx.apiV3Key, 'utf8')
  const nonce = Buffer.from(resource.nonce, 'utf8')
  const aad = Buffer.from(resource.associated_data || '', 'utf8')
  const ciphertext = Buffer.from(resource.ciphertext, 'base64')

  const authTag = ciphertext.subarray(ciphertext.length - 16)
  const data = ciphertext.subarray(0, ciphertext.length - 16)

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAuthTag(authTag)
  decipher.setAAD(aad)

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return JSON.parse(decrypted.toString('utf8'))
}

module.exports = { decryptResource }
