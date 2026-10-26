const KEYS = Object.freeze({
  current4: 'lambda-lab-hub-v4',
  checkpoint4: 'lambda-lab-hub-checkpoint-v4',
  current3: 'lambda-lab-hub-v3',
  checkpoint3: 'lambda-lab-hub-checkpoint-v3',
  current2: 'lambda-lab-v2',
  checkpoint2: 'lambda-lab-checkpoint-v2',
  ready: 'lambda-lab-hub-mirror-ready-v3',
  journal: 'lambda-lab-hub-journal-v4',
  legacy4: 'lambda-lab-hub-legacy-v4',
  legacy3: 'lambda-lab-hub-legacy-v3',
  legacy1: 'lambda-lab-v1',
  oldJournal: 'lambda-lab-hub-journal-v3',
  oldEditArchive: 'lambda-lab-hub-old-edit-archive-v3',
  oldCheckpointArchive: 'lambda-lab-hub-old-checkpoint-archive-v3',
  upgradeBackup: 'lambda-lab-hub-upgrade-backup-v2',
  conflictArchive: 'lambda-lab-hub-c5-conflict-archive-v1',
  checkpointTombstone: 'lambda-lab-hub-c5-checkpoint-tombstone-v1',
  reviewState: 'lambda-lab-hub-c5-review-state-v1'
});
const ALLOWED = new Set(Object.values(KEYS));
export const LAMBDA_C5_STORAGE_KEYS = Object.freeze(Object.values(KEYS));

export function captureLambdaC5Snapshot(storage) {
  return Object.fromEntries(LAMBDA_C5_STORAGE_KEYS.map(key => [key, storage.getItem(key)]));
}

function oldBase(text, OldS) {
  const state = OldS.decode(text);
  const copy = JSON.parse(OldS.encode(state));
  copy.version = 2;
  copy.session = { ...copy.session, original: state.term, steps: 0 };
  delete copy.session.paths;
  copy.functions = copy.functions.map(({ name, term }) => ({ name, term }));
  copy.view.strategy = 'normal';
  copy.view.direction = 'left';
  return OldS.encode(copy);
}

function oldCanonical(text, OldS) {
  const state = JSON.parse(OldS.encode(OldS.decode(text)));
  delete state.savedAt;
  state.functions = state.functions.map(({ name, term }) => ({ name, term }));
  return JSON.stringify(state);
}

export function lambdaC5Projection(text, CurrentS, OldS) {
  const full = CurrentS.decode(text);
  const projected = JSON.parse(CurrentS.encode(full));
  projected.completed = projected.completed.filter(id => id <= 5);
  if (projected.level > 4) {
    projected.mode = 'free';
    projected.level = 0;
  }
  delete projected.view.numberEncoding;
  delete projected.view.decimalPlaces;
  projected.lambdaHubC5 = {
    schemaVersion: 1,
    completedBeyondLegacy: full.completed.filter(id => id > 5),
    numberEncoding: full.view.numberEncoding,
    decimalPlaces: full.view.decimalPlaces
  };
  const v3 = JSON.stringify(projected);
  OldS.decode(v3);
  return { v3, v2: oldBase(v3, OldS) };
}

function decodeLegacy(text, CurrentS, OldS) {
  const normalized = OldS.encode(OldS.decode(text));
  const full = CurrentS.decode(normalized);
  return { fullText: CurrentS.encode(full), summary: { mode: full.mode, level: full.level, completed: full.completed.length, draft: full.draft } };
}

function parseReady(raw) {
  if (raw === null) return { value: { auto: false, checkpoint: false }, valid: true, present: false };
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value.auto !== 'boolean' || typeof value.checkpoint !== 'boolean') return { value: null, valid: false, present: true };
    return { value, valid: true, present: true };
  } catch { return { value: null, valid: false, present: true }; }
}

