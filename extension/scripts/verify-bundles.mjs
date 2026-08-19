import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const extensionRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
const outputRoot = process.argv.includes('--chrome') ? path.join(extensionRoot, 'chrome-dist') : extensionRoot;
const bundlePaths = [
  path.join(outputRoot, 'dist/content-script.js'),
  path.join(outputRoot, 'dist/background.js'),
];

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
