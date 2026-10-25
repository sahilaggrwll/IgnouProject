const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const dashboardRoutes = require('./routes/dashboard');

fs.mkdirSync(config.workspaceDir, { recursive: true });
fs.mkdirSync(config.nginxConfDir, { recursive: true });

const app = express();

app.use(
  cors({
    origin: config.frontendOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ACDE',
    deploy_mode: config.deployMode,
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await mongoose.connect(config.mongoUri);
  console.log(`MongoDB connected: ${config.mongoUri}`);

  app.listen(config.port, () => {
    console.log(`ACDE API listening on http://localhost:${config.port}`);
    console.log(`Deploy mode: ${config.deployMode}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start ACDE API', err);
    process.exit(1);
  });
}

module.exports = { app, start };
