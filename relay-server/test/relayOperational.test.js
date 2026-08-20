'use strict';
const http = require('http');
const WebSocket = require('ws');
const { startPersistentRelay } = require('../src/persistentRelay');

let pass = 0, fail = 0;
function check(label, condition) {
  console.log((condition ? 'PASS' : 'FAIL') + ' — ' + label);
  condition ? pass++ : fail++;
}
function waitOpen(ws) { return new Promise((resolve) => ws.once('open', resolve)); }
function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function health(port) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/healthz`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    }).on('error', reject);
  });
}

async function main() {
  const metrics = [];
  const relay = startPersistentRelay(8127, {
    healthPort: 8128,
    heartbeatIntervalMs: 0,
    maxMessagesPerInterval: 2,
    rateIntervalMs: 1000,
    maxClientsPerRoom: 1,
    onMetric: (metric) => metrics.push(metric),
  });
  await new Promise((resolve) => relay.wss.listening ? resolve() : relay.wss.once('listening', resolve));
  await new Promise((resolve) => relay.healthServer.listening ? resolve() : relay.healthServer.once('listening', resolve));

  const status = await health(8128);
  check('health endpoint reports relay readiness without room identifiers', status.status === 200 && status.body.ok === true && !('roomIds' in status.body));

  const client = new WebSocket('ws://127.0.0.1:8127?room=limited');
  await waitOpen(client);
  client.send(Buffer.from([1]));
  client.send(Buffer.from([2]));
  client.send(Buffer.from([3]));
  const closeCode = await new Promise((resolve) => client.once('close', (code) => resolve(code)));
  check('message rate limit closes an abusive connection', closeCode === 1008);

  const first = new WebSocket('ws://127.0.0.1:8127?room=client-limit');
  await waitOpen(first);
  const second = new WebSocket('ws://127.0.0.1:8127?room=client-limit');
  const secondClose = await new Promise((resolve) => second.once('close', (code) => resolve(code)));
  check('per-room client limit rejects excess connections', secondClose === 1008);
  const forbiddenKeys = ['roomId', 'url', 'payload', 'content', 'key', 'token'];
  check('operational metrics stay aggregate and omit sensitive fields', metrics.length > 0 && metrics.every((metric) => forbiddenKeys.every((key) => !(key in metric))));
  first.close();
  await wait(50);
  await relay.shutdown();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => { console.error(error); process.exit(1); });
