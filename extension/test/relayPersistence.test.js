'use strict';
const Y = require('yjs');
const WebSocket = require('ws');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startPersistentRelay } = require('../../relay-server/src/persistentRelay');
const { SyncClient } = require('../src/sync/syncClient');
const { AnnotationYDoc } = require('../src/sync/annotationYDoc');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function waitFor(conditionFn, timeoutMs = 5000, intervalMs = 20) {
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
  const PORT = 8134;
  const relay = startPersistentRelay(PORT, { compactionThreshold: 10 });
  const roomUrl = `ws://localhost:${PORT}?room=persistence-test`;
  const opts = { WebSocketImpl: WebSocket, minBackoff: 50, maxBackoff: 200 };

  const ydocA = new Y.Doc();
  const annA = new AnnotationYDoc(ydocA);
  const syncA = new SyncClient(roomUrl, ydocA, opts);
  await waitFor(() => syncA.getStatus() === 'open');

  annA.addAnnotation({ id: 'ann-1', type: 'highlight', content: 'first' });
  annA.addAnnotation({ id: 'ann-2', type: 'note', content: 'second' });
  await wait(100);

  syncA.disconnect();
  await wait(100);

  const ydocB = new Y.Doc();
  const annB = new AnnotationYDoc(ydocB);
  const syncB = new SyncClient(roomUrl, ydocB, opts);

  await waitFor(() => annB.getAnnotation('ann-1') !== null && annB.getAnnotation('ann-2') !== null);
  check(
    'a client that was never online while edits happened still catches up on ALL of them from relay history',
    annB.getAnnotation('ann-1')?.content === 'first' && annB.getAnnotation('ann-2')?.content === 'second'
  );

  const ydocC = new Y.Doc();
  const annC = new AnnotationYDoc(ydocC);
  const syncC = new SyncClient(roomUrl, ydocC, opts);
  await waitFor(() => syncC.getStatus() === 'open');
  await waitFor(() => annC.getAnnotation('ann-1') !== null);

  syncC._forceDisconnect();
  await waitFor(() => syncC.getStatus() === 'reconnecting');

  annB.addAnnotation({ id: 'ann-3', type: 'arrow', content: null });
  await wait(150);

  await waitFor(() => syncC.getStatus() === 'open', 3000);
  await waitFor(() => annC.getAnnotation('ann-3') !== null, 3000);
  check(
    "a client that reconnects catches up on an annotation ANOTHER client added while it was offline (the gap QC-32 flagged)",
    annC.getAnnotation('ann-3') !== null
  );

  const statsBeforeCompaction = relay.getStats();
  for (let i = 0; i < 20; i++) {
    annB.updateAnnotation('ann-3', { content: `rev-${i}` });
    await wait(10);
  }
  await wait(200);
  const statsAfterCompaction = relay.getStats();

  check(
    'log for the room was compacted (fewer stored entries than raw update count would suggest)',
    statsAfterCompaction.logSizePerRoom['persistence-test'] <= 10
  );

  const ydocD = new Y.Doc();
  const annD = new AnnotationYDoc(ydocD);
  const syncD = new SyncClient(roomUrl, ydocD, opts);
  await waitFor(() => annD.getAnnotation('ann-3')?.content === 'rev-19', 3000);
  check(
    'a client joining AFTER compaction still receives the fully correct, up-to-date state',
    annD.getAnnotation('ann-3')?.content === 'rev-19' &&
    annD.getAnnotation('ann-1')?.content === 'first' &&
    annD.getAnnotation('ann-2')?.content === 'second'
  );

  syncB.disconnect();
  syncC.disconnect();
  syncD.disconnect();
  relay.close();

  // Restart durability: the same opaque history is available to a fresh
  // relay instance, without decoding or inspecting the payload.
  const durablePath = path.join(os.tmpdir(), `quillcrypt-relay-${process.pid}.json`);
  try { fs.unlinkSync(durablePath); } catch {}
  const durablePort = 8135;
  const firstRelay = startPersistentRelay(durablePort, { persistencePath: durablePath });
  const firstClient = new WebSocket(`ws://localhost:${durablePort}?room=restart-test`);
  await new Promise((resolve) => firstClient.once('open', resolve));
  const opaquePayload = Buffer.from([0, 255, 18, 42]);
  firstClient.send(opaquePayload);
  await wait(50);
  firstClient.close();
  await new Promise((resolve) => firstRelay.wss.close(resolve));

  const secondRelay = startPersistentRelay(durablePort, { persistencePath: durablePath });
  const secondClient = new WebSocket(`ws://localhost:${durablePort}?room=restart-test`);
  const replayed = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('durable replay timed out')), 2000);
    secondClient.once('message', (data) => { clearTimeout(timer); resolve(Buffer.from(data)); });
  });
  check('relay history survives a process restart', replayed.equals(opaquePayload));
  secondClient.close();
  await new Promise((resolve) => secondRelay.wss.close(resolve));
  try { fs.unlinkSync(durablePath); } catch {}

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