function metadataProblems(snapshot) {
  const problems = [];
  if (snapshot[KEYS.reviewState] !== null) {
    try {
      const state = JSON.parse(snapshot[KEYS.reviewState]);
      if (!state || state.schemaVersion !== 1 || !state.pending || typeof state.pending.current !== 'boolean' || typeof state.pending.checkpoint !== 'boolean' ||
        (state.oldJournal !== null && typeof state.oldJournal !== 'string')) problems.push('review-state-invalid');
    } catch { problems.push('review-state-invalid'); }
  }
  const backup = snapshot[KEYS.upgradeBackup];
  if (backup !== null) {
    try {
      const value = JSON.parse(backup);
      if (!value || typeof value !== 'object' || Array.isArray(value) || !['auto', 'checkpoint', 'legacy'].every(k =>
        k in value && (value[k] === null || typeof value[k] === 'string'))) problems.push('upgrade-backup-invalid');
    } catch { problems.push('upgrade-backup-invalid'); }
  }
  for (const key of [KEYS.oldEditArchive, KEYS.oldCheckpointArchive]) {
    if (snapshot[key] === null) continue;
    try {
      const value = JSON.parse(snapshot[key]);
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) problems.push(`${key}-invalid`);
      else if (value.length) problems.push(`${key}-has-history`);
    } catch { problems.push(`${key}-invalid`); }
  }
  const archived = snapshot[KEYS.conflictArchive];
  if (archived !== null) {
    try {
      const value = JSON.parse(archived);
      if (!value || value.schemaVersion !== 1 || !Array.isArray(value.entries) || value.entries.some(entry =>
        !entry || typeof entry !== 'object' || !entry.snapshot || typeof entry.snapshot !== 'object' ||
        LAMBDA_C5_STORAGE_KEYS.some(key => !(key in entry.snapshot) || (entry.snapshot[key] !== null && typeof entry.snapshot[key] !== 'string')))) problems.push('c5-archive-invalid');
    } catch { problems.push('c5-archive-invalid'); }
  }
  return problems;
}

function journalAffected(raw) {
  if (raw === null) return { current: false, checkpoint: false };
  try {
    const record = JSON.parse(raw);
    if (record.schemaVersion !== 1 || !Array.isArray(record.after) || !record.after.length) throw Error('shape');
    const groups = { current: false, checkpoint: false };
    for (const entry of record.after) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string') throw Error('entry');
      const key = entry[0];
      if ([KEYS.current4, KEYS.current3, KEYS.current2].includes(key)) groups.current = true;
      else if ([KEYS.checkpoint4, KEYS.checkpoint3, KEYS.checkpoint2, KEYS.checkpointTombstone].includes(key)) groups.checkpoint = true;
      else if ([KEYS.ready, KEYS.conflictArchive, KEYS.oldJournal, KEYS.journal, KEYS.reviewState].includes(key)) { /* metadata follows affected data */ }
      else throw Error('unknown key');
    }
    if (!groups.current && !groups.checkpoint) return { current: true, checkpoint: true };
    return groups;
  } catch { return { current: true, checkpoint: true }; }
}

function candidateFromRaw(id, raw, CurrentS, OldS) {
  if (raw === null) return null;
  try {
    const result = id === 'v4'
      ? { fullText: raw, summary: (() => { const s = CurrentS.decode(raw); return { mode: s.mode, level: s.level, completed: s.completed.length, draft: s.draft }; })() }
      : decodeLegacy(raw, CurrentS, OldS);
    return { id, fullText: result.fullText, summary: result.summary };
  } catch { return null; }
}

