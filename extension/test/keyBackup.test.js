'use strict';
const { ready, generateSymmetricKey, encodeKey } = require('../src/crypto/primitives');
const { KeyStore } = require('../src/crypto/keyStore');
const { WorkspaceRegistry } = require('../src/ui/settings');
const { exportKeyBackup, importKeyBackup } = require('../src/crypto/keyBackup');

let pass = 0, fail = 0;
function check(label, condition) {
  console.log((condition ? 'PASS' : 'FAIL') + ' — ' + label);
  condition ? pass++ : fail++;
}

async function main() {
  await ready();
  const sourceKeys = new KeyStore();
  const sourceWorkspaces = new WorkspaceRegistry();
  const workspace = { id: 'backup-ws', name: 'Backup test', scopeType: 'domain', scopeValue: 'example.com' };
  const key = generateSymmetricKey();
  await sourceWorkspaces.addWorkspace(workspace);
  await sourceKeys.storeWorkspaceKey(workspace.id, key);

  const backup = await exportKeyBackup(sourceKeys, sourceWorkspaces, 'correct horse battery');
  check('backup has a versioned encrypted envelope', JSON.parse(backup).formatVersion === 1 && JSON.parse(backup).ciphertext);
  check('backup ciphertext does not contain the raw workspace key', !backup.includes(encodeKey(key)));

  const restoredKeys = new KeyStore();
  const restoredWorkspaces = new WorkspaceRegistry();
  const imported = await importKeyBackup(backup, restoredKeys, restoredWorkspaces, 'correct horse battery');
  const restoredKey = await restoredKeys.getWorkspaceKey(workspace.id);
  check('backup import restores workspace metadata and key', imported === 1 && (await restoredWorkspaces.listWorkspaces())[0].name === workspace.name && Buffer.from(restoredKey).equals(Buffer.from(key)));

  let wrongPasswordRejected = false;
  try { await importKeyBackup(backup, new KeyStore(), new WorkspaceRegistry(), 'wrong password'); } catch { wrongPasswordRejected = true; }
  check('wrong backup password is rejected', wrongPasswordRejected);

  let shortPasswordRejected = false;
  try { await exportKeyBackup(sourceKeys, sourceWorkspaces, 'short'); } catch { shortPasswordRejected = true; }
  check('short backup passwords are rejected', shortPasswordRejected);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => { console.error(error); process.exit(1); });
