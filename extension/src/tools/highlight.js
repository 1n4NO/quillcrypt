'use strict';
const { applyInlineDecoration, removeInlineDecoration, hasExistingInlineDecoration } = require('./inlineDecoration');

/** QC-14: highlight tool — colored background behind selected text. */
function applyHighlight(root, range, annotationId, color = '#F5C542') {
  if (hasExistingInlineDecoration(root, range, '.qc-highlight')) return [];
  return applyInlineDecoration(
    root,
    range,
    { tag: 'mark', className: 'qc-highlight', style: `background-color: ${color}66;` }, // 66 = ~40% alpha
    annotationId
  );
}

function removeHighlight(root, annotationId) {
  removeInlineDecoration(root, annotationId);
}

module.exports = { applyHighlight, removeHighlight };
