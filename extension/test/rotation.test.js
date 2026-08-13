'use strict';
const { ready, generateMemberKeyPair, generateSymmetricKey } = require('../src/crypto/primitives');
const { MemberRoster, acceptMemberInvite } = require('../src/crypto/membership');
const { rotateGroupKeyAfterRemoval } = require('../src/crypto/rotation');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

async function main() {
  await ready();

  const roster = new MemberRoster();
  const alice = generateMemberKeyPair();
  const bob = generateMemberKeyPair();
  const carol = generateMemberKeyPair();

  await roster.addMember('alice', alice.publicKey);
  await roster.addMember('bob', bob.publicKey);
  await roster.addMember('carol', carol.publicKey);

  const oldKey = generateSymmetricKey();

  const { newKey, wrappedKeysByMember } = await rotateGroupKeyAfterRemoval(roster, 'carol');

  check('rotation produces a genuinely different key than the old one', Buffer.compare(Buffer.from(newKey), Buffer.from(oldKey)) !== 0);
  check('carol is removed from the roster after rotation', (await roster.listMembers()).every((m) => m.memberId !== 'carol'));
  check('remaining members (alice, bob) both got a wrapped copy of the new key', wrappedKeysByMember.has('alice') && wrappedKeysByMember.has('bob'));
  check('the removed member (carol) got NO wrapped copy at all', !wrappedKeysByMember.has('carol'));

  const aliceRecovered = acceptMemberInvite(wrappedKeysByMember.get('alice'), alice.publicKey, alice.privateKey);
  const bobRecovered = acceptMemberInvite(wrappedKeysByMember.get('bob'), bob.publicKey, bob.privateKey);
  check('alice recovers the exact new key from her wrapped copy', Buffer.compare(Buffer.from(aliceRecovered), Buffer.from(newKey)) === 0);
  check('bob recovers the exact new key from his wrapped copy', Buffer.compare(Buffer.from(bobRecovered), Buffer.from(newKey)) === 0);

  let carolCanUnwrapAny = false;
  for (const wrapped of wrappedKeysByMember.values()) {
    try {
      acceptMemberInvite(wrapped, carol.publicKey, carol.privateKey);
      carolCanUnwrapAny = true;
    } catch (e) {
      // expected
    }
  }
  check("the removed member's keypair cannot unwrap ANY of the newly-wrapped entries", !carolCanUnwrapAny);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
