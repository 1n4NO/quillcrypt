'use strict';

const assert = require('node:assert/strict');
const { MESSAGE_TYPES, validateMessage, createBackgroundController } = require('../src/background/messages');

let pass = 0;
function check(label, condition) {
  console.log((condition ? 'PASS' : 'FAIL') + ' — ' + label);
  if (!condition) process.exitCode = 1;
  else pass++;
}

async function main() {
  check('validates known messages', validateMessage({ type: MESSAGE_TYPES.PING }).ok);
  check('rejects unknown messages', !validateMessage({ type: 'SECRET_KEY' }).ok);
  check('rejects non-object messages', !validateMessage(null).ok);

  const listeners = [];
  const browserApi = { runtime: { onMessage: { addListener: (listener) => listeners.push(listener) } } };
  const storageArea = { async get() { return { 'config:relay-url': 'ws://localhost:8123' }; } };
  const controller = createBackgroundController({
    browserApi,
    storageArea,
    getStatus: async (url) => ({ url, workspaces: [] }),
  });
  check('registers one runtime message listener', listeners.length === 1);
  check('ping response contains no sensitive fields', JSON.stringify(await controller.handleMessage({ type: MESSAGE_TYPES.PING })) === JSON.stringify({ ok: true, type: MESSAGE_TYPES.PING }));
  check('relay response exposes configuration state only', JSON.stringify(await controller.handleMessage({ type: MESSAGE_TYPES.GET_RELAY_URL })) === JSON.stringify({ ok: true, relayConfigured: true }));
  check('status passes tab URL to the status provider', (await controller.handleMessage({ type: MESSAGE_TYPES.GET_STATUS }, { tab: { url: 'https://example.com' } })).status.url === 'https://example.com');
  check('malformed message is rejected safely', (await controller.handleMessage({ type: 'NOPE' })).ok === false);
  assert.equal(pass, 8);
  console.log(`\n${pass} passed, 0 failed`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
