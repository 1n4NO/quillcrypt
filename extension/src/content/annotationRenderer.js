'use strict';
const { locateAsRange } = require('../content/anchoring/rangeAnchoring');
const { applyHighlight, removeHighlight } = require('../tools/highlight');
const { applyUnderline, removeUnderline } = require('../tools/underline');
const { pointsToSvgPath } = require('../tools/draw');
const { computeArrowGeometry } = require('../tools/arrow');
const { computeNotePosition } = require('../tools/note');

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Renders one annotation record into the page. `root` is the anchoring
 * root (document.body or similar); `overlaySvg` is the QC-4 SVG overlay
 * element shape-type annotations render into; `noteLayer` is a plain DOM
 * container note bubbles render into (kept separate from the SVG overlay
 * since notes are HTML, not SVG).
 *
 * Returns true if rendering succeeded, false if the annotation's anchor
 * could not be relocated (see QC-1 findings for why that can happen) —
 * callers should surface false results to the user rather than silently
 * dropping the annotation.
 */
function renderAnnotation(root, overlaySvg, noteLayer, annotation) {
  const doc = root.ownerDocument;
  const color = annotation.style?.color || '#F5C542';

  if (annotation.type === 'highlight' || annotation.type === 'underline') {
    const range = locateAsRange(root, annotation.anchor);
    if (!range) return false;
    if (annotation.type === 'highlight') applyHighlight(root, range, annotation.id, color);
    else applyUnderline(root, range, annotation.id, color);
    return true;
  }

  if (annotation.type === 'note') {
    let anchorRect = { top: 100, left: 100, right: 100, bottom: 100 }; // fallback if unanchored
    if (annotation.anchor) {
      const range = locateAsRange(root, annotation.anchor);
      if (!range) return false;
      anchorRect = range.getBoundingClientRect ? range.getBoundingClientRect() : anchorRect;
    }
    const viewport = { width: doc.defaultView?.innerWidth || 1200, height: doc.defaultView?.innerHeight || 800 };
    const pos = computeNotePosition(anchorRect, viewport);
    const bubble = doc.createElement('div');
    bubble.className = 'qc-note-bubble';
    bubble.dataset.annotationId = annotation.id;
    bubble.style.position = 'fixed';
    bubble.style.left = `${pos.x}px`;
    bubble.style.top = `${pos.y}px`;
    bubble.style.width = `${pos.width}px`;
    bubble.textContent = annotation.content || '';
    noteLayer.appendChild(bubble);
    return true;
  }

  if (annotation.type === 'draw') {
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pointsToSvgPath(annotation.geometry.points));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', String(annotation.style?.strokeWidth || 2));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.dataset.annotationId = annotation.id;
    overlaySvg.appendChild(path);
    return true;
  }

  if (annotation.type === 'arrow') {
    const g = annotation.geometry;
    const { linePath, headPath } = computeArrowGeometry(g.x1, g.y1, g.x2, g.y2);
    const group = doc.createElementNS(SVG_NS, 'g');
    group.dataset.annotationId = annotation.id;
    const line = doc.createElementNS(SVG_NS, 'path');
    line.setAttribute('d', linePath);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', String(annotation.style?.strokeWidth || 2));
    line.setAttribute('fill', 'none');
    const head = doc.createElementNS(SVG_NS, 'path');
    head.setAttribute('d', headPath);
    head.setAttribute('fill', color);
    group.appendChild(line);
    group.appendChild(head);
    overlaySvg.appendChild(group);
    return true;
  }

  if (annotation.type === 'rect' || annotation.type === 'ellipse') {
    const el = doc.createElementNS(SVG_NS, annotation.type);
    const g = annotation.geometry;
    if (annotation.type === 'rect') {
      el.setAttribute('x', g.x); el.setAttribute('y', g.y);
      el.setAttribute('width', g.width); el.setAttribute('height', g.height);
    } else {
      el.setAttribute('cx', g.cx); el.setAttribute('cy', g.cy);
      el.setAttribute('rx', g.rx); el.setAttribute('ry', g.ry);
    }
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', color);
    el.setAttribute('stroke-width', String(annotation.style?.strokeWidth || 2));
    el.dataset.annotationId = annotation.id;
    overlaySvg.appendChild(el);
    return true;
  }

  return false; // unknown type
}

function removeAnnotationElement(root, overlaySvg, noteLayer, annotation) {
  if (annotation.type === 'highlight') removeHighlight(root, annotation.id);
  else if (annotation.type === 'underline') removeUnderline(root, annotation.id);
  else {
    const selector = `[data-annotation-id="${annotation.id}"]`;
    overlaySvg.querySelector(selector)?.remove();
    noteLayer.querySelector(selector)?.remove();
  }
}

module.exports = { renderAnnotation, removeAnnotationElement };
