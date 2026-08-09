'use strict';
const { JSDOM } = require('jsdom');
const { anchorFromOffsets, locate, fullText } = require('../src/content/anchoring/anchoring');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

// ---- Scenario setup: original page ----
const originalHtml = `
  <article>
    <p id="a">The quick brown fox jumps over the lazy dog near the river.</p>
    <p id="b">Collaborative annotation lets teams mark up any webpage together in real time.</p>
    <p id="c">Encryption keeps the server from ever reading what you wrote.</p>
  </article>
`;

const dom1 = new JSDOM(originalHtml);
const root1 = dom1.window.document.querySelector('article');
const text1 = fullText(root1);

// Anchor the phrase "mark up any webpage" inside paragraph B
const target = 'mark up any webpage';
const start = text1.indexOf(target);
const end = start + target.length;
const anchor = anchorFromOffsets(root1, start, end);

check('anchor captured correct exact text', anchor.exact === target);

// ---- Test 1: reordered paragraph + changed word nearby (still in same anchor's paragraph) ----
// Swap paragraph A and B, and change "teams" -> "groups" near (but not inside) the anchored phrase
const reflowedHtml = `
  <article>
    <p id="b">Collaborative annotation lets groups mark up any webpage together in real time.</p>
    <p id="a">The quick brown fox jumps over the lazy dog near the river.</p>
    <p id="c">Encryption keeps the server from ever reading what you wrote.</p>
  </article>
`;
const dom2 = new JSDOM(reflowedHtml);
const root2 = dom2.window.document.querySelector('article');
const result2 = locate(root2, anchor);

check('anchor re-located after paragraph reorder + nearby word change', result2 !== null);
if (result2) {
  const text2 = fullText(root2);
  check('re-located text still matches the original quote', text2.slice(result2.start, result2.end) === target);
}

// ---- Test 2: documented failure mode — the anchored text is fully removed ----
const removedHtml = `
  <article>
    <p id="a">The quick brown fox jumps over the lazy dog near the river.</p>
    <p id="c">Encryption keeps the server from ever reading what you wrote.</p>
  </article>
`;
const dom3 = new JSDOM(removedHtml);
const root3 = dom3.window.document.querySelector('article');
const result3 = locate(root3, anchor);

check('locate() returns null when the anchored text is fully removed (documented failure mode)', result3 === null);

// ---- Test 3: documented failure mode — ambiguous match, duplicate quote elsewhere ----
const dupeHtml = `
  <article>
    <p id="a">The quick brown fox jumps over the lazy dog near the river.</p>
    <p id="b">Collaborative annotation lets groups mark up any webpage together in real time.</p>
    <p id="dup">A totally unrelated sentence that happens to also mark up any webpage differently.</p>
    <p id="c">Encryption keeps the server from ever reading what you wrote.</p>
  </article>
`;
const dom4 = new JSDOM(dupeHtml);
const root4 = dom4.window.document.querySelector('article');
const result4 = locate(root4, anchor);
const text4 = fullText(root4);
// Context scoring should still favor the original paragraph B occurrence, since its
// surrounding words match the original prefix/suffix much better than the decoy's.
const correctOccurrenceStart = text4.indexOf('Collaborative annotation lets groups mark up any webpage');
const correctStart = text4.indexOf(target, correctOccurrenceStart);
check(
  'ambiguous duplicate quote resolved to the contextually-correct occurrence',
  result4 !== null && result4.start === correctStart
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
