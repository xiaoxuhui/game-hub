// Browser port of this repository resource-protocol scanner; no Node dependency.
// Recursive descent preserves duplicate-key detection before JSON objects lose it.
export function strictJson(bytes, max = 4*1024*1024) {
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
      if (match) {
        at += match[0].length; const parsed = JSON.parse(match[0]);
        if (typeof parsed === 'number' && !Number.isFinite(parsed)) throw new Error('Number overflow');
        // JS folds 10.0/10e0 into integer 10, while Android preserves Double and rejects
        // it in signed integer fields. Never silently accept that different raw grammar.
        if (typeof parsed === 'number' && Number.isInteger(parsed) && /[.eE]/.test(match[0])) throw new Error('Noncanonical integer');
        return parsed;
      }
    }
    throw new Error('Invalid JSON');
  }
  const parsed = value(); ws(); if (at !== text.length) throw new Error('Trailing JSON'); return parsed;
}

