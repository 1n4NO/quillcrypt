'use strict';
const { locateAsRange } = require('../content/anchoring/rangeAnchoring');
const { applyHighlight, removeHighlight } = require('../tools/highlight');
const { applyUnderline, removeUnderline } = require('../tools/underline');
const { pointsToSvgPath } = require('../tools/draw');
const { computeArrowGeometry } = require('../tools/arrow');

const SVG_NS = 'http://www.w3.org/2000/svg';

const TOOLTIP_LABELS = {
  draw: 'Draw annotation',
  arrow: 'Arrow annotation',
  rect: 'Rectangle annotation',
  ellipse: 'Ellipse annotation',
};

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
    const wrappers = annotation.type === 'highlight'
      ? applyHighlight(root, range, annotation.id, color)
      : applyUnderline(root, range, annotation.id, color);
    wrappers.forEach((wrapper) => {
      wrapper.dataset.quillcryptTooltip = annotation.anchor?.exact || 'Text annotation';
    });
    return true;
  }

  if (annotation.type === 'note') {
    let x = 100;
    let y = 100;
    const scrollX = doc.defaultView?.scrollX || 0;
    const scrollY = doc.defaultView?.scrollY || 0;
    if (annotation.anchor) {
      const range = locateAsRange(root, annotation.anchor);
      if (!range) return false;
      const rect = range.getBoundingClientRect ? range.getBoundingClientRect() : null;
      if (rect) {
        x = rect.right + scrollX + 12;
        y = rect.top + scrollY;
      }
    } else if (annotation.geometry) {
      x = annotation.geometry.x;
      y = annotation.geometry.y;
    }
    const bubble = doc.createElement('div');
    bubble.className = 'qc-note-bubble';
    bubble.dataset.annotationId = annotation.id;
    bubble.dataset.quillcryptTooltip = annotation.content || 'Note annotation';
    bubble.style.position = 'absolute';
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
    bubble.style.width = '240px';
    const title = annotation.title ? doc.createElement('strong') : null;
    if (title) { title.className = 'qc-note-title'; title.textContent = annotation.title; }
    const text = doc.createElement('div');
    text.className = 'qc-note-content';
    text.textContent = annotation.content || '';
    bubble.replaceChildren(...(title ? [title, text] : [text]));
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
    path.dataset.quillcryptTooltip = TOOLTIP_LABELS.draw;
    overlaySvg.appendChild(path);
    return true;
  }

  if (annotation.type === 'arrow') {
    const g = annotation.geometry;
    const { linePath, headPath } = computeArrowGeometry(g.x1, g.y1, g.x2, g.y2);
    const group = doc.createElementNS(SVG_NS, 'g');
    group.dataset.annotationId = annotation.id;
    group.dataset.quillcryptTooltip = TOOLTIP_LABELS.arrow;
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
    el.dataset.quillcryptTooltip = TOOLTIP_LABELS[annotation.type];
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
