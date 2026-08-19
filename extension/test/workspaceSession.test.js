'use strict';
const WebSocket = require('ws');
const { startPersistentRelay } = require('../../relay-server/src/persistentRelay');
const { ready, generateSymmetricKey } = require('../src/crypto/primitives');
const { WorkspaceSession } = require('../src/sync/workspaceSession');

let pass = 0, fail = 0;
function check(label, condition) {
  console.log((condition ? 'PASS' : 'FAIL') + ' — ' + label);
  condition ? pass++ : fail++;
}
function waitFor(condition, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      if (condition()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(poll, 20);
    };
    poll();
  });
}

async function main() {
  await ready();
  const relay = startPersistentRelay(8137, { compactionThreshold: 1000 });
  const workspace = { id: 'workspace-session-test', name: 'Review', scopeType: 'domain', scopeValue: 'example.com' };
  const key = generateSymmetricKey();
  const options = { WebSocketImpl: WebSocket, minBackoff: 25, maxBackoff: 100, presenceState: { workspaceId: workspace.id } };
  const sessionA = new WorkspaceSession(workspace, key, 'ws://localhost:8137', options);
  const sessionB = new WorkspaceSession(workspace, key, 'ws://localhost:8137', options);

  await waitFor(() => sessionA.getStatus() === 'open' && sessionB.getStatus() === 'open');
  sessionA.addAnnotation({ id: 'shared-1', type: 'note', content: 'encrypted workspace note' });
  await waitFor(() => sessionB.getAnnotations().some((annotation) => annotation.id === 'shared-1'));

  check('sessions derive the same room and exchange encrypted annotations', sessionB.getAnnotations()[0].content === 'encrypted workspace note');
  await waitFor(() => sessionA.presence.getPeers().some((peer) => peer.state && peer.state.workspaceId === workspace.id));
  check('presence is connected in a separate workspace presence room', sessionA.presence.getPeers().length === 1);

  sessionA.dispose();
  sessionB.dispose();
  relay.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
