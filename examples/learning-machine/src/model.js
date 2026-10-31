/* MIT; multilayer extension of turbowarp-neural-network's gradient-descent model. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LearningModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LIMIT = 1000, EPOCHS = 600, RATE = 0.08, MAX_SAMPLES = 32, TARGET_LOSS = 0.0001;
  const CANDIDATES = [[2], [4], [6], [4, 3], [6, 4], [8, 6, 4], [8, 6, 4, 2]];
  const copy = value => JSON.parse(JSON.stringify(value));
  const asArray = value => Array.isArray(value) ? value : [value];
  const unpack = values => values.length === 1 ? values[0] : values;
  function parseNumber(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    if (String(value).trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) && Math.abs(n) <= LIMIT ? n : null;
  }
  function parseVector(value, size) {
    const values = asArray(value);
    if (values.length !== size) return null;
    const parsed = values.map(parseNumber);
    return parsed.some(v => v === null) ? null : parsed;
  }
  function parseArchitecture(mode) {
    if (mode === 'auto') return [2];
    if (typeof mode !== 'string' || !/^\d+(?:-\d+){0,3}$/.test(mode)) throw new RangeError('隐藏层需要 1～4 层，每层 1～12 个节点。');
    const widths = mode.split('-').map(Number);
    if (widths.some(n => n < 1 || n > 12)) throw new RangeError('隐藏层需要 1～4 层，每层 1～12 个节点。');
    return widths;
  }
  function validateSize(n) {
    if (!Number.isInteger(n) || n < 1 || n > 4) throw new RangeError('输入和输出数量需要是 1～4 的整数。');
  }
  class NeuralNetwork {
    constructor(options = {}) {
      this.reset();
      if (options.inputSize !== undefined || options.outputSize !== undefined) this.configure(options);
    }
    initialize(architecture = [2]) {
      this.architecture = [...architecture];
      let seed = 109;
      const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      const sizes = [this.inputSize, ...architecture, this.outputSize];
      this.layers = sizes.slice(1).map((size, i) => {
        const scale = Math.sqrt(6 / (sizes[i] + size));
        return { weights: Array.from({ length: size }, () => Array.from({ length: sizes[i] }, () => (random() * 2 - 1) * scale)), biases: Array.from({ length: size }, () => (random() - 0.5) * 0.1) };
      });
    }
    reset() {
      this.inputSize = 1; this.outputSize = 1;
      this.samples = []; this.epochs = 0; this.loss = null; this.normalizedLoss = null;
      this.inputScales = [1]; this.outputScales = [1]; this.sx = 1; this.sy = 1;
      this.structureMode = 'auto'; this.trials = []; this.lastRounds = 0; this.initialize();
    }
    configure({ inputSize = this.inputSize, outputSize = this.outputSize, structure = this.structureMode } = {}) {
      validateSize(inputSize); validateSize(outputSize); const architecture = parseArchitecture(structure);
      const dimensionsChanged = inputSize !== this.inputSize || outputSize !== this.outputSize;
      if (dimensionsChanged) {
        this.reset(); this.inputSize = inputSize; this.outputSize = outputSize;
        this.inputScales = Array(inputSize).fill(1); this.outputScales = Array(outputSize).fill(1);
      }
      this.structureMode = structure;
      if (this.samples.length) this.fit();
      else { this.initialize(architecture); this.trials = []; this.lastRounds = 0; }
      return { dimensionsChanged };
    }
    weights() { return copy(this.layers); }
    traceNormalized(value) {
      let inputs = asArray(value);
      return this.layers.map((layer, index) => {
        const z = layer.weights.map((row, i) => row.reduce((sum, w, j) => sum + w * inputs[j], layer.biases[i]));
        const outputs = index === this.layers.length - 1 ? z : z.map(Math.tanh);
        const trace = { inputs, z, outputs }; inputs = outputs; return trace;
      });
    }
    forward(value) { return unpack(this.traceNormalized(value).at(-1).outputs); }
    gradients(x, y) {
      const trace = this.traceNormalized(x), targets = asArray(y), gradients = new Array(this.layers.length);
      let delta = trace.at(-1).outputs.map((v, i) => 2 * (v - targets[i]) / this.outputSize);
      for (let l = this.layers.length - 1; l >= 0; l--) {
        gradients[l] = { weights: delta.map(d => trace[l].inputs.map(v => d * v)), biases: [...delta] };
        if (l > 0) delta = trace[l - 1].outputs.map((v, i) => delta.reduce((sum, d, j) => sum + this.layers[l].weights[j][i] * d, 0) * (1 - v * v));
      }
      return gradients;
    }
    fit() {
      const candidates = this.structureMode === 'auto' ? CANDIDATES : [parseArchitecture(this.structureMode)];
      const data = this.samples.map(([x, y]) => [asArray(x).map((v, i) => v / this.inputScales[i]), asArray(y).map((v, i) => v / this.outputScales[i])]);
      let best = null; this.trials = []; this.lastRounds = 0;
      for (const architecture of candidates) {
        this.initialize(architecture);
        for (let epoch = 0; epoch < EPOCHS; epoch++) {
          for (const [x, y] of data) {
            const g = this.gradients(x, y);
            this.layers.forEach((layer, l) => {
              layer.weights.forEach((row, i) => {
                row.forEach((_, j) => { row[j] -= RATE * g[l].weights[i][j]; });
                layer.biases[i] -= RATE * g[l].biases[i];
              });
            });
          }
        }
        this.lastRounds += EPOCHS;
        const normalizedLoss = data.reduce((sum, [x, y]) => sum + asArray(this.forward(x)).reduce((s, v, i) => s + (v - y[i]) ** 2, 0) / this.outputSize, 0) / data.length;
        this.trials.push({ architecture: [...architecture], normalizedLoss });
        if (!best || normalizedLoss < best.normalizedLoss) best = { architecture: [...architecture], layers: this.weights(), normalizedLoss };
        if (normalizedLoss <= TARGET_LOSS) break;
      }
      this.architecture = best.architecture; this.layers = best.layers; this.normalizedLoss = best.normalizedLoss;
      this.loss = this.samples.reduce((sum, [x, y]) => sum + asArray(this.predict(x)).reduce((s, v, i) => s + (v - asArray(y)[i]) ** 2, 0) / this.outputSize, 0) / this.samples.length;
      this.epochs += this.lastRounds;
    }
    train(rawX, rawY) {
      const x = parseVector(rawX, this.inputSize), y = parseVector(rawY, this.outputSize);
      if (!x || !y) throw new RangeError('请填写所有输入和输出，每个数在 -1000 到 1000 之间。');
      const index = this.samples.findIndex(s => asArray(s[0]).every((v, i) => v === x[i]));
      if (index < 0 && this.samples.length >= MAX_SAMPLES) throw new RangeError('最多学习 32 个不同输入；可以修改已有输入的正确输出。');
      if (index < 0) this.samples.push([unpack(x), unpack(y)]); else this.samples[index] = [unpack(x), unpack(y)];
      this.inputScales = x.map((_, i) => Math.max(1, ...this.samples.map(s => Math.abs(asArray(s[0])[i]))));
      this.outputScales = y.map((_, i) => Math.max(1, ...this.samples.map(s => Math.abs(asArray(s[1])[i]))));
      this.sx = Math.max(...this.inputScales); this.sy = Math.max(...this.outputScales);
      this.fit(); return this.loss;
    }
    setStructure(mode) { this.configure({ structure: mode }); }
    predict(value) {
      if (!this.samples.length) throw new Error('先教我至少一组输入和正确输出，再来计算吧。');
      const x = parseVector(value, this.inputSize);
      if (!x) throw new RangeError('请填写全部输入，每个数在 -1000 到 1000 之间。');
      return this.forwardTrace(unpack(x)).output;
    }
    forwardTrace(value) {
      const x = parseVector(value, this.inputSize);
      if (!x) throw new RangeError('输入数量不符，或含有无效数字。');
      const normalized = x.map((v, i) => v / this.inputScales[i]), layers = this.traceNormalized(normalized);
      const outputs = layers.at(-1).outputs.map((v, i) => v * this.outputScales[i]);
      return { x: unpack(x), normalizedX: unpack(normalized), layers, output: unpack(outputs) };
    }
    exactAssignments() {
      const rows = [], inputNames = Array.from({ length: this.inputSize }, (_, i) => this.inputSize === 1 ? 'x' : 'x' + (i + 1));
      let inputs = inputNames.map((name, i) => {
        const variable = 'u' + (i + 1); rows.push('const ' + variable + ' = ' + name + ' / ' + this.inputScales[i] + ';'); return variable;
      });
      this.layers.forEach((layer, l) => {
        inputs = layer.weights.map((row, i) => {
          const variable = 'a' + (l + 1) + '_' + (i + 1);
          const inner = '(' + layer.biases[i] + ' + ' + row.map((w, j) => '(' + w + ') * ' + inputs[j]).join(' + ') + ')';
          rows.push('const ' + variable + ' = ' + (l === this.layers.length - 1 ? inner : 'tanh' + inner) + ';');
          return variable;
        });
      });
      return { rows, outputs: inputs.map((name, i) => this.outputScales[i] + ' * ' + name) };
    }
    functionExpression(outputIndex = 0) {
      if (!Number.isInteger(outputIndex) || outputIndex < 0 || outputIndex >= this.outputSize) throw new RangeError('无效的输出序号。');
      let inputs = this.inputScales.map((scale, i) => '(' + (this.inputSize === 1 ? 'x' : 'x' + (i + 1)) + ' / ' + scale + ')');
      for (let l = 0; l < this.layers.length; l++) {
        const layer = this.layers[l], projected = layer.weights.length * inputs.reduce((sum, text) => sum + text.length + 50, 0);
        if (projected > 60000) {
          const exact = this.exactAssignments();
          return '(() => { ' + exact.rows.join(' ') + ' return ' + exact.outputs[outputIndex] + '; })()';
        }
        inputs = layer.weights.map((row, i) => {
          const inner = '(' + layer.biases[i] + ' + ' + row.map((w, j) => '(' + w + ') * ' + inputs[j]).join(' + ') + ')';
          return l === this.layers.length - 1 ? inner : 'tanh' + inner;
        });
      }
      return this.outputScales[outputIndex] + ' * ' + inputs[outputIndex];
    }
    equations() {
      const n = value => String(Number(value.toPrecision(6))), equations = [];
      let inputs = this.inputScales.map((scale, i) => {
        const name = this.inputSize === 1 ? 'u' : 'u' + (i + 1);
        equations.push({ name, expression: (this.inputSize === 1 ? 'x' : 'x' + (i + 1)) + ' / ' + n(scale), layer: 0 });
        return name;
      });
      this.layers.forEach((layer, l) => {
        inputs = layer.weights.map((row, i) => {
          const name = l === this.layers.length - 1 ? this.outputSize === 1 ? 'v' : 'v' + (i + 1) : 'h' + (l + 1) + '_' + (i + 1);
          const sum = n(layer.biases[i]) + ' + ' + row.map((w, j) => '(' + n(w) + ') × ' + inputs[j]).join(' + ');
          equations.push({ name, expression: l === this.layers.length - 1 ? sum : 'tanh(' + sum + ')', layer: l + 1 }); return name;
        });
      });
      const argumentsText = this.inputSize === 1 ? 'x' : Array.from({ length: this.inputSize }, (_, i) => 'x' + (i + 1)).join(', ');
      this.outputScales.forEach((scale, i) => equations.push({
        name: (this.outputSize === 1 ? 'f' : 'f' + (i + 1)) + '(' + argumentsText + ')',
        expression: n(scale) + ' × ' + inputs[i], layer: this.layers.length + 1
      }));
      return equations;
    }
  }
  return { NeuralNetwork, parseNumber, parseVector, parseArchitecture, asArray, unpack, LIMIT, HIDDEN: 2, EPOCHS, MAX_SAMPLES, TARGET_LOSS, CANDIDATES };
});
