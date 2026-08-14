# QC-63 — Performance pass findings

**Status: benchmarked; all comfortably within thresholds. Real-browser re-verification recommended before treating as a release gate.**

## Results (this sandbox's Node process)

| Operation | Scale | Time |
|---|---|---|
| Sidebar sort + excerpt | 5,000 annotations | ~5ms |
| Douglas-Peucker simplification | 10,000-point freehand stroke | ~30ms |
| `AnnotationStore` writes | 2,000 annotations across 50 pages | ~40-50ms |
| `AnnotationStore` single-page read | ~40 annotations (the hot path — runs on every page load) | ~0.1ms |
| `AnnotationYDoc` writes | 2,000 annotations | ~60-75ms |
| `AnnotationYDoc` read-all | 2,000 annotations | ~3ms |

All of these have wide margin against their thresholds — nothing is close to the limits set in
`test/perf/benchmarks.test.js`, which is a good sign for the current architecture at these
scales rather than a sign the thresholds are too loose (the thresholds were deliberately set
generously — see caveat below).

## What this does and does not prove

**Proves:** no accidental O(n²) blowup in the hot paths tested, and the QC-16 point-reduction
mitigation genuinely helps at realistic freehand-stroke scale (a 10,000-point stroke, more than
any real hand-drawn annotation would ever produce, simplifies in ~30ms).

**Does NOT prove**, stated plainly:
- Real Firefox content-script performance, which has different characteristics than a bare
  Node process (DOM overhead, extension messaging overhead, real page contention for the main
  thread).
- Real CI hardware performance — this sandbox's timing is not representative of a CI runner or
  a user's actual device.
- SVG rendering/paint performance for a page with hundreds of visible shapes — the benchmarks
  here test the data-layer operations (storage, sorting, CRDT), not the DOM paint cost of the
  QC-4 SVG overlay actually rendering that many elements, which jsdom can't measure (same
  limitation flagged in QC-23).

## Recommendation before Phase 5 sign-off

Re-run equivalent benchmarks (or at least the sidebar/overlay-rendering ones) in an actual
Firefox profile with the extension loaded on a real page with a few hundred visible
annotations, using the browser's own performance profiler. If real-world numbers are
meaningfully worse than what's shown here, that's a signal the DOM/paint layer — not the data
layer benchmarked here — is the actual bottleneck, and worth a separate investigation.
