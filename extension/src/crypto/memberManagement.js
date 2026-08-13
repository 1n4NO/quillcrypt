'use strict';
const { rotateGroupKeyAfterRemoval } = require('./rotation');

/**
 * Workspace member management (QC-54) — the state/controller layer a
 * management UI would sit on top of. Same precedent as QC-20's toolbar:
 * this is the testable logic; actual DOM rendering isn't attempted here
 * since it isn't meaningfully unit-testable.
 *
 * Adds display names on top of QC-44's MemberRoster (which only tracks
 * public keys) and a readable key fingerprint for the UI to show — similar
 * in spirit to Signal's "safety number" concept, so members can visually
 * confirm they're looking at the key they expect, without needing to
 * compare raw hex.
 */

function fingerprintOf(publicKey) {
  const hex = Buffer.from(publicKey).toString('hex').slice(0, 16);
  return hex.match(/.{1,4}/g).join(' '); // grouped for readability: "a1b2 c3d4 e5f6 0718"
}

class WorkspaceMemberController {
  constructor(roster, displayNames = new Map()) {
    this.roster = roster;
    this.displayNames = displayNames;
  }

  async addMember(memberId, publicKey, displayName) {
    await this.roster.addMember(memberId, publicKey);
    this.displayNames.set(memberId, displayName);
  }

  async listMembersForDisplay() {
    const members = await this.roster.listMembers();
    return members.map(({ memberId, publicKey }) => ({
      memberId,
      displayName: this.displayNames.get(memberId) || memberId,
      publicKeyFingerprint: fingerprintOf(publicKey),
    }));
  }

  /** Removing a member always rotates the group key — see QC-45 for why. */
  async removeMemberAndRotate(memberId) {
    this.displayNames.delete(memberId);
    return rotateGroupKeyAfterRemoval(this.roster, memberId);
  }
}

module.exports = { WorkspaceMemberController, fingerprintOf };
