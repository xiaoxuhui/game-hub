(function (root) {
  'use strict';

  const integerBits = 4;
  const fractionBits = 4;
  const scale = 2 ** fractionBits;
  const max = 2 ** (integerBits + fractionBits) - 1;
  const ports = Object.freeze({
    input: [], constant: [], add: ['A', 'B'], sign: ['A'], changeSign: ['A', 'S'],
    left: ['A', 'N'], right: ['A', 'N'], delay: ['IN'], output: ['IN'],
  });

  function inputPorts(node) {
    return node.type === 'custom' ? node.gate.inputs.map(input => input.name) : ports[node.type];
  }

  function format(ticks) {
    return String(ticks / scale);
  }

  function parse(value) {
    const source = String(value).trim();
    const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/.exec(source);
    if (!match || source.length > 40) throw new Error('请输入十进制数值。');
    const decimal = match[3] || match[4] || '';
    const denominator = 10n ** BigInt(decimal.length);
    const numerator = (BigInt(match[2] || 0) * denominator + BigInt(decimal || 0)) * BigInt(scale);
    if (numerator > BigInt(max) * denominator) throw new Error('数值范围为 −15.9375 至 +15.9375。');
    if (numerator % denominator) throw new Error('请输入 0.0625 的整数倍。');
    const ticks = Number(numerator / denominator);
    return match[1] === '-' && ticks !== 0 ? -ticks : ticks;
  }

  function bits(ticks) {
    const magnitude = Math.abs(ticks).toString(2).padStart(integerBits + fractionBits, '0');
    return [ticks < 0 ? '−' : '+', magnitude.slice(0, integerBits), magnitude.slice(integerBits)];
  }

  function operate(type, a, b) {
    let result;
    if (type === 'add') {
      result = a + b;
    } else if (type === 'sign') {
      result = Math.sign(a) * scale;
    } else if (type === 'changeSign') {
      if (b !== -scale && b !== 0 && b !== scale) throw new Error('符号控制端 S 只接收 −1、0 或 +1。');
      result = a * (b / scale);
    } else {
      if (b < 0 || b % scale !== 0) throw new Error('移位量 N 必须是非负整数，小数位须为 0000。');
      const factor = 2 ** (b / scale);
      result = type === 'left' ? a * factor : Math.trunc(a / factor);
    }
    if (Math.abs(result) > max) throw new Error('运算溢出，结果超出固定位宽。');
    return result || 0;
  }

  function resolver(graph, inputs, delays) {
    const nodes = new Map(graph.nodes.map(node => [node.id, node]));
    const wires = new Map(graph.wires.map(wire => [`${wire.to}:${wire.port}`, wire.from]));
    const values = new Map();
    const visiting = new Set();

    function resolve(id) {
      if (values.has(id)) return values.get(id);
      if (visiting.has(id)) return { error: '电路中存在循环连接。', origin: id };
      const node = nodes.get(id);
      if (!node) return { error: '连接的元件已移除。', origin: id };
      visiting.add(id);
      let value;
      const read = port => {
        const source = wires.get(`${id}:${port}`);
        return source ? resolve(source) : { error: `端口 ${port} 还未接线。`, origin: id };
      };
      try {
        if (node.type === 'delay') {
          value = { ticks: delays[id] ?? 0 };
        } else if (node.type === 'input' || node.type === 'constant') {
          const input = node.type === 'input' && Object.hasOwn(inputs, id) ? inputs[id] : node.ticks;
          value = typeof input === 'function' ? input() : { ticks: input };
        } else if (node.type === 'custom') {
          const { gate } = node;
          value = resolver(gate.graph, gateInputs(gate, read), delays[id] ?? {})(gate.output);
        } else {
          const args = inputPorts(node).map(read);
          value = args.find(arg => arg.error);
          if (!value) value = { ticks: node.type === 'output' ? args[0].ticks : operate(node.type, args[0].ticks, args[1]?.ticks) };
        }
      } catch (error) {
        value = { error: error.message, origin: id };
      }
      visiting.delete(id);
      values.set(id, value);
      return value;
    }

    return resolve;
  }

  function evaluate(graph, inputs = {}, delays = {}) {
    const resolve = resolver(graph, inputs, delays);
    return new Map(graph.nodes.map(node => [node.id, resolve(node.id)]));
  }

  function gateInputs(gate, read) {
    return Object.fromEntries(gate.inputs.map(input => [input.id, () => read(input.name)]));
  }

  function hasDelay(graph) {
    return graph.nodes.some(node => node.type === 'delay' || (node.type === 'custom' && node.gate.delayed));
  }

  function advance(graph, inputs = {}, delays = {}) {
    const resolve = resolver(graph, inputs, delays);
    const wires = new Map(graph.wires.map(wire => [`${wire.to}:${wire.port}`, wire.from]));
    const next = {};
    for (const node of graph.nodes) {
      if (node.type === 'delay') {
        const source = wires.get(`${node.id}:IN`);
        next[node.id] = source ? (resolve(source).ticks ?? delays[node.id] ?? 0) : 0;
      } else if (node.type === 'custom' && node.gate.delayed) {
        const { gate } = node;
        const inside = gateInputs(gate, port => {
          const source = wires.get(`${node.id}:${port}`);
          return source ? resolve(source) : { error: `端口 ${port} 还未接线。` };
        });
        next[node.id] = advance(gate.graph, inside, delays[node.id] ?? {});
      }
    }
    return next;
  }

  function captureGate(graph, output, name) {
    const nodes = new Map(graph.nodes.map(node => [node.id, node]));
    const wires = new Map(graph.wires.map(wire => [`${wire.to}:${wire.port}`, wire.from]));
    if (nodes.get(output)?.type !== 'output') throw new Error('请选择一个输出节点。');

    function upstream(instant) {
      const visited = new Set();
      function visit(id) {
        if (visited.has(id)) return;
        visited.add(id);
        const node = nodes.get(id);
        if (instant && node.type === 'delay') return;
        const inputs = instant && node.type === 'custom' ? node.gate.dependencies : inputPorts(node);
        for (const port of inputs) {
          const source = wires.get(`${id}:${port}`);
          if (source) visit(source);
          else if (node.type !== 'delay') throw new Error(`${node.name} 的 ${port} 端口还未接线。`);
        }
      }
      visit(output);
      return visited;
    }

    const used = upstream(false);
    const instant = upstream(true);
    const usedNodes = graph.nodes.filter(node => used.has(node.id));
    const inputs = usedNodes.filter(node => node.type === 'input')
      .map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
    const circuit = { nodes: usedNodes, wires: graph.wires.filter(wire => used.has(wire.to) && used.has(wire.from)) };
    return structuredClone({ name, graph: circuit, output, inputs, dependencies: inputs.filter(input => instant.has(input.id)).map(input => input.name), delayed: hasDelay(circuit) });
  }

  function connect(graph, from, to, port) {
    const nodes = new Map(graph.nodes.map(node => [node.id, node]));
    const source = nodes.get(from);
    const target = nodes.get(to);
    if (!source || !target || source.type === 'output' || !inputPorts(target).includes(port)) {
      throw new Error('请把输出端连接到输入端。');
    }
    const wires = graph.wires.filter(wire => wire.to !== to || wire.port !== port);
    const visited = new Set();
    const pending = [{ to, port }];
    while (pending.length) {
      const incoming = pending.pop();
      const id = incoming.to;
      const node = nodes.get(id);
      if (node.type === 'delay' || (node.type === 'custom' && !node.gate.dependencies.includes(incoming.port))) continue;
      if (id === from) throw new Error('这条线会形成循环连接。');
      if (visited.has(id)) continue;
      visited.add(id);
      for (const wire of wires) if (wire.from === id) pending.push(wire);
    }
    wires.push({ from, to, port });
    return { ...graph, wires };
  }

  const core = { integerBits, fractionBits, scale, max, ports, inputPorts, format, parse, bits, operate, evaluate, hasDelay, advance, captureGate, connect };
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.FixedPoint = core;
})(globalThis);
