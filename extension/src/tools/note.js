'use strict';

/**
 * Sticky note tool. A note is anchored to a text range (via QC-11) or a
 * point on the page, but the note *bubble* itself is positioned relative to
 * that anchor's on-screen rect — and must never render partially off-screen,
 * regardless of where on the page the anchor happens to be.
 */

const DEFAULT_NOTE_SIZE = { width: 240, height: 120 };
const DEFAULT_OFFSET = { x: 12, y: 0 };

/**
 * @param anchorRect {top, left, right, bottom, width, height} — like getBoundingClientRect()
 * @param viewport {width, height}
 */
function computeNotePosition(anchorRect, viewport, noteSize = DEFAULT_NOTE_SIZE, offset = DEFAULT_OFFSET) {
  let x = anchorRect.right + offset.x;
  let y = anchorRect.top + offset.y;

  if (x + noteSize.width > viewport.width) {
    x = anchorRect.left - noteSize.width - offset.x;
  }

  x = Math.max(0, Math.min(x, viewport.width - noteSize.width));
  y = Math.max(0, Math.min(y, viewport.height - noteSize.height));

  return { x, y, width: noteSize.width, height: noteSize.height };
}

module.exports = { computeNotePosition, DEFAULT_NOTE_SIZE, DEFAULT_OFFSET };
