/**
 * Standalone health check — GETs /api/status and reports server + MongoDB state.
 * Usage: node check-server.js
 * Optional: PORT=5000 node check-server.js
 */
const http = require('http');

const PORT = process.env.PORT || 5001;
const options = {
  hostname: 'localhost',
  port: PORT,
  path: '/api/status',
  method: 'GET',
  timeout: 5000,
};

const DB_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

const req = http.request(options, (res) => {
  let body = '';

  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      const dbLabel = DB_STATES[data.dbState] ?? `unknown (${data.dbState})`;

      if (res.statusCode === 200 && data.status === 'ok') {
        console.log(`Server: UP (HTTP ${res.statusCode})`);
        console.log(`MongoDB state: ${dbLabel}`);
        process.exit(data.dbState === 1 ? 0 : 1);
      }

      console.log(`Server: unexpected response (HTTP ${res.statusCode})`);
      console.log(body);
      process.exit(1);
    } catch (err) {
      console.log('Server: UP but /api/status returned invalid JSON');
      console.log(body);
      console.error(err.message);
      process.exit(1);
    }
  });
});

req.on('timeout', () => {
  console.log('Server: DOWN (request timed out)');
  console.log('MongoDB state: unknown');
  req.destroy();
  process.exit(1);
});

req.on('error', (err) => {
  console.log(`Server: DOWN (${err.message})`);
  console.log('MongoDB state: unknown');
  process.exit(1);
});

req.end();
