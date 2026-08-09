'use strict';

/**
 * Page readiness detection and double-injection guard.
 *
 * Even with `run_at: "document_idle"` in manifest.json, a content script can
 * still race a page that's still constructing its DOM (SPAs in particular),
 * and Firefox can re-run content scripts in edge cases (extension reload
 * during dev, some navigation types) — so injection must be idempotent.
 */

const INJECTED_MARKER = 'data-quillcrypt-injected';

function isReady(doc) {
  return doc.readyState !== 'loading' && !!doc.body;
}

/** Calls `callback` once the document is ready — immediately if already ready. */
function onReady(doc, callback) {
  if (isReady(doc)) {
    callback();
    return;
  }
  doc.addEventListener('DOMContentLoaded', () => callback(), { once: true });
}

function isAlreadyInjected(doc) {
  return doc.documentElement.hasAttribute(INJECTED_MARKER);
}

function markInjected(doc) {
  doc.documentElement.setAttribute(INJECTED_MARKER, 'true');
}

/**
 * Top-level guard: runs `mount` exactly once, only once the page is ready,
 * even if this module is evaluated more than once in the same document.
 */
function injectOnce(doc, mount) {
  if (isAlreadyInjected(doc)) return false;
  onReady(doc, () => {
    if (isAlreadyInjected(doc)) return; // race: readiness fired twice
    markInjected(doc);
    mount();
  });
  return true;
}

module.exports = { isReady, onReady, isAlreadyInjected, markInjected, injectOnce };
