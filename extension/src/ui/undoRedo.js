'use strict';

/**
 * Undo/redo stack using the command pattern, so it can wrap any
 * synchronous action (e.g. local Yjs document operations) without this
 * module knowing anything about annotations specifically. A command is
 * `{ do, undo }` — two no-argument functions that perform/reverse one
 * discrete action.
 *
 * NOTE: this stack assumes synchronous commands. Editing/deleting
 * *persisted* annotations (async store operations) uses a separate
 * controller — see QC-22 (`src/models/editController.js`) — rather than
 * forcing async into this API and risking the ordering guarantees below.
 *
 * Standard semantics: executing a new command clears the redo stack. History
 * is bounded so it can't grow unbounded over a long annotation session.
 */
class UndoStack {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this._undoStack = [];
    this._redoStack = [];
  }

  /** Run a command's `do()` immediately and push it onto the undo history. */
  execute(command) {
    command.do();
    this._undoStack.push(command);
    if (this._undoStack.length > this.maxSize) {
      this._undoStack.shift();
    }
    this._redoStack = [];
  }

  undo() {
    const command = this._undoStack.pop();
    if (!command) return false;
    command.undo();
    this._redoStack.push(command);
    return true;
  }

  redo() {
    const command = this._redoStack.pop();
    if (!command) return false;
    command.do();
    this._undoStack.push(command);
    return true;
  }

  canUndo() {
    return this._undoStack.length > 0;
  }

  canRedo() {
    return this._redoStack.length > 0;
  }
}

module.exports = { UndoStack };
