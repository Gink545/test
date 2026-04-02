const mysql = require('mysql2/promise')
const config = require('./config')

const dishes = [
  { id: 'd1', name: '宫保鸡丁饭', price: 22, stock: 999, status: 'ON' },
  { id: 'd2', name: '番茄牛腩面', price: 28, stock: 999, status: 'ON' },
  { id: 'd3', name: '可乐', price: 5, stock: 999, status: 'ON' }
]

class MemoryStore {
  constructor() {
    this.users = [{ id: 'u1', openid: 'mock_openid_u1', balance: 0 }]
    this.carts = {}
    this.orders = []
    this.recharges = []
  }
  async init() {}
  async getDishes() { return dishes.filter(d => d.status === 'ON') }
  async getUserById(id) { return this.users.find(u => u.id === id) || null }
  async getUserByOpenid(openid) { return this.users.find(u => u.openid === openid) || null }
  async createUser(user) { this.users.push(user); return user }
  async getCart(userId) { return this.carts[userId] || [] }
  async setCart(userId, items) { this.carts[userId] = items }
  async clearCart(userId) { this.carts[userId] = [] }
  async createOrder(order) { this.orders.unshift(order) }
  async getOrderById(orderId) { return this.orders.find(o => o.id === orderId) || null }
  async listOrders(userId, status) { return this.orders.filter(o => o.userId === userId && (!status || o.status === status)) }
  async updateOrder(orderId, patch) {
    const o = this.orders.find(x => x.id === orderId)
    if (!o) return null
    Object.assign(o, patch)
    return o
  }
  async createRecharge(r) { this.recharges.unshift(r) }
  async getRechargeById(id) { return this.recharges.find(r => r.id === id) || null }
  async listRecharges(userId) { return this.recharges.filter(r => r.userId === userId) }
  async updateRecharge(id, patch) {
    const r = this.recharges.find(x => x.id === id)
    if (!r) return null
    Object.assign(r, patch)
    return r
  }
  async addBalance(userId, amount) {
    const u = this.users.find(x => x.id === userId)
    if (u) u.balance += amount
    return u
  }
}

