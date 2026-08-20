import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = resolve(extensionRoot, '..');
const artifactRoot = resolve(extensionRoot, 'web-ext-artifacts');
const rootPackage = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'));
const extensionPackage = JSON.parse(readFileSync(resolve(extensionRoot, 'package.json'), 'utf8'));
const manifests = ['manifest.json', 'manifest.chrome.json', 'manifest.firefox.json']
  .map((name) => JSON.parse(readFileSync(resolve(extensionRoot, name), 'utf8')));

const versions = [rootPackage.version, extensionPackage.version, ...manifests.map((manifest) => manifest.version)];
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

const rows = artifacts.map((artifact) => {
  const checksum = createHash('sha256').update(readFileSync(artifact)).digest('hex');
  return `${checksum}  ${artifact.slice(artifactRoot.length + 1)}`;
});
const checksumFile = resolve(artifactRoot, `quillcrypt-${version}-SHA256SUMS.txt`);
writeFileSync(checksumFile, `${rows.join('\n')}\n`);
console.log(`Release ${version} verified.`);
console.log(rows.join('\n'));
console.log(`Checksums written to ${checksumFile}`);
