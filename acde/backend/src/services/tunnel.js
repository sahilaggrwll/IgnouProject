const localtunnel = require('localtunnel');

// In-memory map: subdomain → tunnel instance
// Survives for the life of the process (restart clears it — tunnels auto-close anyway)
const activeTunnels = new Map();

/**
 * Opens a public tunnel for the given host port.
 * Returns the public HTTPS URL (e.g. https://hello-demo-abc123.loca.lt)
 * or null if tunneling is disabled or fails.
 *
 * Controlled by TUNNEL_ENABLED=true in .env (defaults to false so
 * nothing breaks for offline / Docker Compose setups).
 */
async function openTunnel(subdomain, port) {
  if (process.env.TUNNEL_ENABLED !== 'true') return null;

  // Close any existing tunnel for this subdomain first
  await closeTunnel(subdomain);

  try {
    // localtunnel accepts a preferred subdomain but may give a different one
    // if it's already taken — we use the returned tunnel.url as the truth.
    const tunnel = await localtunnel({
      port,
      subdomain: subdomain.replace(/[^a-z0-9-]/g, '-').slice(0, 40),
    });

    activeTunnels.set(subdomain, tunnel);

    tunnel.on('error', (err) => {
      console.error(`[tunnel] error for ${subdomain}:`, err.message);
    });

    tunnel.on('close', () => {
      activeTunnels.delete(subdomain);
    });

    return tunnel.url;          // e.g. https://hello-demo-abc123.loca.lt
  } catch (err) {
    console.error(`[tunnel] failed to open tunnel for port ${port}:`, err.message);
    return null;
  }
}

/**
 * Closes and removes the tunnel for the given subdomain.
 */
async function closeTunnel(subdomain) {
  const tunnel = activeTunnels.get(subdomain);
  if (!tunnel) return;
  try {
    tunnel.close();
  } catch {
    // ignore if already closed
  }
  activeTunnels.delete(subdomain);
}

module.exports = { openTunnel, closeTunnel, activeTunnels };
