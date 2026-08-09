# QC-1 — Spike: text anchoring across reflow

**Status: done.** Implementation lives at `extension/src/content/anchoring/anchoring.js`,
tests at `extension/test/anchoring.test.js`. Run with `node test/anchoring.test.js` from
`extension/` (needs `jsdom` — see setup below).

## Approach

Ported Hypothesis's quote + position + context strategy:

- **exact** — the selected text itself
- **prefix/suffix** — ~32 characters of context on either side, used to disambiguate
  duplicate quotes
- **position** — character offset in the container's `textContent` at anchor time, used as a
  fast path when nothing has changed

`locate()` tries the position fast path first, falls back to an exact-quote search scored by
how well each candidate's surrounding text matches the stored prefix/suffix, and returns
`null` if it can't find anything — callers decide how to surface that (e.g. a "this annotation
couldn't be placed" indicator rather than crashing).

## Results against acceptance criteria

| AC | Result |
|---|---|
| Anchor survives a reordered paragraph and a changed word nearby | **Pass** — tested by swapping two paragraphs and changing a word adjacent to (but not inside) the anchored phrase |
| Documented failure modes | **Documented below** |

Test run (5/5 passing):

```
PASS — anchor captured correct exact text
PASS — anchor re-located after paragraph reorder + nearby word change
PASS — re-located text still matches the original quote
PASS — locate() returns null when the anchored text is fully removed (documented failure mode)
PASS — ambiguous duplicate quote resolved to the contextually-correct occurrence
```

## Documented failure modes

1. **Text fully removed.** If the exact quoted text no longer exists anywhere on the page,
   `locate()` returns `null`. There's no recovery here by design — surface this to the user
   as "this annotation's text is no longer on the page" rather than guessing.
2. **Quote *and* surrounding context both change.** If a heavily-reflowed SPA re-renders the
   same semantic content with different wording throughout (not just nearby), context scoring
   degrades gracefully but isn't guaranteed to pick the right occurrence — it picks the
   *best-scoring* one, not necessarily the *correct* one, when the real match's context has
   also drifted significantly.
3. **Very short exact quotes** (a few characters) are inherently ambiguous — many candidates,
   low signal from context scoring. Worth adding a minimum-length guard or falling back to
   requiring a minimum context-match score before Phase 1 ships.
4. **Not yet tested:** content added/removed via lazy-loading or infinite scroll *before* the
   anchor point, which shifts everything downstream. Position fast path will miss; quote
   search should still work but hasn't been exercised specifically. Worth a follow-up test
   before Phase 1 exit.

## Setup to run the test

```bash
cd extension
npm install --save-dev jsdom
node test/anchoring.test.js
```

(`jsdom` is a test-only dependency — not shipped in the extension bundle. Add it to
`devDependencies` in `package.json` when wiring up a real test runner in Phase 1.)
