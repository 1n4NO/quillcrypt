'use strict';
const { JSDOM } = require('jsdom');
const { isReady, onReady, injectOnce, isAlreadyInjected } = require('../src/content/readiness');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

// ---- Case 1: document already ready (run_at: document_idle, common case) ----
// jsdom starts documents in 'loading' state by default (it simulates real
// parser timing); override to represent the state a content script actually
// sees when injected at document_idle.
const dom1 = new JSDOM('<body></body>');
Object.defineProperty(dom1.window.document, 'readyState', { value: 'complete', configurable: true });
check('document already loaded is detected as ready', isReady(dom1.window.document));

let calledImmediately = false;
onReady(dom1.window.document, () => { calledImmediately = true; });
check('onReady calls back synchronously when already ready', calledImmediately);

// ---- Case 2: document still loading (race condition) ----
const dom2 = new JSDOM('<body></body>', { runScripts: 'outside-only' });
Object.defineProperty(dom2.window.document, 'readyState', { value: 'loading', configurable: true });
check('document mid-load is detected as NOT ready', !isReady(dom2.window.document));

let calledAfterEvent = false;
onReady(dom2.window.document, () => { calledAfterEvent = true; });
check('onReady does not fire before DOMContentLoaded', !calledAfterEvent);

dom2.window.document.dispatchEvent(new dom2.window.Event('DOMContentLoaded'));
check('onReady fires once DOMContentLoaded dispatches', calledAfterEvent);

// ---- Case 3: idempotent injection guard ----
const dom3 = new JSDOM('<body></body>');
Object.defineProperty(dom3.window.document, 'readyState', { value: 'complete', configurable: true });
let mountCount = 0;
const firstAttempt = injectOnce(dom3.window.document, () => { mountCount++; });
const secondAttempt = injectOnce(dom3.window.document, () => { mountCount++; }); // simulates re-injection

check('first injectOnce call proceeds', firstAttempt === true);
check('second injectOnce call is blocked by the marker', secondAttempt === false);
check('mount() only ran once despite two injection attempts', mountCount === 1);
check('injected marker is set on documentElement', isAlreadyInjected(dom3.window.document));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
