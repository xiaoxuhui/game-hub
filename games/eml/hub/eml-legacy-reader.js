(function(root){'use strict';const globalThis={};const factories={"expression.js":function(module,require){
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.EMLExpression = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TYPES = Object.freeze({
    CONSTANT: "constant",
    INTEGER: "integer",
    NEG: "neg",
    ADD: "add",
    SUB: "sub",
    MUL: "mul",
    DIV: "div",
    POW: "pow",
    LN: "ln",
    SQRT: "sqrt",
    SIN: "sin",
  });

  const constant = (name) => ({ type: TYPES.CONSTANT, name });
  const integer = (value) => ({ type: TYPES.INTEGER, value: Number(value) });
  const neg = (child) => ({ type: TYPES.NEG, child });
  const add = (left, right) => ({ type: TYPES.ADD, left, right });
  const sub = (left, right) => ({ type: TYPES.SUB, left, right });
  const mul = (left, right) => ({ type: TYPES.MUL, left, right });
  const div = (numerator, denominator) => ({ type: TYPES.DIV, numerator, denominator });
  const pow = (base, exponent) => ({ type: TYPES.POW, base, exponent });
  const ln = (argument) => ({ type: TYPES.LN, argument });
  const sqrt = (argument) => ({ type: TYPES.SQRT, argument });
  const sin = (argument) => ({ type: TYPES.SIN, argument });

  const ONE = integer(1);
  const ZERO = integer(0);
  const E = constant("e");
  const PI = constant("pi");
  const I = constant("i");
  const MAX_EXPRESSION_DEPTH = 64;
  const MAX_EXPRESSION_NODES = 2000;
  const ALLOWED_CONSTANTS = new Set(["e", "pi", "i"]);

  function canonicalKey(expression) {
    switch (expression.type) {
      case TYPES.CONSTANT:
        return `const:${expression.name}`;
      case TYPES.INTEGER:
        return `int:${expression.value}`;
      case TYPES.NEG:
        return `neg(${canonicalKey(expression.child)})`;
      case TYPES.ADD: {
        const keys = [canonicalKey(expression.left), canonicalKey(expression.right)].sort();
        return `add(${keys[0]},${keys[1]})`;
      }
      case TYPES.SUB:
        return `sub(${canonicalKey(expression.left)},${canonicalKey(expression.right)})`;
      case TYPES.MUL: {
        const keys = [canonicalKey(expression.left), canonicalKey(expression.right)].sort();
        return `mul(${keys[0]},${keys[1]})`;
      }
      case TYPES.DIV:
        return `div(${canonicalKey(expression.numerator)},${canonicalKey(expression.denominator)})`;
      case TYPES.POW:
        return `pow(${canonicalKey(expression.base)},${canonicalKey(expression.exponent)})`;
      case TYPES.LN:
        return `ln(${canonicalKey(expression.argument)})`;
      case TYPES.SQRT:
        return `sqrt(${canonicalKey(expression.argument)})`;
      case TYPES.SIN:
        return `sin(${canonicalKey(expression.argument)})`;
      default:
        throw new Error(`未知表达式类型：${expression.type}`);
    }
  }

  const isSame = (left, right) => canonicalKey(left) === canonicalKey(right);
  const isInteger = (expression, value) => expression.type === TYPES.INTEGER && expression.value === value;
  const isConstant = (expression, name) => expression.type === TYPES.CONSTANT && expression.name === name;

  function precedence(expression) {
    if ([TYPES.ADD, TYPES.SUB].includes(expression.type)) return 1;
    if ([TYPES.MUL, TYPES.DIV].includes(expression.type)) return 2;
    if (expression.type === TYPES.POW) return 3;
    return 4;
  }

  function render(expression, parentPrecedence = 0) {
    const ownPrecedence = precedence(expression);
    let text;
    switch (expression.type) {
      case TYPES.CONSTANT:
        text = expression.name === "pi" ? "π" : expression.name;
        break;
      case TYPES.INTEGER:
        text = String(expression.value);
        break;
      case TYPES.NEG:
        if (expression.child.type === TYPES.NEG) {
          text = `-(${render(expression.child)})`;
        } else if (
          expression.child.type === TYPES.MUL &&
          [expression.child.left, expression.child.right].every((part) =>
            [TYPES.CONSTANT, TYPES.INTEGER].includes(part.type)
          )
        ) {
          text = `-${render(expression.child, 2)}`;
        } else {
          text = `-${render(expression.child, ownPrecedence)}`;
        }
        break;
      case TYPES.ADD:
        text = `${render(expression.left, ownPrecedence)} + ${render(expression.right, ownPrecedence)}`;
        break;
      case TYPES.SUB:
        text = `${render(expression.left, ownPrecedence)} - ${render(expression.right, ownPrecedence + 1)}`;
        break;
      case TYPES.MUL: {
        const leftText = render(expression.left, ownPrecedence);
        const rightText = render(expression.right, ownPrecedence);
        const compact = [expression.left, expression.right].every((part) =>
          [TYPES.CONSTANT, TYPES.INTEGER].includes(part.type)
        );
        text = compact ? `${leftText}${rightText}` : `${leftText} × ${rightText}`;
        break;
      }
      case TYPES.DIV:
        text = `${render(expression.numerator, ownPrecedence)} / ${render(expression.denominator, ownPrecedence + 1)}`;
        break;
      case TYPES.POW: {
        const baseText = render(expression.base, ownPrecedence);
        const exponentText = render(expression.exponent);
        text = `${baseText}^(${exponentText})`;
        break;
      }
      case TYPES.LN:
        text = `ln(${render(expression.argument)})`;
        break;
      case TYPES.SQRT:
        text = `√(${render(expression.argument)})`;
        break;
      case TYPES.SIN:
        text = `sin(${render(expression.argument)})`;
        break;
      default:
        throw new Error(`未知表达式类型：${expression.type}`);
    }
    return ownPrecedence < parentPrecedence ? `(${text})` : text;
  }

  function approximate(expression) {
    const make = (re, im = 0) => ({ re, im });
    const addComplex = (a, b) => make(a.re + b.re, a.im + b.im);
    const subComplex = (a, b) => make(a.re - b.re, a.im - b.im);
    const mulComplex = (a, b) => make(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
    const divComplex = (a, b) => {
      const denominator = b.re * b.re + b.im * b.im;
      if (denominator === 0) return null;
      return make(
        (a.re * b.re + a.im * b.im) / denominator,
        (a.im * b.re - a.re * b.im) / denominator
      );
    };
    const expComplex = (z) => {
      const scale = Math.exp(z.re);
      return make(scale * Math.cos(z.im), scale * Math.sin(z.im));
    };
    const logComplex = (z) => {
      const magnitudeSquared = z.re * z.re + z.im * z.im;
      if (magnitudeSquared === 0) return null;
      return make(0.5 * Math.log(magnitudeSquared), Math.atan2(z.im, z.re));
    };

    switch (expression.type) {
      case TYPES.CONSTANT:
        if (expression.name === "e") return make(Math.E);
        if (expression.name === "pi") return make(Math.PI);
        if (expression.name === "i") return make(0, 1);
        return null;
      case TYPES.INTEGER:
        return make(expression.value);
      case TYPES.NEG: {
        const value = approximate(expression.child);
        return value ? make(-value.re, -value.im) : null;
      }
      case TYPES.ADD: {
        const left = approximate(expression.left);
        const right = approximate(expression.right);
        return left && right ? addComplex(left, right) : null;
      }
      case TYPES.SUB: {
        const left = approximate(expression.left);
        const right = approximate(expression.right);
        return left && right ? subComplex(left, right) : null;
      }
      case TYPES.MUL: {
        const left = approximate(expression.left);
        const right = approximate(expression.right);
        return left && right ? mulComplex(left, right) : null;
      }
      case TYPES.DIV: {
        const numerator = approximate(expression.numerator);
        const denominator = approximate(expression.denominator);
        return numerator && denominator ? divComplex(numerator, denominator) : null;
      }
      case TYPES.POW: {
        const base = approximate(expression.base);
        const exponent = approximate(expression.exponent);
        if (!base || !exponent) return null;
        if (Math.abs(base.re - Math.E) < 1e-12 && Math.abs(base.im) < 1e-12) return expComplex(exponent);
        const logBase = logComplex(base);
        return logBase ? expComplex(mulComplex(exponent, logBase)) : null;
      }
      case TYPES.LN: {
        const argument = approximate(expression.argument);
        return argument ? logComplex(argument) : null;
      }
      case TYPES.SQRT: {
        const argument = approximate(expression.argument);
        if (!argument) return null;
        const magnitude = Math.hypot(argument.re, argument.im);
        return make(
          Math.sqrt((magnitude + argument.re) / 2),
          Math.sign(argument.im || 1) * Math.sqrt(Math.max(0, (magnitude - argument.re) / 2))
        );
      }
      case TYPES.SIN: {
        const argument = approximate(expression.argument);
        return argument
          ? make(Math.sin(argument.re) * Math.cosh(argument.im), Math.cos(argument.re) * Math.sinh(argument.im))
          : null;
      }
      default:
        return null;
    }
  }

  function validateExpression(expression, options) {
    const maxDepth = options?.maxDepth ?? MAX_EXPRESSION_DEPTH;
    const maxNodes = options?.maxNodes ?? MAX_EXPRESSION_NODES;
    const active = new Set();
    let nodeCount = 0;

    function visit(node, depth) {
      if (!node || typeof node !== "object" || Array.isArray(node)) return false;
      if (depth > maxDepth || nodeCount >= maxNodes || active.has(node)) return false;
      nodeCount += 1;
      active.add(node);
      let valid = false;
      switch (node.type) {
        case TYPES.CONSTANT:
          valid = ALLOWED_CONSTANTS.has(node.name);
          break;
        case TYPES.INTEGER:
          valid = typeof node.value === "number" && Number.isSafeInteger(node.value);
          break;
        case TYPES.NEG:
          valid = visit(node.child, depth + 1);
          break;
        case TYPES.ADD:
        case TYPES.SUB:
        case TYPES.MUL:
          valid = visit(node.left, depth + 1) && visit(node.right, depth + 1);
          break;
        case TYPES.DIV:
          valid = visit(node.numerator, depth + 1) && visit(node.denominator, depth + 1);
          break;
        case TYPES.POW:
          valid = visit(node.base, depth + 1) && visit(node.exponent, depth + 1);
          break;
        case TYPES.LN:
        case TYPES.SQRT:
        case TYPES.SIN:
          valid = visit(node.argument, depth + 1);
          break;
        default:
          valid = false;
      }
      active.delete(node);
      return valid;
    }

    return { ok: visit(expression, 0), nodeCount };
  }

  function isValidExpression(expression, options) {
    return validateExpression(expression, options).ok;
  }

  return {
    TYPES,
    constant,
    integer,
    neg,
    add,
    sub,
    mul,
    div,
    pow,
    ln,
    sqrt,
    sin,
    ONE,
    ZERO,
    E,
    PI,
    I,
    MAX_EXPRESSION_DEPTH,
    MAX_EXPRESSION_NODES,
    canonicalKey,
    isSame,
    isInteger,
    isConstant,
    render,
    approximate,
    isValidExpression,
    validateExpression,
  };
});

},
"value-store.js":function(module,require){
(function (root, factory) {
  const expression = typeof module === "object" && module.exports
    ? require("./expression.js")
    : root.EMLExpression;
  const api = factory(expression);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.EMLValueStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Expr) {
  "use strict";

  const encodeId = (prefix, key) => `${prefix}:${encodeURIComponent(key)}`;
  const valueIdFor = (canonicalKey) => encodeId("value", canonicalKey);
  const derivationIdFor = (formulaKey) => encodeId("derivation", formulaKey);
  const initialValueId = valueIdFor(Expr.canonicalKey(Expr.ONE));
  const DEFAULT_TREE_DEPTH = 4;
  const MAX_TREE_DEPTH = 32;
  const MAX_TREE_NODES = 800;

  function createInitialValue() {
    return {
      id: initialValueId,
      canonicalExpression: Expr.ONE,
      canonicalKey: Expr.canonicalKey(Expr.ONE),
      displayText: "1",
      protected: true,
      derivationIds: [],
      createdAt: new Date(0).toISOString(),
    };
  }

  function createInitialState() {
    const initialValue = createInitialValue();
    return {
      schemaVersion: 2,
      values: { [initialValue.id]: initialValue },
      derivations: {},
      valueOrder: [initialValue.id],
      inputXId: null,
      inputYId: null,
      selectedValueId: null,
    };
  }

  const cloneState = (state) => JSON.parse(JSON.stringify(state));

  function formulaKeyFor(evaluation) {
    return `eml(${Expr.canonicalKey(evaluation.xExpression)},${Expr.canonicalKey(evaluation.yExpression)})->${evaluation.canonicalKey}`;
  }

  function addEvaluation(state, evaluation, xValueId, yValueId) {
    if (!evaluation || !evaluation.ok) return { state, status: "invalid" };
    if (!state.values[xValueId] || !state.values[yValueId]) return { state, status: "missing-input" };

    const next = cloneState(state);
    const resultValueId = valueIdFor(evaluation.canonicalKey);
    const formulaKey = formulaKeyFor(evaluation);
    const derivationId = derivationIdFor(formulaKey);
    const existingValue = next.values[resultValueId];
    const existingDerivation = next.derivations[derivationId];

    if (!existingValue) {
      next.values[resultValueId] = {
        id: resultValueId,
        canonicalExpression: evaluation.resultExpression,
        canonicalKey: evaluation.canonicalKey,
        displayText: evaluation.displayText,
        protected: evaluation.canonicalKey === Expr.canonicalKey(Expr.ONE),
        derivationIds: [],
        createdAt: new Date().toISOString(),
      };
      next.valueOrder.push(resultValueId);
    }

    if (!existingDerivation) {
      next.derivations[derivationId] = {
        id: derivationId,
        formulaKey,
        operation: "EML",
        xValueId,
        yValueId,
        rawExpression: evaluation.rawExpression,
        resultValueId,
        directFormula: evaluation.directFormula,
        rewriteSteps: evaluation.rewriteSteps,
        createdAt: new Date().toISOString(),
      };
      next.values[resultValueId].derivationIds.push(derivationId);
    } else {
      Object.assign(existingDerivation, {
        xValueId,
        yValueId,
        rawExpression: evaluation.rawExpression,
        resultValueId,
        directFormula: evaluation.directFormula,
        rewriteSteps: evaluation.rewriteSteps,
      });
    }

    next.selectedValueId = resultValueId;
    return {
      state: next,
      resultValueId,
      status: existingDerivation ? "duplicate-formula" : existingValue ? "added-formula" : "added-value",
    };
  }

  function isReferenced(state, valueId) {
    return Object.values(state.derivations).some(
      (derivation) => derivation.xValueId === valueId || derivation.yValueId === valueId
    );
  }

  function deleteValue(state, valueId) {
    const value = state.values[valueId];
    if (!value) return { state, status: "missing" };
    if (value.protected || valueId === initialValueId) return { state, status: "protected" };
    if (isReferenced(state, valueId)) return { state, status: "referenced" };

    const next = cloneState(state);
    for (const derivationId of value.derivationIds) delete next.derivations[derivationId];
    delete next.values[valueId];
    next.valueOrder = next.valueOrder.filter((id) => id !== valueId);
    if (next.inputXId === valueId) next.inputXId = null;
    if (next.inputYId === valueId) next.inputYId = null;
    if (next.selectedValueId === valueId) next.selectedValueId = null;
    return { state: next, status: "deleted" };
  }

  function clearNonInitial() {
    return createInitialState();
  }

  function selectValue(state, valueId) {
    if (!state.values[valueId]) return state;
    const next = cloneState(state);
    next.selectedValueId = valueId;
    return next;
  }

  function setInput(state, inputName, valueId) {
    if (!state.values[valueId] || !["x", "y"].includes(inputName)) return state;
    const next = cloneState(state);
    if (inputName === "x") next.inputXId = valueId;
    if (inputName === "y") next.inputYId = valueId;
    return next;
  }

  function buildValueTree(state, valueId, options) {
    const maxDepth = options?.maxDepth ?? Infinity;
    const maxNodes = options?.maxNodes ?? Infinity;
    const budget = { count: 0 };

    function buildNode(currentValueId, path, depth) {
      const value = state.values[currentValueId];
      if (!value) return { type: "missing", valueId: currentValueId };
      if (path.has(currentValueId)) return { type: "cycle", valueId: currentValueId, label: value.displayText };
      if (budget.count >= maxNodes) {
        return { type: "deferred", valueId: currentValueId, label: value.displayText, reason: "node-limit" };
      }
      budget.count += 1;
      if (depth >= maxDepth && value.derivationIds.length > 0) {
        return { type: "deferred", valueId: currentValueId, label: value.displayText, reason: "depth-limit" };
      }

      const nextPath = new Set(path);
      nextPath.add(currentValueId);
      return {
        type: "value",
        valueId: currentValueId,
        label: value.displayText,
        initial: value.protected && value.derivationIds.length === 0,
        derivations: value.derivationIds.map((derivationId) => {
          const derivation = state.derivations[derivationId];
          if (!derivation) return { type: "missing-derivation", derivationId };
          return {
            type: "derivation",
            derivationId,
            directFormula: derivation.directFormula,
            rewriteSteps: derivation.rewriteSteps,
            x: buildNode(derivation.xValueId, nextPath, depth + 1),
            y: buildNode(derivation.yValueId, nextPath, depth + 1),
          };
        }),
      };
    }

    return buildNode(valueId, new Set(), 0);
  }

  function treeHasDeferredBranches(node) {
    if (!node || typeof node !== "object") return false;
    if (node.type === "deferred") return true;
    if (!Array.isArray(node.derivations)) return false;
    return node.derivations.some((derivation) => (
      derivation && (treeHasDeferredBranches(derivation.x) || treeHasDeferredBranches(derivation.y))
    ));
  }

  function getDetails(state, valueId, treeOptions) {
    const value = state.values[valueId];
    if (!value) return null;
    return {
      value,
      directFormulas: value.derivationIds
        .map((id) => state.derivations[id])
        .filter(Boolean)
        .map((derivation) => derivation.directFormula),
      tree: buildValueTree(state, valueId, treeOptions),
    };
  }

  return {
    initialValueId,
    DEFAULT_TREE_DEPTH,
    MAX_TREE_DEPTH,
    MAX_TREE_NODES,
    valueIdFor,
    formulaKeyFor,
    createInitialState,
    addEvaluation,
    deleteValue,
    clearNonInitial,
    selectValue,
    setInput,
    isReferenced,
    buildValueTree,
    treeHasDeferredBranches,
    getDetails,
  };
});

},
"persistence.js":function(module,require){
(function (root, factory) {
  const expression = typeof module === "object" && module.exports
    ? require("./expression.js")
    : root.EMLExpression;
  const valueStore = typeof module === "object" && module.exports
    ? require("./value-store.js")
    : root.EMLValueStore;
  const api = factory(expression, valueStore);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.EMLPersistence = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Expr, ValueStore) {
  "use strict";

  const CACHE_KEY = "eml_workbench_v2";
  const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
  const MAX_VALUES = 2000;
  const MAX_DERIVATIONS = 5000;
  const MAX_REWRITE_STEPS = 200;
  const MAX_TEXT_LENGTH = 2000;

  const isShortString = (value, maximum = MAX_TEXT_LENGTH) => (
    typeof value === "string" && value.length <= maximum
  );

  function hasDependencyCycle(state) {
    const visiting = new Set();
    const visited = new Set();

    function visit(valueId) {
      if (visiting.has(valueId)) return true;
      if (visited.has(valueId)) return false;
      visiting.add(valueId);
      const value = state.values[valueId];
      for (const derivationId of value.derivationIds) {
        const derivation = state.derivations[derivationId];
        if (derivation && (visit(derivation.xValueId) || visit(derivation.yValueId))) return true;
      }
      visiting.delete(valueId);
      visited.add(valueId);
      return false;
    }

    return state.valueOrder.some(visit);
  }

  function validateState(candidate) {
    if (!candidate || candidate.schemaVersion !== 2) return { ok: false, error: "不支持的数据版本" };
    if (!candidate.values || typeof candidate.values !== "object") return { ok: false, error: "缺少数值数据" };
    if (!candidate.derivations || typeof candidate.derivations !== "object") return { ok: false, error: "缺少公式数据" };
    if (!Array.isArray(candidate.valueOrder)) return { ok: false, error: "数值顺序无效" };
    if (candidate.valueOrder.length > MAX_VALUES) return { ok: false, error: "数值数量超过限制" };
    if (Object.keys(candidate.derivations).length > MAX_DERIVATIONS) return { ok: false, error: "公式数量超过限制" };
    if (new Set(candidate.valueOrder).size !== candidate.valueOrder.length) return { ok: false, error: "数值顺序存在重复" };
    if (Object.keys(candidate.values).length !== candidate.valueOrder.length) return { ok: false, error: "数值索引不完整" };

    for (const valueId of candidate.valueOrder) {
      const value = candidate.values[valueId];
      if (!value || value.id !== valueId || !Expr.isValidExpression(value.canonicalExpression)) {
        return { ok: false, error: "存在无效数值" };
      }
      if (Expr.canonicalKey(value.canonicalExpression) !== value.canonicalKey) {
        return { ok: false, error: "数值标识不一致" };
      }
      if (!isShortString(value.displayText, 500) || !isShortString(value.canonicalKey, 2000)) {
        return { ok: false, error: "数值文本无效" };
      }
      if (!Array.isArray(value.derivationIds)) return { ok: false, error: "公式索引无效" };
      if (new Set(value.derivationIds).size !== value.derivationIds.length) return { ok: false, error: "公式索引存在重复" };
    }

    for (const [derivationId, derivation] of Object.entries(candidate.derivations)) {
      if (!derivation || derivation.id !== derivationId) return { ok: false, error: "存在无效公式" };
      if (!candidate.values[derivation.xValueId] || !candidate.values[derivation.yValueId] || !candidate.values[derivation.resultValueId]) {
        return { ok: false, error: "公式引用了不存在的数值" };
      }
      if (derivation.operation !== "EML" || !isShortString(derivation.directFormula)) {
        return { ok: false, error: "公式内容无效" };
      }
      if (!Expr.isValidExpression(derivation.rawExpression)) return { ok: false, error: "公式表达式无效" };
      if (!Array.isArray(derivation.rewriteSteps) || derivation.rewriteSteps.length > MAX_REWRITE_STEPS) {
        return { ok: false, error: "化简步骤无效" };
      }
      if (derivation.rewriteSteps.some((step) => (
        !step || !isShortString(step.ruleId, 100) || !isShortString(step.before) || !isShortString(step.after)
      ))) {
        return { ok: false, error: "化简步骤内容无效" };
      }
      if (!candidate.values[derivation.resultValueId].derivationIds.includes(derivationId)) {
        return { ok: false, error: "公式与结果索引不一致" };
      }
    }

    const initial = candidate.values[ValueStore.initialValueId];
    if (!initial || !initial.protected) return { ok: false, error: "缺少受保护的初始值 1" };

    const allowedSelection = (id) => id === null || Boolean(candidate.values[id]);
    if (!allowedSelection(candidate.inputXId) || !allowedSelection(candidate.inputYId) || !allowedSelection(candidate.selectedValueId)) {
      return { ok: false, error: "选择状态引用了不存在的数值" };
    }

    if (hasDependencyCycle(candidate)) return { ok: false, error: "公式来源存在循环引用" };

    return { ok: true, state: JSON.parse(JSON.stringify(candidate)) };
  }

  function serialize(state) {
    return JSON.stringify({
      app: "EML Workbench",
      savedAt: new Date().toISOString(),
      ...state,
      schemaVersion: 2,
    }, null, 2);
  }

  function deserialize(text) {
    if (typeof text !== "string" || text.length > MAX_IMPORT_BYTES) {
      return { ok: false, error: "文件大小超过限制" };
    }
    try {
      return validateState(JSON.parse(text));
    } catch {
      return { ok: false, error: "文件不是有效的 JSON" };
    }
  }

  function saveToCache(storage, state) {
    storage.setItem(CACHE_KEY, serialize(state));
  }

  function loadFromCache(storage) {
    const text = storage.getItem(CACHE_KEY);
    if (!text) return { ok: false, error: "没有缓存" };
    return deserialize(text);
  }

  return {
    CACHE_KEY,
    MAX_IMPORT_BYTES,
    MAX_VALUES,
    MAX_DERIVATIONS,
    validateState,
    hasDependencyCycle,
    serialize,
    deserialize,
    saveToCache,
    loadFromCache,
  };
});

}};const cache=Object.create(null);function load(name){name=name.replace(/^\.\//,'');if(!Object.prototype.hasOwnProperty.call(factories,name))throw Error('Unknown frozen EML module');if(!cache[name]){const module={exports:{}};cache[name]=module;factories[name](module,load);}return cache[name].exports;}root.EMLHubLegacy={expression:load('expression.js'),store:load('value-store.js'),persistence:load('persistence.js')};})(globalThis);
