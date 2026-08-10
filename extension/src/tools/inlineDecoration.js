'use strict';

/**
 * Shared engine for "decorate this text selection" tools — highlight (QC-14)
 * and underline (QC-15) both reduce to the same operation: wrap every text
 * node inside a Range in a styled inline element, tagged with the
 * annotation's id so it can be found again later (removal, hover, etc).
 *
 * Ranges can span multiple elements and partial text nodes, so boundary
 * nodes get split first so every node touched by the wrap step is either
 * fully inside or fully outside the range — never partially.
 */

function splitRangeBoundaries(range) {
  // Split the end first: splitting doesn't disturb offsets before the split
  // point, so doing end-then-start keeps both boundaries valid throughout.
  // (Ranges auto-adjust their own boundary points on splitText per the DOM
  // spec, which is what makes the same-node case below work correctly.)
  if (range.endContainer.nodeType === 3 && range.endOffset > 0 && range.endOffset < range.endContainer.length) {
    range.endContainer.splitText(range.endOffset);
  }
  if (range.startContainer.nodeType === 3 && range.startOffset > 0 && range.startOffset < range.startContainer.length) {
    const newNode = range.startContainer.splitText(range.startOffset);
    range.setStart(newNode, 0);
  }
}

/** Collect every text node fully contained within the (boundary-split) range. */
function collectFullyContainedTextNodes(root, range) {
  const container = range.commonAncestorContainer;

  // Selection fully inside a single text node: that node IS the container,
  // and TreeWalker never visits its own root, so handle this case directly.
  if (container.nodeType === 3) {
    return [container];
  }

  const walker = root.ownerDocument.createTreeWalker(container, 4 /* SHOW_TEXT */);
  const nodes = [];
  let node;
  // eslint-disable-next-line no-cond-assign
  while ((node = walker.nextNode())) {
    if (node.length === 0) continue;
    const startsAtOrAfter = range.comparePoint(node, 0) >= 0;
    const endsAtOrBefore = range.comparePoint(node, node.length) <= 0;
    if (startsAtOrAfter && endsAtOrBefore) {
      nodes.push(node);
    }
  }
  return nodes;
}

/**
 * Wrap every text node in `range` with a decoration element.
 * `decoration` = { tag, className, style } — style is an inline CSS string.
 * Returns the list of wrapper elements created (so callers can track/undo).
 */
function applyInlineDecoration(root, range, decoration, annotationId) {
  splitRangeBoundaries(range);
  const textNodes = collectFullyContainedTextNodes(root, range);
  const doc = root.ownerDocument;

  const wrappers = textNodes.map((textNode) => {
    const wrapper = doc.createElement(decoration.tag || 'span');
    if (decoration.className) wrapper.className = decoration.className;
    if (decoration.style) wrapper.setAttribute('style', decoration.style);
    wrapper.setAttribute('data-quillcrypt-annotation-id', annotationId);
    textNode.parentNode.insertBefore(wrapper, textNode);
    wrapper.appendChild(textNode);
    return wrapper;
  });

  return wrappers;
}

/** Remove all decoration wrappers for a given annotation id, restoring plain text. */
function removeInlineDecoration(root, annotationId) {
  const selector = `[data-quillcrypt-annotation-id="${annotationId}"]`;
  const wrappers = root.querySelectorAll(selector);
  wrappers.forEach((wrapper) => {
    const parent = wrapper.parentNode;
    while (wrapper.firstChild) {
      parent.insertBefore(wrapper.firstChild, wrapper);
    }
    parent.removeChild(wrapper);
    parent.normalize(); // merge adjacent text nodes back together
  });
}

module.exports = { applyInlineDecoration, removeInlineDecoration, splitRangeBoundaries, collectFullyContainedTextNodes };
