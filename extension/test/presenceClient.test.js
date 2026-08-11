'use strict';
const WebSocket = require('ws');
const { startRelay } = require('../../relay-server/src/relay');
const { PresenceClient } = require('../src/sync/presenceClient');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
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
  const PORT = 8130;
  const relay = startRelay(PORT);
  const roomUrl = `ws://localhost:${PORT}?room=presence-test:presence`;
  const fastOptions = { heartbeatMs: 50, timeoutMs: 150, pruneIntervalMs: 30 };

  const clientA = new PresenceClient(roomUrl, WebSocket, { ...fastOptions, clientId: 'alice', initialState: { name: 'Alice', cursor: { x: 0, y: 0 } } });
  const clientB = new PresenceClient(roomUrl, WebSocket, { ...fastOptions, clientId: 'bob', initialState: { name: 'Bob', cursor: { x: 10, y: 10 } } });

  await waitFor(() => clientA.getPeers().length === 1 && clientB.getPeers().length === 1);
  check('client A sees client B as a peer', clientA.getPeers()[0].clientId === 'bob');
  check('client B sees client A as a peer', clientB.getPeers()[0].clientId === 'alice');
  check('peer state includes the data the other client set', clientA.getPeers()[0].state.name === 'Bob');

  clientB.setLocalState({ cursor: { x: 99, y: 99 } });
  await waitFor(() => clientA.getPeers()[0].state.cursor.x === 99);
  check("a state update (cursor move) propagates to the other client's peer view", clientA.getPeers()[0].state.cursor.x === 99);
  check('unrelated fields in the state survive a partial update (merge, not replace)', clientA.getPeers()[0].state.name === 'Bob');

  clientB.dispose();
  await waitFor(() => clientA.getPeers().length === 0, 500);
  check('client A immediately removes client B after B disposes cleanly (does not wait for the timeout)', clientA.getPeers().length === 0);

  const clientC = new PresenceClient(roomUrl, WebSocket, { ...fastOptions, clientId: 'carol', initialState: { name: 'Carol' } });
  await waitFor(() => clientA.getPeers().length === 1 && clientA.getPeers()[0].clientId === 'carol');

  clearInterval(clientC._heartbeatTimer);
  clearInterval(clientC._pruneTimer);
  clientC._ws.close();

  check('peer is NOT removed immediately on a silent disconnect (no leave message was sent)', clientA.getPeers().some((p) => p.clientId === 'carol'));

  await waitFor(() => !clientA.getPeers().some((p) => p.clientId === 'carol'), 1000);
  check('peer is removed via timeout-based pruning after going silent without a clean leave', !clientA.getPeers().some((p) => p.clientId === 'carol'));

  clientA.dispose();
  relay.close();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
