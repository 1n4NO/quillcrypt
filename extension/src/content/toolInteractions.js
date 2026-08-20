'use strict';
const { anchorFromRange } = require('../content/anchoring/rangeAnchoring');
const { createAnnotation } = require('../models/annotation');
const { simplifyPoints } = require('../tools/draw');
const { rectGeometry, ellipseGeometry } = require('../tools/shapes');
const { renderAnnotation } = require('./annotationRenderer');
const { hasExistingInlineDecoration } = require('../tools/inlineDecoration');

const DRAG_TOOLS = ['draw', 'arrow', 'rect', 'ellipse'];
const SELECTION_TOOLS = ['highlight', 'underline', 'note'];

/**
 * Wires user input to annotation creation. Returns a dispose function.
 *
 * `getSelection` and `promptForNoteContent` are injectable specifically so
 * this is unit-testable without a real browser Selection API or a real
 * window.prompt dialog — both are just function calls from this module's
 * point of view, same injectable-dependency pattern used for WebSocketImpl
 * throughout the sync layer.
 */
function attachToolInteractions({
  doc,
  win = doc.defaultView,
  root,
  overlaySvg,
  noteLayer,
  toolbarState,
  store,
  url,
  onAnnotationCreated,
  render = true,
  getSelection = () => doc.defaultView.getSelection(),
  promptForNoteContent = () => doc.defaultView.prompt('Note text:') || '',
}) {
  let dragStart = null;
  let dragPoints = null;

  function documentPoint(event) {
    return {
      x: event.clientX + (win?.scrollX || 0),
      y: event.clientY + (win?.scrollY || 0),
    };
  }

  async function persistAndRender(record) {
    await store.addAnnotation(url, record);
    if (render) renderAnnotation(root, overlaySvg, noteLayer, record);
    onAnnotationCreated?.(record);
  }

  async function handleMouseUp() {
    const tool = toolbarState.getState().activeTool;
    if (!SELECTION_TOOLS.includes(tool)) return;

    const selection = getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    if (!root.contains(range.commonAncestorContainer)) return;
    if (tool === 'highlight' && hasExistingInlineDecoration(root, range, '.qc-highlight')) {
      selection.removeAllRanges();
      return;
    }
    let anchor;
    try {
      anchor = anchorFromRange(root, range);
    } catch {
      // Pages can replace their DOM between selection and mouseup. Treat that
      // transient range as unanchorable instead of leaking an unhandled error.
      selection.removeAllRanges();
      return;
    }
    const content = tool === 'note' ? promptForNoteContent() : null;
    const record = createAnnotation({ type: tool, anchor, content, style: { color: toolbarState.getState().color } });

    selection.removeAllRanges();
    await persistAndRender(record);
  }

  function handleMouseDown(event) {
    const tool = toolbarState.getState().activeTool;
    if (!DRAG_TOOLS.includes(tool)) return;
    dragStart = documentPoint(event);
    dragPoints = [dragStart];
  }

  function handleMouseMove(event) {
    if (!dragStart) return;
    const tool = toolbarState.getState().activeTool;
    if (tool === 'draw') {
      dragPoints.push(documentPoint(event));
    }
  }

  async function handleMouseUpDrag(event) {
    if (!dragStart) return;
    const tool = toolbarState.getState().activeTool;
    const end = documentPoint(event);
    const style = { color: toolbarState.getState().color, strokeWidth: toolbarState.getState().strokeWidth };

    let geometry = null;
    if (tool === 'draw') {
      geometry = { points: simplifyPoints(dragPoints, 2) };
    } else if (tool === 'arrow') {
      geometry = { x1: dragStart.x, y1: dragStart.y, x2: end.x, y2: end.y };
    } else if (tool === 'rect') {
      geometry = rectGeometry(dragStart.x, dragStart.y, end.x, end.y);
    } else if (tool === 'ellipse') {
      geometry = ellipseGeometry(dragStart.x, dragStart.y, end.x, end.y);
    }

    dragStart = null;
    dragPoints = null;

    if (!geometry) return; // not a drag tool
    const record = createAnnotation({ type: tool, geometry, style });
    await persistAndRender(record);
  }

  // mouseup does double duty: finishes a text selection OR a shape drag,
  // depending on which tool is active — never both at once, since
  // SELECTION_TOOLS and DRAG_TOOLS are disjoint sets.
  function onMouseUp(event) {
    void handleMouseUp().catch(() => {});
    void handleMouseUpDrag(event).catch(() => {});
  }

  // Capture phase is important on modern app pages: canvas/layout handlers
  // often stop bubbling mouse events before they reach document listeners.
  doc.addEventListener('mouseup', onMouseUp, true);
  doc.addEventListener('mousedown', handleMouseDown, true);
  doc.addEventListener('mousemove', handleMouseMove, true);

  return function dispose() {
    doc.removeEventListener('mouseup', onMouseUp, true);
    doc.removeEventListener('mousedown', handleMouseDown, true);
    doc.removeEventListener('mousemove', handleMouseMove, true);
  };
}

module.exports = { attachToolInteractions };
