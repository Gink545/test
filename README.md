# 微信点单小程序（上线补丁版）

> 不懂技术也可以部署：请先看《`DEPLOY_GUIDE_ZH.md`》按步骤操作。

本版本已补上可上线的关键安全项：
- ✅ 登录改为 Bearer Token（JWT）
- ✅ 关闭前端直改 paid 状态（默认禁用调试 paid 接口）
- ✅ 支付回调签名校验（Wechatpay-*）+ resource 解密
- ✅ 支付回调幂等（payment_events 去重）
- ✅ 下单库存扣减（事务化）

## 快速部署

```bash
docker compose up -d --build
```

## 关键环境变量

| 变量 | 说明 |
|---|---|
| `NODE_ENV` | 建议 `production` |
| `JWT_SECRET` | JWT 密钥（生产必须改） |
| `ENABLE_DEBUG_PAID_API` | 是否开启联调 paid 接口（生产必须 `false`） |
| `STORAGE` | `mysql` / `memory` |
| `PAY_MODE` | `mock` / `wechat_v3` |
| `WX_API_V3_KEY` | 回调解密 key |
| `WX_PLATFORM_CERT_PATH` | 微信支付平台证书（用于回调签名验签） |

## 已实现后端接口

- 登录：`POST /api/auth/login`
- 菜单：`GET /api/dishes`
- 购物车：`GET/PUT/DELETE /api/cart`
- 订单：`POST /api/orders`、`GET /api/orders`、`GET /api/orders/:id`、`POST /api/orders/:id/cancel`
- 会员：`GET /api/member/profile`、`POST /api/member/recharge`、`GET /api/member/recharges`
- 回调：`POST /api/pay/notify`

> `POST /api/orders/:id/paid` 与 `POST /api/member/recharge/:id/paid` 仅在 `ENABLE_DEBUG_PAID_API=true` 时开放，生产默认关闭。

## 发版检查

1. `NODE_ENV=production`
2. `JWT_SECRET` 已替换为高强度随机串
3. `ENABLE_DEBUG_PAID_API=false`
4. `STORAGE=mysql`
5. `PAY_MODE=wechat_v3`
6. `WX_PLATFORM_CERT_PATH`、`WX_API_V3_KEY` 已配置
7. 小程序域名和支付回调域名均为 HTTPS

## 一键部署脚本（阿里云轻量服务器）

可直接执行：`scripts/deploy_aliyun_lighthouse.sh`。

```bash
chmod +x scripts/deploy_aliyun_lighthouse.sh
./scripts/deploy_aliyun_lighthouse.sh
```

执行前先编辑脚本开头变量（仓库地址、域名、微信参数等）。


## Mac 本地联调检查表（勾选版）

请看：`TEST_CHECKLIST_MAC_WECHAT.md`

