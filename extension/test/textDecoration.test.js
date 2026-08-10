'use strict';
const { JSDOM } = require('jsdom');
const { applyInlineDecoration, removeInlineDecoration } = require('../src/tools/inlineDecoration');
const { applyHighlight, removeHighlight } = require('../src/tools/highlight');
const { applyUnderline, removeUnderline } = require('../src/tools/underline');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

// ---- Shared engine: single-node selection ----
const dom1 = new JSDOM('<article><p id="p">The quick brown fox jumps over the lazy dog</p></article>');
const doc1 = dom1.window.document;
const root1 = doc1.querySelector('article');
const p1 = doc1.querySelector('#p');
const text1 = p1.firstChild;

const range1 = doc1.createRange();
const start1 = text1.textContent.indexOf('quick brown');
range1.setStart(text1, start1);
range1.setEnd(text1, start1 + 'quick brown'.length);

applyInlineDecoration(root1, range1, { tag: 'mark', className: 'qc-highlight' }, 'ann-1');

check('surrounding text before selection is untouched', p1.textContent === 'The quick brown fox jumps over the lazy dog');
check('a <mark> wrapper was created', p1.querySelector('mark.qc-highlight') !== null);
check('wrapper contains exactly the selected text', p1.querySelector('mark').textContent === 'quick brown');
check('wrapper carries the annotation id', p1.querySelector('mark').getAttribute('data-quillcrypt-annotation-id') === 'ann-1');

// ---- Shared engine: multi-element selection (correct Range semantics: the
// whole span between the two points is included, not just each end phrase) ----
const dom2 = new JSDOM(`<article><p id="a">First paragraph ends here.</p><p id="b">Second paragraph starts here.</p></article>`);
const doc2 = dom2.window.document;
const root2 = doc2.querySelector('article');
const pa = doc2.querySelector('#a');
const pb = doc2.querySelector('#b');

const range2 = doc2.createRange();
const endsHereIdx = pa.firstChild.textContent.indexOf('ends here');
range2.setStart(pa.firstChild, endsHereIdx);
const startsHereIdx = pb.firstChild.textContent.indexOf('starts here');
range2.setEnd(pb.firstChild, startsHereIdx + 'starts here'.length);

check('sanity: range selects the expected full span across both paragraphs', range2.toString() === 'ends here.Second paragraph starts here');

applyInlineDecoration(root2, range2, { tag: 'mark', className: 'qc-highlight' }, 'ann-2');

const marksInA = pa.querySelectorAll('mark.qc-highlight');
const marksInB = pb.querySelectorAll('mark.qc-highlight');
check('multi-element selection decorates the tail of paragraph A', marksInA.length === 1 && marksInA[0].textContent === 'ends here.');
check('multi-element selection decorates the head of paragraph B', marksInB.length === 1 && marksInB[0].textContent === 'Second paragraph starts here');
check('text before the selection in paragraph A is untouched', pa.textContent === 'First paragraph ends here.');
check('text after the selection in paragraph B is untouched', pb.textContent === 'Second paragraph starts here.');

removeInlineDecoration(root2, 'ann-2');
check('removal leaves no wrapper elements behind', root2.querySelectorAll('[data-quillcrypt-annotation-id]').length === 0);
check('paragraph A text is fully restored', pa.textContent === 'First paragraph ends here.');
check('paragraph B text is fully restored', pb.textContent === 'Second paragraph starts here.');

// ---- QC-14: highlight tool wrapper ----
const dom3 = new JSDOM('<article><p id="p">Some highlightable text here</p></article>');
const root3 = dom3.window.document.querySelector('article');
const p3 = dom3.window.document.querySelector('#p');
const range3 = dom3.window.document.createRange();
range3.setStart(p3.firstChild, 5);
range3.setEnd(p3.firstChild, 18);
applyHighlight(root3, range3, 'hl-1', '#F5C542');
const mark3 = p3.querySelector('mark.qc-highlight');
check('highlight tool creates a mark with the given color baked into style', mark3 !== null && mark3.getAttribute('style').includes('#F5C54266'));
removeHighlight(root3, 'hl-1');
check('highlight tool removal restores text', p3.textContent === 'Some highlightable text here');

// ---- QC-15: underline tool wrapper ----
const dom4 = new JSDOM('<article><p id="p">Some underlineable text here</p></article>');
const root4 = dom4.window.document.querySelector('article');
const p4 = dom4.window.document.querySelector('#p');
const range4 = dom4.window.document.createRange();
range4.setStart(p4.firstChild, 5);
range4.setEnd(p4.firstChild, 17);
applyUnderline(root4, range4, 'ul-1', '#E85D5D');
const underlineEl = p4.querySelector('span.qc-underline');
check('underline tool creates a span with border-bottom style', underlineEl !== null && underlineEl.getAttribute('style').includes('border-bottom'));
removeUnderline(root4, 'ul-1');
check('underline tool removal restores text', p4.textContent === 'Some underlineable text here');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
