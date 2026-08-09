'use strict';

/**
 * Text anchoring: quote + position + context.
 *
 * An anchor describes where a selection was made, using three signals so it
 * can survive DOM changes:
 *   - exact:    the selected text itself
 *   - prefix/suffix: a small window of context text around the selection,
 *               used to disambiguate when `exact` occurs more than once
 *   - position: the character offset within the container's textContent at
 *               anchor time — a fast path when nothing has changed
 *
 * Locating an anchor later tries, in order:
 *   1. Position fast path (unchanged page)
 *   2. Exact-quote search, disambiguated by prefix/suffix context
 *   3. Failure (returns null) — the caller decides how to surface this
 *
 * Spike results: docs/spikes/QC-1-anchoring.md
 */

const CONTEXT_LEN = 32;

function walkTextNodes(root) {
  const nodes = [];
  let offset = 0;
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* SHOW_TEXT */);
  let node;
  // eslint-disable-next-line no-cond-assign
  while ((node = walker.nextNode())) {
    const len = node.textContent.length;
    nodes.push({ node, start: offset, end: offset + len });
    offset += len;
  }
  return nodes;
}

function fullText(root) {
  return walkTextNodes(root)
    .map((n) => n.node.textContent)
    .join('');
}

function offsetToPosition(textNodes, offset) {
  for (const entry of textNodes) {
    if (offset >= entry.start && offset <= entry.end) {
      return { node: entry.node, localOffset: offset - entry.start };
    }
  }
  return null;
}

/** Build an anchor from a plain {start, end} offset pair into root's textContent. */
function anchorFromOffsets(root, start, end) {
  const text = fullText(root);
  return {
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT_LEN), start),
    suffix: text.slice(end, end + CONTEXT_LEN),
    position: { start, end },
  };
}

/** Score how well a candidate match's surrounding text matches the anchor's context. */
function contextScore(text, candidateStart, candidateEnd, anchor) {
  const actualPrefix = text.slice(Math.max(0, candidateStart - CONTEXT_LEN), candidateStart);
  const actualSuffix = text.slice(candidateEnd, candidateEnd + CONTEXT_LEN);

  let score = 0;
  // Count matching characters working backward from the boundary (closer = more weight)
  for (let i = 1; i <= Math.min(actualPrefix.length, anchor.prefix.length); i++) {
    if (actualPrefix[actualPrefix.length - i] === anchor.prefix[anchor.prefix.length - i]) score++;
    else break;
  }
  for (let i = 0; i < Math.min(actualSuffix.length, anchor.suffix.length); i++) {
    if (actualSuffix[i] === anchor.suffix[i]) score++;
    else break;
  }
  return score;
}

/**
 * Attempt to relocate an anchor in root's current DOM.
 * Returns { start, end, startPos, endPos }, or null on failure.
 */
function locate(root, anchor) {
  const text = fullText(root);
  const textNodes = walkTextNodes(root);

  // 1. Position fast path
  const { start, end } = anchor.position;
  if (text.slice(start, end) === anchor.exact) {
    return buildResult(textNodes, start, end);
  }

  // 2. Quote search, disambiguated by context
  if (!anchor.exact) return null;
  const candidates = [];
  let idx = text.indexOf(anchor.exact);
  while (idx !== -1) {
    candidates.push(idx);
    idx = text.indexOf(anchor.exact, idx + 1);
  }
  if (candidates.length === 0) {
    return null; // text truly gone — failure case
  }

  let best = null;
  let bestScore = -1;
  for (const candidateStart of candidates) {
    const candidateEnd = candidateStart + anchor.exact.length;
    const score = contextScore(text, candidateStart, candidateEnd, anchor);
    if (score > bestScore) {
      bestScore = score;
      best = candidateStart;
    }
  }

  return buildResult(textNodes, best, best + anchor.exact.length);
}

function buildResult(textNodes, start, end) {
  const startPos = offsetToPosition(textNodes, start);
  const endPos = offsetToPosition(textNodes, end);
  if (!startPos || !endPos) return null;
  return { start, end, startPos, endPos };
}

module.exports = { anchorFromOffsets, locate, fullText };
