'use strict';
const Y = require('yjs');
const WebSocket = require('ws');
const { startRelay } = require('../../relay-server/src/relay');
const { SyncClient } = require('../src/sync/syncClient');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function waitFor(conditionFn, timeoutMs = 3000, intervalMs = 20) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (conditionFn()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(check, intervalMs);
    };
    check();
  });
}

async function main() {
  const PORT = 8128;
  const relay = startRelay(PORT);
  const roomUrl = `ws://localhost:${PORT}?room=sync-test`;
  const fastBackoff = { WebSocketImpl: WebSocket, minBackoff: 50, maxBackoff: 200, backoffFactor: 2 };

  const docA = new Y.Doc();
  const docB = new Y.Doc();
  const clientA = new SyncClient(roomUrl, docA, fastBackoff);
  const clientB = new SyncClient(roomUrl, docB, fastBackoff);

  await waitFor(() => clientA.getStatus() === 'open' && clientB.getStatus() === 'open');

  docA.getText('shared').insert(0, 'hello from A');
  await waitFor(() => docB.getText('shared').toString() === 'hello from A');
  check('a local edit on client A syncs to client B through the real relay', docB.getText('shared').toString() === 'hello from A');

  let sendCallCountOnB = 0;
  const originalSend = clientB._ws.send.bind(clientB._ws);
  clientB._ws.send = (data) => { sendCallCountOnB++; return originalSend(data); };

  docA.getText('shared').insert(0, 'X');
  await waitFor(() => docB.getText('shared').toString().startsWith('X'));
  await wait(100);

  check('client B does not re-send the update it just received from A (no echo loop)', sendCallCountOnB === 0);

  const docC = new Y.Doc();
  const clientC = new SyncClient(roomUrl, docC, fastBackoff);
  await waitFor(() => clientC.getStatus() === 'open');

  const statusHistory = [];
  clientC.onStatusChange((status) => statusHistory.push(status));

  clientC._forceDisconnect();
  await waitFor(() => clientC.getStatus() === 'reconnecting');

  docC.getText('shared').insert(0, 'edited while offline. ');
  check('edit made while disconnected does not throw and is held in the local queue', clientC._queue.length === 1);

  await waitFor(() => clientC.getStatus() === 'open', 3000);
  await waitFor(() => clientC._queue.length === 0);

  check('offline queue is flushed once reconnected', clientC._queue.length === 0);
  check('status transitioned through reconnecting on the way back to open', statusHistory.includes('reconnecting'));

  await waitFor(() => docB.getText('shared').toString().includes('edited while offline.'));
  check('the queued offline edit reached another peer once reconnected', docB.getText('shared').toString().includes('edited while offline.'));

  const docD = new Y.Doc();
  const clientD = new SyncClient(roomUrl, docD, fastBackoff);
  await waitFor(() => clientD.getStatus() === 'open');

  clientD.disconnect();
  await waitFor(() => clientD.getStatus() === 'closed');
  await wait(300);

  check('manual disconnect() results in a final "closed" status, not endless reconnect attempts', clientD.getStatus() === 'closed');

  clientA.disconnect();
  clientB.disconnect();
  clientC.disconnect();
  relay.close();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
