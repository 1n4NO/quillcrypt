'use strict';

/**
 * Annotation sidebar panel (QC-25). Builds the list of items the sidebar
 * renders: sorted into roughly "reading order" and with a short excerpt per
 * annotation so the list is scannable without opening each one.
 *
 * KNOWN LIMITATION: text-anchored annotations (highlight/underline/note) sort
 * by their character offset in the page, which is a genuine reading-order
 * proxy. Shape-only annotations (draw/arrow/rect/ellipse) have no text
 * anchor to sort by, so they fall back to creation-time order and are
 * listed after all text-anchored items — NOT interleaved by their actual
 * vertical position on the page. Getting that right would need comparing
 * pixel position against character-offset position on a shared scale,
 * which isn't attempted here. Worth a follow-up ticket if user feedback
 * says the ordering feels wrong once this ships.
 */

const EXCERPT_MAX_LENGTH = 60;

const SHAPE_TYPE_LABELS = {
  draw: 'Freehand drawing',
  arrow: 'Arrow',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
};

function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + '…';
}

function excerptFor(annotation) {
  if (annotation.type === 'note') {
    return truncate(annotation.content || '(empty note)', EXCERPT_MAX_LENGTH);
  }
  if (annotation.anchor) {
    return truncate(annotation.anchor.exact, EXCERPT_MAX_LENGTH);
  }
  return SHAPE_TYPE_LABELS[annotation.type] || annotation.type;
}

function buildSidebarItems(annotations) {
  const anchored = annotations.filter((a) => a.anchor);
  const unanchored = annotations.filter((a) => !a.anchor);

  anchored.sort((a, b) => a.anchor.position.start - b.anchor.position.start);
  unanchored.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return [...anchored, ...unanchored].map((a) => ({
    id: a.id,
    type: a.type,
    excerpt: excerptFor(a),
    createdAt: a.createdAt,
  }));
}

function filterSidebarItems(items, query) {
  if (!query) return items;
  const lowerQuery = query.toLowerCase();
  return items.filter((item) => item.excerpt.toLowerCase().includes(lowerQuery));
}

module.exports = { buildSidebarItems, filterSidebarItems, excerptFor, EXCERPT_MAX_LENGTH };
