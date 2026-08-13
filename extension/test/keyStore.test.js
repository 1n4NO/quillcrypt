'use strict';
const { ready, generateMemberKeyPair, generateSymmetricKey } = require('../src/crypto/primitives');
const { KeyStore, InMemoryKeyBackend } = require('../src/crypto/keyStore');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

async function main() {
  await ready();

  const store = new KeyStore();
  const deviceKeyPair = generateMemberKeyPair();

  await store.storeDeviceKeyPair(deviceKeyPair);
  const retrievedKeyPair = await store.getDeviceKeyPair();
  check(
    'device keypair round-trips correctly',
    Buffer.compare(Buffer.from(retrievedKeyPair.publicKey), Buffer.from(deviceKeyPair.publicKey)) === 0 &&
    Buffer.compare(Buffer.from(retrievedKeyPair.privateKey), Buffer.from(deviceKeyPair.privateKey)) === 0
  );

  const workspaceKey1 = generateSymmetricKey();
  const workspaceKey2 = generateSymmetricKey();
  await store.storeWorkspaceKey('ws-1', workspaceKey1);
  await store.storeWorkspaceKey('ws-2', workspaceKey2);

  const retrievedKey1 = await store.getWorkspaceKey('ws-1');
  check('workspace key round-trips correctly', Buffer.compare(Buffer.from(retrievedKey1), Buffer.from(workspaceKey1)) === 0);

  const workspaceIds = await store.listWorkspaceIds();
  check('listWorkspaceIds returns both stored workspaces', workspaceIds.length === 2 && workspaceIds.includes('ws-1') && workspaceIds.includes('ws-2'));

  await store.removeWorkspaceKey('ws-1');
  const afterRemoval = await store.listWorkspaceIds();
  check('removed workspace key no longer appears in the list', !afterRemoval.includes('ws-1') && afterRemoval.includes('ws-2'));
  check('getWorkspaceKey for a removed workspace returns null', (await store.getWorkspaceKey('ws-1')) === null);

  const freshStoreAfterDeviceLoss = new KeyStore(new InMemoryKeyBackend());
  const lostDeviceKeyPair = await freshStoreAfterDeviceLoss.getDeviceKeyPair();
  const lostWorkspaceKey = await freshStoreAfterDeviceLoss.getWorkspaceKey('ws-2');

  check('after simulated device loss, the device keypair is genuinely gone (null, not recoverable)', lostDeviceKeyPair === null);
  check('after simulated device loss, workspace keys are genuinely gone too', lostWorkspaceKey === null);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
