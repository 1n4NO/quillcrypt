'use strict';
const { AnnotationStore, InMemoryBackend, normalizeUrl } = require('../src/storage/store');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

check(
  'hash fragment is stripped',
  normalizeUrl('https://example.com/article#section-2') === normalizeUrl('https://example.com/article')
);
check(
  'query param order does not affect the key',
  normalizeUrl('https://example.com/a?x=1&y=2') === normalizeUrl('https://example.com/a?y=2&x=1')
);
check(
  'different paths produce different keys',
  normalizeUrl('https://example.com/a') !== normalizeUrl('https://example.com/b')
);

async function main() {
  const store = new AnnotationStore();
  const url = 'https://example.com/article?ref=twitter';

  await store.addAnnotation(url, { id: 'ann-1', type: 'highlight', content: null });
  let all = await store.getAnnotationsForUrl(url);
  check('annotation persisted after add', all.length === 1 && all[0].id === 'ann-1');

  await store.updateAnnotation(url, 'ann-1', { content: 'edited' });
  all = await store.getAnnotationsForUrl(url);
  check('update applied and updatedAt bumped', all[0].content === 'edited' && !!all[0].updatedAt);

  await store.deleteAnnotation(url, 'ann-1');
  all = await store.getAnnotationsForUrl(url);
  check('annotation removed after delete', all.length === 0);

  const sharedDisk = new Map();
  const storeBeforeRestart = new AnnotationStore(new InMemoryBackend(sharedDisk));
  await storeBeforeRestart.addAnnotation(url, { id: 'ann-2', type: 'note', content: 'survives restart' });

  const storeAfterRestart = new AnnotationStore(new InMemoryBackend(sharedDisk));
  const afterRestart = await storeAfterRestart.getAnnotationsForUrl(url);
  check(
    'annotation survives a simulated restart (new store instance, same backing store)',
    afterRestart.length === 1 && afterRestart[0].content === 'survives restart'
  );

  const otherUrl = 'https://example.com/other-page';
  await storeAfterRestart.addAnnotation(otherUrl, { id: 'ann-3', type: 'highlight' });
  const pageA = await storeAfterRestart.getAnnotationsForUrl(url);
  const pageB = await storeAfterRestart.getAnnotationsForUrl(otherUrl);
  check('annotations are scoped per-URL, not shared globally', pageA.length === 1 && pageB.length === 1 && pageA[0].id !== pageB[0].id);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
