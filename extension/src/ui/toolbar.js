'use strict';

/**
 * Toolbar state. This is the state machine behind the toolbar UI — which
 * tool is active (highlight/underline/draw/arrow/rect/ellipse/note, or none
 * for plain selection mode), plus the current color and stroke width new
 * annotations should use. The actual toolbar DOM rendering subscribes to
 * this and re-renders on change; that rendering isn't meaningfully unit
 * testable, but this state machine is, and it's where the actual bugs
 * (wrong tool staying active, invalid color/width sneaking through) live.
 */

const VALID_TOOLS = ['highlight', 'underline', 'draw', 'arrow', 'rect', 'ellipse', 'note'];
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const MIN_STROKE_WIDTH = 1;
const MAX_STROKE_WIDTH = 20;

class ToolbarState {
  constructor() {
    this._state = { activeTool: null, color: '#F5C542', strokeWidth: 2 };
    this._listeners = new Set();
  }

  getState() {
    return { ...this._state };
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _emit() {
    const snapshot = this.getState();
    this._listeners.forEach((listener) => listener(snapshot));
  }

  /** Set the active tool. Pass null to return to plain selection mode (no tool). */
  setTool(tool) {
    if (tool !== null && !VALID_TOOLS.includes(tool)) {
      throw new Error(`Unknown tool: ${tool}`);
    }
    this._state.activeTool = tool;
    this._emit();
  }

  setColor(color) {
    if (!HEX_COLOR_RE.test(color)) {
      throw new Error(`Invalid color: ${color} (expected 6-digit hex, e.g. #F5C542)`);
    }
    this._state.color = color;
    this._emit();
  }

  setStrokeWidth(width) {
    if (typeof width !== 'number' || width < MIN_STROKE_WIDTH || width > MAX_STROKE_WIDTH) {
      throw new Error(`Invalid stroke width: ${width} (expected ${MIN_STROKE_WIDTH}-${MAX_STROKE_WIDTH})`);
    }
    this._state.strokeWidth = width;
    this._emit();
  }
}

module.exports = { ToolbarState, VALID_TOOLS };
