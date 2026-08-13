'use strict';
const { generateSymmetricKey } = require('./primitives');
const { createMemberInvite } = require('./membership');

/**
 * Key rotation on member removal (QC-45).
 *
 * When a member is removed, a fresh group key is generated and wrapped
 * individually for every REMAINING member (via QC-44's sealed-box
 * wrapping) — the removed member is simply excluded from that wrap list,
 * so there's no key for them to unwrap even if they intercept the rotation
 * traffic.
 *
 * STATED LIMITATION, not a bug: this does not provide forward secrecy for
 * content the removed member already received and decrypted BEFORE
 * removal. If they saved a copy of an annotation while they were still a
 * member, rotating the key afterward doesn't un-see it — rotation only
 * prevents them from reading anything encrypted with the NEW key going
 * forward. True forward secrecy (e.g. a full ratcheting scheme like
 * Signal's) is meaningfully heavier machinery and out of scope here; this
 * is the standard tradeoff most "wrap a shared key per member" group
 * encryption designs make, not something specific to this implementation.
 */
async function rotateGroupKeyAfterRemoval(roster, removedMemberId) {
  await roster.removeMember(removedMemberId);
  const remainingMembers = await roster.listMembers();

  const newKey = generateSymmetricKey();
  const wrappedKeysByMember = new Map();
  for (const { memberId, publicKey } of remainingMembers) {
    wrappedKeysByMember.set(memberId, createMemberInvite(newKey, publicKey));
  }

  return { newKey, wrappedKeysByMember };
}

module.exports = { rotateGroupKeyAfterRemoval };
