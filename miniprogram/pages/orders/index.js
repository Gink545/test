const { request } = require('../../utils/request')

Page({
  data: { list: [] },

  onShow() {
    this.loadOrders()
  },

  async loadOrders() {
    try {
      const data = await request({ url: '/api/orders' })
      this.setData({ list: data.list || [] })
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
    }
  }
})
