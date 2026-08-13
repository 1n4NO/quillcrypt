'use strict';
const {
  ready, generateSymmetricKey, encryptSymmetric, decryptSymmetric, encodeKey, decodeKey,
  generateMemberKeyPair, wrapForMember, unwrapForMember,
} = require('../src/crypto/primitives');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

async function main() {
  await ready();

  const key = generateSymmetricKey();
  const plaintext = new TextEncoder().encode('hello workspace');
  const encrypted = encryptSymmetric(plaintext, key);
  const decrypted = decryptSymmetric(encrypted, key);
  check('symmetric encrypt/decrypt round-trips correctly', new TextDecoder().decode(decrypted) === 'hello workspace');

  const wrongKey = generateSymmetricKey();
  check(
    'decrypting with the WRONG symmetric key fails (throws) rather than silently returning garbage',
    (() => { try { decryptSymmetric(encrypted, wrongKey); return false; } catch (e) { return true; } })()
  );

  const encoded = encodeKey(key);
  const roundTrippedKey = decodeKey(encoded);
  check('key survives base64url encode/decode round trip', Buffer.compare(Buffer.from(roundTrippedKey), Buffer.from(key)) === 0);

  const member = generateMemberKeyPair();
  const wrapped = wrapForMember(key, member.publicKey);
  const unwrapped = unwrapForMember(wrapped, member.publicKey, member.privateKey);
  check('group key wrapped for a member unwraps to the exact original key', Buffer.compare(Buffer.from(unwrapped), Buffer.from(key)) === 0);

  const otherMember = generateMemberKeyPair();
  check(
    "a DIFFERENT member's keypair cannot unwrap a key that wasn't wrapped for them",
    (() => { try { unwrapForMember(wrapped, otherMember.publicKey, otherMember.privateKey); return false; } catch (e) { return true; } })()
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
