'use strict';
const sodium = require('libsodium-wrappers');

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
 * key) need asymmetric key wrapping instead — see QC-44 (Phase 3).
 */

async function generateWorkspaceKey() {
  await sodium.ready;
  return sodium.crypto_secretbox_keygen();
}

function encodeKey(key) {
  return sodium.to_base64(key, sodium.base64_variants.URLSAFE_NO_PADDING);
}

function decodeKey(encoded) {
  return sodium.from_base64(encoded, sodium.base64_variants.URLSAFE_NO_PADDING);
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
