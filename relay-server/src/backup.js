'use strict';

const fs = require('fs');
const path = require('path');

const SNAPSHOT_VERSION = 1;

function parseSnapshot(serialized, sourcePath) {
  let snapshot;
  try { snapshot = JSON.parse(serialized); } catch { throw new Error(`Invalid relay snapshot JSON: ${sourcePath}`); }
  if (!snapshot || snapshot.version !== SNAPSHOT_VERSION || !snapshot.rooms || typeof snapshot.rooms !== 'object' || Array.isArray(snapshot.rooms)) {
    throw new Error(`Unsupported relay snapshot format: ${sourcePath}`);
  }
  for (const updates of Object.values(snapshot.rooms)) {
    if (!Array.isArray(updates)) throw new Error('Invalid update log in relay snapshot');
    for (const encoded of updates) {
      if (typeof encoded !== 'string' || !encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
        throw new Error('Invalid opaque update encoding in relay snapshot');
      }
    }
  }
  return snapshot;
}

function readRelaySnapshot(sourcePath) {
  const serialized = fs.readFileSync(sourcePath, 'utf8');
  const snapshot = parseSnapshot(serialized, sourcePath);
  return { serialized, snapshot };
}

function atomicWrite(destinationPath, serialized) {
  const directory = path.dirname(destinationPath);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = `${destinationPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporaryPath, serialized, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, destinationPath);
  } finally {
    try { fs.unlinkSync(temporaryPath); } catch {}
  }
}

function copyRelaySnapshot(sourcePath, destinationPath) {
  const source = path.resolve(sourcePath);
  const destination = path.resolve(destinationPath);
  if (source === destination) throw new Error('Relay backup destination must differ from the source');
  const { serialized, snapshot } = readRelaySnapshot(source);
  atomicWrite(destination, serialized);
  return { version: snapshot.version, roomCount: Object.keys(snapshot.rooms).length, bytes: Buffer.byteLength(serialized) };
}

function backupRelayData(sourcePath, destinationPath) {
  return copyRelaySnapshot(sourcePath, destinationPath);
}

function restoreRelayData(backupPath, destinationPath) {
  return copyRelaySnapshot(backupPath, destinationPath);
}

module.exports = { SNAPSHOT_VERSION, readRelaySnapshot, backupRelayData, restoreRelayData };
