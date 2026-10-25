// This factory is emitted unchanged into the resource. Signed-catalog JSON rules are separate.
export function parseEMLJson(text, maxBytes = 15 * 1048576) {
  if (typeof text !== 'string' || text.length > 5 * 1048576 || new TextEncoder().encode(text).length > maxBytes) throw Error('EML文件超过大小限制。');
  // Detect duplicate keys without narrowing upstream numeric grammar (1.0/1e0 remain legal).
  // Expression depth is 64 upstream; allow its containing structures, unlike catalog depth32.
  let at = 0;
  const ws = () => { while (/[\x20\t\r\n]/.test(text[at] || '') && at < text.length) at++; };
  function string() {
    const start = at++;
    while (at < text.length) {
      const c = text[at++];
      if (c === '\\') { at++; continue; }
      if (c === '"') return JSON.parse(text.slice(start, at));
    }
    throw Error('EML JSON字符串未结束。');
  }
  function value(depth = 0) {
    if (depth > 128) throw Error('EML JSON嵌套超过安全上限。');
    ws();
    if (text[at] === '"') { string(); return; }
    if (text[at] === '{') {
      at++; ws(); const keys = new Set();
      if (text[at] === '}') { at++; return; }
      while (at < text.length) {
        ws(); if (text[at] !== '"') throw Error('EML JSON缺少字段名。');
        const key = string(); if (keys.has(key)) throw Error('EML JSON有重复字段。'); keys.add(key);
        ws(); if (text[at++] !== ':') throw Error('EML JSON缺少冒号。');
        value(depth + 1); ws(); const end = text[at++];
        if (end === '}') return; if (end !== ',') throw Error('EML JSON对象无效。');
      }
    } else if (text[at] === '[') {
      at++; ws(); if (text[at] === ']') { at++; return; }
      while (at < text.length) { value(depth + 1); ws(); const end = text[at++]; if (end === ']') return; if (end !== ',') throw Error('EML JSON数组无效。'); }
    } else {
      const match = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(at));
      if (match) { at += match[0].length; return; }
    }
    throw Error('EML JSON值无效。');
  }
  value(); ws(); if (at !== text.length) throw Error('EML JSON尾部无效。');
  return JSON.parse(text);
}

export function createEMLFormat(current, legacy, parseJson) {
  const extensionKey = 'gameHubEML', maxBytes = 5 * 1048576, maxReadBytes = 15 * 1048576, maxTextLength = 5 * 1048576;
  const baseKeys = ['schemaVersion','values','derivations','valueOrder','inputXId','inputYId','selectedValueId'];
  const copy = value => JSON.parse(JSON.stringify(value));
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }
  function checkedFull(text) {
    const parsed = parseJson(text, maxReadBytes);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || own(parsed, extensionKey)) throw Error('完整EML档不能嵌套兼容扩展。');
    const result = current.deserialize(text);
    if (!result.ok) throw Error(result.error);
    return result.state;
  }
  function project(fullText) {
    const state = checkedFull(fullText), values = Object.create(null), derivations = Object.create(null);
    for (const id of state.valueOrder) {
      const value = state.values[id];
      if (legacy.expression.isValidExpression(value.canonicalExpression) && legacy.expression.canonicalKey(value.canonicalExpression) === value.canonicalKey) values[id] = copy(value);
    }
    for (const [id, derivation] of Object.entries(state.derivations)) {
      // New validation tolerates direct self provenance; the frozen old cycle check cannot.
      if (derivation.operation === 'EML' && derivation.resultValueId !== derivation.xValueId && derivation.resultValueId !== derivation.yValueId && own(values, derivation.xValueId) && own(values, derivation.yValueId) && own(values, derivation.resultValueId) && legacy.expression.isValidExpression(derivation.rawExpression)) derivations[id] = copy(derivation);
    }
    for (const value of Object.values(values)) value.derivationIds = value.derivationIds.filter(id => own(derivations, id));
    const selected = id => id !== null && own(values, id) ? id : null;
    const base = {schemaVersion:2, values, derivations, valueOrder:state.valueOrder.filter(id => own(values,id)), inputXId:selected(state.inputXId), inputYId:selected(state.inputYId), selectedValueId:selected(state.selectedValueId)};
    const old = legacy.persistence.deserialize(JSON.stringify(base));
    if (!old.ok) throw Error('旧版基础校验失败：' + old.error);
    return {base, baseText:canonical(base), state, omitted:{values:state.valueOrder.length-base.valueOrder.length, derivations:Object.keys(state.derivations).length-Object.keys(derivations).length, customFunctions:state.customFunctions?.length || 0}};
  }
  function visibleBase(document) {
    const base = {};
    for (const key of baseKeys) if (own(document,key)) base[key] = document[key];
    const valid = legacy.persistence.deserialize(JSON.stringify(base));
    if (!valid.ok) throw Error('旧版基础无效：' + valid.error);
    return base;
  }
  function wrap(fullText) {
    const projected = project(fullText);
    const contents = JSON.stringify({...projected.base, app:'EML Workbench', [extensionKey]:{schemaVersion:1, fullText, baseText:projected.baseText}}, null, 2);
    parseJson(contents,maxBytes);
    const old = legacy.persistence.deserialize(contents);
    if (!old.ok) throw Error('兼容导出不能被旧版读取：' + old.error);
    return contents;
  }
  function read(text) {
    try {
      const document = parseJson(text,maxReadBytes);
      if (!document || typeof document !== 'object' || Array.isArray(document)) throw Error('EML文件须为对象。');
      if (!own(document, extensionKey)) return {ok:true, state:checkedFull(text), fullText:text, source:'standalone'};
      const extension = document[extensionKey];
      if (!extension || extension.schemaVersion !== 1 || typeof extension.fullText !== 'string' || typeof extension.baseText !== 'string') throw Error('EML兼容扩展版本或内容无效。');
      const full = project(extension.fullText);
      if (full.baseText !== extension.baseText) throw Error('完整EML档与基础绑定不一致。');
      const base = visibleBase(document);
      if (canonical(base) !== extension.baseText) return {ok:false, error:'旧版基础已改变，请明确选择基础或完整档。', conflict:{baseText:JSON.stringify(base),fullText:extension.fullText,originalText:text}};
      return {ok:true,state:full.state,fullText:extension.fullText,source:'full-extension',omitted:full.omitted};
    } catch (error) { return {ok:false,error:error.message}; }
  }
  function fullText(state) {
    const text = current.serialize(state); checkedFull(text); return text;
  }
  return {extensionKey,maxBytes,maxReadBytes,maxTextLength,canonical,project,wrap,read,fullText,serialize:state => wrap(fullText(state))};
}

export function emlFormatRuntime() {
  return Buffer.from(`(function(root){'use strict';const parse=${parseEMLJson.toString()};root.EMLHubFormat={create:(current,legacy)=>(${createEMLFormat.toString()})(current,legacy,parse)};})(globalThis);\n`);
}
