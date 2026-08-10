'use strict';

/**
 * Rectangle and ellipse shape tools. A user can drag in any of the four
 * diagonal directions (down-right, up-left, etc) — geometry must normalize
 * to consistent, always-positive SVG attributes regardless of drag
 * direction, since SVG <rect> doesn't accept negative width/height.
 */

/** Normalize a drag from (x1,y1) to (x2,y2) into SVG <rect> attributes. */
function rectGeometry(x1, y1, x2, y2) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/** Normalize a drag from (x1,y1) to (x2,y2) into SVG <ellipse> attributes. */
function ellipseGeometry(x1, y1, x2, y2) {
  const rect = rectGeometry(x1, y1, x2, y2);
  return {
    cx: rect.x + rect.width / 2,
    cy: rect.y + rect.height / 2,
    rx: rect.width / 2,
    ry: rect.height / 2,
  };
}

module.exports = { rectGeometry, ellipseGeometry };
