const KEYS = Object.freeze({
  current4: 'lambda-lab-hub-v4',
  checkpoint4: 'lambda-lab-hub-checkpoint-v4',
  current3: 'lambda-lab-hub-v3',
  checkpoint3: 'lambda-lab-hub-checkpoint-v3',
  current2: 'lambda-lab-v2',
  checkpoint2: 'lambda-lab-checkpoint-v2',
  ready: 'lambda-lab-hub-mirror-ready-v3',
  journal: 'lambda-lab-hub-journal-v4'
});
const ALLOWED = new Set(Object.values(KEYS));

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

export function lambdaC5Projection(text, CurrentS, OldS) {
  const full = CurrentS.decode(text);
  const projected = JSON.parse(CurrentS.encode(full));
  projected.completed = projected.completed.filter(id => id <= 5);
  if (projected.mode === 'challenge' && projected.level > 4) {
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

export function createLambdaC5Storage(storage, CurrentS, OldS) {
  const read = key => storage.getItem(key);
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
    if (record.schemaVersion !== 1 || !Array.isArray(record.after)) throw Error('Invalid C5 journal');
    for (const entry of record.after) {
      if (!Array.isArray(entry) || entry.length !== 2 || !ALLOWED.has(entry[0]) || (entry[1] !== null && typeof entry[1] !== 'string')) throw Error('Invalid C5 journal');
      if ([KEYS.current4, KEYS.checkpoint4].includes(entry[0]) && entry[1] !== null) CurrentS.decode(entry[1]);
      if ([KEYS.current3, KEYS.checkpoint3, KEYS.current2, KEYS.checkpoint2].includes(entry[0]) && entry[1] !== null) OldS.decode(entry[1]);
    }
    for (const [key, value] of record.after) {
      if (value === null) storage.removeItem(key); else storage.setItem(key, value);
      if (read(key) !== value) throw Error('C5 journal recovery readback mismatch');
    }
    storage.removeItem(KEYS.journal);
  }
  function transaction(changes) {
    recover();
    const before = changes.map(([key]) => [key, read(key)]);
    const record = JSON.stringify({ schemaVersion: 1, before, after: changes });
    storage.setItem(KEYS.journal, record);
    if (read(KEYS.journal) !== record) throw Error('C5 journal write mismatch');
    for (const [key, value] of changes) {
      if (!ALLOWED.has(key)) throw Error('Invalid C5 storage key');
      if (value === null) storage.removeItem(key); else storage.setItem(key, value);
      if (read(key) !== value) throw Error('C5 storage readback mismatch');
    }
    storage.removeItem(KEYS.journal);
  }
  function legacyExists(current) {
    return read(current ? KEYS.current3 : KEYS.checkpoint3) !== null || read(current ? KEYS.current2 : KEYS.checkpoint2) !== null;
  }
  function persist(key, text) {
    const current = key === KEYS.current4;
    CurrentS.decode(text);
    const mirror = lambdaC5Projection(text, CurrentS, OldS);
    const state = flags();
    state[current ? 'auto' : 'checkpoint'] = true;
    transaction([
      [key, text],
      [current ? KEYS.current3 : KEYS.checkpoint3, mirror.v3],
      [current ? KEYS.current2 : KEYS.checkpoint2, mirror.v2],
      [KEYS.ready, JSON.stringify(state)]
    ]);
  }
  function getItem(key) {
    recover();
    if (key !== KEYS.current4 && key !== KEYS.checkpoint4) return read(key);
    const text = read(key);
    if (text !== null) { CurrentS.decode(text); return text; }
    if (legacyExists(key === KEYS.current4)) throw Error('C5 legacy migration requires conflict resolver');
    return null;
  }
  function setItem(key, text) {
    if (key === KEYS.current4 || key === KEYS.checkpoint4) return persist(key, text);
    return storage.setItem(key, text);
  }
  function removeItem(key) {
    recover();
    if (key === KEYS.current4 || key === KEYS.checkpoint4) {
      const current = key === KEYS.current4;
      const state = flags();
      state[current ? 'auto' : 'checkpoint'] = false;
      return transaction([
        [key, null],
        [current ? KEYS.current3 : KEYS.checkpoint3, null],
        [current ? KEYS.current2 : KEYS.checkpoint2, null],
        [KEYS.ready, JSON.stringify(state)]
      ]);
    }
    return storage.removeItem(key);
  }
  return { getItem, setItem, removeItem };
}
