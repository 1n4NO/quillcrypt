'use strict';
const { injectOnce } = require('./readiness');
const { mountOverlay } = require('./overlayController');
const { AnnotationStore } = require('../storage/store');
const {
  WebExtensionStorageBackend,
  WebExtensionOnboardingBackend,
  WebExtensionWorkspaceRegistryBackend,
  WebExtensionConfigBackend,
} = require('../storage/webExtensionStorage');
const { KeyStore } = require('../crypto/keyStore');
const { WorkspaceRegistry, SettingsController } = require('../ui/settings');
const { mountSettings } = require('../ui/settingsView');
const { findWorkspacesForUrl } = require('../storage/workspace');
const { WorkspaceSession } = require('../sync/workspaceSession');
const { ToolbarState } = require('../ui/toolbar');
const { mountToolbar } = require('../ui/toolbarView');
const { mountSidebar } = require('../ui/sidebarView');
const { attachToolInteractions } = require('./toolInteractions');
const { renderAnnotation, removeAnnotationElement } = require('./annotationRenderer');
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
 * SCOPE NOTE: local annotation remains the safe fallback. When an unlocked
 * matching workspace and relay URL exist in extension storage, this same
 * composition upgrades the page to an encrypted WorkspaceSession.
 */
async function mount(doc, win, storageArea, options = {}) {
  const url = win.location.href;

  const { overlaySvg, noteLayer, dispose: disposeOverlay } = mountOverlay(doc, win);

  const store = new AnnotationStore(new WebExtensionStorageBackend('annotations', storageArea));
  const onboarding = new OnboardingState(new WebExtensionOnboardingBackend(storageArea));
  const editController = new AnnotationEditController(store);
  const toolbarState = new ToolbarState();

  const existing = await store.getAnnotationsForUrl(url);
  const failedToRender = [];
  const registry = new WorkspaceRegistry(new WebExtensionWorkspaceRegistryBackend(storageArea));
  const keyStore = new KeyStore(new WebExtensionStorageBackend('keys', storageArea));
  const configBackend = new WebExtensionConfigBackend(storageArea);
  const configuredRelayUrl = options.relayUrl || await configBackend.getRelayUrl();
  const settingsController = new SettingsController(keyStore, registry, {
    url,
    pageTitle: doc.title,
    getAnnotations: () => currentAnnotations,
    onWorkspaceAccepted: (acceptedWorkspace, acceptedKey) => activateWorkspace(acceptedWorkspace, acceptedKey),
    configBackend,
    relayUrl: configuredRelayUrl,
  });
  const workspaces = await registry.listWorkspaces();
  // Resolve the first matching unlocked workspace explicitly.
  let workspace = null;
  let workspaceKey = null;
  if (configuredRelayUrl) {
    for (const candidate of findWorkspacesForUrl(workspaces, url)) {
      const candidateKey = await keyStore.getWorkspaceKey(candidate.id);
      if (candidateKey) { workspace = candidate; workspaceKey = candidateKey; break; }
    }
  }

  let session = workspace && workspaceKey
    ? new WorkspaceSession(workspace, workspaceKey, configuredRelayUrl, options)
    : null;
  const rendered = new Map();
  let mirrorPromise = Promise.resolve();
  let sidebar = null;
  let currentAnnotations = existing.slice();
  let settingsDispose = null;
  let settingsOpening = null;

  function activateWorkspace(acceptedWorkspace, acceptedKey) {
    if (!configuredRelayUrl) return;
    session?.dispose();
    session = new WorkspaceSession(acceptedWorkspace, acceptedKey, configuredRelayUrl, options);
    for (const annotation of currentAnnotations) session.addAnnotation(annotation);
    session.onAnnotationsChange(renderCurrentAnnotations);
  }

  function renderCurrentAnnotations(annotations) {
    currentAnnotations = annotations.slice();
    const next = new Map(annotations.map((annotation) => [annotation.id, annotation]));
    for (const [id, previous] of rendered) {
      if (!next.has(id) || JSON.stringify(next.get(id)) !== JSON.stringify(previous)) {
        removeAnnotationElement(doc.body, overlaySvg, noteLayer, previous);
        rendered.delete(id);
      }
    }
    for (const annotation of annotations) {
      if (rendered.has(annotation.id)) continue;
      const ok = renderAnnotation(doc.body, overlaySvg, noteLayer, annotation);
      if (ok) rendered.set(annotation.id, annotation);
      else if (!failedToRender.includes(annotation.id)) failedToRender.push(annotation.id);
    }
    sidebar?.update(annotations);
    if (session) {
      // Yjs can deliver several updates in one turn. Keep the local mirror
      // ordered so a slower earlier write cannot overwrite a newer snapshot.
      mirrorPromise = mirrorPromise
        .then(() => mirrorAnnotationsToLocalStore(annotations))
        .catch(() => {});
    }
  }

  async function mirrorAnnotationsToLocalStore(annotations) {
    const local = await store.getAnnotationsForUrl(url);
    const localById = new Map(local.map((annotation) => [annotation.id, annotation]));
    const remoteIds = new Set(annotations.map((annotation) => annotation.id));
    for (const annotation of annotations) {
      const previous = localById.get(annotation.id);
      if (!previous) await store.addAnnotation(url, annotation);
      else if (JSON.stringify(previous) !== JSON.stringify(annotation)) {
        await store.updateAnnotation(url, annotation.id, annotation);
      }
    }
    for (const annotation of local) {
      if (!remoteIds.has(annotation.id)) await store.deleteAnnotation(url, annotation.id);
    }
  }

  if (session) {
    for (const annotation of existing) session.addAnnotation(annotation);
    session.onAnnotationsChange(renderCurrentAnnotations);
  } else {
    renderCurrentAnnotations(existing);
  }

  const toolbarHost = doc.createElement('div');
  toolbarHost.className = 'qc-toolbar-host';
  toolbarHost.style.position = 'fixed';
  toolbarHost.style.bottom = '24px';
  toolbarHost.style.left = '50%';
  toolbarHost.style.transform = 'translateX(-50%)';
  toolbarHost.style.zIndex = '2147483647';
  doc.body.appendChild(toolbarHost);
  const sidebarHost = doc.createElement('div');
  sidebarHost.className = 'qc-sidebar-host';
  const disposeSidebar = () => { sidebar?.dispose(); sidebar = null; };
  const disposeToolbar = mountToolbar(toolbarHost, toolbarState, {
    onSidebarToggle: () => {
      if (sidebar) disposeSidebar();
      else sidebar = mountSidebar(sidebarHost, currentAnnotations, { onClose: disposeSidebar });
    },
  });
  doc.body.appendChild(sidebarHost);

  const settingsHost = doc.createElement('div');
  settingsHost.className = 'qc-settings-host';
  settingsHost.style.position = 'fixed';
  settingsHost.style.top = '16px';
  settingsHost.style.left = '16px';
  settingsHost.style.zIndex = '2147483647';
  settingsHost.style.maxWidth = 'min(480px, calc(100vw - 32px))';
  settingsHost.style.maxHeight = 'calc(100vh - 32px)';
  settingsHost.style.overflow = 'auto';
  settingsHost.hidden = true;
  doc.body.appendChild(settingsHost);

  async function toggleSettings() {
    if (settingsDispose) {
      settingsDispose();
      settingsDispose = null;
      settingsHost.hidden = true;
      return;
    }
    if (!settingsOpening) {
      settingsHost.hidden = false;
      settingsOpening = mountSettings(settingsHost, settingsController)
        .then((dispose) => { settingsDispose = dispose; })
        .finally(() => { settingsOpening = null; });
    }
    await settingsOpening;
  }

  const runtime = options.runtime;
  const handleRuntimeMessage = runtime?.onMessage?.addListener
    ? (message) => message?.type === 'QC_OPEN_SETTINGS' ? toggleSettings().then(() => ({ ok: true })) : undefined
    : null;
  if (handleRuntimeMessage) runtime.onMessage.addListener(handleRuntimeMessage);

  await onboarding.markStepComplete('install');

  const disposeInteractions = attachToolInteractions({
    doc,
    root: doc.body,
    overlaySvg,
    noteLayer,
    toolbarState,
    store,
    url,
    render: !session,
    onAnnotationCreated: (record) => {
      onboarding.markStepComplete('first-annotation');
      if (!session) {
        currentAnnotations = [...currentAnnotations, record];
        sidebar?.update(currentAnnotations);
      }
      session?.addAnnotation(record);
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
      disposeSidebar();
      settingsDispose?.();
      settingsDispose = null;
      disposeInteractions();
      disposeOnboarding();
      session?.dispose();
      toolbarHost.remove();
      onboardingHost.remove();
      sidebarHost.remove();
      settingsHost.remove();
      if (handleRuntimeMessage) runtime.onMessage.removeListener?.(handleRuntimeMessage);
      doc.removeEventListener('keydown', handleKeydown);
    },
  };
}

/** Real content-script entry point: guards against double-injection, then mounts. */
function start(doc, win, storageArea) {
  injectOnce(doc, () => {
    mount(doc, win, storageArea, { runtime: browserApi.runtime });
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
