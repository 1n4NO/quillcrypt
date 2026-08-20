import { backupRelayData, restoreRelayData } from '../src/backup.js';

const valueFor = (name) => {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  if (!argument) throw new Error(`Missing --${name}=...`);
  return argument.slice(prefix.length);
};

const source = valueFor('source');
const destination = valueFor('destination');
const result = process.argv.includes('--restore')
  ? restoreRelayData(source, destination)
  : backupRelayData(source, destination);
console.log(JSON.stringify({ ok: true, ...result }));
