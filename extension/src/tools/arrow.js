'use strict';

/**
 * Arrow tool: a straight line plus a triangular arrowhead at the end point,
 * oriented along the line's direction. Returns SVG path data for both the
 * shaft and the head as separate paths (head filled, shaft stroked) per the
 * QC-4 SVG-overlay decision.
 */
function computeArrowGeometry(x1, y1, x2, y2, headLength = 12, headAngleDeg = 25) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headAngleRad = (headAngleDeg * Math.PI) / 180;

  const leftX = x2 - headLength * Math.cos(angle - headAngleRad);
  const leftY = y2 - headLength * Math.sin(angle - headAngleRad);
  const rightX = x2 - headLength * Math.cos(angle + headAngleRad);
  const rightY = y2 - headLength * Math.sin(angle + headAngleRad);

  return {
    linePath: `M ${x1} ${y1} L ${x2} ${y2}`,
    headPath: `M ${x2} ${y2} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`,
    headPoints: {
      tip: { x: x2, y: y2 },
      left: { x: leftX, y: leftY },
      right: { x: rightX, y: rightY },
    },
  };
}

module.exports = { computeArrowGeometry };
