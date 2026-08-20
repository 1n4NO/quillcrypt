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
const { createAnnotation } = require('../models/annotation');
const { OnboardingState } = require('../ui/onboarding');
const { mountOnboarding } = require('../ui/onboardingView');
const { mountRetryObserver } = require('./retryObserver');
const { mountWorkspaceStatus } = require('../ui/workspaceStatusView');
const { mountAnnotationTooltip } = require('./annotationTooltip');
const { locateAsRange } = require('./anchoring/rangeAnchoring');
const { normalizeUrl } = require('../storage/store');

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
  const disposeAnnotationTooltip = mountAnnotationTooltip(doc);

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
  const configuredRelayAuthToken = options.relayAuthToken || await configBackend.getRelayAuthToken();
  let workspaceStatus = null;
  const settingsController = new SettingsController(keyStore, registry, {
    url,
    pageTitle: doc.title,
    getAnnotations: () => currentAnnotations,
    onWorkspaceAccepted: (acceptedWorkspace, acceptedKey) => activateWorkspace(acceptedWorkspace, acceptedKey),
    onWorkspaceCreated: (createdWorkspace, createdKey) => activateWorkspace(createdWorkspace, createdKey),
    onWorkspaceScopeChanged: (updatedWorkspace, updatedKey) => updatedKey && activateWorkspace(updatedWorkspace, updatedKey),
    onKeysImported: () => activateMatchingWorkspace(),
    confirmLeave: (summary) => typeof win.confirm === 'function'
      ? win.confirm(`Leave “${summary.name}” on this device? Its local key will be removed; other members will keep access.`)
      : true,
    privacyPolicyUrl: options.privacyPolicyUrl,
    configBackend,
    relayUrl: configuredRelayUrl,
    relayAuthToken: configuredRelayAuthToken,
  });
  const workspaces = await registry.listWorkspaces();
  const matchingWorkspaces = configuredRelayUrl ? findWorkspacesForUrl(workspaces, url) : [];
  const lockedWorkspaces = [];
  // Resolve the first matching unlocked workspace explicitly.
  let workspace = null;
  let workspaceKey = null;
  if (configuredRelayUrl) {
    for (const candidate of matchingWorkspaces) {
      const candidateKey = await keyStore.getWorkspaceKey(candidate.id);
      if (candidateKey) { workspace = candidate; workspaceKey = candidateKey; break; }
      lockedWorkspaces.push(candidate);
    }
  }

  let session = workspace && workspaceKey
    ? new WorkspaceSession(workspace, workspaceKey, configuredRelayUrl, {
      ...options,
      relayProtocols: configuredRelayAuthToken ? [`quillcrypt-auth.${configuredRelayAuthToken}`] : options.relayProtocols,
    })
    : null;
  const rendered = new Map();
  let mirrorPromise = Promise.resolve();
  let sidebar = null;
  let currentAnnotations = existing.slice();
  let settingsDispose = null;
  let settingsOpening = null;

  function activateWorkspace(acceptedWorkspace, acceptedKey) {
    if (!configuredRelayUrl) return;
    workspace = acceptedWorkspace;
    workspaceKey = acceptedKey;
    session?.dispose();
    session = new WorkspaceSession(acceptedWorkspace, acceptedKey, configuredRelayUrl, {
      ...options,
      relayProtocols: configuredRelayAuthToken ? [`quillcrypt-auth.${configuredRelayAuthToken}`] : options.relayProtocols,
    });
    for (const annotation of currentAnnotations) session.addAnnotation(annotation);
    session.onAnnotationsChange(renderCurrentAnnotations);
    workspaceStatus?.clear();
  }

  async function activateMatchingWorkspace() {
    if (session || !configuredRelayUrl) return Boolean(session);
    const latestWorkspaces = await registry.listWorkspaces();
    const latestLocked = [];
    for (const candidate of findWorkspacesForUrl(latestWorkspaces, url)) {
      const candidateKey = await keyStore.getWorkspaceKey(candidate.id);
      if (candidateKey) {
        activateWorkspace(candidate, candidateKey);
        return true;
      }
      latestLocked.push(candidate);
    }
    workspaceStatus?.update(latestLocked);
    return false;
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
      if (ok) {
        rendered.set(annotation.id, annotation);
        const failedIndex = failedToRender.indexOf(annotation.id);
        if (failedIndex !== -1) failedToRender.splice(failedIndex, 1);
      } else if (!failedToRender.includes(annotation.id)) failedToRender.push(annotation.id);
    }
    sidebar?.update(annotations, failedToRender);
    if (session) {
      // Yjs can deliver several updates in one turn. Keep the local mirror
      // ordered so a slower earlier write cannot overwrite a newer snapshot.
      mirrorPromise = mirrorPromise
        .then(() => mirrorAnnotationsToLocalStore(annotations))
        .catch(() => {});
    }
  }

  async function clearCurrentPageAnnotations() {
    const count = currentAnnotations.length;
    const confirmed = count === 0 || typeof win.confirm !== 'function'
      || win.confirm(`Delete all ${count} annotations from this page?`);
    if (!confirmed) return;
    const toClear = currentAnnotations.slice();
    if (session) {
      toClear.forEach((annotation) => session.deleteAnnotation(annotation.id));
    }
    for (const annotation of toClear) await store.deleteAnnotation(url, annotation.id);
    // Remove the rendered layer explicitly as well. This covers note bubbles
    // and unfinished note editors even if a collaborative session delivers
    // its empty snapshot on a later turn.
    rendered.clear();
    overlaySvg.querySelectorAll('[data-annotation-id]').forEach((element) => element.remove());
    noteLayer.querySelectorAll('[data-annotation-id], .qc-note-editor').forEach((element) => element.remove());
    renderCurrentAnnotations([]);
  }

  async function editAnnotation(id, patch) {
    if (session) {
      session.updateAnnotation(id, patch);
      await store.updateAnnotation(url, id, patch);
      return;
    }
    const updated = await editController.edit(url, id, patch);
    currentAnnotations = currentAnnotations.map((annotation) => annotation.id === id ? updated : annotation);
    renderCurrentAnnotations(currentAnnotations);
  }

  function selectAnnotation(annotation) {
    let target = null;
    if (annotation.anchor) {
      const range = locateAsRange(doc.body, annotation.anchor);
      if (range) {
        target = range.startContainer.nodeType === 3
          ? range.startContainer.parentElement?.closest('[data-quillcrypt-annotation-id]') || range.startContainer.parentElement
          : range.startContainer.closest?.('[data-quillcrypt-annotation-id]');
      }
    }
    target ||= overlaySvg.querySelector(`[data-annotation-id="${annotation.id}"]`);
    target ||= noteLayer.querySelector(`[data-annotation-id="${annotation.id}"]`);
    if (!target) return;
    const rect = target.getBoundingClientRect?.();
    if (rect && typeof win.scrollTo === 'function') {
      win.scrollTo({ top: Math.max(0, rect.top + (win.scrollY || 0) - (win.innerHeight || 800) * 0.35), behavior: 'smooth' });
    }
    target.style.setProperty('--qc-annotation-glow-color', annotation.style?.color || '#F5C542');
    target.classList.add('qc-annotation-glow');
    win.setTimeout?.(() => {
      target.classList.remove('qc-annotation-glow');
      target.style.removeProperty('--qc-annotation-glow-color');
    }, 4200);
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
      else sidebar = mountSidebar(sidebarHost, currentAnnotations, {
        onClose: disposeSidebar,
        onClearAll: clearCurrentPageAnnotations,
        onEdit: editAnnotation,
        onSelect: selectAnnotation,
        orphanedIds: failedToRender,
        onRetry: () => renderCurrentAnnotations(currentAnnotations),
      });
    },
    onSettingsToggle: () => toggleSettings(),
  });
  doc.body.appendChild(sidebarHost);

  const settingsHost = doc.createElement('div');
  settingsHost.className = 'qc-settings-host';
  settingsHost.addEventListener('click', (event) => {
    if (event.target === settingsHost) toggleSettings();
  });
  settingsHost.hidden = true;
  doc.body.appendChild(settingsHost);

  async function toggleSettings() {
    if (settingsDispose) {
      const dispose = settingsDispose;
      settingsDispose = null;
      settingsHost.classList.remove('qc-settings-open');
      win.setTimeout(() => {
        dispose();
        settingsHost.hidden = true;
      }, 220);
      return;
    }
    if (!settingsOpening) {
      settingsHost.hidden = false;
      settingsOpening = mountSettings(settingsHost, settingsController, { onClose: toggleSettings })
        .then((dispose) => {
          settingsDispose = dispose;
          // Let the drawer render in its closed transform state first; adding
          // the open class in the next frame gives the browser a real enter
          // transition instead of only animating the close path.
          win.requestAnimationFrame?.(() => settingsHost.classList.add('qc-settings-open'));
          if (!win.requestAnimationFrame) settingsHost.classList.add('qc-settings-open');
        })
        .finally(() => { settingsOpening = null; });
    }
    await settingsOpening;
  }

  const workspaceStatusHost = doc.createElement('div');
  workspaceStatusHost.className = 'qc-workspace-status-host';
  doc.body.appendChild(workspaceStatusHost);
  workspaceStatus = mountWorkspaceStatus(workspaceStatusHost, {
    lockedWorkspaces,
    onOpenSettings: () => toggleSettings(),
  });

  const runtime = options.runtime;
  const disposeRetryObserver = mountRetryObserver(doc, win, {
    hasOrphans: () => failedToRender.length > 0,
    retry: () => renderCurrentAnnotations(currentAnnotations),
  });
  const handleRuntimeMessage = runtime?.onMessage?.addListener
    ? (message) => message?.type === 'QC_OPEN_SETTINGS' ? toggleSettings().then(() => ({ ok: true })) : undefined
    : null;
  if (handleRuntimeMessage) runtime.onMessage.addListener(handleRuntimeMessage);

  await onboarding.markStepComplete('install');

  const disposeInteractions = attachToolInteractions({
    doc,
    win,
    onNoteRequest: (point, anchor) => openNoteEditor(point, anchor),
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

  function openNoteEditor(point, anchor) {
    return new Promise((resolve) => {
      const editor = doc.createElement('div');
      editor.className = 'qc-note-editor';
      editor.style.position = 'fixed';
      const title = doc.createElement('input');
      title.type = 'text';
      title.className = 'qc-note-editor-title';
      title.placeholder = 'Title (optional)';
      const input = doc.createElement('textarea');
      input.className = 'qc-note-editor-input';
      input.placeholder = 'Write a note…';
      const actions = doc.createElement('div');
      actions.className = 'qc-note-editor-actions';
      const cancel = doc.createElement('button');
      cancel.type = 'button'; cancel.textContent = 'Cancel';
      const save = doc.createElement('button');
      save.type = 'button'; save.textContent = 'Save note';
      actions.append(cancel, save);
      editor.append(title, input, actions);
      noteLayer.appendChild(editor);
      // Position after insertion so the actual editor dimensions are known.
      // This keeps the complete form inside the viewport at every click
      // location, including the right and bottom edges.
      const viewportX = point.x - (win.scrollX || 0);
      const viewportY = point.y - (win.scrollY || 0);
      const measured = editor.getBoundingClientRect?.() || {};
      const width = measured.width || 240;
      const height = measured.height || 190;
      const viewportWidth = win.innerWidth || 1200;
      const viewportHeight = win.innerHeight || 800;
      editor.style.left = `${Math.max(8, Math.min(viewportX, viewportWidth - width - 8))}px`;
      editor.style.top = `${Math.max(8, Math.min(viewportY, viewportHeight - height - 8))}px`;
      const close = () => { editor.remove(); resolve(); };
      cancel.addEventListener('click', close);
      save.addEventListener('click', async () => {
        const content = input.value.trim();
        const noteTitle = title.value.trim();
        if (!content && !noteTitle) { input.focus(); return; }
        save.disabled = true;
        const record = createAnnotation({
          type: 'note', anchor, geometry: anchor ? null : point,
          content, title: noteTitle,
          style: { color: toolbarState.getState().color },
        });
        await store.addAnnotation(url, record);
        if (session) session.addAnnotation(record);
        else renderAnnotation(doc.body, overlaySvg, noteLayer, record);
        onboarding.markStepComplete('first-annotation');
        if (!session) {
          currentAnnotations = [...currentAnnotations, record];
          sidebar?.update(currentAnnotations);
        }
        close();
      });
      input.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') save.click();
        if (event.key === 'Escape') cancel.click();
      });
      input.focus();
    });
  }

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
      disposeAnnotationTooltip();
      disposeToolbar();
      disposeSidebar();
      settingsDispose?.();
      settingsDispose = null;
      disposeInteractions();
      disposeOnboarding();
      disposeRetryObserver();
      workspaceStatus?.dispose();
      session?.dispose();
      toolbarHost.remove();
      onboardingHost.remove();
      sidebarHost.remove();
      settingsHost.remove();
      workspaceStatusHost.remove();
      if (handleRuntimeMessage) runtime.onMessage.removeListener?.(handleRuntimeMessage);
      doc.removeEventListener('keydown', handleKeydown);
    },
  };
}

/** Real content-script entry point: guards against double-injection, then mounts. */
function start(doc, win, storageArea, runtime) {
  injectOnce(doc, () => {
    const activationStore = new WebExtensionStorageBackend('active-pages', storageArea);
    const pageKey = normalizeUrl(win.location.href);
    let mounted = null;

    async function togglePage() {
      if (mounted) {
        await activationStore.remove(pageKey);
        mounted.dispose();
        mounted = null;
        return { ok: true, enabled: false };
      }
      await activationStore.set(pageKey, true);
      mounted = await mount(doc, win, storageArea, { runtime });
      return { ok: true, enabled: true };
    }

    const handleActivationMessage = (message) => {
      if (message?.type !== 'QC_TOGGLE_PAGE') return undefined;
      return togglePage();
    };
    runtime?.onMessage?.addListener?.(handleActivationMessage);

    activationStore.get(pageKey).then((enabled) => {
      if (enabled) return togglePage();
      return null;
    }).catch(() => null);
  });
}

// Actual execution when loaded as a content script (not when required as a
// module by tests — those call mount()/start() directly with their own doc/win).
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const browserApi = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
  if (browserApi) {
    start(document, window, browserApi.storage.local, browserApi.runtime);
  }
}

module.exports = { mount, start };
