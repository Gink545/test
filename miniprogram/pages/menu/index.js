const { request } = require('../../utils/request')
const { addToCart } = require('../../utils/cart')

Page({
  data: { dishes: [] },

  onShow() {
    this.loadDishes()
  },

  async loadDishes() {
    try {
      const data = await request({ url: '/api/dishes' })
      this.setData({ dishes: data.list || [] })
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
    }
  },

  addDish(e) {
    const dish = e.currentTarget.dataset.dish
    addToCart(dish)
    wx.showToast({ title: '已加入购物车' })
  }
})
