const { request } = require('./utils/request')

App({
  globalData: {
    apiBase: 'http://localhost:3000',
    userInfo: null,
    userId: '',
    token: ''
  },

  async onLaunch() {
    try {
      const { code } = await wx.login()
      const loginRes = await request({ url: '/api/auth/login', method: 'POST', data: { code } }, { noAuth: true })
      this.globalData.userId = loginRes.userId
      this.globalData.token = loginRes.token || ''
    } catch (e) {
      console.error('登录失败', e)
    }
  }
})
