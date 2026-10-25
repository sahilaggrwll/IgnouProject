const fs = require('fs');
const path = require('path');
const config = require('../config');
const { runCommand } = require('../utils/process');

function ensureConfDir() {
  fs.mkdirSync(config.nginxConfDir, { recursive: true });
}

function confPathFor(subdomain) {
  return path.join(config.nginxConfDir, `${subdomain}.conf`);
}

function buildServerBlock(subdomain, assignedPort) {
  const host = `${subdomain}.${config.baseDomain}`;
  const upstreamHost = process.env.PROXY_UPSTREAM_HOST || '127.0.0.1';
  return `# ACDE route for ${host}
server {
    listen ${config.proxyPort};
    server_name ${host};

    location / {
        proxy_pass http://${upstreamHost}:${assignedPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;
}

async function reloadNginx() {
  if (!config.nginxReloadCmd) {
    return { skipped: true };
  }

  const parts = config.nginxReloadCmd.split(' ').filter(Boolean);
  try {
    await runCommand(parts[0], parts.slice(1));
    return { reloaded: true };
  } catch (err) {
    // Local demos often lack system nginx; keep config files for inspection.
    return { reloaded: false, error: err.message };
  }
}

async function upsertRoute(subdomain, assignedPort) {
  ensureConfDir();
  const file = confPathFor(subdomain);
  fs.writeFileSync(file, buildServerBlock(subdomain, assignedPort), 'utf8');
  const reload = await reloadNginx();
  return { file, reload };
}

async function removeRoute(subdomain) {
  ensureConfDir();
  const file = confPathFor(subdomain);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
  const reload = await reloadNginx();
  return { file, reload };
}

function liveUrl(subdomain, assignedPort) {
  // HOST_IP env lets you expose deployed apps on LAN or a public IP.
  // Leave blank (default) for localhost-only access.
  const host = process.env.HOST_IP || '127.0.0.1';
  if (assignedPort) {
    return `http://${host}:${assignedPort}`;
  }
  return `http://${subdomain}.${config.baseDomain}:${config.proxyPort}`;
}

module.exports = {
  upsertRoute,
  removeRoute,
  liveUrl,
  buildServerBlock,
};
