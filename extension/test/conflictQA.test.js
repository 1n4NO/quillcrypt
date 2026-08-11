'use strict';
const Y = require('yjs');
const WebSocket = require('ws');
const { startRelay } = require('../../relay-server/src/relay');
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
  const PORT = 8132;
  const relay = startRelay(PORT);
  const roomUrl = `ws://localhost:${PORT}?room=qa-conflict-test`;
  const opts = { WebSocketImpl: WebSocket, minBackoff: 50, maxBackoff: 200 };

  const ydocA = new Y.Doc();
  const ydocB = new Y.Doc();
  const ydocC = new Y.Doc();
  const annA = new AnnotationYDoc(ydocA);
  const annB = new AnnotationYDoc(ydocB);
  const annC = new AnnotationYDoc(ydocC);
  const syncA = new SyncClient(roomUrl, ydocA, opts);
  const syncB = new SyncClient(roomUrl, ydocB, opts);
  const syncC = new SyncClient(roomUrl, ydocC, opts);

  await waitFor(() => [syncA, syncB, syncC].every((s) => s.getStatus() === 'open'));

  annA.addAnnotation({ id: 'shared-note', type: 'note', content: 'initial' });
  await waitFor(() => annB.getAnnotation('shared-note') && annC.getAnnotation('shared-note'));

  for (let i = 0; i < 10; i++) {
    annA.updateAnnotation('shared-note', { content: `from A #${i}` });
    annB.updateAnnotation('shared-note', { content: `from B #${i}` });
    annC.updateAnnotation('shared-note', { content: `from C #${i}` });
  }

  await wait(500);
  await waitFor(() => {
    const a = annA.getAnnotation('shared-note').content;
    const b = annB.getAnnotation('shared-note').content;
    const c = annC.getAnnotation('shared-note').content;
    return a === b && b === c;
  }, 3000);

  const finalA = annA.getAnnotation('shared-note').content;
  const finalB = annB.getAnnotation('shared-note').content;
  const finalC = annC.getAnnotation('shared-note').content;
  check('after 30 rapid concurrent writes across 3 real clients, all converge to an identical value', finalA === finalB && finalB === finalC);
  check('the converged value is a genuine one of the writes, not corrupted/garbled', /^from [ABC] #\d+$/.test(finalA));

  annA.addAnnotation({ id: 'to-delete', type: 'highlight', content: null });
  await waitFor(() => annB.getAnnotation('to-delete') && annC.getAnnotation('to-delete'));

  annB.deleteAnnotation('to-delete');
  annC.deleteAnnotation('to-delete');
  await waitFor(() => annA.getAnnotation('to-delete') === null && annB.getAnnotation('to-delete') === null && annC.getAnnotation('to-delete') === null);

  check('concurrent delete from two different clients does not error and converges to deleted on all three', true);

  annA.addAnnotation({ id: 'note-x', type: 'note', content: 'x-original' });
  annA.addAnnotation({ id: 'note-y', type: 'note', content: 'y-original' });
  await waitFor(() => annB.getAnnotation('note-x') && annB.getAnnotation('note-y'));

  annB.updateAnnotation('note-x', { content: 'x-edited-by-B' });
  annC.updateAnnotation('note-y', { content: 'y-edited-by-C' });
  await waitFor(() => {
    const x = annA.getAnnotation('note-x')?.content;
    const y = annA.getAnnotation('note-y')?.content;
    return x === 'x-edited-by-B' && y === 'y-edited-by-C';
  });

  check(
    'concurrent edits to two DIFFERENT annotations both land correctly with no cross-contamination',
    annA.getAnnotation('note-x').content === 'x-edited-by-B' && annA.getAnnotation('note-y').content === 'y-edited-by-C'
  );

  syncA.disconnect();
  syncB.disconnect();
  syncC.disconnect();
  relay.close();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
