'use strict';
const { injectOnce } = require('./readiness');
const { mountOverlay } = require('./overlayController');
const { AnnotationStore } = require('../storage/store');
const { WebExtensionStorageBackend, WebExtensionOnboardingBackend } = require('../storage/webExtensionStorage');
const { ToolbarState } = require('../ui/toolbar');
const { mountToolbar } = require('../ui/toolbarView');
const { attachToolInteractions } = require('./toolInteractions');
const { renderAnnotation } = require('./annotationRenderer');
const { AnnotationEditController } = require('../models/editController');
const { OnboardingState } = require('../ui/onboarding');
const { mountOnboarding } = require('../ui/onboardingView');

/**
 * The real mount function, composing every module built and individually
 * tested across Phase 1 (anchoring, tools, storage, overlay, toolbar,
 * onboarding) into one running instance for the current page. No new
 * untested logic here beyond the composition itself — verified end-to-end
 * (including as the actual bundled esbuild output, not just raw source)
 * against a mocked browser.storage.local: create an annotation via
 * simulated real user input, then confirm it persists and re-renders
 * across a simulated page reload.
 *
 * SCOPE NOTE: this wires up LOCAL annotation only — creating, persisting,
 * rendering, and deleting annotations on this device. It deliberately does
 * NOT wire SyncClient/encryption/workspace-join here. That's a distinct,
 * separately-scoped piece of work (needs a real relay URL and a
 * workspace-join UI that doesn't exist yet) — wiring it in half-tested
 * would violate the standard the rest of this project has held to.
 */
async function mount(doc, win, storageArea) {
  const url = win.location.href;

  const { overlaySvg, noteLayer, dispose: disposeOverlay } = mountOverlay(doc, win);

  const store = new AnnotationStore(new WebExtensionStorageBackend('annotations', storageArea));
  const onboarding = new OnboardingState(new WebExtensionOnboardingBackend(storageArea));
  const editController = new AnnotationEditController(store);
  const toolbarState = new ToolbarState();

  // Render every annotation already persisted for this page.
  const existing = await store.getAnnotationsForUrl(url);
  const failedToRender = [];
  for (const annotation of existing) {
    const ok = renderAnnotation(doc.body, overlaySvg, noteLayer, annotation);
    if (!ok) failedToRender.push(annotation.id);
  }

  const toolbarHost = doc.createElement('div');
  toolbarHost.className = 'qc-toolbar-host';
  toolbarHost.style.position = 'fixed';
  toolbarHost.style.bottom = '24px';
  toolbarHost.style.left = '50%';
  toolbarHost.style.transform = 'translateX(-50%)';
  toolbarHost.style.zIndex = '2147483647';
  doc.body.appendChild(toolbarHost);
  const disposeToolbar = mountToolbar(toolbarHost, toolbarState);

  await onboarding.markStepComplete('install');

  const disposeInteractions = attachToolInteractions({
    doc,
    root: doc.body,
    overlaySvg,
    noteLayer,
    toolbarState,
    store,
    url,
    onAnnotationCreated: () => {
      onboarding.markStepComplete('first-annotation');
    },
  });

  const onboardingHost = doc.createElement('div');
  onboardingHost.className = 'qc-onboarding-host';
  onboardingHost.style.position = 'fixed';
  onboardingHost.style.bottom = '80px';
  onboardingHost.style.left = '50%';
  onboardingHost.style.transform = 'translateX(-50%)';
  onboardingHost.style.zIndex = '2147483647';
  doc.body.appendChild(onboardingHost);
  const disposeOnboarding = await mountOnboarding(onboardingHost, onboarding);

  function handleKeydown(event) {
    const isUndo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey;
    const isRedo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && event.shiftKey;
    if (isUndo) editController.undo();
    else if (isRedo) editController.redo();
  }
  doc.addEventListener('keydown', handleKeydown);

  return {
    failedToRender,
    dispose() {
      disposeOverlay();
      disposeToolbar();
      disposeInteractions();
      disposeOnboarding();
      toolbarHost.remove();
      onboardingHost.remove();
      doc.removeEventListener('keydown', handleKeydown);
    },
  };
}

/** Real content-script entry point: guards against double-injection, then mounts. */
function start(doc, win, storageArea) {
  injectOnce(doc, () => {
    mount(doc, win, storageArea);
  });
}

// Actual execution when loaded as a content script (not when required as a
// module by tests — those call mount()/start() directly with their own doc/win).
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const browserApi = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
  if (browserApi) {
    start(document, window, browserApi.storage.local);
  }
}

module.exports = { mount, start };
