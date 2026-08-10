# QC-23 — Overlay sizing and positioning on scroll/resize

**Status: logic done and tested; real-browser verification still needed.**

## Approach

The SVG overlay is absolutely positioned to cover the **full document**, not just the
viewport, with every annotation drawn in document coordinates. This is a direct consequence
of the QC-4 decision (SVG overlay, DOM-integrated) rather than a separate mechanism: because
the overlay is a normal part of document flow, the browser scrolls and zooms it exactly like
any other page content, with zero manual transform math.

What still needs active code: the document's total size can grow after initial mount (lazy
load, infinite scroll, a host script resizing something), so the overlay's own width/height
must track that or newly-added-below content has no overlay to draw on.

## What's implemented and tested

- `computeOverlayDimensions(doc)` — takes the max of `documentElement`/`body` scroll
  dimensions, handles a missing `body` gracefully
- `observeDocumentSize(doc, win, callback)` — combines a `resize` listener with a
  `MutationObserver` on `<body>`, only re-notifies on an actual dimension change, cleans up
  correctly on dispose

Tests: `extension/test/overlayAndSidebar.test.js` — 9 assertions passing.

## Important limitation: this is NOT verified against real browser layout

jsdom has no layout engine — `scrollWidth`/`scrollHeight` on real jsdom elements are always
`0`, regardless of content. So the tests above use **mock `document`/`window` objects** with
settable dimensions, which correctly exercises this module's own diffing/notification logic,
but proves nothing about:

- Whether scroll actually looks correct in a real browser (should be automatic per the
  document-coordinate approach, but "should be" isn't "verified")
- Whether browser zoom scales the overlay correctly alongside page content
- Whether `ResizeObserver` (not available in jsdom, recommended as the primary production
  mechanism alongside the `resize`/`MutationObserver` combo already implemented) actually
  catches CSS-only size changes that don't fire a DOM mutation

**Before Phase 1 exit, this needs a manual QA pass in actual Firefox**: load the extension on
a long page, scroll, resize the window, zoom in/out, and load a page with lazy-loaded content
to confirm the overlay actually grows to cover it.

## Recommendation for the real content-script wiring

Add `ResizeObserver` on `document.documentElement` as an additional signal alongside the
`resize` listener and `MutationObserver` already implemented here — it catches size changes
neither of those will (e.g. a stylesheet-only height change with no matching DOM mutation and
no viewport resize).
