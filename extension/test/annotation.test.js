'use strict';
const { createAnnotation, validateAnnotation, runMigrations, CURRENT_SCHEMA_VERSION } = require('../src/models/annotation');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

const fakeAnchor = { exact: 'hello', prefix: '', suffix: '', position: { start: 0, end: 5 } };
const fakeGeometry = { points: [[10, 10], [20, 20]] };

const highlight = createAnnotation({ type: 'highlight', anchor: fakeAnchor });
check('highlight created with correct schemaVersion', highlight.schemaVersion === CURRENT_SCHEMA_VERSION);
check('highlight has a generated id', typeof highlight.id === 'string' && highlight.id.length > 0);

const note = createAnnotation({ type: 'note', anchor: fakeAnchor, content: 'left a comment here' });
check('note created successfully with content', note.content === 'left a comment here');

const rect = createAnnotation({ type: 'rect', geometry: fakeGeometry });
check('rect (shape type) created successfully with geometry', rect.geometry === fakeGeometry);

check(
  'validation rejects a highlight with no anchor',
  validateAnnotation({ id: 'x', type: 'highlight', schemaVersion: 1, anchor: null }).length > 0
);
check(
  'validation rejects a rect with no geometry',
  validateAnnotation({ id: 'x', type: 'rect', schemaVersion: 1, geometry: null }).length > 0
);
check(
  'validation rejects a note with non-string content',
  validateAnnotation({ id: 'x', type: 'note', schemaVersion: 1, anchor: fakeAnchor, content: 42 }).length > 0
);
check(
  'createAnnotation throws for an invalid record rather than returning it silently',
  (() => {
    try { createAnnotation({ type: 'highlight' }); return false; }
    catch (e) { return true; }
  })()
);

const fakeMigrations = {
  0: (r) => ({ ...r, schemaVersion: 1, renamedField: r.oldField }),
  1: (r) => ({ ...r, schemaVersion: 2, addedField: true }),
};
const v0Record = { id: 'x', schemaVersion: 0, oldField: 'legacy-value' };
const migrated = runMigrations(v0Record, fakeMigrations, 2);

check('migration chain walks multiple steps to reach target version', migrated.schemaVersion === 2);
check('migration chain correctly applies each step in order', migrated.renamedField === 'legacy-value' && migrated.addedField === true);
check(
  'migration chain throws clearly when no path exists for a version',
  (() => {
    try { runMigrations({ schemaVersion: 5 }, fakeMigrations, 6); return false; }
    catch (e) { return true; }
  })()
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
