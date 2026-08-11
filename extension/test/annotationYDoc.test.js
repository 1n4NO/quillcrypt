'use strict';
const Y = require('yjs');
const { AnnotationYDoc } = require('../src/sync/annotationYDoc');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

const single = new AnnotationYDoc();
single.addAnnotation({ id: 'ann-1', type: 'highlight', content: null, style: { color: '#F5C542' } });
check('annotation retrievable after add', single.getAnnotation('ann-1').type === 'highlight');

single.updateAnnotation('ann-1', { content: 'edited' });
check('update applies the patch', single.getAnnotation('ann-1').content === 'edited');

single.deleteAnnotation('ann-1');
check('delete removes the annotation', single.getAnnotation('ann-1') === null);

function syncDocs(docA, docB) {
  const updateA = Y.encodeStateAsUpdate(docA.ydoc, Y.encodeStateVector(docB.ydoc));
  const updateB = Y.encodeStateAsUpdate(docB.ydoc, Y.encodeStateVector(docA.ydoc));
  Y.applyUpdate(docB.ydoc, updateA);
  Y.applyUpdate(docA.ydoc, updateB);
}

const docA = new AnnotationYDoc();
const docB = new AnnotationYDoc();

docA.addAnnotation({ id: 'ann-2', type: 'note', content: 'hello from A', style: { color: '#F5C542' } });
syncDocs(docA, docB);
check('an annotation added on doc A appears on doc B after sync', docB.getAnnotation('ann-2')?.content === 'hello from A');

docA.updateAnnotation('ann-2', { content: 'edited by A' });
docB.updateAnnotation('ann-2', { style: { color: '#FF0000' } });
syncDocs(docA, docB);

check(
  "concurrent edits to different fields both survive the merge (A's content change)",
  docA.getAnnotation('ann-2').content === 'edited by A' && docB.getAnnotation('ann-2').content === 'edited by A'
);
check(
  "concurrent edits to different fields both survive the merge (B's style change)",
  docA.getAnnotation('ann-2').style.color === '#FF0000' && docB.getAnnotation('ann-2').style.color === '#FF0000'
);

docA.updateAnnotation('ann-2', { content: 'version from A' });
docB.updateAnnotation('ann-2', { content: 'version from B' });
syncDocs(docA, docB);

const finalContentA = docA.getAnnotation('ann-2').content;
const finalContentB = docB.getAnnotation('ann-2').content;
check('same-field conflicting edits converge to an identical value on both docs', finalContentA === finalContentB);
check('the converged value is one of the two conflicting writes (not corrupted)', finalContentA === 'version from A' || finalContentA === 'version from B');

const docC = new AnnotationYDoc();
const docD = new AnnotationYDoc();
docC.addAnnotation({ id: 'ann-3', type: 'highlight', content: 'original' });
syncDocs(docC, docD);

docC.deleteAnnotation('ann-3');
docD.updateAnnotation('ann-3', { content: 'edited before delete arrives' });
syncDocs(docC, docD);

const resultC = docC.getAnnotation('ann-3');
const resultD = docD.getAnnotation('ann-3');
check('delete-vs-edit conflict converges identically on both docs', resultC === resultD || JSON.stringify(resultC) === JSON.stringify(resultD));

const docE = new AnnotationYDoc();
const docF = new AnnotationYDoc();
let observedCount = 0;
const unsubscribe = docF.observe(() => { observedCount++; });

docE.addAnnotation({ id: 'ann-4', type: 'arrow', content: null });
syncDocs(docE, docF);

check('observe() fires when a remote change arrives via sync, not just local edits', observedCount > 0);
unsubscribe();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
