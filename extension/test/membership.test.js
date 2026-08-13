'use strict';
const sodium = require('libsodium-wrappers');
const { MemberRoster, createMemberInvite, acceptMemberInvite } = require('../src/crypto/membership');
const { ready, generateSymmetricKey, generateMemberKeyPair } = require('../src/crypto/primitives');

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

  await roster.addMember('alice', alice.publicKey);
  await roster.addMember('bob', bob.publicKey);
  let members = await roster.listMembers();
  check('roster lists both added members', members.length === 2);

  await roster.removeMember('bob');
  members = await roster.listMembers();
  check('roster reflects removal', members.length === 1 && members[0].memberId === 'alice');

  const aliceKey = await roster.getMemberPublicKey('alice');
  check('roster returns the correct public key for a member', Buffer.compare(Buffer.from(aliceKey), Buffer.from(alice.publicKey)) === 0);

  const groupKey = generateSymmetricKey();
  const carol = generateMemberKeyPair();

  const wrappedForCarol = createMemberInvite(groupKey, carol.publicKey);
  const recoveredKey = acceptMemberInvite(wrappedForCarol, carol.publicKey, carol.privateKey);
  check(
    "Carol recovers the EXACT group key by unwrapping her invite with her own keypair",
    Buffer.compare(Buffer.from(recoveredKey), Buffer.from(groupKey)) === 0
  );

  const groupKeyHex = Buffer.from(groupKey).toString('hex');
  const wrappedHex = Buffer.from(wrappedForCarol).toString('hex');
  check('the wrapped payload does not contain the raw group key bytes verbatim', !wrappedHex.includes(groupKeyHex));

  const eve = generateMemberKeyPair();
  check(
    "a member the invite was NOT wrapped for cannot accept/unwrap it",
    (() => {
      try {
        acceptMemberInvite(wrappedForCarol, eve.publicKey, eve.privateKey);
        return false;
      } catch (e) {
        return true;
      }
    })()
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
