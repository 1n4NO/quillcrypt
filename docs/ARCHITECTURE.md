# Architecture decisions

## QC-4 — SVG overlay vs. canvas for the draw/shape layer

**Decision: SVG overlay.**

### The comparison

| Concern | SVG | Canvas |
|---|---|---|
| Hit-testing (click/select an existing shape) | Native — the browser does it via normal DOM event targeting and `pointer-events` | Manual — must implement point-in-shape math for every tool (rect, freehand path, arrow) |
| Per-annotation addressability | Each annotation is a real DOM node — trivial to select, restyle, delete, or highlight-on-hover individually | Everything is pixels in one bitmap by default; per-shape editing requires maintaining a separate shadow model anyway |
| Mapping to the CRDT sync layer (QC-30, Yjs) | Natural 1:1 — one annotation = one entry in a Yjs shared array/map = one SVG element, so sync and rendering stay in lockstep | Requires a separate authoritative shape list *plus* a full-canvas redraw pipeline driven off it — more moving parts, more chances for sync/render to drift apart |
| Reposition on scroll/resize (QC-23) | Position via CSS/transform on individual elements, or a single transform on the SVG root — cheap | Must redraw the entire canvas from the shape list on every scroll/resize frame — more redraw work as annotation count grows |
| Accessibility | Elements can carry ARIA roles/labels individually | Canvas content is invisible to assistive tech unless you separately maintain an accessible DOM fallback |
| Styling changes (color, stroke width) | Plain CSS/attribute changes on the affected element | Requires redrawing the affected shape (or the whole canvas) |
| Raw rendering performance at very high shape counts (1000s+) | Degrades — many DOM nodes gets expensive | Wins clearly — a single bitmap doesn't care how many strokes are baked into it |
| Freehand drawing smoothness while actively dragging | Fine at normal stroke complexity; very long, highly-detailed strokes can get expensive to keep as literal path data | Naturally efficient — drawing is just pixels, no per-point DOM cost |

### Why SVG wins for this product

The deciding factors are the ones this product actually needs, not raw rendering ceiling:

1. **Every annotation must be individually selectable, editable, and deletable** (QC-22) — SVG
   gives this for free; canvas requires building it anyway.
2. **Every annotation is a CRDT entry that has to sync in real time** (Phase 2) — SVG's 1:1
   element-per-annotation model matches Yjs's data model directly, so there's one source of
   truth instead of two that have to be kept in sync.
3. **Expected shape counts are modest.** This is a webpage annotation tool, not a digital
   painting app — realistic pages will have tens to low hundreds of annotations, not thousands
   of freehand strokes. Canvas's raw-performance advantage matters most exactly where this
   product doesn't need it.
4. **Accessibility is nearly free with SVG** and would be substantial extra work to bolt onto
   canvas.

### Where this could bite us later

- If freehand drawing produces very long, highly detailed paths (many points), SVG path data
  can get large and slow to manipulate. Mitigation: simplify/smooth captured points before
  committing the path (e.g. Douglas-Peucker point reduction) rather than storing every raw
  pointer-move sample.
- If a future use case genuinely needs thousands of annotations rendered at once (unlikely for
  this product, but worth naming), canvas or a hybrid (canvas for rendering, a parallel DOM/SVG
  layer only for currently-selected/interactive elements) would need revisiting.

### Ticket status

- **QC-4 — Done.** No prototype code needed per this ticket's own AC (decision + rationale
  only) — implementation of the SVG overlay itself happens in QC-16 (freehand draw), QC-17
  (arrow), QC-18 (shapes), and QC-23 (positioning), all now unblocked by this decision.
