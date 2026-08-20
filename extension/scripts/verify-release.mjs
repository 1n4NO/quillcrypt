import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = resolve(extensionRoot, '..');
const artifactRoot = resolve(extensionRoot, 'web-ext-artifacts');
const rootPackage = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'));
const extensionPackage = JSON.parse(readFileSync(resolve(extensionRoot, 'package.json'), 'utf8'));
const relayPackage = JSON.parse(readFileSync(resolve(repositoryRoot, 'relay-server/package.json'), 'utf8'));
const lockfile = JSON.parse(readFileSync(resolve(repositoryRoot, 'package-lock.json'), 'utf8'));
const manifests = ['manifest.json', 'manifest.chrome.json', 'manifest.firefox.json']
  .map((name) => JSON.parse(readFileSync(resolve(extensionRoot, name), 'utf8')));

const versions = [
  rootPackage.version,
  extensionPackage.version,
  relayPackage.version,
  lockfile.version,
  lockfile.packages?.['']?.version,
  lockfile.packages?.extension?.version,
  lockfile.packages?.['relay-server']?.version,
  ...manifests.map((manifest) => manifest.version),
];
if (new Set(versions).size !== 1) {
  throw new Error(`Version mismatch: ${versions.join(', ')}`);
}

const version = rootPackage.version;
const artifacts = [
  resolve(artifactRoot, `quillcrypt-${version}.zip`),
  resolve(artifactRoot, `quillcrypt-${version}-chrome.zip`),
];
const missing = artifacts.filter((artifact) => !existsSync(artifact));
if (missing.length) {
  throw new Error(`Missing release artifacts. Build Firefox and Chrome first: ${missing.join(', ')}`);
}

function readZipEntries(artifact) {
  const bytes = readFileSync(artifact);
  const endSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const endOffset = bytes.lastIndexOf(endSignature);
  if (endOffset < 0) throw new Error(`Invalid ZIP archive: ${artifact}`);
  const count = bytes.readUInt16LE(endOffset + 10);
  let cursor = bytes.readUInt32LE(endOffset + 16);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error(`Invalid ZIP directory: ${artifact}`);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    entries.push(bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8'));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

const expectedEntries = [
  'dist/background.js', 'dist/content-script.js', 'manifest.json',
  'icons/icon-128.png', 'icons/icon-16.png', 'icons/icon-48.png',
  'src/overlay/overlay.css', 'src/ui/settings.css', 'src/ui/sidebar.css',
].sort();
for (const artifact of artifacts) {
  const actualEntries = readZipEntries(artifact).sort();
  if (JSON.stringify(actualEntries) !== JSON.stringify(expectedEntries)) {
    throw new Error(`Unexpected install payload in ${artifact}: ${actualEntries.join(', ')}`);
  }
}

const rows = artifacts.map((artifact) => {
  const checksum = createHash('sha256').update(readFileSync(artifact)).digest('hex');
  return `${checksum}  ${artifact.slice(artifactRoot.length + 1)}`;
});
const checksumFile = resolve(artifactRoot, `quillcrypt-${version}-SHA256SUMS.txt`);
writeFileSync(checksumFile, `${rows.join('\n')}\n`);
console.log(`Release ${version} verified.`);
console.log(rows.join('\n'));
console.log(`Checksums written to ${checksumFile}`);
