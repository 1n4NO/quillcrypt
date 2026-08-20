import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const extensionRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
const chrome = process.argv.includes('--chrome');
const outputRoot = path.join(extensionRoot, chrome ? 'chrome-dist' : 'firefox-dist');
const dist = path.join(outputRoot, 'dist');
const python = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');

execFileSync(python, [path.join(extensionRoot, 'scripts/generate-icons.py')], {
  cwd: extensionRoot,
  stdio: 'inherit',
});

await rm(outputRoot, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await build({
  entryPoints: {
    'content-script': path.join(extensionRoot, 'src/content/content-script.js'),
    background: path.join(extensionRoot, 'src/background/background.js'),
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome110', 'firefox115'],
  outdir: dist,
  sourcemap: false,
  legalComments: 'none',
});

console.log(`Built browser bundles in ${dist}`);

await mkdir(path.join(outputRoot, 'src/overlay'), { recursive: true });
await cp(path.join(extensionRoot, chrome ? 'manifest.chrome.json' : 'manifest.firefox.json'), path.join(outputRoot, 'manifest.json'));
await cp(path.join(extensionRoot, 'src/overlay/overlay.css'), path.join(outputRoot, 'src/overlay/overlay.css'), { recursive: true });
await mkdir(path.join(outputRoot, 'src/ui'), { recursive: true });
await cp(path.join(extensionRoot, 'src/ui/toolbar.css'), path.join(outputRoot, 'src/ui/toolbar.css'));
await cp(path.join(extensionRoot, 'src/ui/sidebar.css'), path.join(outputRoot, 'src/ui/sidebar.css'));
await cp(path.join(extensionRoot, 'src/ui/settings.css'), path.join(outputRoot, 'src/ui/settings.css'));
await cp(path.join(extensionRoot, 'src/ui/onboarding.css'), path.join(outputRoot, 'src/ui/onboarding.css'));
await cp(path.join(extensionRoot, 'src/ui/workspaceStatus.css'), path.join(outputRoot, 'src/ui/workspaceStatus.css'));
await cp(path.join(extensionRoot, 'icons'), path.join(outputRoot, 'icons'), { recursive: true });
console.log(`${chrome ? 'Chrome unpacked' : 'Firefox'} extension ready in ${outputRoot}`);
