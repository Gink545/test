const { getCart, updateQuantity, totalAmount, clearCart } = require('../../utils/cart')
const { request } = require('../../utils/request')

Page({
  data: { cart: [], total: 0 },

  onShow() {
    this.refresh()
  },

  refresh() {
    const cart = getCart()
    this.setData({ cart, total: totalAmount(cart).toFixed(2) })
  },

  inc(e) {
    const { id, quantity } = e.currentTarget.dataset
    updateQuantity(id, quantity + 1)
    this.refresh()
  },

  dec(e) {
    const { id, quantity } = e.currentTarget.dataset
    updateQuantity(id, quantity - 1)
    this.refresh()
  },

  async checkout() {
    if (!this.data.cart.length) {
      wx.showToast({ title: '购物车为空', icon: 'none' })
      return
    }
    try {
      const order = await request({
        url: '/api/orders',
        method: 'POST',
        data: { items: this.data.cart }
      })

      await new Promise((resolve, reject) => {
        wx.requestPayment({
          ...order.payParams,
          success: resolve,
          fail: reject
        })
      })

      await request({ url: `/api/orders/${order.orderId}/paid`, method: 'POST' })
      clearCart()
      this.refresh()
      wx.showToast({ title: '支付成功' })
      wx.switchTab({ url: '/pages/orders/index' })
    } catch (e) {
      wx.showToast({ title: e.errMsg || e.message || '支付失败', icon: 'none' })
    }
  }
})
