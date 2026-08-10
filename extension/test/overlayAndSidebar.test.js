'use strict';
const { JSDOM } = require('jsdom');
const { computeOverlayDimensions, observeDocumentSize } = require('../src/overlay/overlayDimensions');
const { OVERLAY_Z_INDEX, findMaxZIndexInUse, ensureOverlayIsLastChild, watchForNewSiblings } = require('../src/overlay/zIndexGuard');
const { buildSidebarItems, filterSidebarItems, excerptFor } = require('../src/ui/sidebar');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

// ================= QC-23: overlay dimensions =================
const doc1 = {
  documentElement: { scrollWidth: 1200, scrollHeight: 3000 },
  body: { scrollWidth: 1180, scrollHeight: 3200 },
};
const dims1 = computeOverlayDimensions(doc1);
check('takes the larger of documentElement/body width', dims1.width === 1200);
check('takes the larger of documentElement/body height', dims1.height === 3200);

function createMockEnv(initialDims) {
  const mockDoc = {
    documentElement: { scrollWidth: initialDims.width, scrollHeight: initialDims.height },
    body: { scrollWidth: initialDims.width, scrollHeight: initialDims.height },
  };
  const listeners = {};
  const observerInstances = [];
  class MockMutationObserver {
    constructor(cb) { this.cb = cb; this.disconnected = false; observerInstances.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
    trigger() { this.cb(); }
  }
  const mockWin = {
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
    dispatchResize() { (listeners.resize || []).forEach((f) => f()); },
    MutationObserver: MockMutationObserver,
  };
  function setDims(w, h) {
    mockDoc.documentElement.scrollWidth = w; mockDoc.documentElement.scrollHeight = h;
    mockDoc.body.scrollWidth = w; mockDoc.body.scrollHeight = h;
  }
  return { mockDoc, mockWin, setDims, observerInstances };
}

const env = createMockEnv({ width: 1000, height: 2000 });
const callbackCalls = [];
const dispose = observeDocumentSize(env.mockDoc, env.mockWin, (dims) => callbackCalls.push(dims));
check('callback fires immediately on setup with the initial dimensions', callbackCalls.length === 1 && callbackCalls[0].width === 1000);
env.mockWin.dispatchResize();
check('resize with unchanged dimensions does not re-notify', callbackCalls.length === 1);
env.setDims(1000, 2600);
env.mockWin.dispatchResize();
check('resize after a real dimension change re-notifies with the new size', callbackCalls.length === 2 && callbackCalls[1].height === 2600);
env.setDims(1000, 3500);
env.observerInstances[0].trigger();
check('MutationObserver trigger after content growth also re-notifies', callbackCalls.length === 3 && callbackCalls[2].height === 3500);
dispose();
env.setDims(1000, 9999);
env.mockWin.dispatchResize();
check('after dispose(), resize events no longer trigger the callback', callbackCalls.length === 3);
check('dispose() disconnects the MutationObserver', env.observerInstances[0].disconnected === true);

// ================= QC-24: z-index guard =================
check('overlay z-index is the CSS spec maximum', OVERLAY_Z_INDEX === 2147483647);

const zdom1 = new JSDOM(`<body>
  <div style="z-index: 5; position: relative;"></div>
  <div style="z-index: 100; position: relative;"></div>
  <div style="z-index: auto;"></div>
</body>`);
check('correctly finds the maximum z-index actually in use on the page', findMaxZIndexInUse(zdom1.window.document, zdom1.window) === 100);

const zdom3 = new JSDOM('<body><div id="a"></div><div id="overlay"></div><div id="b"></div></body>');
const overlay3 = zdom3.window.document.getElementById('overlay');
ensureOverlayIsLastChild(zdom3.window.document, overlay3);
check('overlay is moved to be the last child', zdom3.window.document.body.lastElementChild.id === 'overlay');

// ================= QC-25: sidebar =================
function anchoredAnnotation(id, type, exact, start, createdAt) {
  return { id, type, anchor: { exact, position: { start, end: start + exact.length } }, content: null, createdAt };
}

const annotations = [
  anchoredAnnotation('ann-3', 'highlight', 'third phrase', 300, '2024-01-03'),
  anchoredAnnotation('ann-1', 'highlight', 'first phrase', 10, '2024-01-01'),
  anchoredAnnotation('ann-2', 'underline', 'second phrase', 150, '2024-01-02'),
];
const items = buildSidebarItems(annotations);
check('items are sorted by reading order (anchor position), not creation order', items.map((i) => i.id).join(',') === 'ann-1,ann-2,ann-3');

const noteAnnotation = { id: 'n1', type: 'note', anchor: { exact: 'ignored', position: { start: 0, end: 0 } }, content: 'This is my comment' };
check('note excerpt uses the note content, not the anchored text', excerptFor(noteAnnotation) === 'This is my comment');

const rectAnnotation = { id: 's1', type: 'rect', anchor: null, geometry: {} };
check('shape excerpt uses a human-readable type label', excerptFor(rectAnnotation) === 'Rectangle');

const longAnnotation = anchoredAnnotation('long', 'highlight', 'a'.repeat(100), 0, 'now');
const excerpt = excerptFor(longAnnotation);
check('long excerpts are truncated to the max length', excerpt.length === 60 && excerpt.endsWith('…'));

const mixed = [
  { id: 'shape-2', type: 'rect', anchor: null, geometry: {}, createdAt: '2024-01-05' },
  anchoredAnnotation('text-1', 'highlight', 'anchored text', 50, '2024-01-01'),
  { id: 'shape-1', type: 'arrow', anchor: null, geometry: {}, createdAt: '2024-01-02' },
];
const mixedItems = buildSidebarItems(mixed);
check('anchored items always come before unanchored shape items', mixedItems[0].id === 'text-1');
check('unanchored items among themselves sort by creation time', mixedItems[1].id === 'shape-1' && mixedItems[2].id === 'shape-2');

const filterableItems = buildSidebarItems([
  anchoredAnnotation('a', 'highlight', 'the quick brown fox', 0, 'now'),
  anchoredAnnotation('b', 'highlight', 'jumps over the lazy dog', 50, 'now'),
]);
const filtered = filterSidebarItems(filterableItems, 'FOX');
check('filter is case-insensitive and matches substrings', filtered.length === 1 && filtered[0].id === 'a');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
