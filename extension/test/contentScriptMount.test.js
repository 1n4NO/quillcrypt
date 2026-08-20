'use strict';
const { JSDOM } = require('jsdom');
const { mount, start } = require('../src/content/content-script');
const { normalizeUrl } = require('../src/storage/store');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

function createMockStorageArea() {
  const data = new Map();
  return {
    async get(keyOrKeys) {
      if (keyOrKeys === null) return Object.fromEntries(data.entries());
      if (typeof keyOrKeys === 'string') return data.has(keyOrKeys) ? { [keyOrKeys]: data.get(keyOrKeys) } : {};
      throw new Error('unsupported');
    },
    async set(obj) { for (const [k, v] of Object.entries(obj)) data.set(k, v); },
    async remove(key) { data.delete(key); },
  };
}

async function main() {
  const sharedStorage = createMockStorageArea(); // simulates the SAME browser.storage.local surviving a reload
  const url = 'https://example.com/article';

  const dom1 = new JSDOM(`<!DOCTYPE html><html><body><article><p id="p">The quick brown fox jumps over the lazy dog</p></article></body></html>`, { url });
  const { failedToRender, dispose } = await mount(dom1.window.document, dom1.window, sharedStorage);

  check('initial mount has no annotations that failed to render (none exist yet)', failedToRender.length === 0);

  const toolbarButton = dom1.window.document.querySelector('[data-tool="highlight"]');
  check('the toolbar was actually mounted into the real document', toolbarButton !== null);

  toolbarButton.dispatchEvent(new dom1.window.MouseEvent('click', { bubbles: true }));

  const textNode = dom1.window.document.querySelector('#p').firstChild;
  const range = dom1.window.document.createRange();
  const selectionStart = textNode.textContent.indexOf('quick brown');
  range.setStart(textNode, selectionStart);
  range.setEnd(textNode, selectionStart + 'quick brown'.length);
  const selection = dom1.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  dom1.window.document.dispatchEvent(new dom1.window.MouseEvent('mouseup', { bubbles: true }));

  await new Promise((r) => setTimeout(r, 50));

  check('the highlight was rendered in the live document', dom1.window.document.querySelector('mark.qc-highlight') !== null);
  check('the highlight text matches what was selected', dom1.window.document.querySelector('mark.qc-highlight').textContent === 'quick brown');

  dispose();
  check('dispose() removes the toolbar from the document', dom1.window.document.querySelector('.qc-toolbar') === null);

  // ---- Simulated "page reload": a completely FRESH document, but the SAME underlying storage ----
  const dom2 = new JSDOM(`<!DOCTYPE html><html><body><article><p id="p">The quick brown fox jumps over the lazy dog</p></article></body></html>`, { url });
  const { failedToRender: failedToRender2 } = await mount(dom2.window.document, dom2.window, sharedStorage);

  check('after a simulated reload, the previously-created annotation is rendered automatically', dom2.window.document.querySelector('mark.qc-highlight') !== null);
  check('the re-rendered highlight has the correct text', dom2.window.document.querySelector('mark.qc-highlight').textContent === 'quick brown');
  check('nothing failed to render on reload', failedToRender2.length === 0);

  const lockedStorage = createMockStorageArea();
  await lockedStorage.set({
    'config:relay-url': 'ws://127.0.0.1:8199',
    'workspaces:locked-ws': { id: 'locked-ws', name: 'Shared review', scopeType: 'domain', scopeValue: 'example.com', createdAt: new Date().toISOString() },
  });
  const dom3 = new JSDOM('<!DOCTYPE html><html><body><p>Locked workspace page</p></body></html>', { url });
  const lockedMount = await mount(dom3.window.document, dom3.window, lockedStorage);
  check('matching workspace without a key shows an actionable locked state', dom3.window.document.querySelector('.qc-workspace-status')?.textContent.includes('Shared review') && dom3.window.document.querySelector('.qc-workspace-status-settings') !== null);
  dom3.window.document.querySelector('.qc-workspace-status-settings').click();
  await new Promise((r) => setTimeout(r, 30));
  check('locked state opens settings with the workspace marked No key', dom3.window.document.querySelector('.qc-settings-row[data-workspace-id="locked-ws"] .qc-settings-badge')?.textContent === 'No key');
  lockedMount.dispose();

  const dom4 = new JSDOM('<!DOCTYPE html><html><body><p>Started page</p></body></html>', { url });
  const runtime = { onMessage: { addListener() {}, removeListener() {} } };
  const startStorage = createMockStorageArea();
  await startStorage.set({ [`active-pages:${normalizeUrl(url)}`]: true });
  start(dom4.window.document, dom4.window, startStorage, runtime);
  await new Promise((r) => setTimeout(r, 50));
  check('real content-script start mounts without a browserApi scope error', dom4.window.document.querySelector('.qc-toolbar') !== null);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
