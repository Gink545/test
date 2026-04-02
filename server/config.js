const fs = require('fs')

const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'change_me_in_production',
  enableDebugPaidApi: process.env.ENABLE_DEBUG_PAID_API === 'true',
  storage: process.env.STORAGE || 'memory', // memory | mysql
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'wechat_order',
    charset: 'utf8mb4'
  },
  payMode: process.env.PAY_MODE || 'mock', // mock | wechat_v3
  wx: {
    appid: process.env.WX_APPID || '',
    appSecret: process.env.WX_APP_SECRET || '',
    mchid: process.env.WX_MCHID || '',
    serialNo: process.env.WX_SERIAL_NO || '',
    notifyUrl: process.env.WX_NOTIFY_URL || '',
    apiV3Key: process.env.WX_API_V3_KEY || '',
    platformCertPath: process.env.WX_PLATFORM_CERT_PATH || '',
    privateKey: process.env.WX_PRIVATE_KEY_PATH
      ? fs.readFileSync(process.env.WX_PRIVATE_KEY_PATH, 'utf8')
      : ''
  }
}

module.exports = config