function inspectGroup(snapshot, kind, CurrentS, OldS, problems, journalPending) {
  const current = kind === 'current';
  const key4 = current ? KEYS.current4 : KEYS.checkpoint4;
  const key3 = current ? KEYS.current3 : KEYS.checkpoint3;
  const key2 = current ? KEYS.current2 : KEYS.checkpoint2;
  const flag = current ? 'auto' : 'checkpoint';
  const ready = parseReady(snapshot[KEYS.ready]);
  const raw4 = snapshot[key4], raw3 = snapshot[key3], raw2 = snapshot[key2];
  const candidates = [candidateFromRaw('v4', raw4, CurrentS, OldS), candidateFromRaw('v3', raw3, CurrentS, OldS), candidateFromRaw('v2', raw2, CurrentS, OldS)].filter(Boolean);
  const invalidPresent = [raw4, raw3, raw2].some((raw, i) => raw !== null && ![candidateFromRaw('v4', raw4, CurrentS, OldS), candidateFromRaw('v3', raw3, CurrentS, OldS), candidateFromRaw('v2', raw2, CurrentS, OldS)][i]);
  let metadata = [...problems];
  if (!ready.valid) metadata.push('mirror-ready-invalid');
  if (journalPending) metadata.push('pending-journal');
  const oldArchive = snapshot[current ? KEYS.oldEditArchive : KEYS.oldCheckpointArchive];
  const hasOldHistory = oldArchive !== null && (() => { try { return JSON.parse(oldArchive).length > 0; } catch { return false; } })();
  if (hasOldHistory) metadata.push('old-adapter-history');
  if (invalidPresent) metadata.push('invalid-candidate');
  if (!current && snapshot[KEYS.checkpointTombstone] !== null) {
    let validTombstone = false;
    try { const value = JSON.parse(snapshot[KEYS.checkpointTombstone]); validTombstone = value?.schemaVersion === 1 && typeof value.source === 'string'; }
    catch { /* invalid marker below */ }
    if (!validTombstone || raw4 !== null || raw3 !== null || raw2 !== null || (ready.valid && ready.value.checkpoint)) metadata.push('checkpoint-tombstone-inconsistent');
  }
  const v4 = candidates.find(c => c.id === 'v4');
  const v3 = candidates.find(c => c.id === 'v3');
  const v2 = candidates.find(c => c.id === 'v2');
  const readyValue = ready.value;
  const raw3Present = raw3 !== null, raw2Present = raw2 !== null;
  let relation = false;
  if (v3 && v2) {
    // Compare v2 against the actual old adapter base(v3) using its canonical rule.
    try { relation = oldCanonical(raw2, OldS) === oldCanonical(oldBase(raw3, OldS), OldS); }
    catch { relation = false; }
  }
  let healthy = false;
  if (v4 && raw3Present && raw2Present && ready.valid && readyValue[flag] === true) {
    try {
      const expected = lambdaC5Projection(raw4, CurrentS, OldS);
      healthy = oldCanonical(raw3, OldS) === oldCanonical(expected.v3, OldS) &&
        oldCanonical(raw2, OldS) === oldCanonical(expected.v2, OldS);
    } catch { healthy = false; }
  }
  const tombstone = !current && raw4 !== null && raw3 === null && raw2 === null && ready.valid && ready.present && readyValue.checkpoint === false;
  const blockingMetadata = metadata.filter(item => item !== 'old-adapter-history');
  let status = 'conflict';
  let autoChoice = null;
  if (problems.length === 0 && blockingMetadata.length === 0 && healthy) status = 'healthy';
  else if (problems.length === 0 && blockingMetadata.length === 0 && tombstone && v4) status = 'tombstone';
  else if (metadata.length === 0 && raw4 === null) {
    const oldSourcesValid = (!raw3Present || !!v3) && (!raw2Present || !!v2);
    const flagsMatch = ready.valid && (!ready.present ||
      (readyValue[flag] ? raw3Present && raw2Present : !raw3Present && !raw2Present));
    if (oldSourcesValid && flagsMatch && (v3 || v2) && (!raw3Present || !raw2Present || relation)) {
      status = 'migrate';
      autoChoice = v3 ? 'v3' : 'v2';
    } else if (!raw3Present && !raw2Present && !readyValue?.[flag]) {
      status = 'empty';
    }
  } else if (metadata.length === 0 && raw4 === null && !raw3Present && !raw2Present) status = 'empty';
  if (status === 'conflict' && !metadata.length) metadata.push('mirror-divergence');
  return { kind, status, autoChoice, candidates, metadata, tombstone };
}

