const { request } = require('../../utils/request')

Page({
  data: { balance: 0, amount: 100 },

  onShow() {
    this.loadProfile()
  },

  async loadProfile() {
    try {
      const data = await request({ url: '/api/member/profile' })
      this.setData({ balance: data.balance || 0 })
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
    }
  },

  inputAmount(e) {
    this.setData({ amount: Number(e.detail.value || 0) })
  },

  async recharge() {
    if (this.data.amount <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    try {
      const data = await request({
        url: '/api/member/recharge',
        method: 'POST',
        data: { amount: this.data.amount }
      })
      await new Promise((resolve, reject) => {
        wx.requestPayment({ ...data.payParams, success: resolve, fail: reject })
      })
      await request({ url: `/api/member/recharge/${data.rechargeId}/paid`, method: 'POST' })
      wx.showToast({ title: '充值成功' })
      this.loadProfile()
    } catch (e) {
      wx.showToast({ title: e.errMsg || e.message || '充值失败', icon: 'none' })
    }
  }
})
