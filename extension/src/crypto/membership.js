'use strict';
const { wrapForMember, unwrapForMember } = require('./primitives');

/**
 * Member roster and late-join key delivery (QC-44).
 *
 * The crypto primitives (sealed-box wrap/unwrap) already exist in
 * primitives.js from QC-40. This is the workspace-facing layer on top:
 * tracking who's a member (by public key, not raw identity — the roster
 * doesn't need to know anything about a person beyond their key), and the
 * actual invite/accept flow for adding someone new.
 *
 * The key property this delivers: the wrapped payload produced by
 * createMemberInvite() is safe to transmit over ANY channel, including the
 * blind relay itself or a plain link — it's ciphertext that only the
 * intended new member's private key can open. No separate secure
 * out-of-band channel is needed the way the QC-3/QC-43 initial-key-via-
 * fragment approach implicitly relies on the invite link itself being
 * shared carefully. This is what makes it suitable for LATE joins
 * specifically, where the group key already exists and must reach one new
 * person without re-exposing it to everyone.
 */

/** In-memory roster backend — same pluggable-backend pattern as AnnotationStore (QC-12). */
class InMemoryRosterBackend {
  constructor(sharedMap = new Map()) {
    this._map = sharedMap;
  }
  async get(memberId) {
    return this._map.has(memberId) ? this._map.get(memberId) : null;
  }
  async set(memberId, publicKey) {
    this._map.set(memberId, publicKey);
  }
  async remove(memberId) {
    this._map.delete(memberId);
  }
  async list() {
    return [...this._map.entries()].map(([memberId, publicKey]) => ({ memberId, publicKey }));
  }
}

class MemberRoster {
  constructor(backend = new InMemoryRosterBackend()) {
    this.backend = backend;
  }
  async addMember(memberId, publicKey) {
    await this.backend.set(memberId, publicKey);
  }
  async removeMember(memberId) {
    await this.backend.remove(memberId);
  }
  async listMembers() {
    return this.backend.list();
  }
  async getMemberPublicKey(memberId) {
    return this.backend.get(memberId);
  }
}

/** Existing member wraps the current group key for a specific new member's public key. */
function createMemberInvite(groupKey, newMemberPublicKey) {
  return wrapForMember(groupKey, newMemberPublicKey);
}

/** New member unwraps the invite using their own keypair to recover the group key. */
function acceptMemberInvite(wrappedKey, memberPublicKey, memberPrivateKey) {
  return unwrapForMember(wrappedKey, memberPublicKey, memberPrivateKey);
}

module.exports = { MemberRoster, InMemoryRosterBackend, createMemberInvite, acceptMemberInvite };
