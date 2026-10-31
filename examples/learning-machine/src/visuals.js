(function () {
  'use strict';
  const asArray = value => Array.isArray(value) ? value : [value];
  const format = (value, digits = 6) => {
    if (!Number.isFinite(value)) return '—';
    if (Object.is(value, -0)) return '0';
    return String(Number(value.toPrecision(digits)));
  };
  const svgText = (x, y, text, attrs = '') => '<text x="' + x + '" y="' + y + '" ' + attrs + '>' + text + '</text>';
  function renderNetwork(container, model, preview) {
    const sizes = [model.inputSize, ...model.architecture, model.outputSize];
    const rawInput = preview ? asArray(preview.x) : Array(model.inputSize).fill(0);
    const trace = model.traceNormalized(rawInput.map((v, i) => v / model.inputScales[i]));
    const nodes = sizes.map((size, l) => Array.from({ length: size }, (_, i) => ({
      x: 45 + l * 530 / (sizes.length - 1),
      y: size === 1 ? 140 : 34 + i * 210 / (size - 1),
      r: size === 1 && (l === 0 || l === sizes.length - 1) ? 25 : size > 8 ? 7.5 : size > 6 ? 11 : 15
    })));
    let content = '<title>实际多层神经网络 ' + sizes.join(' → ') + '</title><desc>每列为真实的一层，绿色为正权重、橙色为负权重；所有输入输出均参与实际计算。</desc>';
    model.layers.forEach((layer, l) => {
      layer.weights.forEach((row, i) => row.forEach((weight, j) => {
        const a = nodes[l][j], b = nodes[l + 1][i], dx = (b.x - a.x) * 0.4;
        const size = Math.min(3.6, 0.5 + Math.abs(weight) * 1.9), opacity = Math.min(0.75, 0.15 + Math.abs(weight) * 0.45);
        content += '<path d="M ' + (a.x + a.r) + ' ' + a.y + ' C ' + (a.x + dx) + ' ' + a.y + ',' + (b.x - dx) + ' ' + b.y + ',' + (b.x - b.r) + ' ' + b.y + '" fill="none" stroke="' + (weight >= 0 ? '#a1c786' : '#c3a075') + '" stroke-width="' + size + '" opacity="' + opacity + '" data-weight="' + weight + '"><title>层 ' + l + ' 节点 ' + (j + 1) + ' → 层 ' + (l + 1) + ' 节点 ' + (i + 1) + '，权重 ' + format(weight) + '</title></path>';
      }));
    });
    nodes.forEach((layer, l) => {
      layer.forEach((node, i) => {
        const endpoint = l === 0 || l === sizes.length - 1;
        const activation = l === 0 ? rawInput[i] : trace[l - 1].outputs[i] * (l === sizes.length - 1 ? model.outputScales[i] : 1);
        const name = l === 0 ? 'x' + (model.inputSize === 1 ? '' : i + 1) : l === sizes.length - 1 ? 'y' + (model.outputSize === 1 ? '' : i + 1) : 'h' + l + '_' + (i + 1);
        const value = endpoint && !preview ? name : format(activation, endpoint ? 4 : 2);
        const fontSize = node.r > 20 ? value.length > 4 ? 10 : 16 : node.r > 12 ? 8 : node.r > 9 ? 6 : 5;
        content += '<g data-layer="' + l + '" data-node="' + i + '"><circle cx="' + node.x + '" cy="' + node.y + '" r="' + node.r + '" fill="' + (endpoint ? '#2e4530' : '#263c2c') + '" stroke="#a4c583" stroke-opacity="' + (endpoint ? 1 : 0.7) + '"/><title>' + name + ' = ' + format(activation) + '</title>';
        content += svgText(node.x, node.y + (node.r > 20 ? 5 : 3), value, 'text-anchor="middle" fill="#d3e7b6" font-size="' + fontSize + '" font-family="Consolas,monospace"') + '</g>';
      });
      const label = l === 0 ? '输入 · ' + model.inputSize : l === sizes.length - 1 ? '输出 · ' + model.outputSize : '隐藏层 ' + l + ' · ' + sizes[l];
      content += svgText(layer[0].x, 278, label, 'text-anchor="middle" fill="#a1b48d" font-size="10"');
    });
    container.innerHTML = '<svg viewBox="0 0 620 294" role="img" aria-label="实际网络结构 ' + sizes.join(' → ') + '">' + content + '</svg>';
  }
  function renderChart(container, model, prediction, options = {}) {
    const inputIndex = options.inputIndex || 0, outputIndex = options.outputIndex || 0;
    const baseInput = options.baseInput ? [...options.baseInput] : Array(model.inputSize).fill(0);
    const W = 560, H = 202, left = 48, right = 25, top = 17, bottom = 30, width = W - left - right, height = H - top - bottom;
    let xmin = -1, xmax = 3, ymin = -1, ymax = 5, curve = [];
    const matching = model.samples.filter(([x]) => asArray(x).every((v, i) => i === inputIndex || v === baseInput[i]));
    if (model.samples.length) {
      const xs = model.samples.map(s => asArray(s[0])[inputIndex]);
      if (prediction) xs.push(asArray(prediction.x)[inputIndex]);
      const lo = Math.min(...xs), hi = Math.max(...xs), pad = Math.max((hi - lo) * 0.18, Math.max(Math.abs(lo), Math.abs(hi), 1) * 0.15);
      xmin = Math.max(-1000, lo - pad); xmax = Math.min(1000, hi + pad);
      for (let i = 0; i <= 100; i++) {
        const x = xmin + (xmax - xmin) * i / 100, vector = [...baseInput]; vector[inputIndex] = x;
        curve.push([x, asArray(model.predict(model.inputSize === 1 ? vector[0] : vector))[outputIndex]]);
      }
      const ys = [...curve.map(s => s[1]), ...matching.map(s => asArray(s[1])[outputIndex])];
      const vlo = Math.min(...ys), vhi = Math.max(...ys), ypad = Math.max((vhi - vlo) * 0.18, Math.abs(vhi) * 0.04, 0.1);
      ymin = vlo - ypad; ymax = vhi + ypad;
    }
    const px = x => left + (x - xmin) / (xmax - xmin) * width;
    const py = y => top + height - (y - ymin) / (ymax - ymin) * height;
    let content = '<title>预测函数切片与同条件样本</title><desc>横轴为所选输入，纵轴为所选输出。其余输入固定于代入值，仅显示匹配固定条件的样本。</desc>';
    for (let i = 0; i <= 4; i++) {
      const gx = left + width * i / 4, gy = top + height * i / 4;
      content += '<path d="M' + gx + ' ' + top + 'V' + (top + height) + ' M' + left + ' ' + gy + 'H' + (W - right) + '" stroke="#edf0e6" stroke-width="1" ' + (i > 0 && i < 4 ? 'stroke-dasharray="3 4"' : '') + '/>';
      content += svgText(gx, H - 12, format(xmin + (xmax - xmin) * i / 4, 3), 'text-anchor="middle" fill="#a7ae9b" font-size="9" font-family="Consolas,monospace"');
      content += svgText(left - 9, gy + 3, format(ymax - (ymax - ymin) * i / 4, 3), 'text-anchor="end" fill="#a7ae9b" font-size="9" font-family="Consolas,monospace"');
    }
    if (curve.length) {
      const line = curve.map(([x, y], i) => (i ? 'L' : 'M') + px(x).toFixed(2) + ' ' + py(y).toFixed(2)).join(' ');
      content += '<defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#b7d38b" stop-opacity=".18"/><stop offset="1" stop-color="#b7d38b" stop-opacity="0"/></linearGradient></defs><path d="' + line + 'L' + px(xmax) + ' ' + (top + height) + 'H' + left + 'Z" fill="url(#area)"/><path data-curve="true" d="' + line + '" fill="none" stroke="#8caa6d" stroke-width="2.2"/>';
      for (const [x, y] of matching) content += '<circle data-sample="true" cx="' + px(asArray(x)[inputIndex]) + '" cy="' + py(asArray(y)[outputIndex]) + '" r="4" stroke="white" stroke-width="2" fill="#364e35"><title>样本 ' + format(asArray(x)[inputIndex]) + ' → ' + format(asArray(y)[outputIndex]) + '</title></circle>';
      const matchPrediction = prediction && asArray(prediction.x).every((v, i) => i === inputIndex || v === baseInput[i]);
      if (matchPrediction) {
        const x = asArray(prediction.x)[inputIndex], y = asArray(prediction.y)[outputIndex];
        content += '<path d="M' + px(x) + ' ' + top + 'V' + (top + height) + '" stroke="#9baf83" stroke-dasharray="3 3"/><circle data-prediction="true" cx="' + px(x) + '" cy="' + py(y) + '" r="5" stroke="#365b35" stroke-width="2" fill="#d4edb3"><title>预测 ' + format(x) + ' → ' + format(y) + '</title></circle>';
      }
    } else {
      content += '<rect x="135" y="72" width="307" height="45" rx="8" fill="#fff" fill-opacity=".94"/>' + svgText(288, 99, '训练后，规律会在这里显现', 'text-anchor="middle" fill="#a0ac91" font-size="12"');
    }
    content += svgText(W - 2, H - 12, 'x' + (model.inputSize === 1 ? '' : inputIndex + 1), 'text-anchor="end" fill="#8d9e7d" font-size="10" font-style="italic"');
    content += svgText(left - 9, 9, 'y' + (model.outputSize === 1 ? '' : outputIndex + 1), 'text-anchor="end" fill="#8d9e7d" font-size="10" font-style="italic"');
    container.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="所选输入输出的函数切片">' + content + '</svg>';
  }
  window.LearningVisuals = { format, renderNetwork, renderChart };
})();
