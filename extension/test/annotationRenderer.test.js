'use strict';
const { JSDOM } = require('jsdom');
const { anchorFromOffsets } = require('../src/content/anchoring/anchoring');
const { renderAnnotation, removeAnnotationElement } = require('../src/content/annotationRenderer');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const dom = new JSDOM('<body><article><p id="p">The quick brown fox jumps over the lazy dog</p></article></body>');
const document = dom.window.document;
const root = document.querySelector('article');
const overlaySvg = document.createElementNS(SVG_NS, 'svg');
const noteLayer = document.createElement('div');
document.body.appendChild(overlaySvg);
document.body.appendChild(noteLayer);

const text = root.querySelector('#p').firstChild.textContent;
const anchor = anchorFromOffsets(root, text.indexOf('quick brown'), text.indexOf('quick brown') + 'quick brown'.length);

const highlightAnn = { id: 'ann-h', type: 'highlight', anchor, style: { color: '#F5C542' } };
check('highlight renders successfully', renderAnnotation(root, overlaySvg, noteLayer, highlightAnn) === true);
check('highlight produces a <mark> element with the right text', root.querySelector('mark.qc-highlight').textContent === 'quick brown');

const dom2 = new JSDOM('<body><article><p id="p">Another sentence for testing purposes</p></article></body>');
const root2 = dom2.window.document.querySelector('article');
const text2 = root2.querySelector('#p').firstChild.textContent;
const anchor2 = anchorFromOffsets(root2, text2.indexOf('sentence'), text2.indexOf('sentence') + 'sentence'.length);
const underlineAnn = { id: 'ann-u', type: 'underline', anchor: anchor2, style: {} };
check('underline renders successfully', renderAnnotation(root2, overlaySvg, noteLayer, underlineAnn) === true);
check('underline produces the expected span', root2.querySelector('span.qc-underline').textContent === 'sentence');

const noteAnn = { id: 'ann-n', type: 'note', anchor: null, content: 'a helpful comment' };
check('note renders successfully', renderAnnotation(root, overlaySvg, noteLayer, noteAnn) === true);
const bubble = noteLayer.querySelector('[data-annotation-id="ann-n"]');
check('note bubble contains the correct content', bubble.textContent === 'a helpful comment');

const drawAnn = { id: 'ann-d', type: 'draw', geometry: { points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }, style: { color: '#000000' } };
check('draw renders successfully', renderAnnotation(root, overlaySvg, noteLayer, drawAnn) === true);
const drawPath = overlaySvg.querySelector('path[data-annotation-id="ann-d"]');
check('draw produces a path with the correct d attribute', drawPath.getAttribute('d') === 'M 0 0 L 10 10');

const arrowAnn = { id: 'ann-a', type: 'arrow', geometry: { x1: 0, y1: 0, x2: 100, y2: 0 }, style: {} };
check('arrow renders successfully', renderAnnotation(root, overlaySvg, noteLayer, arrowAnn) === true);
check('arrow produces a group containing two paths (shaft + head)', overlaySvg.querySelector('g[data-annotation-id="ann-a"]').children.length === 2);

const rectAnn = { id: 'ann-r', type: 'rect', geometry: { x: 5, y: 5, width: 50, height: 30 }, style: {} };
check('rect renders successfully', renderAnnotation(root, overlaySvg, noteLayer, rectAnn) === true);
const rectEl = overlaySvg.querySelector('rect[data-annotation-id="ann-r"]');
check('rect has correct geometry attributes', rectEl.getAttribute('width') === '50' && rectEl.getAttribute('height') === '30');

const ellipseAnn = { id: 'ann-e', type: 'ellipse', geometry: { cx: 50, cy: 50, rx: 20, ry: 10 }, style: {} };
check('ellipse renders successfully', renderAnnotation(root, overlaySvg, noteLayer, ellipseAnn) === true);
check('ellipse element exists with correct id', overlaySvg.querySelector('ellipse[data-annotation-id="ann-e"]') !== null);

const brokenAnchor = { exact: 'text that does not exist on this page', prefix: '', suffix: '', position: { start: 0, end: 5 } };
const brokenAnn = { id: 'ann-broken', type: 'highlight', anchor: brokenAnchor, style: {} };
check('rendering an unlocatable anchor returns false rather than throwing', renderAnnotation(root, overlaySvg, noteLayer, brokenAnn) === false);

removeAnnotationElement(root, overlaySvg, noteLayer, highlightAnn);
check('removing a highlight annotation removes its mark element', root.querySelector('mark.qc-highlight') === null);

removeAnnotationElement(root, overlaySvg, noteLayer, drawAnn);
check('removing a shape annotation removes its SVG element', overlaySvg.querySelector('[data-annotation-id="ann-d"]') === null);

removeAnnotationElement(root, overlaySvg, noteLayer, noteAnn);
check('removing a note annotation removes its bubble', noteLayer.querySelector('[data-annotation-id="ann-n"]') === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
