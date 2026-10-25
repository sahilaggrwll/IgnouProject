const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const rootDir = path.resolve(__dirname, '..', '..');

module.exports = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/acde',
  jwtSecret: process.env.JWT_SECRET || 'acde-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  deployMode: (process.env.DEPLOY_MODE || 'docker').toLowerCase(),
  baseDomain: process.env.BASE_DOMAIN || 'localhost',
  proxyPort: Number(process.env.PROXY_PORT) || 8080,
  portRangeStart: Number(process.env.PORT_RANGE_START) || 31000,
  portRangeEnd: Number(process.env.PORT_RANGE_END) || 31999,
  workspaceDir: path.resolve(
    process.env.WORKSPACE_DIR || path.join(rootDir, 'workspace')
  ),
  nginxConfDir: path.resolve(
    process.env.NGINX_CONF_DIR || path.join(rootDir, 'nginx', 'conf.d')
  ),
  nginxReloadCmd: process.env.NGINX_RELOAD_CMD || '',
  k8sNamespace: process.env.K8S_NAMESPACE || 'acde',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  k8sTemplatesDir: path.join(rootDir, 'k8s'),
};