export function inspectLambdaC5Storage(storage, CurrentS, OldS) {
  const snapshot = captureLambdaC5Snapshot(storage);
  const problems = metadataProblems(snapshot);
  const oldAffected = journalAffected(snapshot[KEYS.oldJournal]);
  const c5Affected = journalAffected(snapshot[KEYS.journal]);
  let reviewState = null;
  let hasReviewState = false;
  if (snapshot[KEYS.reviewState] !== null) {
    try { reviewState = JSON.parse(snapshot[KEYS.reviewState]); hasReviewState = true; } catch { /* invalid review metadata is already a global problem */ }
  }
  const oldJournalChanged = hasReviewState && snapshot[KEYS.oldJournal] !== reviewState.oldJournal;
  const currentPending = hasReviewState
    ? reviewState.pending.current || oldJournalChanged || c5Affected.current
    : oldAffected.current || c5Affected.current;
  const checkpointPending = hasReviewState
    ? reviewState.pending.checkpoint || oldJournalChanged || c5Affected.checkpoint
    : oldAffected.checkpoint || c5Affected.checkpoint;
  const current = inspectGroup(snapshot, 'current', CurrentS, OldS, problems, currentPending);
  const checkpoint = inspectGroup(snapshot, 'checkpoint', CurrentS, OldS, problems, checkpointPending);
  return { snapshot, current, checkpoint };
}

function archiveSnapshot(raw, snapshot) {
  const archive = raw === null ? { schemaVersion: 1, entries: [] } : JSON.parse(raw);
  if (!archive || archive.schemaVersion !== 1 || !Array.isArray(archive.entries)) throw Error('Invalid C5 conflict archive; preserve original data');
  // The archive itself is appended in place, so nesting its previous raw bytes
  // in every new snapshot would cause quadratic growth. Prior entries remain
  // intact in this same archive; record their count and keep the snapshot slot null.
  const sourceSnapshot = { ...snapshot, [KEYS.conflictArchive]: null };
  if (!archive.entries.some(entry => JSON.stringify(entry.snapshot) === JSON.stringify(sourceSnapshot))) {
    archive.entries.push({ snapshot: sourceSnapshot, priorConflictArchiveEntries: archive.entries.length });
  }
  return archive;
}

function fullForChoice(group, choice) {
  const candidate = group.candidates.find(item => item.id === choice);
  if (!candidate) throw Error('Selected Lambda save candidate is unavailable');
  return candidate.fullText;
}

