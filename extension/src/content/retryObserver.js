'use strict';

function isExtensionNode(node) {
  let current = node?.nodeType === 1 ? node : node?.parentElement;
  while (current) {
    if (typeof current.className === 'string' && current.className.split(/\s+/).some((name) => name.startsWith('qc-'))) return true;
    current = current.parentElement;
  }
  return false;
}

/** Retry only orphaned anchors, and only after relevant page mutations/routes. */
function mountRetryObserver(doc, win, { hasOrphans, retry, delayMs = 250 } = {}) {
  let timer = null;
  const schedule = () => {
    if (!hasOrphans?.() || timer) return;
    timer = setTimeout(() => { timer = null; if (hasOrphans?.()) retry?.(); }, delayMs);
  };
  const observer = win.MutationObserver ? new win.MutationObserver((records) => {
    if (records.some((record) => !isExtensionNode(record.target) && [...record.addedNodes].some((node) => !isExtensionNode(node)))) schedule();
  }) : null;
  if (observer && doc.body) observer.observe(doc.body, { childList: true, subtree: true });
  const onRoute = () => schedule();
  win.addEventListener?.('popstate', onRoute);
  win.addEventListener?.('hashchange', onRoute);
  const history = win.history;
  const originalPush = history?.pushState;
  const originalReplace = history?.replaceState;
  if (history && originalPush && originalReplace) {
    history.pushState = function (...args) { const result = originalPush.apply(this, args); onRoute(); return result; };
    history.replaceState = function (...args) { const result = originalReplace.apply(this, args); onRoute(); return result; };
  }
  return () => {
    if (timer) clearTimeout(timer);
    observer?.disconnect();
    win.removeEventListener?.('popstate', onRoute);
    win.removeEventListener?.('hashchange', onRoute);
    if (history && originalPush && history.pushState !== originalPush) history.pushState = originalPush;
    if (history && originalReplace && history.replaceState !== originalReplace) history.replaceState = originalReplace;
  };
}

module.exports = { mountRetryObserver };
