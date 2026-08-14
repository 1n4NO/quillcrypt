'use strict';
const { ToolbarState, VALID_TOOLS } = require('../src/ui/toolbar');
const { KeyboardToolbarNav, generateAriaLabel } = require('../src/ui/accessibility');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

const toolbar = new ToolbarState();
const nav = new KeyboardToolbarNav(toolbar);

check('no tool active initially', toolbar.getState().activeTool === null);

nav.next();
check('first "next" from no-tool-active lands on the first tool', toolbar.getState().activeTool === VALID_TOOLS[0]);

nav.next();
check('second "next" advances to the second tool', toolbar.getState().activeTool === VALID_TOOLS[1]);

nav.previous();
check('"previous" goes back to the first tool', toolbar.getState().activeTool === VALID_TOOLS[0]);

nav.previous();
check('"previous" from the first tool wraps around to the last tool', toolbar.getState().activeTool === VALID_TOOLS[VALID_TOOLS.length - 1]);

nav.next();
check('"next" from the last tool wraps around to the first tool', toolbar.getState().activeTool === VALID_TOOLS[0]);

nav.last();
check('"last" jumps directly to the last tool', toolbar.getState().activeTool === VALID_TOOLS[VALID_TOOLS.length - 1]);

nav.first();
check('"first" jumps directly to the first tool', toolbar.getState().activeTool === VALID_TOOLS[0]);

nav.escape();
check('"escape" returns to no-tool-active (plain selection mode)', toolbar.getState().activeTool === null);

const highlightAnnotation = { type: 'highlight', anchor: { exact: 'the quoted phrase' } };
check('highlight label includes the type and quoted text', generateAriaLabel(highlightAnnotation) === 'Highlight on text: the quoted phrase');

const noteAnnotation = { type: 'note', content: 'a helpful comment' };
check('note label includes the content, not anchor text', generateAriaLabel(noteAnnotation) === 'Note: a helpful comment');

const noteWithAuthor = { type: 'note', content: 'a comment' };
check('label includes author name when provided', generateAriaLabel(noteWithAuthor, { authorName: 'Alice' }) === 'Note by Alice: a comment');

const shapeAnnotation = { type: 'rect', geometry: {} };
check('shape annotation (no anchor, no content) still produces a sensible label', generateAriaLabel(shapeAnnotation) === 'Rectangle');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
