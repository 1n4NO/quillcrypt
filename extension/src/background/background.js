'use strict';

const { createBackgroundController, MESSAGE_TYPES } = require('./messages');
const { WebExtensionWorkspaceRegistryBackend, WebExtensionConfigBackend } = require('../storage/webExtensionStorage');
const { WorkspaceRegistry } = require('../ui/settings');
const { findWorkspacesForUrl } = require('../storage/workspace');
const { KeyStore } = require('../crypto/keyStore');
const { WebExtensionStorageBackend } = require('../storage/webExtensionStorage');

globalThis.addEventListener?.('install', () => globalThis.skipWaiting?.());
globalThis.addEventListener?.('activate', (event) => event.waitUntil?.(globalThis.clients?.claim?.()));

function getBrowserApi() {
  return typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
}

async function getStatus(storageArea, url) {
  if (!url) return { relayConfigured: false, workspaces: [] };
  const config = new WebExtensionConfigBackend(storageArea);
  const relayUrl = await config.getRelayUrl();
  const registry = new WorkspaceRegistry(new WebExtensionWorkspaceRegistryBackend(storageArea));
  const keyStore = new KeyStore(new WebExtensionStorageBackend('keys', storageArea));
  const matches = findWorkspacesForUrl(await registry.listWorkspaces(), url);
  const workspaces = [];
  for (const workspace of matches) {
    workspaces.push({
      id: workspace.id,
      name: workspace.name,
      scopeType: workspace.scopeType,
      hasKey: (await keyStore.getWorkspaceKey(workspace.id)) !== null,
    });
  }
  return { relayConfigured: Boolean(relayUrl), workspaces };
}

const browserApi = getBrowserApi();
if (browserApi?.storage?.local && browserApi.runtime?.onMessage) {
  createBackgroundController({
    browserApi,
    storageArea: browserApi.storage.local,
    getStatus: (url) => getStatus(browserApi.storage.local, url),
  });

  browserApi.action?.onClicked?.addListener(async (tab) => {
    if (!tab?.id) return;
    try {
      await browserApi.tabs?.sendMessage?.(tab.id, { type: MESSAGE_TYPES.OPEN_SETTINGS });
    } catch {
      // Restricted pages and tabs without the content script are expected.
    }
  });
}

module.exports = { getStatus };
