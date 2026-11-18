(function (root) {
  'use strict';

  const core = root.LambdaCore || require('./core.js');
  const colors = {
    binders: ['#a899ff', '#68dec5', '#f899b2', '#8bbdf9', '#edb979', '#d0df97'],
    application: '#ffe3a8',
    free: '#bdc7ea',
  };
  const rowSpacing = 2;
  const minimumColumnSpacing = 2;
  const automaticNodeLimit = 512;
  const coordinate = (x, y) => x + ',' + y;

  function compactColumns(strokes, count) {
    const rows = new Map();
    // Only binding bars have overhangs that can force wider column gaps.
    for (const stroke of strokes) {
      if (stroke.overhang && !rows.has(stroke.top)) rows.set(stroke.top, []);
    }
    for (const stroke of strokes) {
      for (let y = stroke.top; y <= stroke.bottom; y++) {
        rows.get(y)?.push(stroke);
      }
    }
    const gaps = Array(count - 1).fill(minimumColumnSpacing);
    for (const row of rows.values()) {
      row.sort((a, b) => a.left - b.left || b.right - a.right);
      const spans = [];
      for (const { left, right, overhang } of row) {
        const last = spans.at(-1);
        if (!last || left > last.right) {
          spans.push({ left, right, leftTip: overhang, rightTip: overhang });
          continue;
        }
        if (left === last.left) last.leftTip = Math.max(last.leftTip, overhang);
        if (right >= last.right) {
          last.rightTip = right === last.right ? Math.max(last.rightTip, overhang) : overhang;
          last.right = right;
        }
      }
      // Connected strokes share a span. Independent strokes need a blank
      // cell even where one or both binding bars overhang the variable.
      for (let i = 1; i < spans.length; i++) {
        const before = spans[i - 1], after = spans[i];
        if (before.right + 1 === after.left) {
          gaps[before.right] = Math.max(gaps[before.right],
            minimumColumnSpacing + before.rightTip + after.leftTip);
        }
      }
    }
    const columns = [0];
    for (const gap of gaps) columns.push(columns.at(-1) + gap);
    return columns;
  }

  function layoutDrawing(term, origin = { x: 0, y: 0 }, { ink, freeRows } = {}) {
    if ([...core.freeVars(term)].some((name) => !freeRows?.has(name))) {
      throw new core.LambdaError('表达式含有自由变量，请勾选「识别自由变量」。');
    }
    const strokes = [], bindings = new Map();
    const rootColor = ink?.get(term);
    let column = 0;
    let binderIndex = 0;

    function line(left, top, right, bottom, color, overhang = 0) {
      strokes.push({ left, top, right, bottom, color, overhang });
    }

    function layout(node, y) {
      if (node.type === 'var') {
        const x = column++;
        const binder = bindings.get(node.name);
        const color = ink?.get(node) ?? binder?.color ?? colors.free;
        line(x, binder?.y ?? freeRows.get(node.name), x, y, color);
        return { left: x, right: x, bottom: y, lastBar: -Infinity, color };
      }
      if (node.type === 'abs') {
        const nested = bindings.get(node.param);
        const color = ink?.get(node) ?? rootColor ?? colors.binders[binderIndex++ % colors.binders.length];
        bindings.set(node.param, { y, color });
        const body = layout(node.body, y + rowSpacing);
        if (nested) bindings.set(node.param, nested);
        else bindings.delete(node.param);
        line(body.left, y, body.right, y, color, 1);
        return { ...body, lastBar: Math.max(y, body.lastBar) };
      }
      const fn = layout(node.fn, y), arg = layout(node.arg, y);
      // A variable's lower endpoint is not a horizontal bar. Only actual
      // bars need an intervening row before the next application.
      const bottom = Math.max(y, Math.max(fn.lastBar, arg.lastBar) + rowSpacing);
      line(fn.left, fn.bottom, fn.left, bottom, fn.color);
      line(arg.left, arg.bottom, arg.left, bottom, arg.color);
      line(fn.left, bottom, arg.left, bottom, ink?.get(node) ?? rootColor ?? colors.application);
      return { left: fn.left, right: arg.right, bottom, lastBar: bottom, color: fn.color };
    }

    layout(term, 0);
    const columns = compactColumns(strokes, column);
    const lines = new Int32Array(strokes.length * 5);
    const palette = new Map();
    let i = 0;
    for (const { left, top, right, bottom, color, overhang } of strokes) {
      if (!palette.has(color)) palette.set(color, palette.size);
      lines[i++] = columns[left] - overhang;
      lines[i++] = top;
      lines[i++] = columns[right] + overhang;
      lines[i++] = bottom;
      lines[i++] = palette.get(color);
    }
    return { origin, colors: [...palette.keys()], lines };
  }

  function forEachLine(drawing, visit) {
    const { origin, colors, lines } = drawing;
    for (let i = 0; i < lines.length; i += 5) {
      visit(lines[i] + origin.x, lines[i + 1] + origin.y,
        lines[i + 2] + origin.x, lines[i + 3] + origin.y, colors[lines[i + 4]]);
    }
  }

  function rasterize(drawing) {
    const pixels = new Map();
    forEachLine(drawing, (x0, y0, x1, y1, color) => {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) pixels.set(coordinate(x, y), color);
      }
    });
    return pixels;
  }

  function draw(term, origin, options) {
    return rasterize(layoutDrawing(term, origin, options));
  }

  function guide(source, { allowFree = false } = {}) {
    if (/\b\d|[\[\],]/.test(source)) throw new core.LambdaError('底稿请输入纯 Lambda 表达式，例如 (λx.x) (λy.y)。');
    const term = core.parse(source, 1600);
    const freeRows = allowFree
      ? new Map([...core.freeVars(term)].map((name, i) => [name, -(i + 1) * rowSpacing]))
      : undefined;
    return draw(term, undefined, { freeRows });
  }

  function dominantColor(samples) {
    const counts = new Map();
    for (const color of samples) counts.set(color, (counts.get(color) || 0) + 1);
    let chosen, highest = 0;
    for (const [color, count] of counts) {
      if (count > highest) {
        chosen = color;
        highest = count;
      }
    }
    return chosen;
  }

  function read(pixels, { allowFree = false } = {}) {
    if (!pixels.size) throw new Error('第 1 帧还没有可读取的线路。');
    const rows = new Map();
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const id of pixels.keys()) {
      const [x, y] = id.split(',').map(Number);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push(x);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    const invalid = () => new Error('第 1 帧的线路无法识别。请检查断点、多余像素和间距，也可沿底稿描画。');

    const variableColumns = new Set(), horizontal = [];
    for (const [y, row] of rows) {
      row.sort((a, b) => a - b);
      for (let i = 0; i < row.length; i++) {
        const start = row[i];
        while (row[i + 1] === row[i] + 1) i++;
        const end = row[i];
        if (start === end) variableColumns.add(start);
        else horizontal.push({ start, end, y });
      }
    }
    const columns = [...variableColumns].sort((a, b) => a - b);
    const leftFits = columns[0] === left + 1 || (allowFree && columns[0] === left);
    const rightFits = columns.at(-1) === right - 1 || (allowFree && columns.at(-1) === right);
    if (!columns.length || !leftFits || !rightFits ||
        columns.some((x, i) => i > 0 && x - columns[i - 1] < minimumColumnSpacing)) {
      throw invalid();
    }
    const columnIndex = new Map(columns.map((x, i) => [x, i]));
    const binders = columns.map(() => []);
    const applications = columns.map(() => []);
    const horizontalInk = new Set();
    let firstBinderY = Infinity;
    const inkAt = (x, y) => pixels.get(coordinate(x, y))?.toLowerCase();

    function splitBindingBar(bar, first, last) {
      // Nearby overhangs can touch or share one cell. At a shared tip, use
      // the adjacent pixels to determine the color on each side.
      const pieces = [];
      let start = bar.start;
      let sharedStart = false;
      for (let i = first; i < last; i++) {
        const end = columns[i] + 1;
        const next = columns[i + 1] - 1;
        const sharedEnd = next === end;
        const leftColor = inkAt(sharedEnd ? end - 1 : end, bar.y);
        const rightColor = inkAt(sharedEnd ? next + 1 : next, bar.y);
        if ((sharedEnd || next === end + 1) && leftColor !== rightColor) {
          pieces.push({ start, end, y: bar.y, sharedStart, sharedEnd });
          start = next;
          sharedStart = sharedEnd;
        }
      }
      pieces.push({ start, end: bar.end, y: bar.y, sharedStart });
      for (const piece of pieces) {
        const startInk = inkAt(piece.start + (piece.sharedStart ? 1 : 0), piece.y);
        const endInk = inkAt(piece.end - (piece.sharedEnd ? 1 : 0), piece.y);
        if (startInk !== endInk) {
          const leftInk = inkAt(bar.start, bar.y);
          return [{ ...bar, color: leftInk === inkAt(bar.end, bar.y) ? leftInk : undefined }];
        }
        piece.color = startInk;
      }
      return pieces;
    }

    horizontal.sort((a, b) => a.y - b.y);
    for (const bar of horizontal) {
      const { start, end, y } = bar;
      for (let x = start; x <= end; x++) horizontalInk.add(coordinate(x, y));
      // Binding bars overhang the outer variable columns by one cell.
      // An application connects the actual columns of the two subterms.
      const first = columnIndex.get(start + 1), last = columnIndex.get(end - 1);
      if (end - start >= 2 && first !== undefined && last !== undefined) {
        firstBinderY = Math.min(firstBinderY, y);
        for (const piece of splitBindingBar(bar, first, last)) {
          binders[columnIndex.get(piece.start + 1)].push({
            ...piece,
            right: columnIndex.get(piece.end - 1),
          });
        }
      } else if (columnIndex.has(start) && columnIndex.has(end)) {
        applications[columnIndex.get(start)].push({ ...bar, right: columnIndex.get(end) });
      } else {
        throw invalid();
      }
    }
    for (const items of applications) items.reverse();

    const covered = new Set(), scope = new Map(), ink = new WeakMap();
    const freeNames = new Map();
    function markHorizontal({ start, end, y, sharedStart, sharedEnd, color }) {
      const samples = [];
      for (let x = start; x <= end; x++) {
        covered.add(coordinate(x, y));
        if (!columnIndex.has(x) && !(sharedStart && x === start) && !(sharedEnd && x === end)) {
          samples.push(inkAt(x, y));
        }
      }
      return dominantColor(samples) ?? color;
    }
    function markVertical(x, start, end) {
      for (let y = start; y <= end; y++) {
        const id = coordinate(x, y);
        if (!pixels.has(id)) throw invalid();
        covered.add(id);
      }
    }

    let binderCount = 0;
    function parse(first, last, top, output, ceiling) {
      if (top > output) throw invalid();
      const binder = binders[first].find(({ right, y }) =>
        right === last && y >= top && y <= ceiling && y + rowSpacing <= output);
      if (binder) {
        const strokeColor = markHorizontal(binder);
        const name = 'x' + (++binderCount);
        scope.set(binder.y, { name, color: binder.color, strokeColor });
        const body = parse(first, last, binder.y + rowSpacing, output, ceiling);
        scope.delete(binder.y);
        const term = core.L(name, body);
        ink.set(term, strokeColor);
        return term;
      }
      const app = applications[first].find(({ y, right }) => y >= top && y <= ceiling && right <= last);
      if (app) {
        const color = markHorizontal(app);
        markVertical(columns[first], app.y, output);
        const childCeiling = app.y - rowSpacing;
        const fn = parse(first, app.right - 1, top, app.y, childCeiling);
        const arg = parse(app.right, last, top, app.y, childCeiling);
        const term = core.A(fn, arg);
        ink.set(term, color);
        return term;
      }
      const x = columns[first];
      if (first !== last || !pixels.has(coordinate(x, output))) throw invalid();
      let start = output;
      while (pixels.has(coordinate(x, start - 1))) start--;
      const binderAtStart = scope.get(start);
      if (!binderAtStart && (!allowFree || start >= firstBinderY || output - start < rowSpacing)) throw invalid();
      markVertical(x, start, output);
      const samples = [];
      for (let y = start + 1; y <= output; y++) {
        if (!horizontalInk.has(coordinate(x, y))) samples.push(inkAt(x, y));
      }
      const verticalColors = new Set(samples);
      if (binderAtStart?.color && verticalColors.size === 1 && !verticalColors.has(binderAtStart.color)) {
        for (const [y, binder] of scope) {
          if (verticalColors.has(binder.color)) {
            throw new Error('X=' + x + ' 的竖线接在 Y=' + start + '，颜色却与 Y=' + y + ' 的绑定横线相同。请检查交叉处。');
          }
        }
      }
      if (!binderAtStart && !freeNames.has(start)) freeNames.set(start, 'f' + (freeNames.size + 1));
      const term = core.V(binderAtStart?.name ?? freeNames.get(start));
      ink.set(term, dominantColor(samples) ?? binderAtStart?.strokeColor ?? inkAt(x, start));
      return term;
    }
    const termTop = allowFree && Number.isFinite(firstBinderY) ? firstBinderY : top;
    const term = parse(0, columns.length - 1, termTop, bottom, bottom);
    // Every pixel must belong to a bar, a variable, or an application output.
    if (covered.size !== pixels.size) throw invalid();
    const layoutTop = !Number.isFinite(firstBinderY) && freeNames.size
      ? Math.max(...freeNames.keys()) + rowSpacing
      : termTop;
    const freeRows = new Map([...freeNames].map(([y, name]) => [name, y - layoutTop]));
    return { term, origin: { x: columns[0], y: layoutTop }, ink, freeRows };
  }

  function inheritInk(before, change, ink) {
    let after = change.term;
    for (const part of change.path) {
      ink.set(after, ink.get(before));
      before = before[part];
      after = after[part];
    }
    // The reducer keeps the body shape except where its bound variable
    // is replaced. Every inserted copy takes its colors from the argument.
    const pending = [{ from: change.before.fn.body, to: after, substituting: true }];
    while (pending.length) {
      let { from, to, substituting } = pending.pop();
      if (substituting && from.type === 'var' && from.name === change.param) {
        from = change.argument;
        substituting = false;
      }
      if (from === to) continue;
      ink.set(to, ink.get(from));
      if (from.type === 'abs') {
        pending.push({ from: from.body, to: to.body, substituting: substituting && from.param !== change.param });
      } else if (from.type === 'app') {
        pending.push({ from: from.fn, to: to.fn, substituting }, { from: from.arg, to: to.arg, substituting });
      }
    }
  }

  function* reductionFrames(pixels, limit = Infinity, options) {
    try {
      const { term, origin, ink, freeRows } = read(pixels, options);
      const automatic = limit === Infinity;
      if (automatic && core.inspect(term).nodes > automaticNodeLimit) return 'size';
      const compactFreeRows = new Map([...freeRows]
        .sort((a, b) => b[1] - a[1])
        .map(([name], i) => [name, -(i + 1) * rowSpacing]));
      const seen = automatic ? new Set([core.key(term)]) : null;
      let current = term;
      for (let step = 1; step <= limit; step++) {
        const next = core.step(current);
        if (!next) return 'normal';
        if (automatic && core.inspect(next.term).nodes > automaticNodeLimit) return 'size';
        inheritInk(current, next, ink);
        current = next.term;
        const drawing = layoutDrawing(current, origin, { ink, freeRows: compactFreeRows });
        const image = options?.compact ? { drawing } : { pixels: rasterize(drawing) };
        yield { ...image, expression: core.format(current), step };
        if (seen) {
          const key = core.key(current);
          if (seen.has(key)) return 'cycle';
          seen.add(key);
        }
      }
      return core.hasRedex(current) ? 'limit' : 'normal';
    } catch (error) {
      if (error instanceof RangeError) return 'capacity';
      throw error;
    }
  }

  function generate(pixels, limit, options) {
    const frames = [];
    const sequence = reductionFrames(pixels, limit, options);
    for (let result = sequence.next(); ; result = sequence.next()) {
      if (result.done) return { frames, reason: result.value };
      frames.push(result.value);
    }
  }

  const api = { draw, guide, read, generate, reductionFrames, rasterize, forEachLine };
  root.Tromp = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
