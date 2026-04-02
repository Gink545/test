const express = require('express')
const { v4: uuidv4 } = require('uuid')
const cors = require('cors')
const config = require('./config')
const { createJsapiPay } = require('./wechatPay')
const { createStore } = require('./store')
const { code2Session } = require('./wechatAuth')
const { decryptResource } = require('./wechatNotify')
const { signToken, verifyToken } = require('./authToken')
const { verifyWechatPaySignature } = require('./wechatVerify')

const app = express()
app.use(cors())
app.use(express.json())

let store

function ok(res, data = {}, message = 'ok') {
  return res.json({ code: 0, message, data })
}
function fail(res, message = '请求失败', code = 1, status = 400) {
  return res.status(status).json({ code, message })
}

async function getOrCreateUserByOpenid(openid) {
  let user = await store.getUserByOpenid(openid)
  if (!user) {
    user = await store.createUser({ id: `u_${Date.now()}`, openid, balance: 0 })
  }
  return user
}

app.use(async (req, res, next) => {
  if (req.path === '/api/auth/login' || req.path === '/api/health') return next()

  const auth = req.header('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return fail(res, '缺少 Bearer Token', 40101, 401)

  try {
    const payload = verifyToken(token, config.jwtSecret)
    const user = await store.getUserById(payload.userId)
    if (!user) return fail(res, '用户不存在，请重新登录', 40102, 401)
    req.user = user
    req.auth = payload
    next()
  } catch (e) {
    return fail(res, e.message || 'token无效', 40103, 401)
  }
})

app.get('/api/health', (req, res) => {
  ok(res, { now: Date.now(), payMode: config.payMode, storage: config.storage, env: config.nodeEnv })
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { code } = req.body || {}
    if (!code) return fail(res, '缺少 wx.login code')

    const session = await code2Session(code)
    const user = await getOrCreateUserByOpenid(session.openid)
    const token = signToken({ userId: user.id, openid: user.openid }, config.jwtSecret)

    ok(res, { userId: user.id, openid: user.openid, unionid: session.unionid || '', token })
  } catch (e) {
    fail(res, e.message || '登录失败', 50003, 500)
  }
})

app.get('/api/dishes', async (req, res) => {
  const list = await store.getDishes()
  ok(res, { list })
})

app.get('/api/cart', async (req, res) => {
  const items = await store.getCart(req.user.id)
  const amount = items.reduce((s, i) => s + i.price * i.quantity, 0)
  ok(res, { items, amount: Number(amount.toFixed(2)) })
})

app.put('/api/cart', async (req, res) => {
  const { items = [] } = req.body || {}
  if (!Array.isArray(items)) return fail(res, 'items 必须为数组')
  const dishes = await store.getDishes()
  for (const item of items) {
    if (!item.id || !item.quantity) return fail(res, '购物车项目参数缺失')
    const dish = dishes.find(d => d.id === item.id)
    if (!dish) return fail(res, `菜品不存在: ${item.id}`)
    if (item.quantity < 1) return fail(res, '数量必须大于 0')
    if (item.quantity > dish.stock) return fail(res, `${dish.name} 库存不足`)
  }
  await store.setCart(req.user.id, items.map(i => ({ id: i.id, quantity: Number(i.quantity) })))
  ok(res)
})

app.delete('/api/cart', async (req, res) => {
  await store.clearCart(req.user.id)
  ok(res)
})

app.post('/api/orders', async (req, res) => {
  try {
    const bodyItems = req.body?.items
    const cartItems = await store.getCart(req.user.id)
    const baseItems = Array.isArray(bodyItems) && bodyItems.length ? bodyItems : cartItems
    if (!baseItems.length) return fail(res, '购物车为空')

    const dishes = await store.getDishes()
    const normalized = []
    for (const item of baseItems) {
      const dish = dishes.find(d => d.id === item.id)
      if (!dish) return fail(res, `菜品不可下单: ${item.id}`)
      if (Number(item.quantity) > dish.stock) return fail(res, `${dish.name} 库存不足`)
      normalized.push({ id: dish.id, name: dish.name, price: Number(dish.price), quantity: Number(item.quantity) })
    }

    await store.reserveStock(normalized)

    const amount = normalized.reduce((s, i) => s + i.price * i.quantity, 0)
    const orderId = uuidv4()
    await store.createOrder({
      id: orderId,
      userId: req.user.id,
      items: normalized,
      amount,
      status: 'PENDING_PAY',
      createdAt: Date.now(),
      paidAt: null,
      payType: 'wechat'
    })

    const payParams = await createJsapiPay({
      outTradeNo: orderId,
      amountFen: Math.round(amount * 100),
      description: '餐饮订单支付',
      openid: req.user.openid
    })

    ok(res, { orderId, payParams, amount: Number(amount.toFixed(2)) })
  } catch (e) {
    fail(res, e.message || '创建订单失败', 50001, 500)
  }
})

