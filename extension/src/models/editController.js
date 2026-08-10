'use strict';

/**
 * Edit/delete controller for existing annotations (QC-22).
 *
 * This deliberately does NOT reuse QC-21's UndoStack (src/ui/undoRedo.js),
 * because that stack's do()/undo() are synchronous by design (correct for
 * the common case of undoing local Yjs operations). Store operations here
 * are async — awaiting inside a synchronous command API would silently
 * break the ordering guarantees QC-21's own tests depend on. So this
 * controller keeps its own small, async-first history instead of forcing
 * one abstraction to cover both cases.
 */
class AnnotationEditController {
  constructor(store) {
    this.store = store;
    this._history = []; // { type: 'edit'|'delete', url, id, before, after? }
    this._redoHistory = [];
  }

  async edit(url, id, patch) {
    const all = await this.store.getAnnotationsForUrl(url);
    const before = all.find((a) => a.id === id);
    if (!before) throw new Error(`Annotation ${id} not found for ${url}`);

    const after = await this.store.updateAnnotation(url, id, patch);
    this._history.push({ type: 'edit', url, id, before, after });
    this._redoHistory = [];
    return after;
  }

  async delete(url, id) {
    const all = await this.store.getAnnotationsForUrl(url);
    const record = all.find((a) => a.id === id);
    if (!record) throw new Error(`Annotation ${id} not found for ${url}`);

    await this.store.deleteAnnotation(url, id);
    this._history.push({ type: 'delete', url, id, before: record });
    this._redoHistory = [];
  }

  async undo() {
    const entry = this._history.pop();
    if (!entry) return false;

    if (entry.type === 'edit') {
      const { updatedAt, ...revertFields } = entry.before;
      await this.store.updateAnnotation(entry.url, entry.id, revertFields);
    } else if (entry.type === 'delete') {
      await this.store.addAnnotation(entry.url, entry.before);
    }
    this._redoHistory.push(entry);
    return true;
  }

  async redo() {
    const entry = this._redoHistory.pop();
    if (!entry) return false;

    if (entry.type === 'edit') {
      await this.store.updateAnnotation(entry.url, entry.id, entry.after);
    } else if (entry.type === 'delete') {
      await this.store.deleteAnnotation(entry.url, entry.id);
    }
    this._history.push(entry);
    return true;
  }

  canUndo() {
    return this._history.length > 0;
  }
  canRedo() {
    return this._redoHistory.length > 0;
  }
}

module.exports = { AnnotationEditController };
