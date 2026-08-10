'use strict';
const { applyInlineDecoration, removeInlineDecoration } = require('./inlineDecoration');

/** QC-15: underline tool — colored underline beneath selected text. */
function applyUnderline(root, range, annotationId, color = '#E85D5D') {
  return applyInlineDecoration(
    root,
    range,
    {
      tag: 'span',
      className: 'qc-underline',
      style: `border-bottom: 2px solid ${color}; text-decoration: none;`,
    },
    annotationId
  );
}

function removeUnderline(root, annotationId) {
  removeInlineDecoration(root, annotationId);
}

module.exports = { applyUnderline, removeUnderline };
