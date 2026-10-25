// Resource-only project format. Factory and parser are emitted unchanged for the browser.
export function parseTuringJSON(text, maxBytes = 20_000_000) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > maxBytes) throw Error('图灵机文件超过大小限制。');
  let at = 0;
  const ws = () => { while (at < text.length && /[\x20\t\r\n]/.test(text[at])) at++; };
  function string() { const start = at++; while (at < text.length) { const c = text[at++]; if (c === '\\') { at++; continue; } if (c === '"') return JSON.parse(text.slice(start, at)); } throw Error('JSON字符串未结束。'); }
  function value(depth = 0) {
    if (depth > 128) throw Error('JSON嵌套超过安全上限。'); ws();
    if (text[at] === '"') { string(); return; }
    if (text[at] === '{') { at++; ws(); const keys = new Set(); if (text[at] === '}') { at++; return; } while (at < text.length) { ws(); if (text[at] !== '"') throw Error('JSON缺少字段名。'); const name = string(); if (keys.has(name)) throw Error('JSON有重复字段。'); keys.add(name); ws(); if (text[at++] !== ':') throw Error('JSON缺少冒号。'); value(depth + 1); ws(); const end = text[at++]; if (end === '}') return; if (end !== ',') throw Error('JSON对象无效。'); } }
    else if (text[at] === '[') { at++; ws(); if (text[at] === ']') { at++; return; } while (at < text.length) { value(depth + 1); ws(); const end = text[at++]; if (end === ']') return; if (end !== ',') throw Error('JSON数组无效。'); } }
    else { const match = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(at)); if (match) { at += match[0].length; return; } }
    throw Error('JSON值无效。');
  }
  value(); ws(); if (at !== text.length) throw Error('JSON尾部无效。'); return JSON.parse(text);
}

export function createTuringFormat(current, legacy, parseJSON) {
  const extensionKey = 'gameHubTuring', maxBytes = 20_000_000;
  const baseKeys = ['format','version','name','description','input','blankSymbol','initialState','acceptStates','rejectStates','haltStates','rules','maxSteps','speed'];
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  function canonical(value) { if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'; if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'; return JSON.stringify(value); }
  function checkedFull(text) { const parsed = parseJSON(text, maxBytes); if (!parsed || own(parsed, extensionKey)) throw Error('完整项目不能嵌套兼容扩展。'); return current.validateProjectData(parsed); }
  function finite(value) { if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000) throw Error('Max的旧版兼容步数须明确选择1–1000000整数；有限值不等价于Max。'); return value; }
  function project(fullText, legacyMaxSteps) {
    const state = checkedFull(fullText), limit = state.maxSteps === null ? finite(legacyMaxSteps) : finite(state.maxSteps);
    const base = Object.fromEntries(baseKeys.map(key => [key, key === 'maxSteps' ? limit : state[key]])); legacy.validateProjectData(base);
    return { base, baseText: canonical(base), legacyMaxSteps: limit, fullText, state, isLimitedView: state.maxSteps === null };
  }
  function wrap(fullText, legacyMaxSteps) { const result = project(fullText, legacyMaxSteps), text = JSON.stringify({ ...result.base, [extensionKey]: { schemaVersion: 1, fullText, baseText: result.baseText, legacyMaxSteps: result.legacyMaxSteps } }); if (new TextEncoder().encode(text).length > maxBytes) throw Error('兼容文件包含基础与完整原文，超过20 MB；请单独导出完整项目。'); return text; }
  function read(text) {
    try {
      const parsed = parseJSON(text, maxBytes);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('项目必须是对象。');
      if (!own(parsed, extensionKey)) return { ok: true, source: 'standalone', fullText: text, state: checkedFull(text), originalText: text };
      const extension = parsed[extensionKey];
      if (!extension || extension.schemaVersion !== 1 || typeof extension.fullText !== 'string' || typeof extension.baseText !== 'string') throw Error('兼容扩展版本或原文无效。');
      const result = project(extension.fullText, extension.legacyMaxSteps);
      if (extension.baseText !== result.baseText || extension.legacyMaxSteps !== result.legacyMaxSteps) throw Error('完整原文与兼容基础绑定无效。');
      legacy.validateProjectData(parsed);
      const base = Object.fromEntries(baseKeys.map(key => [key, parsed[key]])), baseText = canonical(base);
      if (baseText !== extension.baseText) return { ok: false, conflict: { fullText: extension.fullText, baseText, originalText: text, legacyMaxSteps: extension.legacyMaxSteps }, error: '旧版已修改基础项目，请明确选择基础、完整或取消。' };
      return { ok: true, source: 'full-extension', fullText: extension.fullText, state: result.state, legacyMaxSteps: result.legacyMaxSteps, originalText: text };
    } catch (error) { return { ok: false, error: error.message }; }
  }
  return { extensionKey, baseKeys, maxBytes, maxReadBytes: maxBytes, canonical, project, wrap, read, validateFull: checkedFull };
}

export function turingFormatRuntime() { return Buffer.from(`(function(root){'use strict';const parse=${parseTuringJSON.toString()};root.TuringHubFormat={create:(current,legacy)=>(${createTuringFormat.toString()})(current,legacy,parse),parse};})(globalThis);\n`); }
