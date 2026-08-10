'use strict';
const { computeNotePosition } = require('../src/tools/note');
const { ToolbarState } = require('../src/ui/toolbar');
const { UndoStack } = require('../src/ui/undoRedo');
const { AnnotationStore } = require('../src/storage/store');
const { AnnotationEditController } = require('../src/models/editController');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

// ================= QC-19: sticky note positioning =================
const viewport = { width: 1200, height: 800 };
const noteSize = { width: 240, height: 120 };

const midAnchor = { top: 300, left: 400, right: 480, bottom: 320, width: 80, height: 20 };
const midPos = computeNotePosition(midAnchor, viewport, noteSize);
check('note placed to the right of the anchor when there is room', midPos.x === midAnchor.right + 12);
check('note stays fully within the viewport horizontally', midPos.x + noteSize.width <= viewport.width);

const rightEdgeAnchor = { top: 300, left: 1100, right: 1180, bottom: 320, width: 80, height: 20 };
const rightPos = computeNotePosition(rightEdgeAnchor, viewport, noteSize);
check('note flips to the left side when there is no room on the right', rightPos.x < rightEdgeAnchor.left);

const bottomAnchor = { top: 780, left: 400, right: 480, bottom: 800, width: 80, height: 20 };
const bottomPos = computeNotePosition(bottomAnchor, viewport, noteSize);
check('note y is clamped so it does not extend past the bottom of the viewport', bottomPos.y + noteSize.height <= viewport.height);

const cornerAnchor = { top: 0, left: 0, right: 10, bottom: 5, width: 10, height: 5 };
const cornerPos = computeNotePosition(cornerAnchor, viewport, noteSize);
check('note position at the top-left corner has no negative coordinates', cornerPos.x >= 0 && cornerPos.y >= 0);

// ================= QC-20: toolbar state =================
const toolbar = new ToolbarState();
check('default state has no active tool', toolbar.getState().activeTool === null);

toolbar.setTool('draw');
toolbar.setTool('arrow');
check('setting a new tool replaces the previous one (only one active at a time)', toolbar.getState().activeTool === 'arrow');
check(
  'setting an unknown tool throws',
  (() => { try { toolbar.setTool('laser-pointer'); return false; } catch (e) { return true; } })()
);

toolbar.setColor('#123ABC');
check('valid hex color is accepted', toolbar.getState().color === '#123ABC');
check(
  'invalid color format is rejected',
  (() => { try { toolbar.setColor('red'); return false; } catch (e) { return true; } })()
);

check(
  'stroke width above maximum is rejected',
  (() => { try { toolbar.setStrokeWidth(999); return false; } catch (e) { return true; } })()
);

let notifications = [];
const unsubscribe = toolbar.subscribe((state) => notifications.push(state));
toolbar.setTool('highlight');
check('subscriber is notified on state change', notifications.length === 1 && notifications[0].activeTool === 'highlight');
unsubscribe();
toolbar.setTool('rect');
check('unsubscribed listener receives no further notifications', notifications.length === 1);

// ================= QC-21: undo/redo stack =================
function makeAddCommand(list, item) {
  return {
    do: () => list.push(item),
    undo: () => { const idx = list.indexOf(item); if (idx !== -1) list.splice(idx, 1); },
  };
}

const state = [];
const stack = new UndoStack();
stack.execute(makeAddCommand(state, 'A'));
stack.execute(makeAddCommand(state, 'B'));
stack.execute(makeAddCommand(state, 'C'));
check('three executed commands all applied their effects', state.join('') === 'ABC');

stack.undo();
stack.undo();
check('two undos reverse the two most recent commands', state.join('') === 'A');

stack.redo();
check('redo re-applies the most recently undone command', state.join('') === 'AB');

stack.execute(makeAddCommand(state, 'D'));
check('redo is no longer available after a new action branches off', stack.canRedo() === false);

const boundedState = [];
const boundedStack = new UndoStack(3);
for (const letter of ['A', 'B', 'C', 'D', 'E']) {
  boundedStack.execute(makeAddCommand(boundedState, letter));
}
let undoCount = 0;
while (boundedStack.undo()) undoCount++;
check('only maxSize (3) undo steps are available once history exceeds the bound', undoCount === 3);

// ================= QC-22: edit/delete controller =================
async function runAsyncChecks() {
  const store = new AnnotationStore();
  const controller = new AnnotationEditController(store);
  const url = 'https://example.com/page';

  await store.addAnnotation(url, { id: 'ann-1', type: 'note', content: 'original text' });

  await controller.edit(url, 'ann-1', { content: 'edited text' });
  let all = await store.getAnnotationsForUrl(url);
  check('edit applies the patch', all[0].content === 'edited text');

  await controller.undo();
  all = await store.getAnnotationsForUrl(url);
  check('undo reverts the edit back to original content', all[0].content === 'original text');

  await controller.redo();
  all = await store.getAnnotationsForUrl(url);
  check('redo re-applies the edit', all[0].content === 'edited text');

  await controller.delete(url, 'ann-1');
  all = await store.getAnnotationsForUrl(url);
  check('delete removes the annotation', all.length === 0);

  await controller.undo();
  all = await store.getAnnotationsForUrl(url);
  check('undo restores the deleted annotation', all.length === 1 && all[0].id === 'ann-1');
  check('restored annotation has its edited content (state at time of deletion)', all[0].content === 'edited text');

  await store.addAnnotation(url, { id: 'ann-2', type: 'note', content: 'v1' });
  await controller.edit(url, 'ann-2', { content: 'v2' });
  await controller.delete(url, 'ann-2');
  await controller.undo(); // undoes the delete
  await controller.undo(); // undoes the edit
  all = await store.getAnnotationsForUrl(url);
  const ann2 = all.find((a) => a.id === 'ann-2');
  check('interleaved edit+delete unwinds correctly with two undos', ann2 && ann2.content === 'v1');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

runAsyncChecks();
