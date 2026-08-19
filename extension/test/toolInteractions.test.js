'use strict';
const { JSDOM } = require('jsdom');
const { ToolbarState } = require('../src/ui/toolbar');
const { AnnotationStore } = require('../src/storage/store');
const { attachToolInteractions } = require('../src/content/toolInteractions');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

async function main() {
  const dom = new JSDOM('<body><article><p id="p">The quick brown fox jumps over the lazy dog</p><p id="p2">Another separate paragraph for the note test</p></article></body>');
  const document = dom.window.document;
  const root = document.querySelector('article');
  const overlaySvg = document.createElementNS(SVG_NS, 'svg');
  const noteLayer = document.createElement('div');
  document.body.appendChild(overlaySvg);
  document.body.appendChild(noteLayer);

  const toolbarState = new ToolbarState();
  const store = new AnnotationStore();
  const url = 'https://example.com/test';
  const createdAnnotations = [];

  const dispose = attachToolInteractions({
    doc: document, root, overlaySvg, noteLayer, toolbarState, store, url,
    onAnnotationCreated: (record) => createdAnnotations.push(record),
    promptForNoteContent: () => 'a test note',
  });

  toolbarState.setTool('highlight');
  const textNode = root.querySelector('#p').firstChild;
  const range = document.createRange();
  const start = textNode.textContent.indexOf('quick brown');
  range.setStart(textNode, start);
  range.setEnd(textNode, start + 'quick brown'.length);
  const selection = document.defaultView.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  document.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  check('a highlight annotation was created from the text selection', createdAnnotations.length === 1 && createdAnnotations[0].type === 'highlight');
  check('the created highlight has the correct anchored text', createdAnnotations[0].anchor.exact === 'quick brown');
  check('the highlight was actually rendered into the DOM', root.querySelector('mark.qc-highlight') !== null);
  check('the highlight was actually persisted to the store', (await store.getAnnotationsForUrl(url)).length === 1);

  createdAnnotations.length = 0;
  toolbarState.setTool('note');
  const textNode2 = root.querySelector('#p2').firstChild;
  const range2 = document.createRange();
  const start2 = textNode2.textContent.indexOf('separate paragraph');
  range2.setStart(textNode2, start2);
  range2.setEnd(textNode2, start2 + 'separate paragraph'.length);
  selection.removeAllRanges();
  selection.addRange(range2);
  document.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  check('a note annotation was created using the injected prompt content', createdAnnotations.length === 1 && createdAnnotations[0].content === 'a test note');

  createdAnnotations.length = 0;
  toolbarState.setTool('highlight');
  selection.removeAllRanges();
  const collapsedRange = document.createRange();
  collapsedRange.setStart(textNode2, 0);
  collapsedRange.setEnd(textNode2, 0);
  selection.addRange(collapsedRange);
  document.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));
  check('a plain click (collapsed selection) does NOT create an annotation', createdAnnotations.length === 0);

  createdAnnotations.length = 0;
  selection.removeAllRanges();
  toolbarState.setTool('rect');
  document.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
  document.dispatchEvent(new dom.window.MouseEvent('mousemove', { bubbles: true, clientX: 50, clientY: 40 }));
  document.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, clientX: 60, clientY: 40 }));
  await new Promise((r) => setTimeout(r, 20));

  check('a rect annotation was created from the drag', createdAnnotations.length === 1 && createdAnnotations[0].type === 'rect');
  check('the rect geometry is correctly normalized from the drag coordinates', createdAnnotations[0].geometry.x === 10 && createdAnnotations[0].geometry.width === 50);
  check('the rect was rendered into the SVG overlay', overlaySvg.querySelector('rect') !== null);

  createdAnnotations.length = 0;
  toolbarState.setTool('draw');
  document.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
  for (let x = 1; x <= 50; x++) {
    document.dispatchEvent(new dom.window.MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: x }));
  }
  document.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, clientX: 50, clientY: 50 }));
  await new Promise((r) => setTimeout(r, 20));

  check('a draw annotation was created', createdAnnotations.length === 1 && createdAnnotations[0].type === 'draw');
  check('point simplification reduced a straight 51-point line down to 2 points', createdAnnotations[0].geometry.points.length === 2);

  createdAnnotations.length = 0;
  toolbarState.setTool('highlight');
  document.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, clientX: 5, clientY: 5 }));
  document.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, clientX: 15, clientY: 15 }));
  await new Promise((r) => setTimeout(r, 20));
  check('a drag gesture while a SELECTION tool is active does not create a shape annotation', createdAnnotations.length === 0);

  dispose();
  createdAnnotations.length = 0;
  toolbarState.setTool('rect');
  document.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
  document.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, clientX: 20, clientY: 20 }));
  await new Promise((r) => setTimeout(r, 20));
  check('after dispose(), no further annotations are created from input', createdAnnotations.length === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
