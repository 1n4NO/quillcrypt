'use strict';

/**
 * Settings page (QC-61) — the aggregation/controller layer behind key
 * management, workspace list, and export, all in one place, matching how
 * a real settings UI needs data from three otherwise-separate modules
 * (KeyStore from QC-46, a workspace registry, export from QC-53).
 *
 * Same precedent as QC-20/54: this is the testable state layer, not DOM
 * rendering.
 */

/** Minimal local registry of joined workspaces (name/scope metadata) — pluggable backend. */
class InMemoryWorkspaceRegistryBackend {
  constructor(sharedMap = new Map()) {
    this._map = sharedMap;
  }
  async get(id) {
    return this._map.has(id) ? this._map.get(id) : null;
  }
  async set(id, workspace) {
    this._map.set(id, workspace);
  }
  async remove(id) {
    this._map.delete(id);
  }
  async list() {
    return [...this._map.values()];
  }
}

class WorkspaceRegistry {
  constructor(backend = new InMemoryWorkspaceRegistryBackend()) {
    this.backend = backend;
  }
  async addWorkspace(workspace) {
    await this.backend.set(workspace.id, workspace);
  }
  async getWorkspace(id) {
    return this.backend.get?.(id) || null;
  }
  async removeWorkspace(id) {
    await this.backend.remove(id);
  }
  async listWorkspaces() {
    return this.backend.list();
  }
}

class SettingsController {
  constructor(keyStore, workspaceRegistry, pageContext = {}) {
    this.keyStore = keyStore;
    this.workspaceRegistry = workspaceRegistry;
    this.pageContext = pageContext;
    this.confirmLeave = pageContext.confirmLeave;
    this.privacyPolicyUrl = pageContext.privacyPolicyUrl || 'https://quillcrypt.dev/privacy.html';
  }

  /** Combined view-model: every registered workspace, annotated with whether this device still has its key. */
  async getWorkspaceSummaries() {
    const workspaces = await this.workspaceRegistry.listWorkspaces();
    const summaries = [];
    for (const workspace of workspaces) {
      const key = await this.keyStore.getWorkspaceKey(workspace.id);
      summaries.push({
        id: workspace.id,
        name: workspace.name,
        scopeType: workspace.scopeType,
        scopeLabel: workspace.scopeType === 'domain' ? workspace.scopeValue : `${workspace.scopeValue.length} page(s)`,
        hasKey: key !== null,
        coversCurrentPage: this.pageContext.url ? require('../storage/workspace').matchesUrl(workspace, this.pageContext.url) : false,
      });
    }
    return summaries;
  }

  /**
   * "Leave" a workspace from this device only — removes the local key and
   * registry entry. Does NOT affect other members' access (this is purely
   * local cleanup, matching the tradeoff described in docs/KEY_RECOVERY.md).
   */
  async removeWorkspaceLocally(workspaceId) {
    await this.keyStore.removeWorkspaceKey(workspaceId);
    await this.workspaceRegistry.removeWorkspace(workspaceId);
  }

  async exportCurrentPage(format) {
    const annotations = await (this.pageContext.getAnnotations?.() || []);
    const { url, pageTitle } = this.pageContext;
    const exporters = require('../models/exportAnnotations');
    if (format === 'json') return exporters.exportToJson(annotations, { url });
    if (format === 'markdown') return exporters.exportToMarkdown(annotations, { url, pageTitle });
    throw new Error(`Unknown export format: ${format}`);
  }

  async exportKeyBackup(password) {
    const { exportKeyBackup } = require('../crypto/keyBackup');
    return exportKeyBackup(this.keyStore, this.workspaceRegistry, password);
  }

  async importKeyBackup(json, password) {
    const { importKeyBackup } = require('../crypto/keyBackup');
    const imported = await importKeyBackup(json, this.keyStore, this.workspaceRegistry, password);
    await this.pageContext.onKeysImported?.();
    return imported;
  }

  getMemberController() { return this.pageContext.memberController || null; }

