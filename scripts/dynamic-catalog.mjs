import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicKey } from 'node:crypto';
import { strictJson, signCatalog, verifyEnvelope } from './resource-protocol.mjs';
import { validateDynamicCatalog } from './dynamic-protocol.mjs';
import { captureReleaseSnapshot, validateReleaseSnapshot } from './resource-catalog.mjs';

const tag = 'game-resources-v2';
export function validateSuccessor(previous, next) {
  if (!previous) {
    if (next.catalogSequence !== '1') throw new Error('Initial dynamic sequence must be 1; later issuance needs signed history');
    return next;
  }
  validateDynamicCatalog(previous, Date.parse(previous.issuedAt));
  if (next.releaseId !== previous.releaseId || BigInt(next.catalogSequence) <= BigInt(previous.catalogSequence)) throw new Error('Dynamic release identity or sequence rollback');
  for (const old of previous.games) {
    const game = next.games.find(value => value.id === old.id);
    if (!game || game.contentCode < old.contentCode) throw new Error('Dynamic cumulative identity or content rollback');
    if (game.contentCode === old.contentCode) {
      const identity = value => JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'available').sort(([a], [b]) => a.localeCompare(b))));
      if (identity(game) !== identity(old)) throw new Error('Dynamic same-code metadata or archive reuse');
    }
  }
  return next;
}
export function validateSigningInput(payload, snapshot, previous = null, now = Date.now()) {
  validateDynamicCatalog(payload, now);
  validateReleaseSnapshot(payload, snapshot, tag);
  return validateSuccessor(previous, payload);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, input, keyPath, keyId, output, snapshotPath, previousPath] = process.argv.slice(2);
    if (mode === 'capture' && input && !keyPath) {
      writeFileSync(input, JSON.stringify(await captureReleaseSnapshot(fetch, tag), null, 2) + '\n', { flag: 'wx' });
      console.log('Captured fixed v2 public resource release and complete asset pages');
    } else if (mode === 'sign' && output && snapshotPath) {
      const payload = strictJson(readFileSync(input)), snapshot = strictJson(readFileSync(snapshotPath), 4 * 1048576);
      // Reject malformed protocol, incomplete assets and unsigned higher sequences before reading a key.
      validateDynamicCatalog(payload); validateReleaseSnapshot(payload, snapshot, tag);
      if (!previousPath) validateSuccessor(null, payload);
      const key = readFileSync(keyPath === '-' ? 0 : keyPath);
      try {
        const previous = previousPath ? verifyEnvelope(readFileSync(previousPath), key, keyId).catalog : null;
        validateSigningInput(payload, snapshot, previous);
        const signed = signCatalog(payload, key, keyId);
        const checked = verifyEnvelope(signed, key, keyId);
        validateDynamicCatalog(checked.catalog);
        writeFileSync(output, signed, { flag: 'wx' });
        console.log(`Signed v2 sequence ${payload.catalogSequence}; ${checked.payloadSha256}`);
      } finally { key.fill(0); }
    } else if (mode === 'verify' && !output) {
      const bytes = readFileSync(keyPath);
      const key = keyPath.endsWith('.der') ? createPublicKey({ key: bytes, format: 'der', type: 'spki' }) : bytes;
      const checked = verifyEnvelope(readFileSync(input), key, keyId);
      validateDynamicCatalog(checked.catalog);
      console.log(`Verified v2 sequence ${checked.catalog.catalogSequence}; ${checked.payloadSha256}`);
    } else throw new Error('Usage: dynamic-catalog.mjs capture snapshot.json | sign payload.json private-key-path key-id output.json snapshot.json [previous-signed.json] | verify signed.json public-key-path key-id');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
