'use strict';

/**
 * Freehand draw tool. Captures raw pointer-move samples as {x, y} points,
 * simplifies them (fewer points = smaller stored geometry, cheaper CRDT
 * sync payload, cheaper re-render on scroll/resize per QC-23), and converts
 * the result to an SVG path `d` string per the QC-4 SVG-overlay decision.
 */

/** Perpendicular distance from point p to the line through a-b. */
function perpendicularDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared;
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Douglas-Peucker simplification: reduces a polyline to fewer points while
 * staying within `tolerance` pixels of the original shape. Always keeps the
 * first and last point.
 */
function simplifyPoints(points, tolerance = 2) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPoints(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPoints(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

/** Convert a point list to an SVG path `d` attribute (straight-line segments). */
function pointsToSvgPath(points) {
  if (points.length < 2) return '';
  const [start, ...rest] = points;
  const moveTo = `M ${start.x} ${start.y}`;
  const lineTos = rest.map((p) => `L ${p.x} ${p.y}`).join(' ');
  return `${moveTo} ${lineTos}`;
}

module.exports = { simplifyPoints, pointsToSvgPath, perpendicularDistance };
