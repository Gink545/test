const app = getApp()

function request({ url, method = 'GET', data = {} }, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBase}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        Authorization: app.globalData.token || '',
        'X-User-Id': options.noUser ? '' : (app.globalData.userId || '')
      },
      success: (res) => {
        if (!(res.statusCode >= 200 && res.statusCode < 300)) {
          return reject(new Error(res.data?.message || '请求失败'))
        }

        const payload = res.data || {}
        if (typeof payload.code === 'number') {
          if (payload.code === 0) return resolve(payload.data || {})
          return reject(new Error(payload.message || '业务失败'))
        }

        resolve(payload)
      },
      fail: reject
    })
  })
}

module.exports = { request }
