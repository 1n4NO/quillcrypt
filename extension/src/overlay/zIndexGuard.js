'use strict';

/**
 * Z-index conflict handling (QC-24).
 *
 * The overlay uses the CSS spec maximum z-index (2^31 - 1). That alone
 * doesn't fully guarantee it's on top: a host page could theoretically use
 * the exact same maximum value (some "always on top" libraries do this
 * deliberately), and when z-index ties, paint/DOM order decides — the LATER
 * element in the DOM wins. So the real defense against ties is keeping the
 * overlay as the last child of <body> at all times, including re-asserting
 * that whenever the host page appends new elements later (some sites mount
 * modals/toasts dynamically, well after initial page load).
 *
 * `findMaxZIndexInUse` only inspects inline/computed z-index at call time —
 * it's informational (useful for debugging/logging what the page is doing),
 * not the actual defense mechanism, since z-index can also come from
 * stylesheets that apply conditionally (media queries, :hover, etc) which
 * can't be fully enumerated statically anyway.
 */

const OVERLAY_Z_INDEX = 2147483647; // CSS spec max (2^31 - 1)

function findMaxZIndexInUse(doc, win) {
  let max = 0;
  const all = doc.querySelectorAll('*');
  for (const el of all) {
    const z = win.getComputedStyle(el).zIndex;
    if (z && z !== 'auto') {
      const n = parseInt(z, 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return max;
}

/** Move the overlay to be the last child of <body>, if it isn't already. */
function ensureOverlayIsLastChild(doc, overlayEl) {
  if (doc.body.lastElementChild !== overlayEl) {
    doc.body.appendChild(overlayEl); // appendChild on an existing node moves it
  }
}

/**
 * Keep re-asserting overlay-is-last-child whenever the host page appends new
 * elements to <body>. Self-terminating: the re-append itself queues another
 * mutation record, but the next check sees the overlay is already last and
 * no-ops, so it settles after one extra (harmless) pass.
 */
function watchForNewSiblings(doc, overlayEl) {
  const observer = new doc.defaultView.MutationObserver((mutations) => {
    const sawAddedNodes = mutations.some((m) => m.addedNodes.length > 0);
    if (sawAddedNodes) ensureOverlayIsLastChild(doc, overlayEl);
  });
  observer.observe(doc.body, { childList: true });
  return () => observer.disconnect();
}

module.exports = { OVERLAY_Z_INDEX, findMaxZIndexInUse, ensureOverlayIsLastChild, watchForNewSiblings };