app.get('/api/orders', async (req, res) => {
  const { status } = req.query
  const list = await store.listOrders(req.user.id, status)
  ok(res, {
    list: list.map(o => ({
      id: o.id,
      amount: Number(o.amount.toFixed(2)),
      status: o.status,
      createdAt: o.createdAt,
      paidAt: o.paidAt
    }))
  })
})

app.get('/api/orders/:id', async (req, res) => {
  const order = await store.getOrderById(req.params.id)
  if (!order || order.userId !== req.user.id) return fail(res, '订单不存在', 40401, 404)
  ok(res, order)
})

app.post('/api/orders/:id/cancel', async (req, res) => {
  const order = await store.getOrderById(req.params.id)
  if (!order || order.userId !== req.user.id) return fail(res, '订单不存在', 40401, 404)
  if (order.status !== 'PENDING_PAY') return fail(res, '当前状态不可取消')
  await store.updateOrder(order.id, { status: 'CANCELLED' })
  ok(res)
})

if (config.enableDebugPaidApi) {
  app.post('/api/orders/:id/paid', async (req, res) => {
    const order = await store.getOrderById(req.params.id)
    if (!order || order.userId !== req.user.id) return fail(res, '订单不存在', 40401, 404)
    if (order.status !== 'PAID') {
      await store.updateOrder(order.id, { status: 'PAID', paidAt: Date.now() })
    }
    ok(res)
  })

  app.post('/api/member/recharge/:id/paid', async (req, res) => {
    const recharge = await store.getRechargeById(req.params.id)
    if (!recharge || recharge.userId !== req.user.id) return fail(res, '充值记录不存在', 40402, 404)
    if (recharge.status !== 'PAID') {
      await store.updateRecharge(recharge.id, { status: 'PAID', paidAt: Date.now() })
      await store.addBalance(req.user.id, recharge.amount)
    }
    ok(res)
  })
}

app.get('/api/member/profile', async (req, res) => {
  const user = await store.getUserById(req.user.id)
  ok(res, { id: user.id, balance: Number(user.balance.toFixed(2)) })
})

app.post('/api/member/recharge', async (req, res) => {
  try {
    const amount = Number(req.body?.amount || 0)
    if (amount <= 0) return fail(res, '充值金额非法')

    const rechargeId = uuidv4()
    await store.createRecharge({
      id: rechargeId,
      userId: req.user.id,
      amount,
      status: 'PENDING_PAY',
      createdAt: Date.now(),
      paidAt: null
    })

    const payParams = await createJsapiPay({
      outTradeNo: rechargeId,
      amountFen: Math.round(amount * 100),
      description: '会员充值',
      openid: req.user.openid
    })

    ok(res, { rechargeId, payParams })
  } catch (e) {
    fail(res, e.message || '发起充值失败', 50002, 500)
  }
})

app.get('/api/member/recharges', async (req, res) => {
  const list = await store.listRecharges(req.user.id)
  ok(res, { list: list.map(r => ({ ...r, amount: Number(r.amount.toFixed(2)) })) })
})

app.post('/api/pay/notify', async (req, res) => {
  try {
    if (config.payMode === 'wechat_v3') {
      const signOk = verifyWechatPaySignature(req, config.wx.platformCertPath)
      if (!signOk) return res.status(401).json({ code: 'FAIL', message: '回调签名校验失败' })
    }

    let outTradeNo = req.body?.out_trade_no
    let tradeState = req.body?.trade_state
    const transactionId = req.body?.transaction_id || req.body?.id || `txn_${Date.now()}`

    if (!outTradeNo && req.body?.resource) {
      const plain = decryptResource(req.body.resource)
      outTradeNo = plain.out_trade_no
      tradeState = plain.trade_state
    }

    if (!outTradeNo) return fail(res, '缺少 out_trade_no')

    const firstSeen = await store.recordPaymentEvent(transactionId, outTradeNo)
    if (!firstSeen) return res.status(200).json({ code: 'SUCCESS', message: '重复通知忽略' })

    if (tradeState === 'SUCCESS') {
      const order = await store.getOrderById(outTradeNo)
      if (order && order.status !== 'PAID') {
        await store.updateOrder(order.id, { status: 'PAID', paidAt: Date.now() })
      }

      const recharge = await store.getRechargeById(outTradeNo)
      if (recharge && recharge.status !== 'PAID') {
        await store.updateRecharge(recharge.id, { status: 'PAID', paidAt: Date.now() })
        await store.addBalance(recharge.userId, recharge.amount)
      }
    }

    return res.status(200).json({ code: 'SUCCESS', message: '成功' })
  } catch (e) {
    return res.status(500).json({ code: 'FAIL', message: e.message || '回调处理失败' })
  }
})

async function bootstrap() {
  if (config.nodeEnv === 'production' && config.jwtSecret === 'change_me_in_production') {
    throw new Error('生产环境必须设置 JWT_SECRET')
  }

  store = await createStore()
  app.listen(config.port, () => {
    console.log(`server running on http://localhost:${config.port}, payMode=${config.payMode}, storage=${config.storage}, env=${config.nodeEnv}`)
  })
}

bootstrap().catch((e) => {
  console.error('server bootstrap failed', e)
  process.exit(1)
})
