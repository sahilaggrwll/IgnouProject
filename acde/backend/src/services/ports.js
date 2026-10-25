const net = require('net');
const Deployment = require('../models/Deployment');
const config = require('../config');

/**
 * Returns true if the port is genuinely free on this host
 * (no process or Docker container has it bound).
 */
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));   // EADDRINUSE or similar
    server.listen(port, '0.0.0.0', () => {
      server.close(() => resolve(true));
    });
  });
}

async function allocatePort() {
  // Fast filter: skip ports already recorded in the DB
  const used = await Deployment.find({
    status: { $in: ['pending', 'building', 'deployed'] },
  }).distinct('assigned_port');

  const usedSet = new Set(used);

  for (let port = config.portRangeStart; port <= config.portRangeEnd; port += 1) {
    if (usedSet.has(port)) continue;             // DB says in use
    if (await isPortFree(port)) return port;     // OS confirms actually free
  }

  throw new Error('No free ports available in configured range');
}

module.exports = { allocatePort, isPortFree };
