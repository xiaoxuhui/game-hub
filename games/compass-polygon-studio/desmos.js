const call = (name, ...args) => `\\operatorname{${name}}\\left(${args.join(',')}\\right)`;

function shapeExpression(shape, pointName) {
  if (shape.type !== 'circle') return call(shape.type, pointName(shape.a.id), pointName(shape.b.id));

  const [a, b] = shape.radiusPoints;
  // Use the compass-length form so the two intersections remain distinct even
  // when the radius endpoint already lies on the intersecting line.
  return call('circle', pointName(shape.c.id), call('segment', pointName(a), pointName(b)));
}

function intersectionOrder(first, second, point) {
  // Desmos reverses the selected intersection when the two inputs swap.
  if (first.type === 'circle' && second.type === 'circle') {
    const dx = second.c.x - first.c.x;
    const dy = second.c.y - first.c.y;
    const side = dx * (point.y - first.c.y) - dy * (point.x - first.c.x);
    if (side < 0) return [second, first];
  } else if (first.type === 'line' && second.type === 'circle') {
    const dx = first.b.x - first.a.x;
    const dy = first.b.y - first.a.y;
    const projection = dx * (point.x - second.c.x) + dy * (point.y - second.c.y);
    if (projection > 0) return [second, first];
  }
  return [first, second];
}

export function desmosExpressions(model, stepIndex, visible, showLabels) {
  // Keep variable references distinct when the user pastes multiple constructions.
  const tag = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
  const pointName = id => `P_{e${tag}p${id}}`;
  const shapeName = id => `G_{e${tag}g${id}}`;
  const visibleShapes = new Set(visible.shapes.map(shape => shape.id));
  const visiblePoints = new Set(visible.points.map(point => point.id));
  const exportedPoints = new Set();
  const expressions = [];

  for (const step of model.steps.slice(0, stepIndex + 1)) {
    for (const id of step.shapes) {
      const shape = model.shapes[id];
      expressions.push({
        type: 'expression',
        id: `compass-shape-${id}`,
        latex: `${shapeName(id)}=${shapeExpression(shape, pointName)}`,
        color: shape.role === 'aux' ? '#879a75' : '#315f4c',
        hidden: !visibleShapes.has(id)
      });
    }
    for (const id of step.points) {
      if (exportedPoints.has(id)) continue;
      exportedPoints.add(id);
      const point = model.points[id];
      let definition;
      if (step.intersection) {
        const [first, second] = step.intersection.sources.map(source => model.shapes[source]);
        const [a, b] = intersectionOrder(first, second, point);
        definition = call('intersection', shapeName(a.id), shapeName(b.id));
      } else {
        definition = `\\left(${point.x},${point.y}\\right)`;
      }
      expressions.push({
        type: 'expression',
        id: `compass-point-${id}`,
        latex: `${pointName(id)}=${definition}`,
        color: point.base || point.vertex ? '#315f4c' : '#879a75',
        hidden: !visiblePoints.has(id),
        label: point.label,
        showLabel: showLabels,
        ...(point.base ? {dragMode: 'XY'} : {})
      });
    }
  }
  return expressions;
}

export function desmosClipboard(expressions, title) {
  const plain = expressions.map(entry => entry.latex).join('\n');
  // Desmos imports the full list when it starts with a folder and its members.
  const folderId = 'compass-export';
  const folder = {type: 'folder', id: folderId, title, collapsed: false};
  const items = [folder, ...expressions.map(entry => ({...entry, folderId}))];
  const html = document.createElement('div');
  html.setAttribute('data-dcg-clipboard-format', 'dcg-copy-expression');
  html.setAttribute('data-dcg-clipboard-payload', JSON.stringify(items));
  html.textContent = plain;
  return {'text/plain': plain, 'text/html': html.outerHTML};
}

export async function copyDesmos(data) {
  try {
    const parts = Object.fromEntries(Object.entries(data).map(([type, value]) => [type, new Blob([value], {type})]));
    await navigator.clipboard.write([new ClipboardItem(parts)]);
    return true;
  } catch {
    let wrote = false;
    const onCopy = event => {
      if (!event.clipboardData) return;
      event.preventDefault();
      for (const [type, value] of Object.entries(data)) event.clipboardData.setData(type, value);
      wrote = true;
    };
    document.addEventListener('copy', onCopy, {once: true});
    try {
      return document.execCommand('copy') && wrote;
    } catch {
      return false;
    } finally {
      document.removeEventListener('copy', onCopy);
    }
  }
}
