import test from 'node:test';
import assert from 'node:assert/strict';
import { TURING_REVISION, TURING_INTEGRATION } from '../scripts/turing-legacy-reader.mjs';
import { turingSourceProof, validateTuringSourceProof } from '../scripts/turing-resource-integration.mjs';

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
});
