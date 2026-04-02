const axios = require('axios')
const config = require('./config')

async function code2Session(code) {
  if (!config.wx.appid || !config.wx.appSecret) {
    return { openid: `mock_${code}` }
  }

  const url = 'https://api.weixin.qq.com/sns/jscode2session'
  const { data } = await axios.get(url, {
    params: {
      appid: config.wx.appid,
      secret: config.wx.appSecret,
      js_code: code,
      grant_type: 'authorization_code'
    },
    timeout: 8000
  })

  if (data.errcode) {
    throw new Error(`code2Session失败: ${data.errmsg || data.errcode}`)
  }
  return { openid: data.openid, sessionKey: data.session_key, unionid: data.unionid }
}

module.exports = { code2Session }
