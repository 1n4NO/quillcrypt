'use strict';
const { exportToJson, importFromJson, exportToMarkdown } = require('../src/models/exportAnnotations');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

const annotations = [
  { id: 'ann-1', type: 'highlight', anchor: { exact: 'a key phrase', position: { start: 0, end: 13 } }, content: null },
  { id: 'ann-2', type: 'note', anchor: { exact: 'context text', position: { start: 50, end: 62 } }, content: 'This is my full, unredacted note content.' },
];

const json = exportToJson(annotations, { url: 'https://example.com/article' });
check('JSON export includes a format version', JSON.parse(json).formatVersion === 1);
check('JSON export includes the source URL', JSON.parse(json).url === 'https://example.com/article');
check('JSON export includes the annotation count', JSON.parse(json).annotationCount === 2);

const imported = importFromJson(json);
check('imported annotations round-trip with full content intact', JSON.stringify(imported) === JSON.stringify(annotations));
check('imported note content is NOT redacted (unlike the metadata-only event stream)', imported.find((a) => a.id === 'ann-2').content === 'This is my full, unredacted note content.');

check(
  'importing an unsupported format version throws rather than silently misreading data',
  (() => {
    try { importFromJson(JSON.stringify({ formatVersion: 999, annotations: [] })); return false; }
    catch (e) { return true; }
  })()
);

const markdown = exportToMarkdown(annotations, { url: 'https://example.com/article', pageTitle: 'My Article' });
check('Markdown export includes the page title as a heading', markdown.includes('# Annotations: My Article'));
check('Markdown export includes the source URL', markdown.includes('https://example.com/article'));
check('Markdown export includes the highlighted quote', markdown.includes('a key phrase'));
check('Markdown export includes the full note content', markdown.includes('This is my full, unredacted note content.'));
check('Markdown export uses human-readable type labels', markdown.includes('## Highlight') && markdown.includes('## Note'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
