'use strict';
const Y = require('yjs');
const { buildSidebarItems } = require('../../src/ui/sidebar');
const { simplifyPoints } = require('../../src/tools/draw');
const { AnnotationStore } = require('../../src/storage/store');
const { AnnotationYDoc } = require('../../src/sync/annotationYDoc');

/**
 * Performance pass (QC-63).
 *
 * IMPORTANT CAVEAT, stated plainly: these thresholds are calibrated against
 * THIS sandbox's Node process, not a real Firefox content-script
 * environment, and not real CI hardware. They're useful for catching
 * accidental O(n²) regressions (a 10x input taking 100x longer instead of
 * ~10x) and gross performance cliffs, not as a precise SLA. Before treating
 * any of these numbers as a hard release gate, re-run equivalent
 * benchmarks in an actual browser and on real CI hardware.
 *
 * Findings: docs/PERFORMANCE.md
 */

function time(label, fn) {
  const start = process.hrtime.bigint();
  const result = fn();
  const end = process.hrtime.bigint();
  const ms = Number(end - start) / 1e6;
  console.log(`  ${label}: ${ms.toFixed(2)}ms`);
  return { result, ms };
}

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

async function main() {
  console.log('--- QC-63 performance benchmarks ---\n');

  const manyAnnotations = [];
  for (let i = 0; i < 5000; i++) {
    manyAnnotations.push({
      id: `ann-${i}`,
      type: 'highlight',
      anchor: { exact: `annotation number ${i} with some surrounding text for realism`, position: { start: i * 50, end: i * 50 + 20 } },
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
    });
  }
  const { ms: sidebarMs } = time('buildSidebarItems x5000', () => buildSidebarItems(manyAnnotations));
  check('sidebar sort/excerpt of 5000 annotations completes in well under 1 second', sidebarMs < 1000);

  const longStroke = [];
  for (let x = 0; x < 10000; x++) {
    longStroke.push({ x, y: Math.sin(x / 50) * 30 + (Math.random() - 0.5) * 2 });
  }
  const { result: simplified, ms: simplifyMs } = time('simplifyPoints x10000 (Douglas-Peucker)', () => simplifyPoints(longStroke, 2));
  check('simplifying a 10,000-point stroke completes in well under 1 second', simplifyMs < 1000);
  check('simplification meaningfully reduces point count (validates the QC-16 mitigation actually helps at scale)', simplified.length < longStroke.length * 0.5);

  const store = new AnnotationStore();
  const storeWriteStart = process.hrtime.bigint();
  for (let i = 0; i < 2000; i++) {
    const url = `https://example.com/page-${i % 50}`;
    await store.addAnnotation(url, { id: `ann-${i}`, type: 'highlight', content: null });
  }
  const storeWriteMs = Number(process.hrtime.bigint() - storeWriteStart) / 1e6;
  console.log(`  AnnotationStore: 2000 sequential writes across 50 pages: ${storeWriteMs.toFixed(2)}ms`);
  check('2000 sequential annotation writes complete in well under 5 seconds', storeWriteMs < 5000);

  const readStart = process.hrtime.bigint();
  const pageAnnotations = await store.getAnnotationsForUrl('https://example.com/page-0');
  const readMs = Number(process.hrtime.bigint() - readStart) / 1e6;
  console.log(`  AnnotationStore: single-page read (40 annotations expected): ${readMs.toFixed(2)}ms`);
  check('a single page with ~40 annotations reads back correctly', pageAnnotations.length === 40);
  check('single-page read is fast (well under 50ms) — this is the hot path for every page load', readMs < 50);

  const ydoc = new Y.Doc();
  const annDoc = new AnnotationYDoc(ydoc);
  const { ms: ydocWriteMs } = time('AnnotationYDoc: 2000 sequential addAnnotation calls', () => {
    for (let i = 0; i < 2000; i++) {
      annDoc.addAnnotation({ id: `ann-${i}`, type: 'highlight', content: null });
    }
  });
  check('2000 sequential Yjs annotation writes complete in well under 5 seconds', ydocWriteMs < 5000);

  const { ms: ydocReadMs } = time('AnnotationYDoc: getAllAnnotations x2000', () => annDoc.getAllAnnotations());
  check('reading all 2000 annotations back from the Yjs doc is fast (under 100ms)', ydocReadMs < 100);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
