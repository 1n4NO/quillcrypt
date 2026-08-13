'use strict';
const Y = require('yjs');
const { AnnotationYDoc } = require('../src/sync/annotationYDoc');
const { EventStream, buildMetadataEvent, assertMetadataOnly, hashUrl, EVENT_ALLOWED_KEYS } = require('../src/integrations/eventStream');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

async function main() {
  const hash1 = await hashUrl('https://example.com/article');
  const hash2 = await hashUrl('https://example.com/article');
  const hash3 = await hashUrl('https://example.com/other');
  check('hashing the same URL twice is deterministic', hash1 === hash2);
  check('hashing different URLs produces different hashes', hash1 !== hash3);
  check('the hash never contains the original URL as a substring', !hash1.includes('example.com'));

  const validEvent = { type: 'annotation-added', workspaceId: 'ws-1', urlHash: 'abc', authorId: 'alice', annotationId: 'ann-1', timestamp: 123 };
  check('a valid metadata-only event passes assertMetadataOnly without throwing', (() => { try { assertMetadataOnly(validEvent); return true; } catch (e) { return false; } })());

  const leakyEvent = { ...validEvent, content: 'this should never be here' };
  check(
    'an event with a disallowed key (e.g. content) is rejected by assertMetadataOnly',
    (() => { try { assertMetadataOnly(leakyEvent); return false; } catch (e) { return true; } })()
  );

  const built = await buildMetadataEvent({ type: 'annotation-added', workspaceId: 'ws-1', url: 'https://example.com/page', authorId: 'alice', annotationId: 'ann-1' });
  const builtKeys = Object.keys(built).sort();
  check('buildMetadataEvent output contains exactly the allowed keys, nothing more', JSON.stringify(builtKeys) === JSON.stringify([...EVENT_ALLOWED_KEYS].sort()));

  const ydoc = new Y.Doc();
  const annDoc = new AnnotationYDoc(ydoc);
  const capturedEvents = [];
  const stream = new EventStream(annDoc, { workspaceId: 'ws-1', url: 'https://example.com/article', authorId: 'alice' });
  stream.onEvent((event) => capturedEvents.push(event));

  annDoc.addAnnotation({ id: 'ann-1', type: 'note', content: 'this is sensitive content that must never leak' });
  await new Promise((r) => setTimeout(r, 50));
  annDoc.updateAnnotation('ann-1', { content: 'edited sensitive content' });
  await new Promise((r) => setTimeout(r, 50));
  annDoc.deleteAnnotation('ann-1');
  await new Promise((r) => setTimeout(r, 50));

  const types = capturedEvents.map((e) => e.type);
  check('add/update/delete produce exactly the three expected event types in order', JSON.stringify(types) === JSON.stringify(['annotation-added', 'annotation-updated', 'annotation-deleted']));

  const anyEventHasContent = capturedEvents.some((e) => 'content' in e);
  check('NONE of the emitted events contain a "content" field at all', !anyEventHasContent);

  const serializedEvents = JSON.stringify(capturedEvents);
  check(
    'the actual sensitive content string never appears anywhere in any emitted event, even indirectly',
    !serializedEvents.includes('sensitive content')
  );

  const allEventsHaveOnlyAllowedKeys = capturedEvents.every((e) => {
    try { assertMetadataOnly(e); return true; } catch (err) { return false; }
  });
  check('every single emitted event passes the whitelist check', allEventsHaveOnlyAllowedKeys);

  stream.dispose();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
