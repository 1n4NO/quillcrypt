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
  async removeWorkspace(id) {
    await this.backend.remove(id);
  }
  async listWorkspaces() {
    return this.backend.list();
  }
}

class SettingsController {
  constructor(keyStore, workspaceRegistry) {
    this.keyStore = keyStore;
    this.workspaceRegistry = workspaceRegistry;
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
}

module.exports = { SettingsController, WorkspaceRegistry, InMemoryWorkspaceRegistryBackend };
