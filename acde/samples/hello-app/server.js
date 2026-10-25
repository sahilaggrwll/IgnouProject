const http = require('http');

const port = Number(process.env.PORT) || 3000;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>ACDE Hello App</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
    }
    .card {
      text-align: center;
      padding: 48px;
      border: 1px solid #334155;
      border-radius: 16px;
      background: #1e293b;
      max-width: 480px;
    }
    h1 { color: #60a5fa; margin: 0 0 12px; }
    p { color: #94a3b8; line-height: 1.5; }
    .pill {
      display: inline-block;
      margin-top: 16px;
      padding: 6px 14px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.35);
      font-size: 13px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hello from ACDE</h1>
    <p>This sample application was deployed by the Automated Cloud Deployment Engine.</p>
    <div class="pill">Status: Live</div>
  </div>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

server.listen(port, () => {
  console.log(`ACDE hello-app listening on ${port}`);
});
