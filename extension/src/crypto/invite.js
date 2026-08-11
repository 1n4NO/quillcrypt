'use strict';
const { encodeKey, decodeKey } = require('./keyExchange');

/**
 * Invite flow: turns a workspace + its group key into a shareable link, and
 * reconstructs an equivalent workspace on the joining side.
 *
 * Split exactly along the QC-3 threat model: the encryption key goes in the
 * URL fragment (never transmitted to any server), while the workspace's
 * identity and SCOPE (domain or url list) go in the path/query. That scope
 * metadata isn't secret the same way the key is — a server already knows
 * what page it's serving — but it's genuinely necessary for the joining
 * client to know: without knowing the scope, Bob's client wouldn't know
 * which pages should activate this workspace at all.
 *
 * Critically, the invite carries the SAME workspace id as the inviter's
 * workspace (not a freshly generated one) — deriveRoomId(workspace) must
 * produce an identical room id on both sides, or Alice and Bob would each
 * be alone in their own room instead of actually connecting to each other.
 */

function buildWorkspaceInviteLink(origin, workspace, key) {
  const url = new URL(`${origin}/join/${workspace.id}`);
  url.searchParams.set('name', workspace.name);
  url.searchParams.set('scopeType', workspace.scopeType);
  url.searchParams.set(
    'scopeValue',
    workspace.scopeType === 'urlList' ? JSON.stringify(workspace.scopeValue) : workspace.scopeValue
  );
  url.hash = `key=${encodeKey(key)}`;
  return url;
}

/**
 * Parse an invite link back into { workspace, key }. `workspace` has the
 * SAME id as the inviter's original — see the module doc above for why
 * that matters. Returns null if the URL isn't a valid invite link.
 */
function parseInviteLink(url) {
  const pathMatch = url.pathname.match(/\/join\/([^/]+)/);
  if (!pathMatch) return null;

  const id = pathMatch[1];
  const name = url.searchParams.get('name');
  const scopeType = url.searchParams.get('scopeType');
  const rawScopeValue = url.searchParams.get('scopeValue');
  const scopeValue = scopeType === 'urlList' ? JSON.parse(rawScopeValue) : rawScopeValue;

  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  const encodedKey = params.get('key');
  if (!encodedKey) return null;

  return {
    workspace: { id, name, scopeType, scopeValue, createdAt: new Date().toISOString() },
    key: decodeKey(encodedKey),
  };
}

module.exports = { buildWorkspaceInviteLink, parseInviteLink };
