#!/usr/bin/env node
// Checks that a private key is the one the shipped APK trusts, without printing
// or writing any key material. Run this on whichever machine holds the export
// before trusting it with a release.
//
//   node scripts/verify-signing-key.mjs <path|-> [--public <spki.der>] [--key-id <id>]
//
// Encrypted PKCS#8 PEM is read with SIGNING_KEY_PASSPHRASE, so the passphrase
// stays out of argv and shell history. `-` reads the key from stdin, which the
// signer also supports, so a caller can decrypt straight into the pipe.
import { readFileSync } from 'node:fs';
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PUBLIC = 'android/app/src/main/res/raw/resource_public_key.der';
const DEFAULT_KEY_ID = 'resources-20261008';
const PROBE = Buffer.from('game-hub signing key probe\n', 'utf8');

function fail(message) {
  console.error(`FAIL  ${message}`);
  process.exitCode = 1;
}

function fingerprint(spki) {
  return createHash('sha256').update(spki).digest('base64url').slice(0, 24);
}

function loadPrivate(bytes, passphrase) {
  const text = bytes.subarray(0, 32).toString('latin1').startsWith('-----BEGIN');
  const attempts = text
    ? [{ key: bytes, format: 'pem', passphrase }]
    : [{ key: bytes, format: 'der', type: 'pkcs8' }, { key: bytes, format: 'der', type: 'pkcs1' }];
  const errors = [];
  for (const options of attempts) {
    try {
      return createPrivateKey(options);
    } catch (error) {
      errors.push(`${options.format}${options.type ? '/' + options.type : ''}: ${error.message}`);
    }
  }
  throw new Error(errors.join('; '));
}

function parseArgs(argv) {
  const options = { publicKey: DEFAULT_PUBLIC, keyId: DEFAULT_KEY_ID, path: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--public') options.publicKey = argv[++i];
    else if (arg === '--key-id') options.keyId = argv[++i];
    else if (!options.path) options.path = arg;
    else throw new Error(`unexpected argument: ${arg}`);
  }
  if (!options.path) throw new Error('usage: verify-signing-key.mjs <private-key-path|-> [--public <spki.der>] [--key-id <id>]');
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const raw = options.path === '-' ? readFileSync(0) : readFileSync(options.path);
  const passphrase = process.env.SIGNING_KEY_PASSPHRASE;

  let key;
  try {
    key = loadPrivate(raw, passphrase);
  } catch (error) {
    const hint = passphrase ? '' : ' (if the PEM header says ENCRYPTED, set SIGNING_KEY_PASSPHRASE)';
    return fail(`cannot read private key: ${error.message}${hint}`);
  }
  if (key.type !== 'private') return fail(`not a private key (type=${key.type})`);
  if (key.asymmetricKeyType !== 'rsa') return fail(`expected RSA, got ${key.asymmetricKeyType}`);
  const bits = key.asymmetricKeyDetails?.modulusLength ?? 0;
  if (bits < 3072) return fail(`modulus is ${bits} bits, the shipped key is 3072`);

  const derivedSpki = createPublicKey(key).export({ format: 'der', type: 'spki' });
  let expected;
  try {
    expected = readFileSync(options.publicKey);
  } catch {
    return fail(`cannot read expected public key at ${options.publicKey}; pass --public <path>`);
  }
  if (!derivedSpki.equals(expected)) {
    console.error(`  derived fingerprint ${fingerprint(derivedSpki)}`);
    console.error(`  expected fingerprint ${fingerprint(expected)}`);
    return fail('this private key does not match the public key in the APK');
  }

  const signature = sign('RSA-SHA256', PROBE, key);
  if (signature.length !== 384) return fail(`signature is ${signature.length} bytes, expected 384`);
  if (!verify('RSA-SHA256', PROBE, createPublicKey(key), signature)) {
    return fail('RSA-SHA256 sign/verify round trip failed');
  }

  console.log(`OK    RSA ${bits} bits, key id ${options.keyId}`);
  console.log(`      public key matches ${options.publicKey}`);
  console.log(`      fingerprint ${fingerprint(derivedSpki)}`);
  console.log('      RSA-SHA256 round trip passed');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    fail(error.message);
  }
}
