import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootPackagePath = resolve(root, 'package.json');
const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
const version = rootPackage.version;
const jsonTargets = [
  'extension/package.json',
  'relay-server/package.json',
  'extension/manifest.json',
  'extension/manifest.chrome.json',
  'extension/manifest.firefox.json',
];
let changed = [];

for (const relativePath of jsonTargets) {
  const path = resolve(root, relativePath);
  const document = JSON.parse(readFileSync(path, 'utf8'));
  if (document.version === version) continue;
  document.version = version;
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`);
  changed.push(relativePath);
}

const lockfilePath = resolve(root, 'package-lock.json');
const lockfile = JSON.parse(readFileSync(lockfilePath, 'utf8'));
const lockTargets = ['', 'extension', 'relay-server'];
let lockChanged = lockfile.version !== version;
lockfile.version = version;
for (const target of lockTargets) {
  if (!lockfile.packages[target] || lockfile.packages[target].version === version) continue;
  lockfile.packages[target].version = version;
  lockChanged = true;
}
if (lockChanged) {
  writeFileSync(lockfilePath, `${JSON.stringify(lockfile, null, 2)}\n`);
  changed.push('package-lock.json');
}

const landingConfigPath = resolve(root, 'quillcrypt-landing/release-config.js');
const landingConfig = `/* Deployment-owned URLs. Replace these with published store/release URLs before launch. */
window.QUILLCRYPT_RELEASES = Object.freeze({
  chrome: '../extension/web-ext-artifacts/quillcrypt-${version}-chrome.zip',
  firefox: '../extension/web-ext-artifacts/quillcrypt-${version}.zip',
});
`;
if (readFileSync(landingConfigPath, 'utf8') !== landingConfig) {
  writeFileSync(landingConfigPath, landingConfig);
  changed.push('quillcrypt-landing/release-config.js');
}

const landingIndexPath = resolve(root, 'quillcrypt-landing/index.html');
const landingIndex = readFileSync(landingIndexPath, 'utf8').replace(
  /quillcrypt-\d+\.\d+\.\d+(?:-chrome)?\.zip/g,
  (archive) => archive.includes('-chrome')
    ? `quillcrypt-${version}-chrome.zip`
    : `quillcrypt-${version}.zip`,
);
if (landingIndex !== readFileSync(landingIndexPath, 'utf8')) {
  writeFileSync(landingIndexPath, landingIndex);
  changed.push('quillcrypt-landing/index.html');
}

console.log(changed.length ? `Synchronized ${version}: ${changed.join(', ')}` : `Version ${version} already synchronized.`);
