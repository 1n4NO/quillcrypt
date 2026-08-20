'use strict';

const { ready, encodeKey, decodeKey } = require('./primitives');

const FORMAT_VERSION = 1;
const KDF_ITERATIONS = 210000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function webCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('Web Crypto is unavailable; key backup cannot run here');
  }
  return globalThis.crypto;
}

async function deriveKey(password, salt, usage) {
  const crypto = webCrypto();
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage]
  );
}

function requirePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Backup password must be at least 8 characters');
  }
}

async function exportKeyBackup(keyStore, workspaceRegistry, password) {
  requirePassword(password);
  await ready();
  const crypto = webCrypto();
  const workspaces = await workspaceRegistry.listWorkspaces();
  const entries = [];
  for (const workspace of workspaces) {
    const key = await keyStore.getWorkspaceKey(workspace.id);
    if (key) entries.push({ workspace, key: encodeKey(key) });
  }
  const salt = new Uint8Array(SALT_BYTES);
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(salt);
  crypto.getRandomValues(iv);
  const aesKey = await deriveKey(password, salt, 'encrypt');
  const plaintext = new TextEncoder().encode(JSON.stringify({ entries }));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext));
  return JSON.stringify({
    formatVersion: FORMAT_VERSION,
    kdf: 'PBKDF2-SHA-256',
    iterations: KDF_ITERATIONS,
    salt: encodeKey(salt),
    iv: encodeKey(iv),
    ciphertext: encodeKey(ciphertext),
    createdAt: new Date().toISOString(),
  }, null, 2);
}

async function importKeyBackup(json, keyStore, workspaceRegistry, password) {
  requirePassword(password);
  await ready();
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  if (parsed?.formatVersion !== FORMAT_VERSION || parsed.kdf !== 'PBKDF2-SHA-256' || parsed.iterations !== KDF_ITERATIONS) {
    throw new Error('Unsupported or invalid key backup format');
  }
  let decrypted;
  try {
    const crypto = webCrypto();
    const aesKey = await deriveKey(password, decodeKey(parsed.salt), 'decrypt');
    decrypted = new TextDecoder().decode(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: decodeKey(parsed.iv) }, aesKey, decodeKey(parsed.ciphertext)
    ));
  } catch {
    throw new Error('Could not decrypt key backup; check the password and file');
  }
  const payload = JSON.parse(decrypted);
  if (!Array.isArray(payload.entries)) throw new Error('Key backup has no valid workspace entries');
  const existing = new Set((await workspaceRegistry.listWorkspaces()).map((workspace) => workspace.id));
  const decoded = payload.entries.map((entry) => {
    if (!entry?.workspace?.id || typeof entry.key !== 'string') throw new Error('Key backup contains an invalid workspace');
    return { workspace: entry.workspace, key: decodeKey(entry.key) };
  });
  if (decoded.some(({ workspace }) => existing.has(workspace.id))) {
    throw new Error('Key backup contains a workspace already on this device');
  }
  for (const { workspace, key } of decoded) {
    await workspaceRegistry.addWorkspace(workspace);
    await keyStore.storeWorkspaceKey(workspace.id, key);
  }
  return decoded.length;
}

module.exports = { exportKeyBackup, importKeyBackup, FORMAT_VERSION, KDF_ITERATIONS };
