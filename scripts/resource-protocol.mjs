import { createHash, createPublicKey, sign, verify } from 'node:crypto';

export const LIMITS = Object.freeze({ envelope: 1048576, payload: 524288, archive: 26214400, unpacked: 104857600, file: 20971520, files: 2000 });
export const IDS = ['conway', 'eml', 'light', 'turing'];
export const CONTRACTS = Object.freeze(Object.fromEntries(IDS.map(id => [id, `${id}-baseline-v1`])));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// Recursive descent preserves duplicate-key detection before JSON objects lose it.
export function strictJson(bytes, max = LIMITS.payload) {
  if (bytes.length > max) throw new Error('JSON byte limit');
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  let at = 0;
  const ws = () => { while (/\s/.test(text[at] ?? '') && at < text.length) { if (!/[\x20\t\r\n]/.test(text[at])) throw new Error('Invalid whitespace'); at++; } };
  function string() {
    const start = at++;
    while (at < text.length) {
      const c = text[at++];
      if (c === '\\') { at++; continue; }
      if (c === '"') return JSON.parse(text.slice(start, at));
    }
    throw new Error('Unterminated string');
  }
  function value(depth = 0) {
    if (depth > 32) throw new Error('JSON nesting limit');
    ws();
    if (text[at] === '"') return string();
    if (text[at] === '{') {
      at++; ws(); const result = Object.create(null); const keys = new Set();
      if (text[at] === '}') { at++; return result; }
      while (at < text.length) {
        ws(); if (text[at] !== '"') throw new Error('Expected key');
        const key = string(); if (keys.has(key)) throw new Error('Duplicate JSON key'); keys.add(key);
        ws(); if (text[at++] !== ':') throw new Error('Expected colon'); result[key] = value(depth + 1); ws();
        const end = text[at++]; if (end === '}') return result; if (end !== ',') throw new Error('Expected comma');
      }
    } else if (text[at] === '[') {
      at++; ws(); const result = []; if (text[at] === ']') { at++; return result; }
      while (at < text.length) { result.push(value(depth + 1)); ws(); const end = text[at++]; if (end === ']') return result; if (end !== ',') throw new Error('Expected comma'); }
    } else {
      const match = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(at));
      if (match) { at += match[0].length; const parsed = JSON.parse(match[0]); if (typeof parsed === 'number' && !Number.isFinite(parsed)) throw new Error('Number overflow'); return parsed; }
    }
    throw new Error('Invalid JSON');
  }
  const parsed = value(); ws(); if (at !== text.length) throw new Error('Trailing JSON'); return parsed;
}

