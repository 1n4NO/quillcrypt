'use strict';
const { VALID_TOOLS } = require('./toolbar');
const { KeyboardToolbarNav, generateAriaLabel } = require('./accessibility');

/**
 * Toolbar DOM view. Renders real DOM elements (createElement, not innerHTML
 * strings) so structural correctness is testable with jsdom and there's no
 * injection surface from annotation content ever ending up in a template
 * string. Wired to ToolbarState (QC-20) and KeyboardToolbarNav (QC-62) —
 * both already built and tested; this file is the rendering layer on top.
 *
 * VISUAL NOTE: CSS lives in toolbar.css alongside this file. Icon paths
 * below intentionally echo the brand mark's stroke style (2px, rounded
 * caps/joins, currentColor) from logo/quillcrypt-mark.svg, so the toolbar
 * reads as the same visual object as the brand rather than a generic
 * icon-font toolbar.
 *
 * WHAT THIS DOES NOT VERIFY (same honesty as QC-23/QC-62): real visual
 * appearance, real click/touch behavior in an actual browser, or whether
 * the CSS actually looks good — jsdom has no layout or paint engine.
 * Needs manual browser QA same as the rest of the overlay work.
 */

const TOOL_ICONS = {
  highlight: 'M4 15 L14 5 L18 9 L8 19 Z M4 15 L4 19 L8 19',
  underline: 'M6 5 L6 13 A6 6 0 0 0 18 13 L18 5 M4 19 L20 19',
  draw: 'M4 18 Q8 6 12 12 T20 6',
  arrow: 'M4 16 L16 4 M16 4 L9 4 M16 4 L16 11',
  rect: 'M4 5 h16 v14 h-16 Z',
  ellipse: 'M12 4 a8 6 0 1 0 0.01 0 Z',
  note: 'M5 4 h14 v12 h-6 l-4 4 v-4 h-4 Z',
};

const TOOL_LABELS = {
  highlight: 'Highlight',
  underline: 'Underline',
  draw: 'Draw',
  arrow: 'Arrow',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  note: 'Note',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function createIcon(doc, tool) {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', TOOL_ICONS[tool]);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  return svg;
}

/**
 * Mount a toolbar into `container`, wired to `toolbarState`.
 * Returns a dispose() function that unsubscribes and clears the DOM.
 */
function mountToolbar(container, toolbarState, { onSidebarToggle, onSettingsToggle } = {}) {
  const doc = container.ownerDocument;
  const nav = new KeyboardToolbarNav(toolbarState);

  const root = doc.createElement('div');
  root.className = 'qc-toolbar';
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Annotation tools');
  root.setAttribute('aria-orientation', 'horizontal');

  const buttons = new Map();

  for (const tool of VALID_TOOLS) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'qc-toolbar-button';
    button.dataset.tool = tool;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', TOOL_LABELS[tool]);
    button.title = TOOL_LABELS[tool];
    button.appendChild(createIcon(doc, tool));

    button.addEventListener('click', () => {
      const current = toolbarState.getState().activeTool;
      toolbarState.setTool(current === tool ? null : tool); // click active tool again to deselect
    });

    buttons.set(tool, button);
    root.appendChild(button);
  }

  // Color swatch
  const colorInput = doc.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'qc-toolbar-color';
  colorInput.setAttribute('aria-label', 'Annotation color');
  colorInput.value = toolbarState.getState().color;
  colorInput.addEventListener('input', () => toolbarState.setColor(colorInput.value));
  root.appendChild(colorInput);

  // Stroke width
  const strokeInput = doc.createElement('input');
  strokeInput.type = 'range';
  strokeInput.min = '1';
  strokeInput.max = '20';
  strokeInput.className = 'qc-toolbar-stroke';
  strokeInput.setAttribute('aria-label', 'Stroke width');
  strokeInput.value = String(toolbarState.getState().strokeWidth);
  strokeInput.addEventListener('input', () => toolbarState.setStrokeWidth(Number(strokeInput.value)));
  root.appendChild(strokeInput);

  const sidebarButton = doc.createElement('button');
  sidebarButton.type = 'button';
  sidebarButton.className = 'qc-toolbar-sidebar-button';
  sidebarButton.setAttribute('aria-label', 'Show annotations');
  sidebarButton.title = 'Show annotations';
  sidebarButton.textContent = 'List';
  sidebarButton.addEventListener('click', () => onSidebarToggle?.());
  root.appendChild(sidebarButton);

  const settingsButton = doc.createElement('button');
  settingsButton.type = 'button';
  settingsButton.className = 'qc-toolbar-sidebar-button';
  settingsButton.setAttribute('aria-label', 'Open settings');
  settingsButton.title = 'Open settings and invite teammates';
  settingsButton.textContent = '⚙';
  settingsButton.addEventListener('click', () => onSettingsToggle?.());
  root.appendChild(settingsButton);

  function syncButtonStates(state) {
    for (const [tool, button] of buttons.entries()) {
      const isActive = state.activeTool === tool;
      button.classList.toggle('qc-toolbar-button-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    }
  }
  syncButtonStates(toolbarState.getState());
  const unsubscribe = toolbarState.subscribe(syncButtonStates);

  function handleKeydown(event) {
    const keyActions = {
      ArrowRight: () => nav.next(),
      ArrowDown: () => nav.next(),
      ArrowLeft: () => nav.previous(),
      ArrowUp: () => nav.previous(),
      Home: () => nav.first(),
      End: () => nav.last(),
      Escape: () => nav.escape(),
    };
    const action = keyActions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  }
  root.addEventListener('keydown', handleKeydown);

  container.appendChild(root);

  return function dispose() {
    unsubscribe();
    root.removeEventListener('keydown', handleKeydown);
    root.remove();
  };
}

module.exports = { mountToolbar, TOOL_ICONS, TOOL_LABELS };
