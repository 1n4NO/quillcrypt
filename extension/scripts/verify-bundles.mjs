import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const extensionRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
const outputRoot = process.argv.includes('--chrome') ? path.join(extensionRoot, 'chrome-dist') : path.join(extensionRoot, 'firefox-dist');
const bundlePaths = [
  path.join(outputRoot, 'dist/content-script.js'),
  path.join(outputRoot, 'dist/background.js'),
];

if (process.argv.includes('--chrome')) {
  const manifest = JSON.parse(await readFile(path.join(outputRoot, 'manifest.json'), 'utf8'));
  const extensionPagesPolicy = manifest.content_security_policy?.extension_pages;
  if (!extensionPagesPolicy?.includes("'wasm-unsafe-eval'")) {
    throw new Error('Chrome manifest must allow wasm-unsafe-eval for libsodium WebAssembly.');
  }
}

const forbidden = [
  { pattern: /require\(["'](?:crypto|fs|path|os|child_process)["']\)/, label: 'Node builtin require' },
  { pattern: /\bBuffer\.(?:from|alloc|concat)\b/, label: 'Node Buffer API' },
];

for (const bundlePath of bundlePaths) {
  await access(bundlePath);
  const source = await readFile(bundlePath, 'utf8');
  for (const check of forbidden) {
    if (check.pattern.test(source)) throw new Error(`${check.label} found in browser bundle: ${bundlePath}`);
  }
}

console.log(`Verified ${bundlePaths.length} browser bundles for Node-only runtime leaks.`);