export function safePath(path) {
  if (typeof path !== 'string' || path.length > 240 || !path || /[\\\x00-\x1f:]/.test(path) || path.startsWith('/') || path.split('/').length > 16 || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Unsafe resource path');
  if (/\.(?:dex|jar|so|class|apk)$/i.test(path)) throw new Error('Executable native resource');
  return path;
}
export function mime(path) {
  const extension = path.split('.').at(-1).toLowerCase();
  const types = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', txt: 'text/plain', md: 'text/plain' };
  return path === 'LICENSE' ? 'text/plain' : types[extension] ?? 'application/octet-stream';
}
function integer(n, min, max) { if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error('Invalid integer'); }
function text(s, max) { if (typeof s !== 'string' || !s || s.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(s)) throw new Error('Invalid text'); }
export function validateCatalog(catalog, sources, now = Date.now()) {
  if (catalog.schemaVersion !== 1 || catalog.channel !== 'game-hub-resources-v1') throw new Error('Unknown catalog protocol');
  integer(catalog.releaseId, 1, Number.MAX_SAFE_INTEGER);
  if (typeof catalog.catalogSequence !== 'string' || !/^[1-9][0-9]{0,18}$/.test(catalog.catalogSequence) || BigInt(catalog.catalogSequence) > 9223372036854775807n) throw new Error('Invalid sequence');
  const issued = Date.parse(catalog.issuedAt), expires = Date.parse(catalog.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued || expires - issued > 90 * 86400000 || now < issued - 300000 || now >= expires) throw new Error('Catalog clock or expiry');
  if (!Array.isArray(catalog.games) || catalog.games.length !== 4) throw new Error('Expected four games');
  const seen = new Set(); const assets = new Set();
  for (const game of catalog.games) {
    const source = sources.find(s => s.id === game.id);
    if (!source || seen.has(game.id) || !IDS.includes(game.id)) throw new Error('Unknown or duplicate game'); seen.add(game.id);
    if (game.sourceRepository !== source.repository || !/^[0-9a-f]{40}$/.test(game.sourceRevision)) throw new Error('Source identity');
    if (game.resourceProtocol !== 1 || game.storageContract !== CONTRACTS[game.id] || game.entryPage !== source.entryPage) throw new Error('Compatibility contract');
    integer(game.contentCode, 1, 2147483647); integer(game.minHostVersionCode, 3, 2147483647); integer(game.maxHostVersionCode, game.minHostVersionCode, 2147483647);
    integer(game.assetId, 1, Number.MAX_SAFE_INTEGER); if (assets.has(game.assetId)) throw new Error('Duplicate asset'); assets.add(game.assetId);
    integer(game.archiveBytes, 1, LIMITS.archive); if (!/^[0-9a-f]{64}$/.test(game.archiveSha256)) throw new Error('Archive digest');
    text(game.version, 64); text(game.releaseNotes, 2000);
    if (!Array.isArray(game.files) || !game.files.length || game.files.length > LIMITS.files) throw new Error('File count');
    const paths = new Set(); let total = 0;
    for (const file of game.files) {
      safePath(file.path); const key = file.path.toLowerCase();
      if (paths.has(key) || [...paths].some(p => key.startsWith(p + '/') || p.startsWith(key + '/'))) throw new Error('Conflicting path'); paths.add(key);
      integer(file.bytes, 0, LIMITS.file); total += file.bytes;
      if (total > LIMITS.unpacked || !/^[0-9a-f]{64}$/.test(file.sha256) || file.mime !== mime(file.path)) throw new Error('Invalid file manifest');
    }
    if (!game.files.some(f => f.path === game.entryPage) || !game.files.some(f => f.path === 'LICENSE')) throw new Error('Required resource missing');
  }
  return catalog;
}
export function assetName(game) { return `game-${game.id}-${game.contentCode}-${game.archiveSha256.slice(0, 12)}.zip`; }
function rsaKey(key) { const pub = createPublicKey(key); if (pub.asymmetricKeyType !== 'rsa' || pub.asymmetricKeyDetails.modulusLength !== 3072) throw new Error('Expected RSA3072'); return pub; }
export function signCatalog(payload, privateKey, keyId) {
  rsaKey(privateKey); text(keyId, 64); const bytes = Buffer.from(JSON.stringify(payload)); if (bytes.length > LIMITS.payload) throw new Error('Payload limit');
  return Buffer.from(JSON.stringify({ envelopeVersion: 1, keyId, payloadBase64: bytes.toString('base64'), signatureBase64: sign('RSA-SHA256', bytes, privateKey).toString('base64') }) + '\n');
}
export function verifyEnvelope(bytes, publicKey, keyId) {
  const envelope = strictJson(bytes, LIMITS.envelope);
  if (envelope.envelopeVersion !== 1 || envelope.keyId !== keyId || Object.keys(envelope).sort().join() !== 'envelopeVersion,keyId,payloadBase64,signatureBase64') throw new Error('Unknown envelope');
  function base64(text) { if (typeof text !== 'string' || !text || text.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) throw new Error('Invalid base64'); const bytes = Buffer.from(text, 'base64'); if (bytes.toString('base64') !== text) throw new Error('Noncanonical base64'); return bytes; }
  const payload = base64(envelope.payloadBase64); const signature = base64(envelope.signatureBase64);
  if (payload.length > LIMITS.payload || signature.length !== 384 || !verify('RSA-SHA256', payload, rsaKey(publicKey), signature)) throw new Error('Signature verification failed');
  return { catalog: strictJson(payload), payloadSha256: sha256(payload) };
}
