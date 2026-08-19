'use strict';
const { WebExtensionStorageBackend, WebExtensionOnboardingBackend } = require('../src/storage/webExtensionStorage');
const { AnnotationStore } = require('../src/storage/store');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

function createMockStorageArea() {
  const data = new Map();
  return {
    async get(keyOrKeys) {
      if (keyOrKeys === null) return Object.fromEntries(data.entries());
      if (typeof keyOrKeys === 'string') return data.has(keyOrKeys) ? { [keyOrKeys]: data.get(keyOrKeys) } : {};
      throw new Error('mock only supports string or null');
    },
    async set(obj) {
      for (const [k, v] of Object.entries(obj)) data.set(k, v);
    },
    async remove(key) {
      data.delete(key);
    },
    _raw: data,
  };
}

async function main() {
  const area = createMockStorageArea();
  const backend = new WebExtensionStorageBackend('annotations', area);

  check('get() on a missing key returns null', (await backend.get('foo')) === null);

  await backend.set('foo', 'bar-value');
  check('set() then get() round-trips correctly', (await backend.get('foo')) === 'bar-value');
  check('keys are namespaced under the hood (no collision risk)', area._raw.has('annotations:foo'));

  await backend.set('baz', 'other-value');
  const keys = await backend.keys();
  check("keys() returns only this namespace's keys, unprefixed", JSON.stringify(keys.sort()) === JSON.stringify(['baz', 'foo']));

  await backend.remove('foo');
  check('remove() actually removes the key', (await backend.get('foo')) === null);
  check('remove() does not affect other keys', (await backend.get('baz')) === 'other-value');

  const otherBackend = new WebExtensionStorageBackend('keys', area);
  await otherBackend.set('baz', 'totally-different-value');
  check('two backends with different namespaces sharing one storage area do not collide', (await backend.get('baz')) === 'other-value');
  check('the second namespace has its own independent value under the same local key', (await otherBackend.get('baz')) === 'totally-different-value');

  const onboardingBackend = new WebExtensionOnboardingBackend(createMockStorageArea());
  check('onboarding backend starts empty', (await onboardingBackend.get()).length === 0);
  await onboardingBackend.add('install');
  check('onboarding backend records a completed step', (await onboardingBackend.get()).includes('install'));
  await onboardingBackend.add('install');
  check('adding the same step twice does not duplicate it', (await onboardingBackend.get()).length === 1);

  const annotationBackend = new WebExtensionStorageBackend('annotations-real', createMockStorageArea());
  const store = new AnnotationStore(annotationBackend);
  await store.addAnnotation('https://example.com/page', { id: 'ann-1', type: 'highlight', content: null });
  const retrieved = await store.getAnnotationsForUrl('https://example.com/page');
  check('AnnotationStore (unmodified, already-tested code) works correctly against this real backend', retrieved.length === 1 && retrieved[0].id === 'ann-1');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
