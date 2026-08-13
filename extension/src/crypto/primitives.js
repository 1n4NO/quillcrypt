'use strict';
const sodium = require('libsodium-wrappers');

/**
 * Consolidated libsodium wrapper (QC-40). Single place all crypto
 * primitives go through, so there's exactly one spot to audit rather than
 * scattered sodium calls across the codebase. Two families:
 *
 *  - Symmetric (secretbox): the workspace group key. Used to encrypt every
 *    Yjs update at the sync boundary (QC-42). One shared key per workspace.
 *  - Asymmetric (sealed box): per-member keypairs, used only to wrap the
 *    group key for a specific new member (QC-44) so it can be delivered to
 *    them without an insecure out-of-band channel. NOT used for document
 *    content — that's what would make this a much heavier "everyone
 *    encrypts to everyone" scheme; sealed boxes are used narrowly, once
 *    per member-join, to hand over the one symmetric key.
 *
 * This consolidates and supersedes the symmetric-key logic that started
 * inline in the QC-3 spike and QC-2 spike — extension/src/crypto/keyExchange.js
 * (QC-3/QC-43) now delegates key generation/encoding to this module rather
 * than calling sodium directly, so there's one source of truth.
 */

async function ready() {
  await sodium.ready;
}

// ---- Symmetric (workspace group key) ----

function generateSymmetricKey() {
  return sodium.crypto_secretbox_keygen();
}

/** Wire format: nonce || ciphertext. */
function encryptSymmetric(plaintext, key) {
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, key);
  const out = new Uint8Array(nonce.length + ciphertext.length);
  out.set(nonce, 0);
  out.set(ciphertext, nonce.length);
  return out;
}

function decryptSymmetric(payload, key) {
  const nonce = payload.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = payload.slice(sodium.crypto_secretbox_NONCEBYTES);
  return sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
}

function encodeKey(key) {
  return sodium.to_base64(key, sodium.base64_variants.URLSAFE_NO_PADDING);
}

function decodeKey(encoded) {
  return sodium.from_base64(encoded, sodium.base64_variants.URLSAFE_NO_PADDING);
}

// ---- Asymmetric (per-member keypair, for wrapping the group key — QC-44) ----

function generateMemberKeyPair() {
  const pair = sodium.crypto_box_keypair();
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}

/** Wrap `payload` (typically a group key) so only the holder of memberPublicKey's matching private key can read it. */
function wrapForMember(payload, memberPublicKey) {
  return sodium.crypto_box_seal(payload, memberPublicKey);
}

function unwrapForMember(sealed, memberPublicKey, memberPrivateKey) {
  return sodium.crypto_box_seal_open(sealed, memberPublicKey, memberPrivateKey);
}

module.exports = {
  ready,
  generateSymmetricKey,
  encryptSymmetric,
  decryptSymmetric,
  encodeKey,
  decodeKey,
  generateMemberKeyPair,
  wrapForMember,
  unwrapForMember,
};
