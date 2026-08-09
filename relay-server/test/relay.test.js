'use strict';
const Y = require('yjs');
const WebSocket = require('ws');
const sodium = require('libsodium-wrappers');
const { startRelay } = require('../src/relay');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

async function main() {
  await sodium.ready;

  const PORT = 8123;
  const relay = startRelay(PORT);
  const observedBytes = []; // captured independently of the relay's own internals,
                             // via a lightweight observer client — see note below.

  // Workspace symmetric key — in production this comes from the invite-link
  // fragment (see QC-3), never generated or seen server-side.
  const groupKey = sodium.crypto_secretbox_keygen();

  function encrypt(update) {
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = sodium.crypto_secretbox_easy(update, nonce, groupKey);
    const out = new Uint8Array(nonce.length + ciphertext.length);
    out.set(nonce, 0);
    out.set(ciphertext, nonce.length);
    return out;
  }

  function decrypt(payload) {
    const nonce = payload.slice(0, sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = payload.slice(sodium.crypto_secretbox_NONCEBYTES);
    return sodium.crypto_secretbox_open_easy(ciphertext, nonce, groupKey);
  }

  const docA = new Y.Doc();
  const docB = new Y.Doc();
  const plaintextUpdatesSent = [];

  function connectClient(doc, roomId, { silent } = {}) {
    const ws = new WebSocket(`ws://localhost:${PORT}?room=${roomId}`);
    if (!silent) {
      doc.on('update', (update, origin) => {
        if (origin === 'remote') return;
        plaintextUpdatesSent.push(Buffer.from(update));
        const encrypted = encrypt(update);
        if (ws.readyState === WebSocket.OPEN) ws.send(encrypted);
        else ws.once('open', () => ws.send(encrypted));
      });
      ws.on('message', (data) => {
        const update = decrypt(new Uint8Array(data));
        Y.applyUpdate(doc, update, 'remote');
      });
    } else {
      // A third, non-participating connection in the same room purely to
      // observe what bytes actually cross the wire, independent of either
      // real client's own bookkeeping.
      ws.on('message', (data) => observedBytes.push(Buffer.from(data)));
    }
    return ws;
  }

  const wsA = connectClient(docA, 'workspace-1');
  const wsB = connectClient(docB, 'workspace-1');
  const wsObserver = connectClient(new Y.Doc(), 'workspace-1', { silent: true });

  await Promise.all([
    new Promise((resolve) => wsA.once('open', resolve)),
    new Promise((resolve) => wsB.once('open', resolve)),
    new Promise((resolve) => wsObserver.once('open', resolve)),
  ]);

  const yTextA = docA.getText('shared');
  yTextA.insert(0, 'hello from A');
  await new Promise((r) => setTimeout(r, 150));

  check("doc B converged to match doc A after A's edit", docB.getText('shared').toString() === 'hello from A');

  const yTextB = docB.getText('shared');
  yTextB.insert(yTextB.length, ' | hi from B');
  await new Promise((r) => setTimeout(r, 150));

  check("doc A converged to match doc B after B's edit", docA.getText('shared').toString() === docB.getText('shared').toString());
  check('final merged content is as expected', docA.getText('shared').toString() === 'hello from A | hi from B');

  check('observer saw at least one relayed message', observedBytes.length > 0);

  const sawPlaintext = observedBytes.some((observed) =>
    plaintextUpdatesSent.some((plain) => Buffer.compare(observed, plain) === 0)
  );
  check('bytes crossing the relay never exactly match any plaintext Yjs update', !sawPlaintext);

  let anyObservedBytesParseAsValidUpdate = false;
  for (const observed of observedBytes) {
    try {
      Y.decodeUpdate(observed);
      anyObservedBytesParseAsValidUpdate = true;
    } catch (e) {
      // expected: ciphertext is not a valid Yjs update
    }
  }
  check('bytes crossing the relay do not parse as a valid Yjs update (they are ciphertext)', !anyObservedBytesParseAsValidUpdate);

  wsA.close();
  wsB.close();
  wsObserver.close();
  relay.close();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
