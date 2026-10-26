import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TURING_REVISION, TURING_INTEGRATION } from '../scripts/turing-legacy-reader.mjs';
import { finalizeTuringSourceProof, turingSourceProof, validateTuringSourceProof } from '../scripts/turing-resource-integration.mjs';

test('Turing source proof recomputes adapted source hashes and rejects altered or extra fields', () => {
  const source = {
    id: 'turing',
    repository: 'https://github.com/xiaoxuhui/turing-machine-simulator.git',
    revision: TURING_REVISION,
    resourceIntegration: TURING_INTEGRATION,
  };
  const proof = turingSourceProof(source);
  assert.equal(
    validateTuringSourceProof(proof, source).adaptedSources['src/main.ts'],
    proof.adaptedSources['src/main.ts'],
  );

  const alteredSourceHash = structuredClone(proof);
  alteredSourceHash.adaptedSources['src/main.ts'] = '0'.repeat(64);
  assert.throws(() => validateTuringSourceProof(alteredSourceHash, source), /source proof changed: adaptedSources/);

  const extraHeader = structuredClone(proof);
  extraHeader.unreviewedHeader = 'accepted?';
  assert.throws(() => validateTuringSourceProof(extraHeader, source), /source proof fields changed/);

  const missingField = structuredClone(proof);
  delete missingField.runtimeFiles;
  assert.throws(() => validateTuringSourceProof(missingField, source), /source proof fields changed/);

  const outputFiles = [{ path: 'index.html', bytes: 1, sha256: 'a'.repeat(64) }];
  const proofDir = mkdtempSync(join(tmpdir(), 'turing-source-proof-'));
  const proofPath = join(proofDir, 'hub-source-proof.json');
  try {
    writeFileSync(proofPath, JSON.stringify(proof));
    const firstFinalization = finalizeTuringSourceProof(proofPath, source, outputFiles);
    const finalizedBytes = readFileSync(proofPath);
    const secondFinalization = finalizeTuringSourceProof(proofPath, source, outputFiles);
    assert.deepEqual(firstFinalization.outputs, outputFiles);
    assert.deepEqual(secondFinalization.outputs, outputFiles);
    assert.deepEqual(readFileSync(proofPath), finalizedBytes);

    const alteredOutputs = structuredClone(secondFinalization);
    alteredOutputs.outputs[0].sha256 = 'b'.repeat(64);
    writeFileSync(proofPath, JSON.stringify(alteredOutputs));
    assert.throws(() => finalizeTuringSourceProof(proofPath, source, outputFiles), /output proof changed/);

    const extraFinalField = { ...secondFinalization, unreviewedHeader: true };
    writeFileSync(proofPath, JSON.stringify(extraFinalField));
    assert.throws(() => finalizeTuringSourceProof(proofPath, source, outputFiles), /source proof fields changed/);
  } finally {
    rmSync(proofDir, { recursive: true, force: true });
  }
});
