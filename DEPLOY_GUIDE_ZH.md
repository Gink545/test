# 小白上线手册（一步一步照做）

> 目标：把这个项目从“本地代码”部署成“手机可访问”的线上服务。  
> 适合完全没服务器经验的人，照抄命令即可。

---

## 0. 你要准备什么（先买/先申请）

1. **一台云服务器**（推荐阿里云/腾讯云）
   - 配置建议：2核4G、50G硬盘、Ubuntu 22.04
2. **一个域名**（例如 `yourshop.cn`）
3. **微信小程序账号**（已认证）
4. **微信支付商户号**（JSAPI 能力）

---

## 1. 你的上线架构（你会部署哪些东西）

你最终会有以下服务：

- `Nginx`：网站入口 + HTTPS 证书
- `API 容器`：本项目后端 Node.js
- `MySQL 容器`：数据库
- （可选）`Redis`：缓存

本项目已经内置：
- `docker-compose.yml`（一键启动 API + MySQL）
- `server/Dockerfile`
- `server/.env.example`

---

## 2. 第一阶段：登录服务器并安装环境

### 2.1 从你自己的电脑连接服务器

在本机终端执行（把 IP 改成你的）：

```bash
ssh root@你的服务器IP
```

首次会问 `yes/no`，输入 `yes`。

### 2.2 安装 Docker + Docker Compose

在服务器执行：

```bash
apt update && apt -y upgrade
apt -y install ca-certificates curl gnupg lsb-release git
mkdir -m 0755 -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker
```

验证安装：

```bash
docker --version
docker compose version
```

---

## 3. 第二阶段：拉代码并配置环境

### 3.1 拉取代码

```bash
cd /opt
git clone 你的代码仓库地址 wechat-order
cd wechat-order
```

### 3.2 复制环境变量模板

```bash
cp server/.env.example server/.env
```

### 3.3 编辑 `server/.env`

```bash
nano server/.env
```

重点改这几项：

- `NODE_ENV=production`
- `JWT_SECRET=一个很长很乱的字符串`
- `ENABLE_DEBUG_PAID_API=false`
- `PAY_MODE=wechat_v3`
- `WX_APPID=你的小程序AppID`
- `WX_APP_SECRET=你的小程序Secret`
- `WX_MCHID=你的商户号`
- `WX_SERIAL_NO=商户证书序列号`
- `WX_NOTIFY_URL=https://api.你的域名/api/pay/notify`
- `WX_API_V3_KEY=微信支付APIv3密钥`
- `WX_PRIVATE_KEY_PATH=/app/certs/apiclient_key.pem`
- `WX_PLATFORM_CERT_PATH=/app/certs/wechatpay_platform.pem`

保存：`Ctrl + O` 回车；退出：`Ctrl + X`。

---

## 4. 第三阶段：准备微信支付证书文件

在服务器上创建目录：

```bash
mkdir -p /opt/wechat-order/server/certs
```

你需要把两个文件放进去：

1. `apiclient_key.pem`（商户私钥）
2. `wechatpay_platform.pem`（微信支付平台证书）

放好后确认：

```bash
ls -l /opt/wechat-order/server/certs
```

---

## 5. 第四阶段：启动项目

### 5.1 修改 `docker-compose.yml` 的关键配置

把 `JWT_SECRET` 改成真实随机串；
把支付相关变量改成真实值（或者你也可以让 compose 读取 `.env`）。

### 5.2 一键启动

```bash
cd /opt/wechat-order
docker compose up -d --build
```

查看容器：

```bash
docker compose ps
```

看日志（是否报错）：

```bash
docker compose logs -f api
```

---

## 6. 第五阶段：配置域名和 HTTPS（必须）

小程序和微信支付都要求 HTTPS。

### 6.1 域名解析

在域名控制台添加 A 记录：

- `api.你的域名` -> 服务器公网IP

### 6.2 安装 Nginx + 证书工具

```bash
apt -y install nginx certbot python3-certbot-nginx
systemctl enable nginx
systemctl start nginx
```

### 6.3 配置反向代理

新建配置：

```bash
nano /etc/nginx/sites-available/wechat-order
```

填入：

```nginx
server {
    listen 80;
    server_name api.你的域名;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用：

```bash
ln -s /etc/nginx/sites-available/wechat-order /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 6.4 申请 HTTPS 证书

```bash
certbot --nginx -d api.你的域名
```

按提示输入邮箱，选择同意。成功后会自动配置 HTTPS。

---

## 7. 第六阶段：微信后台配置（非常关键）

### 7.1 小程序后台

在微信小程序后台配置：

- request 合法域名：`https://api.你的域名`

### 7.2 微信支付后台

- 支付回调地址设置为：
  - `https://api.你的域名/api/pay/notify`

---

## 8. 第七阶段：改小程序 API 地址并发布

修改 `miniprogram/app.js` 中 `apiBase`：

```js
apiBase: 'https://api.你的域名'
```

然后用微信开发者工具：

1. 上传代码
2. 提交审核
3. 审核通过后发布

---

## 9. 上线后每天怎么维护（小白版）

### 看服务是否正常

```bash
cd /opt/wechat-order
docker compose ps
```

### 看报错日志

```bash
docker compose logs -f api
```

### 重启服务

```bash
docker compose restart api
```

### 更新版本（以后每次发版）

```bash
cd /opt/wechat-order
git pull
docker compose up -d --build
```

---

## 10. 常见错误排查

### 10.1 小程序提示“request:fail”
- 多数是域名没配 HTTPS 或没加入小程序合法域名。

### 10.2 支付回调没进来
- 回调地址不是 HTTPS
- 防火墙没开 443
- `WX_NOTIFY_URL` 配错

### 10.3 登录失败（code2Session）
- `WX_APPID/WX_APP_SECRET` 配置错误

### 10.4 服务器启动失败
- `.env` 写错
- 证书路径不存在
- MySQL 没起来

---

## 11. 防踩坑清单（上线前最后核对）

- [ ] `ENABLE_DEBUG_PAID_API=false`
- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` 已替换
- [ ] `PAY_MODE=wechat_v3`
- [ ] `WX_PLATFORM_CERT_PATH` 存在
- [ ] `WX_API_V3_KEY` 正确
- [ ] 小程序合法域名已配置
- [ ] 回调地址可公网访问

完成以上，就可以上线。
