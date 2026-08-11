'use strict';
const crypto = require('crypto');
const { normalizeUrl } = require('./store');

/**
 * Workspace model. A workspace is either:
 *  - domain-scoped: covers every page on a given hostname (exact match only
 *    — subdomains are NOT automatically included; www.example.com and
 *    example.com are different workspaces unless both are added explicitly.
 *    That's a deliberate simplicity choice for v1, not an oversight — worth
 *    revisiting if user feedback wants subdomain inclusion.)
 *  - urlList-scoped: covers only an explicit set of normalized URLs
 *
 * A single page can belong to more than one workspace (e.g. a personal
 * domain-wide workspace AND a specific shared review link for one article).
 * findWorkspacesForUrl returns ALL matches, with urlList (more specific)
 * matches sorted before domain (broader) matches, so calling UI can default
 * to the most specific context while still surfacing the rest.
 */

function createWorkspace({ name, scopeType, scopeValue }) {
  if (scopeType !== 'domain' && scopeType !== 'urlList') {
    throw new Error(`Unknown scopeType: ${scopeType}`);
  }
  if (scopeType === 'urlList' && !Array.isArray(scopeValue)) {
    throw new Error('urlList scopeValue must be an array of URLs');
  }
  return {
    id: crypto.randomUUID(),
    name,
    scopeType,
    scopeValue: scopeType === 'urlList' ? scopeValue.map(normalizeUrl) : scopeValue,
    createdAt: new Date().toISOString(),
  };
}

function matchesUrl(workspace, rawUrl) {
  if (workspace.scopeType === 'domain') {
    return new URL(rawUrl).hostname === workspace.scopeValue;
  }
  // urlList
  const normalized = normalizeUrl(rawUrl);
  return workspace.scopeValue.includes(normalized);
}

function findWorkspacesForUrl(workspaces, rawUrl) {
  const matches = workspaces.filter((ws) => matchesUrl(ws, rawUrl));
  // urlList (more specific) before domain (broader)
  return matches.sort((a, b) => {
    if (a.scopeType === b.scopeType) return 0;
    return a.scopeType === 'urlList' ? -1 : 1;
  });
}

/** Stable, deterministic room id for the sync layer (SyncClient/PresenceClient), derived from workspace id. */
function deriveRoomId(workspace) {
  return `workspace:${workspace.id}`;
}

module.exports = { createWorkspace, matchesUrl, findWorkspacesForUrl, deriveRoomId };