class MysqlStore {
  constructor() {
    this.pool = mysql.createPool(config.mysql)
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        openid VARCHAR(128) NOT NULL UNIQUE,
        balance DECIMAL(10,2) NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS dishes (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        stock INT NOT NULL DEFAULT 0,
        status VARCHAR(16) NOT NULL DEFAULT 'ON'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        user_id VARCHAR(64) NOT NULL,
        dish_id VARCHAR(64) NOT NULL,
        quantity INT NOT NULL,
        PRIMARY KEY (user_id, dish_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(32) NOT NULL,
        created_at BIGINT NOT NULL,
        paid_at BIGINT NULL,
        pay_type VARCHAR(32) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        order_id VARCHAR(64) NOT NULL,
        dish_id VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        quantity INT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS recharges (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(32) NOT NULL,
        created_at BIGINT NOT NULL,
        paid_at BIGINT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)

    for (const d of dishes) {
      await this.pool.query(
        `INSERT INTO dishes (id,name,price,stock,status) VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE name=VALUES(name),price=VALUES(price),stock=VALUES(stock),status=VALUES(status)`,
        [d.id, d.name, d.price, d.stock, d.status]
      )
    }

    await this.pool.query(
      `INSERT INTO users (id,openid,balance,created_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE openid=openid`,
      ['u1', 'mock_openid_u1', 0, Date.now()]
    )
  }

  async getDishes() {
    const [rows] = await this.pool.query(`SELECT id,name,price,stock,status FROM dishes WHERE status='ON'`)
    return rows.map(r => ({ ...r, price: Number(r.price) }))
  }
  async getUserById(id) {
    const [rows] = await this.pool.query(`SELECT id,openid,balance FROM users WHERE id=? LIMIT 1`, [id])
    if (!rows[0]) return null
    return { ...rows[0], balance: Number(rows[0].balance) }
  }
  async getUserByOpenid(openid) {
    const [rows] = await this.pool.query(`SELECT id,openid,balance FROM users WHERE openid=? LIMIT 1`, [openid])
    if (!rows[0]) return null
    return { ...rows[0], balance: Number(rows[0].balance) }
  }
  async createUser(user) {
    await this.pool.query(`INSERT INTO users (id,openid,balance,created_at) VALUES (?,?,?,?)`, [user.id, user.openid, user.balance, Date.now()])
    return user
  }
  async getCart(userId) {
    const [rows] = await this.pool.query(
      `SELECT d.id,d.name,d.price,c.quantity FROM cart_items c JOIN dishes d ON c.dish_id=d.id WHERE c.user_id=?`,
      [userId]
    )
    return rows.map(r => ({ ...r, price: Number(r.price) }))
  }
  async setCart(userId, items) {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query(`DELETE FROM cart_items WHERE user_id=?`, [userId])
      for (const i of items) {
        await conn.query(`INSERT INTO cart_items (user_id,dish_id,quantity) VALUES (?,?,?)`, [userId, i.id, i.quantity])
      }
      await conn.commit()
    } catch (e) {
      await conn.rollback(); throw e
    } finally { conn.release() }
  }
  async clearCart(userId) { await this.pool.query(`DELETE FROM cart_items WHERE user_id=?`, [userId]) }
  async createOrder(order) {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query(`INSERT INTO orders (id,user_id,amount,status,created_at,paid_at,pay_type) VALUES (?,?,?,?,?,?,?)`,
        [order.id, order.userId, order.amount, order.status, order.createdAt, order.paidAt, order.payType])
      for (const i of order.items) {
        await conn.query(`INSERT INTO order_items (order_id,dish_id,name,price,quantity) VALUES (?,?,?,?,?)`,
          [order.id, i.id, i.name, i.price, i.quantity])
      }
      await conn.commit()
    } catch (e) {
      await conn.rollback(); throw e
    } finally { conn.release() }
  }
  async getOrderById(orderId) {
    const [orders] = await this.pool.query(`SELECT * FROM orders WHERE id=? LIMIT 1`, [orderId])
    if (!orders[0]) return null
    const [items] = await this.pool.query(`SELECT dish_id AS id,name,price,quantity FROM order_items WHERE order_id=?`, [orderId])
    const o = orders[0]
    return {
      id: o.id, userId: o.user_id, amount: Number(o.amount), status: o.status,
      createdAt: o.created_at, paidAt: o.paid_at, payType: o.pay_type,
      items: items.map(i => ({ ...i, price: Number(i.price) }))
    }
  }
  async listOrders(userId, status) {
    const sql = status ? `SELECT * FROM orders WHERE user_id=? AND status=? ORDER BY created_at DESC` : `SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC`
    const [rows] = await this.pool.query(sql, status ? [userId, status] : [userId])
    return rows.map(r => ({ id: r.id, userId: r.user_id, amount: Number(r.amount), status: r.status, createdAt: r.created_at, paidAt: r.paid_at }))
  }
  async updateOrder(orderId, patch) {
    const fields = []; const vals = []
    for (const [k, v] of Object.entries(patch)) {
      const key = k === 'paidAt' ? 'paid_at' : k
      fields.push(`${key}=?`); vals.push(v)
    }
    if (!fields.length) return this.getOrderById(orderId)
    vals.push(orderId)
    await this.pool.query(`UPDATE orders SET ${fields.join(',')} WHERE id=?`, vals)
    return this.getOrderById(orderId)
  }
  async createRecharge(r) {
    await this.pool.query(`INSERT INTO recharges (id,user_id,amount,status,created_at,paid_at) VALUES (?,?,?,?,?,?)`, [r.id, r.userId, r.amount, r.status, r.createdAt, r.paidAt])
  }
  async getRechargeById(id) {
    const [rows] = await this.pool.query(`SELECT * FROM recharges WHERE id=? LIMIT 1`, [id])
    if (!rows[0]) return null
    const r = rows[0]
    return { id: r.id, userId: r.user_id, amount: Number(r.amount), status: r.status, createdAt: r.created_at, paidAt: r.paid_at }
  }
  async listRecharges(userId) {
    const [rows] = await this.pool.query(`SELECT * FROM recharges WHERE user_id=? ORDER BY created_at DESC`, [userId])
    return rows.map(r => ({ id: r.id, userId: r.user_id, amount: Number(r.amount), status: r.status, createdAt: r.created_at, paidAt: r.paid_at }))
  }
  async updateRecharge(id, patch) {
    const fields = []; const vals = []
    for (const [k, v] of Object.entries(patch)) {
      const key = k === 'paidAt' ? 'paid_at' : k
      fields.push(`${key}=?`); vals.push(v)
    }
    if (!fields.length) return this.getRechargeById(id)
    vals.push(id)
    await this.pool.query(`UPDATE recharges SET ${fields.join(',')} WHERE id=?`, vals)
    return this.getRechargeById(id)
  }
  async addBalance(userId, amount) {
    await this.pool.query(`UPDATE users SET balance = balance + ? WHERE id=?`, [amount, userId])
    return this.getUserById(userId)
  }
}

async function createStore() {
  const store = config.storage === 'mysql' ? new MysqlStore() : new MemoryStore()
  await store.init()
  return store
}

module.exports = { createStore }
