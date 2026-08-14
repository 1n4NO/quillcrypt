'use strict';
const { VALID_TOOLS } = require('./toolbar');

/**
 * Accessibility pass (QC-62).
 *
 * Two genuinely testable pieces:
 *  - Keyboard navigation state machine for cycling through toolbar tools
 *    (arrow keys, Home/End, Escape)
 *  - ARIA label generation for annotations, so a screen reader announces
 *    something meaningful when a user navigates to one in the sidebar
 *
 * WHAT THIS DOES NOT VERIFY, stated plainly (same honesty as QC-23's
 * overlay-sizing caveat): whether a real screen reader actually announces
 * these labels correctly, whether focus order in the real rendered DOM
 * matches this logical model, or whether color contrast/visual indicators
 * meet WCAG requirements. Those need manual testing with an actual screen
 * reader (VoiceOver/NVDA/JAWS) and a real rendered extension — nothing
 * here can substitute for that.
 */

/** Cycles through VALID_TOOLS via keyboard; wraps at both ends. */
class KeyboardToolbarNav {
  constructor(toolbarState) {
    this.toolbarState = toolbarState;
  }

  _currentIndex() {
    const current = this.toolbarState.getState().activeTool;
    return current ? VALID_TOOLS.indexOf(current) : -1;
  }

  next() {
    const idx = this._currentIndex();
    const nextIdx = (idx + 1) % VALID_TOOLS.length;
    this.toolbarState.setTool(VALID_TOOLS[nextIdx]);
  }

  previous() {
    const idx = this._currentIndex();
    const prevIdx = idx <= 0 ? VALID_TOOLS.length - 1 : idx - 1;
    this.toolbarState.setTool(VALID_TOOLS[prevIdx]);
  }

  first() {
    this.toolbarState.setTool(VALID_TOOLS[0]);
  }

  last() {
    this.toolbarState.setTool(VALID_TOOLS[VALID_TOOLS.length - 1]);
  }

  /** Escape returns to plain selection mode (no tool active). */
  escape() {
    this.toolbarState.setTool(null);
  }
}

const TYPE_ANNOUNCEMENTS = {
  highlight: 'Highlight',
  underline: 'Underline',
  note: 'Note',
  draw: 'Drawing',
  arrow: 'Arrow',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
};

/** Generates a screen-reader-friendly label for one annotation. */
function generateAriaLabel(annotation, { authorName } = {}) {
  const typeLabel = TYPE_ANNOUNCEMENTS[annotation.type] || annotation.type;
  const byline = authorName ? ` by ${authorName}` : '';

  if (annotation.type === 'note' && annotation.content) {
    return `${typeLabel}${byline}: ${annotation.content}`;
  }
  if (annotation.anchor?.exact) {
    return `${typeLabel}${byline} on text: ${annotation.anchor.exact}`;
  }
  return `${typeLabel}${byline}`;
}

module.exports = { KeyboardToolbarNav, generateAriaLabel };
