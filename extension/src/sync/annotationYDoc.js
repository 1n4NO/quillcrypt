'use strict';
const Y = require('yjs');

/**
 * Yjs document model for annotations.
 *
 * Structure: a root Y.Map('annotations') keyed by annotation id, where each
 * value is itself a Y.Map holding that annotation's fields. Using a nested
 * Y.Map per annotation (rather than one plain JS object per key) means
 * field-level updates from different clients merge independently — editing
 * `content` on one client and `style.color` on another, concurrently,
 * merges both changes rather than one clobbering the other.
 *
 * Fields are stored as plain values (not nested CRDTs) within each
 * annotation's Y.Map. That's a deliberate choice: annotation edits are
 * whole-field replacements (you retype a note, you don't co-edit it
 * character-by-character like a shared text document), so plain
 * last-writer-wins per field is the right granularity — full Y.Text
 * character-level merging would be over-engineering for this use case.
 */
class AnnotationYDoc {
  constructor(ydoc = new Y.Doc()) {
    this.ydoc = ydoc;
    this.yAnnotations = ydoc.getMap('annotations');
  }

  addAnnotation(record) {
    this.ydoc.transact(() => {
      const yMap = new Y.Map();
      for (const [key, value] of Object.entries(record)) {
        yMap.set(key, value);
      }
      this.yAnnotations.set(record.id, yMap);
    });
  }

  updateAnnotation(id, patch) {
    const yMap = this.yAnnotations.get(id);
    if (!yMap) throw new Error(`Annotation ${id} not found`);
    this.ydoc.transact(() => {
      for (const [key, value] of Object.entries(patch)) {
        yMap.set(key, value);
      }
    });
  }

  deleteAnnotation(id) {
    this.ydoc.transact(() => {
      this.yAnnotations.delete(id);
    });
  }

  getAnnotation(id) {
    const yMap = this.yAnnotations.get(id);
    return yMap ? yMap.toJSON() : null;
  }

  getAllAnnotations() {
    const result = [];
    this.yAnnotations.forEach((yMap) => result.push(yMap.toJSON()));
    return result;
  }

  /** Subscribe to any change anywhere in the annotation tree (add/edit/delete, local or remote). */
  observe(callback) {
    const handler = () => callback(this.getAllAnnotations());
    this.yAnnotations.observeDeep(handler);
    return () => this.yAnnotations.unobserveDeep(handler);
  }
}

module.exports = { AnnotationYDoc };
