# 微信点单小程序（可部署发版版）

这是可直接部署的版本，包含：
- 小程序前端（点餐 / 购物车 / 下单 / 会员充值 / 订单）
- Node.js API（登录、菜单、购物车、订单、会员、支付回调）
- MySQL 持久化（可切换 memory/mysql）
- 微信支付（mock / wechat_v3）
- Docker 部署文件（`server/Dockerfile` + `docker-compose.yml`）

---

## 1. 技术栈
- 前端：微信原生小程序
- 后端：Node.js + Express
- 存储：MySQL（生产）/ Memory（开发）
- 支付：微信支付 JSAPI（V3）

---

## 2. 一键本地部署（推荐）

```bash
docker compose up -d --build
```

启动后：
- API: `http://localhost:3000`
- MySQL: `localhost:3306`

---

## 3. 后端手动部署

```bash
cd server
cp .env.example .env
npm install
npm run start
```

> 生产务必把 `.env` 改成真实配置，尤其是微信支付与数据库账号。

---

## 4. 核心环境变量

| 变量 | 说明 |
|---|---|
| `PORT` | 服务端口 |
| `STORAGE` | `mysql` / `memory` |
| `MYSQL_HOST` | MySQL 地址 |
| `MYSQL_PORT` | MySQL 端口 |
| `MYSQL_USER` | MySQL 用户 |
| `MYSQL_PASSWORD` | MySQL 密码 |
| `MYSQL_DATABASE` | 数据库名 |
| `PAY_MODE` | `mock` / `wechat_v3` |
| `WX_APPID` | 小程序 AppID |
| `WX_APP_SECRET` | 小程序密钥（code2Session） |
| `WX_MCHID` | 微信支付商户号 |
| `WX_SERIAL_NO` | 商户证书序列号 |
| `WX_PRIVATE_KEY_PATH` | 商户私钥路径 |
| `WX_NOTIFY_URL` | 支付回调地址 |
| `WX_API_V3_KEY` | APIv3 Key（32位） |

---

## 5. 已实现后端接口

### 认证
- `POST /api/auth/login`

### 菜单
- `GET /api/dishes`

### 购物车
- `GET /api/cart`
- `PUT /api/cart`
- `DELETE /api/cart`

### 订单
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders/:id/cancel`
- `POST /api/orders/:id/paid`

### 会员
- `GET /api/member/profile`
- `POST /api/member/recharge`
- `GET /api/member/recharges`
- `POST /api/member/recharge/:id/paid`

### 支付回调
- `POST /api/pay/notify`

---

## 6. 发版前检查清单（必须）

1. `STORAGE=mysql`，禁用 memory
2. 配置真实 `WX_APPID/WX_APP_SECRET`
3. 配置真实商户参数与证书
4. `PAY_MODE=wechat_v3`
5. 回调域名 HTTPS 可公网访问
6. 小程序后台已配置业务域名与 request 合法域名
7. 数据库已备份策略 + 慢查询监控

---

## 7. 当前边界（你上线前建议补）

- 增加微信回调签名头（Wechatpay-*）验签
- 订单与库存扣减的严格事务化
- 支付回调幂等日志表
- 接入日志平台/告警平台
