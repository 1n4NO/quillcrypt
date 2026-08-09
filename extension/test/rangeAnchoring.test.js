'use strict';
const { JSDOM } = require('jsdom');
const { anchorFromRange, locateAsRange } = require('../src/content/anchoring/rangeAnchoring');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

const html = `
  <article>
    <p id="a">The quick brown fox jumps over the lazy dog near the river.</p>
    <p id="b">Collaborative annotation lets teams mark up any webpage together in real time.</p>
  </article>
`;
const dom = new JSDOM(html);
const document = dom.window.document;
const root = document.querySelector('article');
const paragraphB = document.querySelector('#b');
const textNode = paragraphB.firstChild;

const fullB = textNode.textContent;
const selStart = fullB.indexOf('mark up any webpage');
const selEnd = selStart + 'mark up any webpage'.length;

const range = document.createRange();
range.setStart(textNode, selStart);
range.setEnd(textNode, selEnd);

check('live selection has the expected text', range.toString() === 'mark up any webpage');

const anchor = anchorFromRange(root, range);
check('anchor captured the correct exact text from the live range', anchor.exact === 'mark up any webpage');

const reflowedHtml = `
  <article>
    <p id="b">Collaborative annotation lets groups mark up any webpage together in real time.</p>
    <p id="a">The quick brown fox jumps over the lazy dog near the river.</p>
  </article>
`;
const dom2 = new JSDOM(reflowedHtml);
const root2 = dom2.window.document.querySelector('article');

const relocatedRange = locateAsRange(root2, anchor);
check('anchor relocated to a real Range after reflow', relocatedRange !== null);
check('relocated range text matches the original selection', relocatedRange.toString() === 'mark up any webpage');

const removedHtml = `<article><p id="a">The quick brown fox jumps over the lazy dog near the river.</p></article>`;
const dom3 = new JSDOM(removedHtml);
const root3 = dom3.window.document.querySelector('article');
const missingRange = locateAsRange(root3, anchor);
check('locateAsRange returns null (not a broken Range) when text is gone', missingRange === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
