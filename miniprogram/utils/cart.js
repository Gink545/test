const CART_KEY = 'ORDER_CART'

function getCart() {
  return wx.getStorageSync(CART_KEY) || []
}

function setCart(cart) {
  wx.setStorageSync(CART_KEY, cart)
}

function addToCart(dish) {
  const cart = getCart()
  const idx = cart.findIndex(i => i.id === dish.id)
  if (idx >= 0) {
    cart[idx].quantity += 1
  } else {
    cart.push({ ...dish, quantity: 1 })
  }
  setCart(cart)
  return cart
}

function updateQuantity(id, quantity) {
  const cart = getCart().map(i => i.id === id ? { ...i, quantity } : i).filter(i => i.quantity > 0)
  setCart(cart)
  return cart
}

function clearCart() {
  setCart([])
}

function totalAmount(cart = getCart()) {
  return cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
}

module.exports = { getCart, setCart, addToCart, updateQuantity, clearCart, totalAmount }
