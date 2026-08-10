'use strict';

/**
 * Overlay sizing and repositioning (QC-23).
 *
 * Approach: the SVG overlay is absolutely positioned to cover the FULL
 * document (not just the viewport), with all annotation shapes drawn in
 * document coordinates. This means scroll and browser zoom need NO manual
 * transform math at all — the overlay is a normal part of document flow, so
 * the browser scrolls and scales it exactly like any other content. This is
 * a direct consequence of the QC-4 SVG-overlay decision, not a separate
 * mechanism bolted on afterward.
 *
 * What DOES need active handling: the document's total size can change
 * after initial mount — lazy-loaded content, infinite scroll, a host-page
 * script resizing something. The overlay's width/height must track that or
 * newly-added-below content has no overlay to draw on.
 *
 * IMPORTANT — verification limits: jsdom has no layout engine, so none of
 * this can be verified against real scroll/resize/zoom behavior in this
 * repo's test suite. What IS tested: the dimension-computation math, and
 * that the observer wiring actually invokes its callback on the events it
 * should. Real scroll/zoom behavior needs manual QA in an actual browser
 * before this ticket is considered fully verified — see
 * docs/spikes/QC-23-overlay-sizing.md.
 */

/** Compute the full scrollable document size (what the overlay must cover). */
function computeOverlayDimensions(doc) {
  const root = doc.documentElement;
  const body = doc.body;
  return {
    width: Math.max(root.scrollWidth, body ? body.scrollWidth : 0),
    height: Math.max(root.scrollHeight, body ? body.scrollHeight : 0),
  };
}

/**
 * Watch for document size changes and invoke `callback(dimensions)` whenever
 * they change. Combines a window resize listener (viewport changes, which
 * can trigger reflow) with a MutationObserver on <body> (content added,
 * which can grow the document without any resize event firing at all).
 *
 * Real-browser note: ResizeObserver on document.documentElement is the more
 * robust primary mechanism in production (catches size changes MutationObserver
 * would miss, e.g. a CSS-only height change with no DOM mutation) — add it
 * as an additional listener when wiring this into the real content script;
 * jsdom doesn't implement ResizeObserver so it can't be exercised in tests here.
 *
 * Returns a disposer function that removes all listeners.
 */
function observeDocumentSize(doc, win, callback) {
  let lastDimensions = computeOverlayDimensions(doc);
  callback(lastDimensions); // initial call

  function checkAndNotify() {
    const next = computeOverlayDimensions(doc);
    if (next.width !== lastDimensions.width || next.height !== lastDimensions.height) {
      lastDimensions = next;
      callback(next);
    }
  }

  win.addEventListener('resize', checkAndNotify);

  const observer = new win.MutationObserver(checkAndNotify);
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true });

  return function dispose() {
    win.removeEventListener('resize', checkAndNotify);
    observer.disconnect();
  };
}

module.exports = { computeOverlayDimensions, observeDocumentSize };