export function resolveLambdaC5Storage(storage, CurrentS, OldS, { kind, choice, inspection = null } = {}) {
  if (!['current', 'checkpoint'].includes(kind)) throw Error('Invalid Lambda conflict kind');
  inspection ??= inspectLambdaC5Storage(storage, CurrentS, OldS);
  const group = inspection[kind];
  if (!group) throw Error('Missing Lambda conflict inspection');
  if (choice === 'cancel') return { status: 'cancelled', inspection };
  if (group.status === 'healthy' || group.status === 'empty') return { status: group.status, inspection };
  if (group.status === 'migrate' && choice === undefined) choice = group.autoChoice;
  if (group.status === 'tombstone' && !['clear', 'v4'].includes(choice)) return { status: 'choice-required', inspection };
  const explicitTombstoneChoice = kind === 'checkpoint' && group.tombstone && ['clear', 'v4'].includes(choice);
  if (group.status === 'conflict' && !group.candidates.some(candidate => candidate.id === choice) &&
    !(choice === 'clear' && group.candidates.length === 0) && !explicitTombstoneChoice) return { status: 'choice-required', inspection };
  if (!['v4', 'v3', 'v2', 'clear'].includes(choice)) throw Error('Invalid Lambda conflict choice');
  if (JSON.stringify(captureLambdaC5Snapshot(storage)) !== JSON.stringify(inspection.snapshot)) throw Error('C5 storage changed since conflict inspection');

  const snapshot = inspection.snapshot;
  const archived = archiveSnapshot(snapshot[KEYS.conflictArchive], snapshot);
  const archiveText = JSON.stringify(archived);
  let expectedSnapshot = snapshot;
  const changes = [];
  if (snapshot[KEYS.journal] !== null) {
    // The new transaction journal uses the same key. Preserve the interrupted
    // one in a verified archive before replacing it, even if the archive write
    // later fails for quota reasons.
    if (JSON.stringify(captureLambdaC5Snapshot(storage)) !== JSON.stringify(snapshot)) throw Error('C5 storage changed since conflict inspection');
    storage.setItem(KEYS.conflictArchive, archiveText);
    if (storage.getItem(KEYS.conflictArchive) !== archiveText) throw Error('C5 conflict archive write mismatch; preserve original journal');
    expectedSnapshot = { ...snapshot, [KEYS.conflictArchive]: archiveText };
  } else changes.push([KEYS.conflictArchive, archiveText]);
  const ready = parseReady(snapshot[KEYS.ready]);
  const flags = ready.valid ? ready.value : { auto: false, checkpoint: false };
  const currentKind = kind === 'current';
  const key4 = currentKind ? KEYS.current4 : KEYS.checkpoint4;
  const key3 = currentKind ? KEYS.current3 : KEYS.checkpoint3;
  const key2 = currentKind ? KEYS.current2 : KEYS.checkpoint2;
  const oldAffected = journalAffected(snapshot[KEYS.oldJournal]);
  const c5Affected = journalAffected(snapshot[KEYS.journal]);
  let priorReview = null;
  if (snapshot[KEYS.reviewState] !== null) {
    priorReview = JSON.parse(snapshot[KEYS.reviewState]);
  }
  const oldJournalChanged = priorReview !== null && snapshot[KEYS.oldJournal] !== priorReview.oldJournal;
  const pending = priorReview === null
    ? { current: oldAffected.current || c5Affected.current, checkpoint: oldAffected.checkpoint || c5Affected.checkpoint }
    : {
        current: priorReview.pending.current || oldJournalChanged || c5Affected.current,
        checkpoint: priorReview.pending.checkpoint || oldJournalChanged || c5Affected.checkpoint
      };
  pending[kind] = false;
  const anyPending = pending.current || pending.checkpoint;
  changes.push([KEYS.oldJournal, anyPending ? snapshot[KEYS.oldJournal] : null],
    [KEYS.reviewState, anyPending ? JSON.stringify({ schemaVersion: 1, pending, oldJournal: snapshot[KEYS.oldJournal] }) : null]);
  if (choice === 'clear' && currentKind) {
    flags.auto = false;
    changes.push([key4, null], [key3, null], [key2, null], [KEYS.ready, JSON.stringify(flags)]);
  } else if (currentKind) {
    const fullText = fullForChoice(group, choice);
    const projection = lambdaC5Projection(fullText, CurrentS, OldS);
    flags.auto = true;
    changes.push([key4, fullText], [key3, projection.v3], [key2, projection.v2], [KEYS.ready, JSON.stringify(flags)]);
  } else if (choice === 'clear') {
    flags.checkpoint = false;
    changes.push([key4, null], [key3, null], [key2, null], [KEYS.ready, JSON.stringify(flags)],
      [KEYS.checkpointTombstone, JSON.stringify({ schemaVersion: 1, source: 'content3-clear', snapshot: true })]);
  } else {
    const fullText = fullForChoice(group, choice);
    const projection = lambdaC5Projection(fullText, CurrentS, OldS);
    flags.checkpoint = true;
    changes.push([key4, fullText], [key3, projection.v3], [key2, projection.v2], [KEYS.ready, JSON.stringify(flags)], [KEYS.checkpointTombstone, null]);
  }
  const c5 = createLambdaC5Storage(storage, CurrentS, OldS, { eventTarget: null });
  c5.commit(changes, expectedSnapshot);
  return { status: choice === 'clear' ? 'cleared' : 'resolved', choice, inspection };
}

