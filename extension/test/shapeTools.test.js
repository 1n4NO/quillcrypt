'use strict';
const { simplifyPoints, pointsToSvgPath } = require('../src/tools/draw');
const { computeArrowGeometry } = require('../src/tools/arrow');
const { rectGeometry, ellipseGeometry } = require('../src/tools/shapes');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

// ================= QC-16: freehand draw =================
check('empty points produce an empty path', pointsToSvgPath([]) === '');
check('single point produces an empty path (need at least 2 to draw a line)', pointsToSvgPath([{ x: 1, y: 1 }]) === '');
check(
  'three points produce the correct M/L path string',
  pointsToSvgPath([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 5 }]) === 'M 0 0 L 10 10 L 20 5'
);

const straightLine = [];
for (let x = 0; x <= 100; x += 5) straightLine.push({ x, y: x });
const simplifiedStraight = simplifyPoints(straightLine, 1);
check('a straight line simplifies down to its two endpoints', simplifiedStraight.length === 2);
check('simplification preserves the first point', simplifiedStraight[0].x === 0 && simplifiedStraight[0].y === 0);
check('simplification preserves the last point', simplifiedStraight[simplifiedStraight.length - 1].x === 100);

const rightAngle = [];
for (let x = 0; x <= 50; x += 5) rightAngle.push({ x, y: 0 });
for (let y = 5; y <= 50; y += 5) rightAngle.push({ x: 50, y });
const simplifiedCorner = simplifyPoints(rightAngle, 1);
check('a right-angle corner retains at least 3 points (start, corner, end)', simplifiedCorner.length >= 3);
check('the actual corner point (50,0) survives simplification', simplifiedCorner.some((p) => p.x === 50 && p.y === 0));

const wiggle = [];
for (let x = 0; x <= 100; x += 2) wiggle.push({ x, y: Math.sin(x / 5) * 20 });
const simplifiedWiggle = simplifyPoints(wiggle, 1);
check('point count is meaningfully reduced for a smooth curve', simplifiedWiggle.length < wiggle.length);
check('but not collapsed to just 2 points, since the curve has real shape', simplifiedWiggle.length > 2);

// ================= QC-17: arrow =================
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

const horiz = computeArrowGeometry(0, 0, 100, 0, 12, 25);
check('shaft line path is correct', horiz.linePath === 'M 0 0 L 100 0');
check('head tip is exactly at the arrow endpoint', horiz.headPoints.tip.x === 100 && horiz.headPoints.tip.y === 0);
check(
  'both head wing points are approximately headLength away from the tip',
  Math.abs(dist(horiz.headPoints.tip, horiz.headPoints.left) - 12) < 0.001 &&
  Math.abs(dist(horiz.headPoints.tip, horiz.headPoints.right) - 12) < 0.001
);
check('both head wing points sit behind the tip for a rightward arrow (smaller x)', horiz.headPoints.left.x < 100 && horiz.headPoints.right.x < 100);
check(
  'head wings are symmetric above/below the shaft for a horizontal arrow',
  Math.abs(horiz.headPoints.left.y + horiz.headPoints.right.y) < 0.001
);

const vert = computeArrowGeometry(0, 0, 0, 100, 12, 25);
check('head wings sit above the tip for a downward arrow (smaller y)', vert.headPoints.left.y < 100 && vert.headPoints.right.y < 100);
check(
  'head wings are symmetric left/right of the shaft for a vertical arrow',
  Math.abs(vert.headPoints.left.x + vert.headPoints.right.x) < 0.001
);

const diag = computeArrowGeometry(10, 10, 80, 60, 15, 30);
check(
  'wing distances from tip equal headLength for a diagonal arrow too',
  Math.abs(dist(diag.headPoints.tip, diag.headPoints.left) - 15) < 0.001 &&
  Math.abs(dist(diag.headPoints.tip, diag.headPoints.right) - 15) < 0.001
);

// ================= QC-18: rect / ellipse =================
const dragDownRight = rectGeometry(10, 10, 60, 40);
const dragUpLeft = rectGeometry(60, 40, 10, 10);
const dragDownLeft = rectGeometry(60, 10, 10, 40);
const dragUpRight = rectGeometry(10, 40, 60, 10);

for (const [label, geom] of [
  ['down-right', dragDownRight], ['up-left', dragUpLeft],
  ['down-left', dragDownLeft], ['up-right', dragUpRight],
]) {
  check(
    `rect geometry is identical regardless of drag direction (${label})`,
    geom.x === 10 && geom.y === 10 && geom.width === 50 && geom.height === 30
  );
}
check('rect width/height are never negative even for a zero-size drag', rectGeometry(20, 20, 20, 20).width === 0);

const ellipse = ellipseGeometry(10, 10, 60, 40);
check('ellipse center x is the midpoint', ellipse.cx === 35);
check('ellipse center y is the midpoint', ellipse.cy === 25);
check('ellipse rx is half the width', ellipse.rx === 25);
check('ellipse ry is half the height', ellipse.ry === 15);

const ellipseReversed = ellipseGeometry(60, 40, 10, 10);
check(
  'ellipse geometry is also direction-independent',
  ellipseReversed.cx === ellipse.cx && ellipseReversed.cy === ellipse.cy &&
  ellipseReversed.rx === ellipse.rx && ellipseReversed.ry === ellipse.ry
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
