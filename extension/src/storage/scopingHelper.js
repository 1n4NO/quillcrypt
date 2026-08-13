'use strict';
const { normalizeUrl } = require('./store');

/**
 * Workspace scoping UI helper (QC-55) — the logic layer behind the
 * domain-vs-page picker a UI would render when creating a workspace, plus
 * safely growing an existing urlList workspace's scope later.
 */

/**
 * For a given page, build the two scope choices a UI should offer:
 * "just this page" and "this whole domain". A UI renders these as two
 * buttons/radio options; this function just computes what each option's
 * resulting scopeValue would actually be.
 */
function buildScopeOptions(url) {
  const parsed = new URL(url);
  return [
    {
      scopeType: 'urlList',
      scopeValue: [normalizeUrl(url)],
      label: 'Just this page',
    },
    {
      scopeType: 'domain',
      scopeValue: parsed.hostname,
      label: `All of ${parsed.hostname}`,
    },
  ];
}

/**
 * Add a URL to an existing urlList-scoped workspace, without duplicating
 * an already-covered page. Returns a NEW scopeValue array (doesn't mutate
 * the workspace object) — callers persist the updated workspace themselves.
 */
function addUrlToWorkspace(workspace, url) {
  if (workspace.scopeType !== 'urlList') {
    throw new Error('addUrlToWorkspace only applies to urlList-scoped workspaces');
  }
  const normalized = normalizeUrl(url);
  if (workspace.scopeValue.includes(normalized)) {
    return workspace.scopeValue; // already covered — no change
  }
  return [...workspace.scopeValue, normalized];
}

module.exports = { buildScopeOptions, addUrlToWorkspace };
