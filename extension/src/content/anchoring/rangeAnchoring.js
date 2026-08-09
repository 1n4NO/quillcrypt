'use strict';
const { anchorFromOffsets, locate, fullText } = require('./anchoring');

/**
 * Bridges the offset-based anchoring engine (anchoring.js, from the QC-1
 * spike) to the DOM Selection/Range API that a real content script actually
 * gets when a user drags to select text.
 */

/** Walk text nodes the same way anchoring.js does, to map a DOM position -> absolute offset. */
function domPositionToOffset(root, node, localOffset) {
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* SHOW_TEXT */);
  let offset = 0;
  let current;
  // eslint-disable-next-line no-cond-assign
  while ((current = walker.nextNode())) {
    if (current === node) {
      return offset + localOffset;
    }
    offset += current.textContent.length;
  }
  throw new Error('Node not found within root — range spans outside the anchoring root');
}

/** Build an anchor directly from a live DOM Range (what the user actually selected). */
function anchorFromRange(root, range) {
  const start = domPositionToOffset(root, range.startContainer, range.startOffset);
  const end = domPositionToOffset(root, range.endContainer, range.endOffset);
  return anchorFromOffsets(root, start, end);
}

/**
 * Locate an anchor and return a real, renderable Range — or null if the
 * anchor could not be relocated (see docs/spikes/QC-1-anchoring.md for
 * documented failure modes).
 */
function locateAsRange(root, anchor) {
  const result = locate(root, anchor);
  if (!result) return null;

  const range = root.ownerDocument.createRange();
  range.setStart(result.startPos.node, result.startPos.localOffset);
  range.setEnd(result.endPos.node, result.endPos.localOffset);
  return range;
}

module.exports = { anchorFromRange, locateAsRange, fullText };
