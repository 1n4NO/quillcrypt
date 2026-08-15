'use strict';
const { JSDOM } = require('jsdom');
const { ToolbarState, VALID_TOOLS } = require('../src/ui/toolbar');
const { mountToolbar } = require('../src/ui/toolbarView');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

const dom = new JSDOM('<body><div id="container"></div></body>');
const document = dom.window.document;
const container = document.getElementById('container');

const toolbarState = new ToolbarState();
const dispose = mountToolbar(container, toolbarState);

const toolbarRoot = container.querySelector('.qc-toolbar');
check('toolbar root is mounted into the container', toolbarRoot !== null);
check('toolbar has role="toolbar" for accessibility', toolbarRoot.getAttribute('role') === 'toolbar');

const buttons = container.querySelectorAll('.qc-toolbar-button');
check('one button rendered per valid tool', buttons.length === VALID_TOOLS.length);

const highlightButton = container.querySelector('[data-tool="highlight"]');
check('highlight button exists with correct aria-label', highlightButton.getAttribute('aria-label') === 'Highlight');
check('no button is active initially', container.querySelectorAll('.qc-toolbar-button-active').length === 0);

highlightButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
check('clicking a tool button updates the underlying ToolbarState', toolbarState.getState().activeTool === 'highlight');
check('clicking a tool button adds the active class to that button', highlightButton.classList.contains('qc-toolbar-button-active'));
check('aria-pressed is set to true on the active button', highlightButton.getAttribute('aria-pressed') === 'true');

const drawButton = container.querySelector('[data-tool="draw"]');
check('the previously-active button is NOT also marked active', !drawButton.classList.contains('qc-toolbar-button-active'));

drawButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
check('clicking a different tool switches the active state', toolbarState.getState().activeTool === 'draw');
check('the previously-active button is no longer marked active in the DOM', !highlightButton.classList.contains('qc-toolbar-button-active'));
check('the newly-clicked button is now marked active', drawButton.classList.contains('qc-toolbar-button-active'));

drawButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
check('clicking the currently-active tool again deselects it', toolbarState.getState().activeTool === null);
check('no button is marked active after deselecting', container.querySelectorAll('.qc-toolbar-button-active').length === 0);

toolbarState.setTool('arrow');
const arrowButton = container.querySelector('[data-tool="arrow"]');
check('a state change made externally (not via click) still updates the DOM', arrowButton.classList.contains('qc-toolbar-button-active'));

const colorInput = container.querySelector('.qc-toolbar-color');
colorInput.value = '#123abc';
colorInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
check('changing the color input updates ToolbarState', toolbarState.getState().color === '#123abc');

const strokeInput = container.querySelector('.qc-toolbar-stroke');
strokeInput.value = '7';
strokeInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
check('changing the stroke width input updates ToolbarState', toolbarState.getState().strokeWidth === 7);

toolbarState.setTool(null);
toolbarRoot.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
check('ArrowRight on the toolbar activates the first tool', toolbarState.getState().activeTool === VALID_TOOLS[0]);

toolbarRoot.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
check('Escape on the toolbar clears the active tool', toolbarState.getState().activeTool === null);

dispose();
check('dispose() removes the toolbar from the DOM', container.querySelector('.qc-toolbar') === null);

toolbarState.setTool('note');
check('after dispose(), the (now-removed) view does not error when state changes elsewhere', true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
