(function () {
  'use strict';
  const { NeuralNetwork, parseNumber, asArray, unpack, TARGET_LOSS } = window.LearningModel;
  const { format, renderNetwork, renderChart } = window.LearningVisuals;
  const model = new NeuralNetwork();
  const $ = id => document.getElementById(id);
  const valueText = (value, digits = 6) => Array.isArray(value) ? '[' + value.map(v => format(v, digits)).join(', ') + ']' : format(value, digits);
  const fieldId = (prefix, i) => prefix + (i ? '-' + (i + 1) : '');
  let prediction = null, preview = null, traceX = 0, fieldShape = '', toastTimer, animationTimer;

  function message(id, text, type = '') {
    $(id).textContent = text;
    if (id !== 'trace-message' && id !== 'config-message') $(id).className = 'message ' + type;
    else $(id).classList.toggle('error', type === 'error');
  }
  function makeFields(containerId, prefix, size, title, letter, hint, messageId) {
    const container = $(containerId); container.replaceChildren();
    for (let i = 0; i < size; i++) {
      const box = document.createElement('div'), label = document.createElement('label'), input = document.createElement('input');
      input.id = fieldId(prefix, i); input.name = letter + (i + 1); input.inputMode = 'decimal'; input.autocomplete = 'off';
      input.placeholder = hint; input.setAttribute('aria-describedby', messageId); label.htmlFor = input.id;
      label.textContent = title + (size === 1 ? ' ' + letter : ' ' + letter + (i + 1));
      box.append(label, input); container.appendChild(box);
    }
  }
  function ensureFields() {
    const next = model.inputSize + ':' + model.outputSize;
    if (fieldShape === next) return;
    fieldShape = next;
    makeFields('train-inputs', 'train-x', model.inputSize, '输入值', 'x', '比如：2', 'train-message');
    makeFields('train-outputs', 'train-y', model.outputSize, '正确输出', 'y', '比如：4', 'train-message');
    makeFields('predict-inputs', 'predict-x', model.inputSize, '输入值', 'x', '比如：1.5', 'predict-message');
    makeFields('trace-inputs', 'trace-x', model.inputSize, '代入', 'x', '0', 'trace-message');
    for (const [id, size, letter] of [['chart-input', model.inputSize, 'x'], ['chart-output', model.outputSize, 'y']]) {
      $(id).replaceChildren();
      for (let i = 0; i < size; i++) { const option = document.createElement('option'); option.value = i; option.textContent = letter + (size === 1 ? '' : i + 1); $(id).appendChild(option); }
    }
    $('chart-dimensions').hidden = model.inputSize === 1 && model.outputSize === 1;
    $('prediction').classList.toggle('vector-output', model.outputSize > 1);
    $('experiment-instructions').textContent = model.inputSize === 1 && model.outputSize === 1
      ? '依次教它 0 → 0、1 → 2、2 → 4，再去计算 1.5。它会猜到接近 3 吗？'
      : '可以教它多个数之间的关系。比如两个输入 [1, 2]，两个输出 [3, -1]，分别表示和与差。每个输入和输出都要填写。';
    document.querySelectorAll('[data-example]').forEach(button => {
      const pair = button.dataset.example.split(',').map(Number);
      button.textContent = valueText(unpack(Array(model.inputSize).fill(pair[0]))) + ' → ' + valueText(unpack(Array(model.outputSize).fill(pair[1])));
    });
  }
  function readFields(prefix, size, messageId) {
    const values = [];
    for (let i = 0; i < size; i++) {
      const field = $(fieldId(prefix, i)), value = parseNumber(field.value);
      field.setAttribute('aria-invalid', String(value === null));
      if (value === null) { message(messageId, '请填写全部数字，每个数在 -1000 到 1000 之间。', 'error'); field.focus(); return null; }
      values.push(value);
    }
    return unpack(values);
  }
  function writeFields(prefix, value) { asArray(value).forEach((v, i) => { $(fieldId(prefix, i)).value = format(v); }); }
  function layerWidthFields(count, defaults = model.architecture) {
    const widths = $('layer-width-controls'); widths.replaceChildren(); widths.hidden = count === 0;
    for (let i = 0; i < count; i++) {
      const label = document.createElement('label'), input = document.createElement('input');
      label.textContent = '第 ' + (i + 1) + ' 层节点'; input.id = 'layer-width-' + i; input.type = 'number'; input.min = '1'; input.max = '12'; input.step = '1';
      input.value = defaults[i] || [4, 4, 3, 2][i]; input.setAttribute('aria-label', '第 ' + (i + 1) + ' 隐藏层节点数'); label.appendChild(input); widths.appendChild(label);
    }
  }
  function syncConfig() {
    $('input-count').value = model.inputSize; $('output-count').value = model.outputSize;
    $('hidden-count').value = model.structureMode === 'auto' ? 'auto' : model.architecture.length;
    layerWidthFields(model.structureMode === 'auto' ? 0 : model.architecture.length);
    $('structure').value = Array.from($('structure').options).some(o => o.value === model.structureMode) ? model.structureMode : 'custom';
  }
  function setMode(mode, focus = false) {
    const isTrain = mode === 'train';
    $('train-pane').hidden = !isTrain; $('predict-pane').hidden = isTrain;
    $('train-mode').setAttribute('aria-pressed', String(isTrain)); $('predict-mode').setAttribute('aria-pressed', String(!isTrain));
    if (focus) $(isTrain ? 'train-x' : 'predict-x').focus();
  }
  function renderMappings() {
    const trace = model.forwardTrace(traceX), equations = model.equations();
    $('layer-mappings').replaceChildren();
    const groups = [
      { title: '输入归一化', equations: equations.filter(e => e.layer === 0), values: asArray(trace.normalizedX) },
      ...trace.layers.map((layer, l) => ({ title: l === trace.layers.length - 1 ? '输出层 · 线性变换' : '隐藏层 ' + (l + 1) + ' · tanh', equations: equations.filter(e => e.layer === l + 1), values: layer.outputs })),
      { title: '还原输出尺度', equations: equations.filter(e => e.layer === model.layers.length + 1), values: asArray(trace.output) }
    ];
    for (const [index, group] of groups.entries()) {
      const block = document.createElement('section'); block.className = 'layer-block'; block.dataset.mappingLayer = index;
      const heading = document.createElement('h3'); heading.textContent = String(index).padStart(2, '0') + ' / ' + group.title; block.appendChild(heading);
      group.equations.forEach((equation, i) => {
        const row = document.createElement('div'); row.className = 'equation-row';
        const formula = document.createElement('code'); formula.textContent = equation.name + ' = ' + equation.expression;
        const output = document.createElement('output'); output.textContent = '= ' + format(group.values[i]); row.append(formula, output); block.appendChild(row);
      });
      $('layer-mappings').appendChild(block);
    }
    writeFields('trace-x', traceX);
    $('trace-inputs').querySelectorAll('input').forEach(input => input.removeAttribute('aria-invalid'));
    message('trace-message', '代入 x = ' + valueText(traceX) + '；使用完整参数计算，方程显示 6 位有效数字。' + (model.samples.length ? '' : '当前是未训练的初始参数。'));
  }
  function renderFunction() {
    const equations = model.equations(), outputEquations = equations.filter(e => e.layer === model.layers.length);
    const finalEquations = equations.filter(e => e.layer === model.layers.length + 1);
    $('function-short').textContent = outputEquations.map((e, i) => finalEquations[i].name + ' = ' + format(model.outputScales[i]) + ' × (' + e.expression + ')').join('\n\n');
    $('function-status').textContent = model.samples.length ? model.architecture.length + ' 个隐藏层 · ' + model.outputSize + ' 个输出' : '未训练 · 初始函数';
    $('function-full').textContent = $('full-function').open
      ? finalEquations.map((e, i) => e.name + ' = ' + model.functionExpression(i)).join('\n\n') : '';
  }
  function renderCurve() {
    const inputIndex = Number($('chart-input').value), outputIndex = Number($('chart-output').value);
    const baseInput = asArray(traceX);
    renderChart($('chart'), model, prediction, { inputIndex, outputIndex, baseInput });
    const fixed = baseInput.map((v, i) => i === inputIndex ? null : 'x' + (i + 1) + ' = ' + format(v)).filter(Boolean);
    $('chart-slice-note').textContent = model.inputSize === 1 && model.outputSize === 1
      ? '观察曲线如何随着你的训练，慢慢靠近样本点。'
      : (fixed.length ? '函数切片：固定 ' + fixed.join('，') + '；只标出满足固定条件的样本。' : '显示所选输出的预测曲线及样本。');
  }
  function render() {
    ensureFields(); syncConfig();
    const count = model.samples.length, shape = [model.inputSize, ...model.architecture, model.outputSize].join(' → ');
    $('sample-count').textContent = count; $('sample-badge').textContent = count + ' 组'; $('epoch-count').textContent = model.epochs.toLocaleString('en-US');
    $('loss-value').textContent = model.loss === null ? '—' : format(model.loss, 2); $('loss-unit').textContent = model.loss === null ? '等待训练' : '';
    $('machine-status').textContent = count ? '已学习 ' + count + ' 组样本' : '等待第一组样本';
    $('architecture-label').textContent = shape;
    $('architecture-caption').textContent = model.inputSize + ' 输入 · ' + model.architecture.length + ' 隐藏层 · ' + model.outputSize + ' 输出';
    $('structure-info').textContent = model.structureMode === 'auto'
      ? !count ? '自动从单隐藏层开始。简单样本可能保留单层；需要指定双层、三层或四层时，在上方选择隐藏层数并应用。'
        : '本次比较 ' + model.trials.length + ' 种结构，选用 ' + shape + '。' + (model.normalizedLoss <= TARGET_LOSS ? '误差已达标，不必继续加层；也可手动选择。' : '保留误差最低的结构，尚未达到拟合目标。')
      : '手动网络 ' + shape + '。所有层、所有输入输出都参与实际计算。';
    $('sample-empty').hidden = count > 0; $('sample-table-wrap').hidden = count === 0; $('sample-rows').replaceChildren();
    model.samples.forEach(([x, y], i) => {
      const row = document.createElement('tr');
      for (const value of [String(i + 1).padStart(2, '0'), valueText(x), valueText(y), valueText(model.predict(x))]) {
        const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
      }
      $('sample-rows').appendChild(row);
    });
    $('prediction').textContent = prediction ? valueText(prediction.y) : '?';
    $('prediction-note').textContent = prediction ? '输入 ' + valueText(prediction.x) + ' 的近似输出' : count ? '准备好了，填写全部输入试试吧。' : '先训练，再见证它的第一次预测。';
    renderNetwork($('network'), model, preview); renderCurve(); renderFunction(); renderMappings();
  }
  function toast(text) {
    clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2800);
  }
  function fillExample(x, y) {
    setMode('train'); writeFields('train-x', unpack(Array(model.inputSize).fill(Number(x)))); writeFields('train-y', unpack(Array(model.outputSize).fill(Number(y))));
    $('train-inputs').querySelectorAll('input').forEach(f => f.removeAttribute('aria-invalid'));
    $('train-outputs').querySelectorAll('input').forEach(f => f.removeAttribute('aria-invalid'));
    message('train-message', '示例已填好，点击“开始学习”教给它。'); $('train-x').focus();
  }
  function structureChanged() {
    prediction = null; preview = model.samples.length ? { x: traceX, y: model.predict(traceX) } : null; render();
    message('predict-message', '网络配置已改变，请重新计算。');
  }
  $('train-mode').addEventListener('click', () => setMode('train'));
  $('predict-mode').addEventListener('click', () => setMode('predict'));
  document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => fillExample(...button.dataset.example.split(','))));
  $('try-example').addEventListener('click', () => { fillExample('0', '0'); $('train-mode').scrollIntoView({ block: 'nearest' }); });
  $('train-form').addEventListener('submit', event => {
    event.preventDefault();
    const x = readFields('train-x', model.inputSize, 'train-message'); if (x === null) return;
    const y = readFields('train-y', model.outputSize, 'train-message'); if (y === null) return;
    try {
      const existed = model.samples.some(s => JSON.stringify(s[0]) === JSON.stringify(x));
      model.train(x, y); prediction = null; preview = { x, y: model.predict(x) }; traceX = x; $('train-form').reset();
      message('train-message', (existed ? '已更新 ' : '已学习 ') + valueText(x) + ' → ' + valueText(y) + '，执行 ' + model.lastRounds + ' 轮；当前 ' + model.architecture.length + ' 个隐藏层。', 'success');
      message('predict-message', '模型已更新，试着计算一组新输入吧。'); render();
      const panel = document.querySelector('.machine-panel'); clearTimeout(animationTimer); panel.classList.remove('learning'); void panel.offsetWidth;
      panel.classList.add('learning'); animationTimer = setTimeout(() => panel.classList.remove('learning'), 800); $('train-x').focus();
    } catch (error) { message('train-message', error.message, 'error'); }
  });
  $('predict-form').addEventListener('submit', event => {
    event.preventDefault(); const x = readFields('predict-x', model.inputSize, 'predict-message'); if (x === null) return;
    try {
      prediction = { x, y: model.predict(x) }; preview = prediction; traceX = x;
      const outside = asArray(x).some((v, i) => {
        const samples = model.samples.map(s => asArray(s[0])[i]); return v < Math.min(...samples) || v > Math.max(...samples);
      });
      message('predict-message', outside ? '部分输入超出训练范围，预测可能不准确。' : '预测完成。参数和样本保持不变。', 'success'); render();
    } catch (error) { message('predict-message', error.message, 'error'); }
  });
  $('reset').addEventListener('click', () => {
    model.reset(); prediction = null; preview = null; traceX = 0;
    clearTimeout(animationTimer); document.querySelector('.machine-panel').classList.remove('learning');
    $('train-form').reset(); $('predict-form').reset(); render();
    document.querySelectorAll('input').forEach(field => field.removeAttribute('aria-invalid'));
    message('train-message', '每学一组，都会一起复习已有样本。'); message('predict-message', '计算只使用当前模型，不会改变学习结果。');
    message('config-message', '修改输入或输出数量后应用，会清空不匹配的旧样本。');
    setMode('train'); toast('已完全重置：1 输入、1 输出、自动结构，可以重新学习。'); $('train-x').focus();
  });
  $('structure').addEventListener('change', () => {
    if ($('structure').value === 'custom') {
      $('hidden-count').value = model.architecture.length; layerWidthFields(model.architecture.length);
      message('config-message', '设置每层节点数，再点击“应用网络配置”。'); return;
    }
    model.setStructure($('structure').value); structureChanged(); toast(model.samples.length ? '已更换真实结构，并重新训练已有样本。' : '网络结构已改变，每一层都参与实际计算。');
  });
  $('hidden-count').addEventListener('change', () => layerWidthFields($('hidden-count').value === 'auto' ? 0 : Number($('hidden-count').value)));
  for (const id of ['input-count', 'output-count']) $(id).addEventListener('change', () => {
    const changed = Number($('input-count').value) !== model.inputSize || Number($('output-count').value) !== model.outputSize;
    message('config-message', changed ? '应用新输入/输出数量将清空当前样本、训练轮次和预测。' : '输入输出数量不变时，保留样本并重新训练。');
  });
  $('network-config').addEventListener('submit', event => {
    event.preventDefault();
    try {
      let structure = 'auto';
      if ($('hidden-count').value !== 'auto') {
        const widths = Array.from($('layer-width-controls').querySelectorAll('input')).map(input => {
          const n = Number(input.value);
          if (!Number.isInteger(n) || n < 1 || n > 12 || !input.value.trim()) { input.setAttribute('aria-invalid', 'true'); throw new RangeError('每层需要 1～12 个节点。'); }
          return n;
        });
        structure = widths.join('-');
      }
      const result = model.configure({ inputSize: Number($('input-count').value), outputSize: Number($('output-count').value), structure });
      if (result.dimensionsChanged) traceX = unpack(Array(model.inputSize).fill(0));
      structureChanged();
      if (result.dimensionsChanged) { $('train-form').reset(); $('predict-form').reset(); message('train-message', '已应用新输入输出数量，请教给它第一组样本。'); }
      message('config-message', result.dimensionsChanged ? '已应用新维度，不匹配的旧样本已清空。' : '网络配置已应用；已有样本已保留。');
      toast(model.inputSize + ' 个输入、' + model.outputSize + ' 个输出、' + model.architecture.length + ' 个隐藏层已生效。');
    } catch (error) { message('config-message', error.message, 'error'); }
  });
  $('full-function').addEventListener('toggle', renderFunction);
  $('trace-form').addEventListener('submit', event => {
    event.preventDefault(); const value = readFields('trace-x', model.inputSize, 'trace-message'); if (value === null) return;
    traceX = value; preview = { x: value, y: model.forwardTrace(value).output };
    renderMappings(); renderNetwork($('network'), model, preview); renderCurve();
  });
  $('chart-input').addEventListener('change', renderCurve); $('chart-output').addEventListener('change', renderCurve);
  document.addEventListener('input', event => { if (event.target.matches('input')) event.target.removeAttribute('aria-invalid'); });
  render();
})();