  async getRelayUrl() {
    return this.pageContext.relayUrl || await this.pageContext.configBackend?.getRelayUrl() || '';
  }

  async setRelayUrl(value) {
    const normalized = typeof value === 'string' ? value.trim().replace(/\/$/, '') : '';
    if (normalized && !/^wss?:\/\//i.test(normalized)) throw new Error('Relay URL must start with ws:// or wss://');
    if (normalized) {
      try { new URL(normalized); } catch { throw new Error('Relay URL is invalid'); }
    }
    if (this.pageContext.configBackend) await this.pageContext.configBackend.setRelayUrl(normalized);
    this.pageContext.relayUrl = normalized;
    return normalized;
  }

  async getRelayAuthToken() {
    return await this.pageContext.configBackend?.getRelayAuthToken() || '';
  }

  async setRelayAuthToken(value) {
    const token = typeof value === 'string' ? value.trim() : '';
    if (token && /[^A-Za-z0-9._~-]/.test(token)) throw new Error('Relay token contains unsupported characters');
    await this.pageContext.configBackend?.setRelayAuthToken(token);
    this.pageContext.relayAuthToken = token;
    return token;
  }

  async createWorkspaceForPage({ name, scopeType, origin = 'https://app.quillcrypt.dev' }) {
    const { createWorkspace } = require('../storage/workspace');
    const { buildScopeOptions } = require('../storage/scopingHelper');
    const { generateSymmetricKey, ready } = require('../crypto/primitives');
    const { buildWorkspaceInviteLink } = require('../crypto/invite');
    if (!name?.trim()) throw new Error('Workspace name is required');
    const options = buildScopeOptions(this.pageContext.url);
    const selected = options.find((option) => option.scopeType === scopeType);
    if (!selected) throw new Error('Unknown workspace scope');
    const workspace = createWorkspace({ name: name.trim(), scopeType, scopeValue: selected.scopeValue });
    await ready();
    const key = generateSymmetricKey();
    await this.workspaceRegistry.addWorkspace(workspace);
    await this.keyStore.storeWorkspaceKey(workspace.id, key);
    await this.pageContext.onWorkspaceCreated?.(workspace, key);
    return { workspace, inviteLink: buildWorkspaceInviteLink(origin, workspace, key).href };
  }

  async addCurrentPageToWorkspace(workspaceId) {
    const { addUrlToWorkspace } = require('../storage/scopingHelper');
    const workspace = await this.workspaceRegistry.getWorkspace(workspaceId);
    if (!workspace) throw new Error('Workspace not found');
    if (!this.pageContext.url) throw new Error('The current page URL is unavailable');
    const updated = { ...workspace, scopeValue: addUrlToWorkspace(workspace, this.pageContext.url) };
    await this.workspaceRegistry.addWorkspace(updated);
    await this.pageContext.onWorkspaceScopeChanged?.(updated, await this.keyStore.getWorkspaceKey(updated.id));
    return updated;
  }

  async acceptInvite(url) {
    const { parseInviteLink } = require('../crypto/invite');
    let invite;
    try { invite = parseInviteLink(new URL(url)); } catch { throw new Error('This invite link is invalid'); }
    if (!invite?.workspace?.name || !invite.workspace.scopeType || !invite.workspace.scopeValue) {
      throw new Error('This invite link is invalid');
    }
    if (await this.workspaceRegistry.get?.(invite.workspace.id) || (await this.workspaceRegistry.listWorkspaces()).some((ws) => ws.id === invite.workspace.id)) {
      throw new Error('This workspace is already on this device');
    }
    await this.workspaceRegistry.addWorkspace(invite.workspace);
    await this.keyStore.storeWorkspaceKey(invite.workspace.id, invite.key);
    await this.pageContext.onWorkspaceAccepted?.(invite.workspace, invite.key);
    return invite.workspace;
  }
}

module.exports = { SettingsController, WorkspaceRegistry, InMemoryWorkspaceRegistryBackend };
