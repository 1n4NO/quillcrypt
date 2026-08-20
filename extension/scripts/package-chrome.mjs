import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const webExt = resolve(root, '../node_modules/.bin/web-ext');
execFileSync(webExt, [
  'build', '--source-dir', resolve(root, 'chrome-dist'), '--artifacts-dir', resolve(root, 'web-ext-artifacts'),
  '--filename', `quillcrypt-${version}-chrome.zip`, '--overwrite-dest',
], { cwd: root, stdio: 'inherit' });
