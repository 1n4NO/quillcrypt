'use strict';
const { computeOverlayDimensions, observeDocumentSize } = require('../overlay/overlayDimensions');
const { OVERLAY_Z_INDEX, ensureOverlayIsLastChild, watchForNewSiblings } = require('../overlay/zIndexGuard');

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Creates and mounts the SVG overlay root, sized to cover the full
 * document (QC-4/QC-23 approach) and defended against z-index/DOM-order
 * conflicts with the host page (QC-24). Also creates a plain HTML note
 * layer alongside it (notes are HTML bubbles, not SVG — see
 * annotationRenderer.js).
 */
function mountOverlay(doc, win) {
  const overlaySvg = doc.createElementNS(SVG_NS, 'svg');
  overlaySvg.setAttribute('class', 'qc-overlay');
  overlaySvg.style.position = 'absolute';
  overlaySvg.style.top = '0';
  overlaySvg.style.left = '0';
  overlaySvg.style.pointerEvents = 'none'; // clicks pass through except on individual annotation elements
  overlaySvg.style.zIndex = String(OVERLAY_Z_INDEX);

  const noteLayer = doc.createElement('div');
  noteLayer.className = 'qc-note-layer';
  noteLayer.style.position = 'absolute';
  noteLayer.style.top = '0';
  noteLayer.style.left = '0';
  noteLayer.style.zIndex = String(OVERLAY_Z_INDEX);

  doc.body.appendChild(overlaySvg);
  doc.body.appendChild(noteLayer);

  const disposeSizing = observeDocumentSize(doc, win, ({ width, height }) => {
    overlaySvg.setAttribute('width', String(width));
    overlaySvg.setAttribute('height', String(height));
    overlaySvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  });

  ensureOverlayIsLastChild(doc, overlaySvg);
  const disposeZGuard = watchForNewSiblings(doc, overlaySvg);

  return {
    overlaySvg,
    noteLayer,
    dispose() {
      disposeSizing();
      disposeZGuard();
      overlaySvg.remove();
      noteLayer.remove();
    },
  };
}

module.exports = { mountOverlay };
