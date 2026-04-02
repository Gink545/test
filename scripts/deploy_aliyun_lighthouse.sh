#!/usr/bin/env bash
set -euo pipefail

# ===== 用户需修改的变量（必填） =====
REPO_URL="${REPO_URL:-https://example.com/your/repo.git}"
APP_DIR="${APP_DIR:-/opt/wechat-order}"
API_DOMAIN="${API_DOMAIN:-api.example.com}"

JWT_SECRET="${JWT_SECRET:-please_change_me_very_long_random_string}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root123456}"
MYSQL_USER="${MYSQL_USER:-wechat}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-wechat123456}"
MYSQL_DATABASE="${MYSQL_DATABASE:-wechat_order}"

PAY_MODE="${PAY_MODE:-wechat_v3}" # mock | wechat_v3
WX_APPID="${WX_APPID:-}"
WX_APP_SECRET="${WX_APP_SECRET:-}"
WX_MCHID="${WX_MCHID:-}"
WX_SERIAL_NO="${WX_SERIAL_NO:-}"
WX_API_V3_KEY="${WX_API_V3_KEY:-}"

# 证书路径（容器内）
WX_PRIVATE_KEY_PATH="/app/certs/apiclient_key.pem"
WX_PLATFORM_CERT_PATH="/app/certs/wechatpay_platform.pem"
WX_NOTIFY_URL="https://${API_DOMAIN}/api/pay/notify"

# ====== 工具函数 ======
log() { echo -e "\033[32m[deploy]\033[0m $*"; }
warn() { echo -e "\033[33m[warn]\033[0m $*"; }
err() { echo -e "\033[31m[error]\033[0m $*"; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    err "请用 root 账号执行：sudo -i 后再运行"
    exit 1
  fi
}

install_docker() {
  if command -v docker >/dev/null 2>&1; then
    log "Docker 已安装，跳过"
    return
  fi

  log "安装 Docker 与 Compose 插件"
  apt update && apt -y upgrade
  apt -y install ca-certificates curl gnupg lsb-release git
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list >/dev/null
  apt update
  apt -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable docker
  systemctl start docker
}

prepare_code() {
  if [[ -d "${APP_DIR}/.git" ]]; then
    log "检测到已有代码，执行 git pull"
    git -C "${APP_DIR}" pull
  else
    log "克隆代码到 ${APP_DIR}"
    git clone "${REPO_URL}" "${APP_DIR}"
  fi
}

prepare_env_and_compose() {
  log "生成 server/.env"
  cat > "${APP_DIR}/server/.env" <<ENVEOF
PORT=3000
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}
ENABLE_DEBUG_PAID_API=false

STORAGE=mysql
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=${MYSQL_USER}
MYSQL_PASSWORD=${MYSQL_PASSWORD}
MYSQL_DATABASE=${MYSQL_DATABASE}

PAY_MODE=${PAY_MODE}
WX_APPID=${WX_APPID}
WX_APP_SECRET=${WX_APP_SECRET}
WX_MCHID=${WX_MCHID}
WX_SERIAL_NO=${WX_SERIAL_NO}
WX_PRIVATE_KEY_PATH=${WX_PRIVATE_KEY_PATH}
WX_NOTIFY_URL=${WX_NOTIFY_URL}
WX_API_V3_KEY=${WX_API_V3_KEY}
WX_PLATFORM_CERT_PATH=${WX_PLATFORM_CERT_PATH}
ENVEOF

  log "重写 docker-compose.yml（阿里云轻量可直接启动）"
  cat > "${APP_DIR}/docker-compose.yml" <<COMPOSEEOF
version: '3.9'
services:
  mysql:
    image: mysql:8.0
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    command: --default-authentication-plugin=mysql_native_password
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  api:
    build:
      context: ./server
    restart: always
    depends_on:
      - mysql
    env_file:
      - ./server/.env
    ports:
      - "3000:3000"
    volumes:
      - ./server/certs:/app/certs:ro

volumes:
  mysql_data:
COMPOSEEOF
}

setup_nginx_https() {
  log "安装 Nginx + Certbot"
  apt -y install nginx certbot python3-certbot-nginx
  systemctl enable nginx
  systemctl start nginx

  cat > /etc/nginx/sites-available/wechat-order <<NGINXEOF
server {
    listen 80;
    server_name ${API_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINXEOF

  ln -sf /etc/nginx/sites-available/wechat-order /etc/nginx/sites-enabled/wechat-order
  nginx -t
  systemctl reload nginx

  log "申请 HTTPS 证书（请确保域名已解析到本机公网IP）"
  certbot --nginx -d "${API_DOMAIN}" --non-interactive --agree-tos -m "admin@${API_DOMAIN}" || warn "Certbot 执行失败，请检查域名解析后重试"
}

start_services() {
  log "启动容器"
  cd "${APP_DIR}"
  mkdir -p server/certs
  docker compose up -d --build
  docker compose ps
}

post_hint() {
  cat <<HINTEOF

================= 部署完成后你还需要做 =================
1) 把微信支付证书放到：${APP_DIR}/server/certs/
   - apiclient_key.pem
   - wechatpay_platform.pem

2) 小程序后台配置 request 合法域名：
   https://${API_DOMAIN}

3) 微信支付后台配置回调地址：
   https://${API_DOMAIN}/api/pay/notify

4) 查看日志：
   cd ${APP_DIR} && docker compose logs -f api
=======================================================
HINTEOF
}

main() {
  require_root
  install_docker
  prepare_code
  prepare_env_and_compose
  setup_nginx_https
  start_services
  post_hint
}

main "$@"
