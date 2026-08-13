'use strict';
const Y = require('yjs');
const WebSocket = require('ws');
const { startPersistentRelay } = require('../../relay-server/src/persistentRelay');
const { SyncClient } = require('../src/sync/syncClient');
const { AnnotationYDoc } = require('../src/sync/annotationYDoc');
const { createEncryptedWebSocketImpl } = require('../src/sync/encryptedTransport');
const { ready, generateSymmetricKey } = require('../src/crypto/primitives');

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
  await ready();
  const PORT = 8136;
  const relay = startPersistentRelay(PORT, { compactionThreshold: 1000 });
  const roomUrl = `ws://localhost:${PORT}?room=e2ee-test`;
  const groupKey = generateSymmetricKey();
  const encryptedImpl = createEncryptedWebSocketImpl(WebSocket, groupKey);
  const opts = { WebSocketImpl: encryptedImpl, minBackoff: 50, maxBackoff: 200 };

  const ydocA = new Y.Doc();
  const ydocB = new Y.Doc();
  const annA = new AnnotationYDoc(ydocA);
  const annB = new AnnotationYDoc(ydocB);
  const syncA = new SyncClient(roomUrl, ydocA, opts);
  const syncB = new SyncClient(roomUrl, ydocB, opts);

  await waitFor(() => syncA.getStatus() === 'open' && syncB.getStatus() === 'open');

  annA.addAnnotation({ id: 'ann-1', type: 'note', content: 'this must never appear in plaintext anywhere on the relay' });
  await waitFor(() => annB.getAnnotation('ann-1') !== null);
  check('sync works completely transparently under encryption — SyncClient itself is unmodified', annB.getAnnotation('ann-1')?.content === 'this must never appear in plaintext anywhere on the relay');

  const stats = relay.getStats();
  check('relay actually persisted something for this room', stats.logSizePerRoom['e2ee-test'] > 0);

  const storedLog = relay._debugGetRoomLog('e2ee-test');
  const knownPlaintextSubstring = 'this must never appear in plaintext anywhere on the relay';
  const knownPlaintextBytes = new TextEncoder().encode(knownPlaintextSubstring);

  function containsSubsequence(haystack, needle) {
    outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) {
        if (haystack[i + j] !== needle[j]) continue outer;
      }
      return true;
    }
    return false;
  }

  const anyEntryContainsPlaintext = storedLog.some((entry) => containsSubsequence(entry, knownPlaintextBytes));
  check("NONE of the relay's persisted log entries contain the plaintext note content as a byte subsequence", !anyEntryContainsPlaintext);

  let anyEntryParsesAsValidUpdate = false;
  for (const entry of storedLog) {
    try {
      Y.decodeUpdate(entry);
      anyEntryParsesAsValidUpdate = true;
    } catch (e) {
      // expected — it's ciphertext
    }
  }
  check('relay-persisted entries do not parse as valid Yjs updates (they are ciphertext, not CRDT deltas)', !anyEntryParsesAsValidUpdate);

  const wrongKey = generateSymmetricKey();
  const ydocC = new Y.Doc();
  const annC = new AnnotationYDoc(ydocC);
  let decryptErrorCount = 0;
  const syncC = new SyncClient(roomUrl, ydocC, {
    WebSocketImpl: createEncryptedWebSocketImpl(WebSocket, wrongKey, { onDecryptError: () => { decryptErrorCount++; } }),
    minBackoff: 50, maxBackoff: 200,
  });

  await waitFor(() => syncC.getStatus() === 'open');
  await wait(300);

  check('client with the wrong key receives decrypt errors rather than crashing', decryptErrorCount > 0);
  check('client with the wrong key ends up with NO annotation data (cannot read anything)', annC.getAnnotation('ann-1') === null);

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
