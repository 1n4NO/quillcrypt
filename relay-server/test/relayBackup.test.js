'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');
const { startPersistentRelay } = require('../src/persistentRelay');
const { backupRelayData, restoreRelayData } = require('../src/backup');

let pass = 0, fail = 0;
function check(label, condition) {
  console.log((condition ? 'PASS' : 'FAIL') + ' — ' + label);
  condition ? pass++ : fail++;
}
function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function waitOpen(ws) { return new Promise((resolve) => ws.once('open', resolve)); }
function closeRelay(relay) { return new Promise((resolve) => relay.wss.close(resolve)); }

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quillcrypt-relay-backup-'));
  const source = path.join(directory, 'relay.json');
  const backup = path.join(directory, 'relay.backup.json');
  const restored = path.join(directory, 'restored.json');
  const firstPort = 8140;
  const secondPort = 8141;
  const payload = Buffer.from([0, 255, 18, 42]);
  try {
    const firstRelay = startPersistentRelay(firstPort, { persistencePath: source, heartbeatIntervalMs: 0 });
    const firstClient = new WebSocket(`ws://127.0.0.1:${firstPort}?room=backup-test`);
    await waitOpen(firstClient);
    firstClient.send(payload);
    await wait(80);
    firstClient.close();
    await closeRelay(firstRelay);

    const backupInfo = backupRelayData(source, backup);
    check('backup validates and copies opaque relay state', backupInfo.version === 1 && backupInfo.roomCount === 1 && fs.existsSync(backup));
    const restoreInfo = restoreRelayData(backup, restored);
    check('restore atomically writes a validated relay snapshot', restoreInfo.bytes > 0 && fs.readFileSync(backup, 'utf8') === fs.readFileSync(restored, 'utf8'));

    const corrupt = path.join(directory, 'corrupt.json');
    fs.writeFileSync(corrupt, JSON.stringify({ version: 1, rooms: { hidden: ['not-base64'] } }));
    let rejected = false;
    try { backupRelayData(corrupt, path.join(directory, 'rejected.json')); } catch { rejected = true; }
    check('corrupt backup input is rejected before any restore write', rejected && !fs.existsSync(path.join(directory, 'rejected.json')));

    const secondRelay = startPersistentRelay(secondPort, { persistencePath: restored, heartbeatIntervalMs: 0 });
    const secondClient = new WebSocket(`ws://127.0.0.1:${secondPort}?room=backup-test`);
    const replayed = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('restored replay timed out')), 2000);
      secondClient.once('message', (data) => { clearTimeout(timer); resolve(Buffer.from(data)); });
    });
    check('restored relay replays the opaque history', replayed.equals(payload));
    secondClient.close();
    await closeRelay(secondRelay);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => { console.error(error); process.exit(1); });
