const crypto = require('crypto')
const axios = require('axios')
const config = require('./config')

function randomStr(len = 16) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len)
}

function buildClientPayParams(prepayId) {
  const timeStamp = String(Math.floor(Date.now() / 1000))
  const nonceStr = randomStr(16)
  const pkg = `prepay_id=${prepayId}`
  const signType = 'RSA'

  const message = `${config.wx.appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`
  const paySign = crypto
    .createSign('RSA-SHA256')
    .update(message)
    .sign(config.wx.privateKey, 'base64')

  return { timeStamp, nonceStr, package: pkg, signType, paySign }
}

function mockJsapiPayParams(outTradeNo, totalFeeFen) {
  const timeStamp = String(Math.floor(Date.now() / 1000))
  const nonceStr = randomStr(16)
  const pkg = `prepay_id=mock_${outTradeNo}`
  const paySign = crypto
    .createHash('sha256')
    .update(`${timeStamp}\n${nonceStr}\n${pkg}\n${totalFeeFen}`)
    .digest('hex')
  return { timeStamp, nonceStr, package: pkg, signType: 'RSA', paySign }
}

function buildAuthHeader(method, path, body = '') {
  const nonceStr = randomStr(32)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const message = `${method}\n${path}\n${timestamp}\n${nonceStr}\n${body}\n`
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(message)
    .sign(config.wx.privateKey, 'base64')

  return `WECHATPAY2-SHA256-RSA2048 mchid=\"${config.wx.mchid}\",nonce_str=\"${nonceStr}\",timestamp=\"${timestamp}\",serial_no=\"${config.wx.serialNo}\",signature=\"${signature}\"`
}

async function createJsapiPay({ outTradeNo, amountFen, description, openid }) {
  if (config.payMode === 'mock') {
    return mockJsapiPayParams(outTradeNo, amountFen)
  }

  const path = '/v3/pay/transactions/jsapi'
  const bodyObj = {
    appid: config.wx.appid,
    mchid: config.wx.mchid,
    description,
    out_trade_no: outTradeNo,
    notify_url: config.wx.notifyUrl,
    amount: { total: amountFen, currency: 'CNY' },
    payer: { openid }
  }
  const body = JSON.stringify(bodyObj)

  const res = await axios.post(`https://api.mch.weixin.qq.com${path}`, bodyObj, {
    headers: {
      Authorization: buildAuthHeader('POST', path, body),
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    timeout: 10000
  })

  return buildClientPayParams(res.data.prepay_id)
}

module.exports = { createJsapiPay }