export function createLambdaC5Storage(storage, CurrentS, OldS, { eventTarget = globalThis.window } = {}) {
  const read = key => storage.getItem(key);
  let invalidated = false;
  let observed = null;
  let priorSnapshot = null;
  try { priorSnapshot = captureLambdaC5Snapshot(storage); } catch { /* Retain an unavailable baseline and fail-stop on the first event. */ }
  function externalStorageChange(event = {}) {
    if (event.key !== null && !LAMBDA_C5_STORAGE_KEYS.includes(event.key)) return;
    invalidated = true;
    let snapshot = null, snapshotError = null;
    try { snapshot = captureLambdaC5Snapshot(storage); }
    catch (error) { snapshotError = String(error?.message ?? error); }
    observed = { event: { key: event.key ?? null, oldValue: event.oldValue ?? null, newValue: event.newValue ?? null }, previousSnapshot: priorSnapshot, snapshot, snapshotError };
    if (snapshot !== null) priorSnapshot = snapshot;
  }
  const assertActive = () => { if (invalidated) throw Error('C5 session invalidated by an external storage change; export observed values before continuing'); };
  const onStorage = event => externalStorageChange(event);
  eventTarget?.addEventListener?.('storage', onStorage);
  const flags = () => {
    const raw = read(KEYS.ready);
    const result = raw === null ? { auto: false, checkpoint: false } : JSON.parse(raw);
    if (!result || typeof result.auto !== 'boolean' || typeof result.checkpoint !== 'boolean') throw Error('Invalid C5 mirror readiness');
    return result;
  };
  function recover() {
    const raw = read(KEYS.journal);
    if (raw === null) return;
    const record = JSON.parse(raw);
    if (record.schemaVersion !== 1 || !Array.isArray(record.before) || !Array.isArray(record.after) ||
      record.before.length !== record.after.length) throw Error('Invalid C5 journal');
    const before = new Map();
    const after = new Map();
    for (const [entries, target] of [[record.before, before], [record.after, after]]) {
      for (const entry of entries) {
        if (!Array.isArray(entry) || entry.length !== 2 || !ALLOWED.has(entry[0]) || target.has(entry[0]) ||
          (entry[1] !== null && typeof entry[1] !== 'string')) throw Error('Invalid C5 journal');
        target.set(entry[0], entry[1]);
      }
    }
    if ([...before.keys()].some(key => !after.has(key))) throw Error('Invalid C5 journal');
    for (const entry of record.after) {
      if ([KEYS.current4, KEYS.checkpoint4].includes(entry[0]) && entry[1] !== null) CurrentS.decode(entry[1]);
      if ([KEYS.current3, KEYS.checkpoint3, KEYS.current2, KEYS.checkpoint2].includes(entry[0]) && entry[1] !== null) OldS.decode(entry[1]);
    }
    for (const key of before.keys()) {
      const now = read(key);
      if (now !== before.get(key) && now !== after.get(key)) throw Error('C5 recovery conflict: preserve observed storage values');
    }
    for (const [key, value] of record.after) {
      if (value === null) storage.removeItem(key); else storage.setItem(key, value);
      if (read(key) !== value) throw Error('C5 journal recovery readback mismatch');
    }
    storage.removeItem(KEYS.journal);
    priorSnapshot = captureLambdaC5Snapshot(storage);
  }
  function sameSnapshot(expected) {
    const actual = captureLambdaC5Snapshot(storage);
    return JSON.stringify(actual) === JSON.stringify(expected);
  }
  function transaction(changes, expectedSnapshot = null, skipRecover = false) {
    assertActive();
    if (!skipRecover) recover();
    if (expectedSnapshot && !sameSnapshot(expectedSnapshot)) throw Error('C5 storage changed since conflict inspection');
    if (!Array.isArray(changes) || changes.some(entry => !Array.isArray(entry) || entry.length !== 2 || !ALLOWED.has(entry[0])) ||
      new Set(changes.map(([key]) => key)).size !== changes.length) throw Error('Invalid C5 transaction');
    const before = changes.map(([key]) => [key, read(key)]);
    const record = JSON.stringify({ schemaVersion: 1, before, after: changes });
    storage.setItem(KEYS.journal, record);
    if (read(KEYS.journal) !== record) throw Error('C5 journal write mismatch');
    try {
      for (const [key, value] of changes) {
        if (value === null) storage.removeItem(key); else storage.setItem(key, value);
        if (read(key) !== value) throw Error('C5 storage readback mismatch');
      }
    } catch (error) {
      // If the first write (usually the archive) failed and every data key is
      // still byte-for-byte before, the journal itself can be safely removed.
      if (before.every(([key, value]) => read(key) === value)) storage.removeItem(KEYS.journal);
      throw error;
    }
    storage.removeItem(KEYS.journal);
    priorSnapshot = captureLambdaC5Snapshot(storage);
    if (expectedSnapshot) {
      const final = { ...expectedSnapshot };
      for (const [key, value] of changes) final[key] = value;
      final[KEYS.journal] = null;
      if (!sameSnapshot(final)) throw Error('C5 storage changed during conflict resolution');
    }
  }
  function verifyPrior(key) {
    const current = key === KEYS.current4;
    const v4Key = key;
    const v3Key = current ? KEYS.current3 : KEYS.checkpoint3;
    const v2Key = current ? KEYS.current2 : KEYS.checkpoint2;
    const flag = current ? 'auto' : 'checkpoint';
    const v4 = read(v4Key), v3 = read(v3Key), v2 = read(v2Key), ready = flags();
    if (v4 === null && v3 === null && v2 === null && ready[flag] === false) return;
    if (v4 === null || v3 === null || v2 === null || ready[flag] !== true) throw Error('C5 mirror conflict: explicit legacy resolver required');
    CurrentS.decode(v4);
    const expected = lambdaC5Projection(v4, CurrentS, OldS);
    if (oldCanonical(v3, OldS) !== oldCanonical(expected.v3, OldS) ||
      oldCanonical(v2, OldS) !== oldCanonical(expected.v2, OldS)) throw Error('C5 mirror conflict: explicit legacy resolver required');
  }
  function persist(key, text) {
    assertActive();
    const current = key === KEYS.current4;
    recover();
    verifyPrior(key);
    CurrentS.decode(text);
    const mirror = lambdaC5Projection(text, CurrentS, OldS);
    const state = flags();
    state[current ? 'auto' : 'checkpoint'] = true;
    transaction([
      [key, text],
      [current ? KEYS.current3 : KEYS.checkpoint3, mirror.v3],
      [current ? KEYS.current2 : KEYS.checkpoint2, mirror.v2],
      [KEYS.ready, JSON.stringify(state)],
      ...(!current ? [[KEYS.checkpointTombstone, null]] : [])
    ]);
  }
  function getItem(key) {
    assertActive();
    recover();
    if (!ALLOWED.has(key)) throw Error('C5 storage key is outside the Lambda allowlist');
    if (key !== KEYS.current4 && key !== KEYS.checkpoint4) return read(key);
    verifyPrior(key);
    const text = read(key);
    if (text !== null) { CurrentS.decode(text); return text; }
    return null;
  }
  function setItem(key, text) {
    assertActive();
    if (key === KEYS.current4 || key === KEYS.checkpoint4) return persist(key, text);
    if (key === KEYS.legacy4) { CurrentS.decode(text); return transaction([[key, text]]); }
    throw Error('C5 storage key is read-only or outside the Lambda allowlist');
  }
  function removeItem(key) {
    assertActive();
    recover();
    if (key === KEYS.current4 || key === KEYS.checkpoint4) {
      verifyPrior(key);
      const current = key === KEYS.current4;
      const state = flags();
      state[current ? 'auto' : 'checkpoint'] = false;
      return transaction([
        [key, null],
        [current ? KEYS.current3 : KEYS.checkpoint3, null],
        [current ? KEYS.current2 : KEYS.checkpoint2, null],
        [KEYS.ready, JSON.stringify(state)],
        ...(!current ? [[KEYS.checkpointTombstone, JSON.stringify({ schemaVersion: 1, source: 'content4-clear' })]] : [])
      ]);
    }
    if (key === KEYS.legacy4) return transaction([[key, null]]);
    throw Error('C5 storage key is read-only or outside the Lambda allowlist');
  }
  return {
    getItem, setItem, removeItem,
    commit: (changes, expectedSnapshot) => transaction(changes, expectedSnapshot, true),
    invalidate: () => externalStorageChange({ key: null }),
    exportObserved: () => observed === null ? null : JSON.stringify(observed),
    dispose: () => eventTarget?.removeEventListener?.('storage', onStorage)
  };
}
