'use strict';
const primitives = require('./primitives');

/**
 * Invite-link key exchange.
 *
 * The workspace symmetric key lives only in the URL fragment (`#key=...`).
 * Browsers never include the fragment in HTTP requests or send it to a
 * server on navigation — it's purely client-side. So as long as every
 * network call in the app is built from origin+path+search (never href/hash),
 * the key structurally cannot reach the server, regardless of relay logging
 * behavior.
 *
 * Spike results: docs/spikes/QC-3-invite-link.md
 *
 * NOTE: this handles the *initial* symmetric key generation and sharing
 * flow only. Late-joining members (added after the workspace already has a
 * key) need asymmetric key wrapping instead — see QC-44 (Phase 3),
 * implemented in `primitives.js`.
 *
 * As of QC-40/41/43 (Phase 3), key generation/encoding here delegates to
 * `primitives.js` rather than calling sodium directly — this file's own
 * exported names are unchanged (nothing downstream, e.g. invite.js, needed
 * to change), but there's now exactly one place all crypto primitives are
 * actually implemented.
 */

async function generateWorkspaceKey() {
  await primitives.ready();
  return primitives.generateSymmetricKey();
}

function encodeKey(key) {
  return primitives.encodeKey(key);
}

function decodeKey(encoded) {
  return primitives.decodeKey(encoded);
}

function buildInviteLink(origin, workspaceId, key) {
  const url = new URL(`${origin}/join/${workspaceId}`);
  url.hash = `key=${encodeKey(key)}`;
  return url;
}

/** Extract the key from a URL's fragment (what the joining client does). */
function extractKeyFromUrl(url) {
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  const encoded = params.get('key');
  if (!encoded) return null;
  return decodeKey(encoded);
}

/**
 * Honest request-URL builder: every network call in the real app MUST go
 * through something equivalent to this. Never build a request from
 * `url.href` or `url.toString()` on a URL that might carry a key fragment —
 * see the QC-3 spike findings for why this is the one rule that matters here.
 */
function buildApiRequestUrl(url, path) {
  return `${url.origin}${path}`;
}

module.exports = {
  generateWorkspaceKey,
  encodeKey,
  decodeKey,
  buildInviteLink,
  extractKeyFromUrl,
  buildApiRequestUrl,
};
