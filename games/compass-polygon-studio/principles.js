const radiusName = (model, circle) => circle.radiusPoints.map(id => model.points[id].label).join('');
const equalRadii = (a, b) => Math.abs(a.r - b.r) <= 1e-9 * Math.max(1, a.r, b.r);

function operationReason(model, step) {
  const shape = model.shapes[step.shapes[0]];
  if (step.tool === 'given') {
    return '给定点 O 决定圆心，给定点 A 决定半径 OA 的长度和起始方向。把 OA 记作 1，可以用同一套构造处理任意大小的给定圆。';
  }
  if (step.tool === 'done') {
    return `这些基本角构造得到 ∠AOB = 360°/${model.n}。圆规把弦 AB 连续复制到同一个圆上，依次得到 ${model.n} 个顶点。等弦所对的圆心角相等，且这些角的和为 360°，所以相邻顶点构成正 ${model.n} 边形。`;
  }
  if (shape?.type === 'circle') {
    const radius = radiusName(model, shape);
    const center = shape.c.label;
    return `圆上每一点到圆心 ${center} 的距离都等于 ${radius}。因此，这个圆把已经得到的长度 ${radius} 复制到以 ${center} 为起点的各个方向。后续的交点会同时满足这个距离条件和另一条线或圆的条件。`;
  }
  if (shape?.type === 'line' || shape?.type === 'segment') {
    const {a, b} = shape;
    const source = model.steps.find(previous => previous.intersection && previous.points.length === 2 && previous.points.includes(a.id) && previous.points.includes(b.id));
    const circles = source?.intersection.sources.map(id => model.shapes[id]);
    if (circles?.every(circle => circle.type === 'circle') && equalRadii(...circles)) {
      const [first, second] = circles;
      return `${a.label}、${b.label} 都是两个等半径圆的交点，所以它们到 ${first.c.label}、${second.c.label} 的距离分别相等。到一条线段两端等距的点位于它的垂直平分线上，因此直线 ${a.label}${b.label} 是 ${first.c.label}${second.c.label} 的垂直平分线。`;
    }
    if (shape.role === 'polygon') {
      return `${a.label}、${b.label} 是按圆周顺序得到的相邻顶点，它们的弦长等于 AB。画线段 ${a.label}${b.label}，就把这个已经作出的弦表示为多边形的一条边。`;
    }
    if (shape.type === 'line') {
      return `两点 ${a.label}、${b.label} 决定唯一一条直线。延长线段 ${a.label}${b.label} 后，整条直线上的点都保持与这两点共线，因而可以和线段外的圆或直线求交。`;
    }
    return `两点 ${a.label}、${b.label} 决定线段 ${a.label}${b.label}。无刻度直尺完成这一步后，这段长度可以作为圆规开口，也可以继续延长来求交点。`;
  }
  if (step.intersection) {
    const [first, second] = step.intersection.sources.map(id => model.shapes[id]);
    const points = step.points.map(id => model.points[id].label).join('、');
    if (first.type === 'circle' && second.type === 'circle') {
      let reason = `交点 ${points} 同时位于两个圆上，所以到 ${first.c.label} 的距离等于 ${radiusName(model, first)}，到 ${second.c.label} 的距离等于 ${radiusName(model, second)}。`;
      if (equalRadii(first, second)) {
        reason += `这两个半径相等，因而交点到 ${first.c.label}、${second.c.label} 等距，位于 ${first.c.label}${second.c.label} 的垂直平分线上。`;
      }
      return reason + '两个交点的位置由这两项距离条件确定，步骤中的方位说明用于选择所需的一支。';
    }
    const circle = first.type === 'circle' ? first : second.type === 'circle' ? second : null;
    if (circle) {
      const line = first === circle ? second : first;
      return `交点 ${points} 同时满足两个条件：与 ${line.a.label}、${line.b.label} 共线，并且到 ${circle.c.label} 的距离等于 ${radiusName(model, circle)}。直线限制方向，圆限制距离，两者共同确定所需位置。`;
    }
    return `交点 ${points} 同时在直线 ${first.a.label}${first.b.label} 和直线 ${second.a.label}${second.b.label} 上，因此同时满足两条共线条件。两条不平行直线有唯一交点。`;
  }
  throw new Error('当前步骤缺少可解释的尺规操作');
}

function phaseReason(model, step) {
  const phase = step.phase;
  const common = {
    '准备': {
      title: '建立给定圆',
      text: '先由 O、A 建立圆与基准直线。OA 的反向射线与圆相交，得到直径另一端 D₀，为后续构造提供对称的基准。',
      formula: 'OA = OD₀ = r'
    },
    '垂直直径': {
      title: '为什么得到垂直直径',
      text: '基准直线上取到的两点关于 O 对称。以这两点为圆心作等半径圆，两个交点的连线就是它们的垂直平分线。因为 O 是原线段的中点，这条线通过 O，也就给出与 OA 垂直的直径。',
      formula: '对称的两端点 → 等圆交点连线 → 过 O 的垂线'
    },
    '三边形的基本弦': {
      title: '为什么三边形的基本角是 120°',
      text: '⊙O 与以 D₀ 为圆心、OA 为半径的圆相交。交点和 O、D₀ 构成三边都等于 OA 的等边三角形，所以在 O 处的角是 60°。OA 与 OD₀ 方向相反，所需圆心角就是 180°−60°。',
      formula: '180° − 60° = 120° = 360°/3'
    },
    '五边形 · 黄金分割': {
      title: '五边形所需的黄金分割长度',
      text: '以 OA 为单位，Carlyle 圆的两个直径端点为 (0,1) 和 (−1,−1)。它与基准直线的正向交点对应方程 x²+x−1=0 的正根。再用垂直平分线构造这个根对应线段的中点。',
      formula: 'x = (√5 − 1)/2，x/2 = (√5 − 1)/4'
    },
    '五边形的基本弦': {
      title: '为什么这个交点给出 72°',
      text: '上一步所得中点到 O 的有向距离为 (√5−1)/4。过它作基准直线的垂线，与单位圆的上方交点相连得到半径。该半径的水平分量等于 cos 72°，所以得到五边形的基本角。',
      formula: 'cos 72° = (√5 − 1)/4，72° = 360°/5'
    },
    '十七边形 · 单位复制': {
      title: '为十七边形准备已知长度',
      text: '沿基准射线连续用圆规复制 OA，得到 2、3、4 倍单位长度。这些已作出的端点用于后续辅助圆的直径端点。',
      formula: 'OA = 1 → 2 → 3 → 4'
    },
    '十七边形 · x²+x−4=0': {
      title: '十七边形的第一对长度',
      text: 'Carlyle 圆与基准直线的两交点对应方程 x²+x−4=0 的两个根。正根记作 x₁，负根记作 x₂。后面复制它们对应的线段。',
      formula: 'x₁ = (−1 + √17)/2，x₂ = (−1 − √17)/2'
    },
    '十七边形 · y²−x₁y−1=0': {
      title: '从 x₁ 构造 y₁',
      text: '用 x₁ 对应的端点和单位长度构造第二个 Carlyle 圆。它与基准直线的正向交点给出下面二次方程的正根 y₁。',
      formula: 'y₁² − x₁y₁ − 1 = 0，y₁ > 0'
    },
    '十七边形 · y²−x₂y−1=0': {
      title: '从 x₂ 构造 y₃',
      text: '用 x₂ 对应的端点和单位长度构造第三个 Carlyle 圆。它与基准直线的正向交点给出正根 y₃，为下一次构造准备另一条已知长度。',
      formula: 'y₃² − x₂y₃ − 1 = 0，y₃ > 0'
    },
    '十七边形 · z²−y₁z+y₃=0': {
      title: '构造十七边形的基本角长度',
      text: '以已构造的 y₁、y₃ 组成第四个 Carlyle 圆的直径端点。取所得二次方程的较大根 z。高斯周期关系给出 z = 2cos(360°/17)，所以把它对应的线段平分，就得到所需的水平分量。',
      formula: 'z² − y₁z + y₃ = 0，z/2 = cos(360°/17)'
    },
    '十七边形的基本弦': {
      title: '为什么得到十七边形的基本角',
      text: '过 z/2 对应的端点作基准直线的垂线，与给定圆相交。由于水平分量已是 cos(360°/17)，上方交点与 O 连成的半径给出基本圆心角。',
      formula: '基本圆心角 = 360°/17'
    },
    '角平分 · 边数加倍': {
      title: '为什么角平分能使边数加倍',
      text: '两条半径等长，构成等腰三角形。它们端点连成的弦的垂直平分线通过 O，也平分这两条半径之间的角。因此新弦对应原来一半的基本角，所需顶点数增加一倍。',
      formula: '360°/m → 180°/m = 360°/(2m)'
    },
    '圆规逐点定顶点': {
      title: '为什么固定 AB 能得到后续顶点',
      text: '每次把圆规开口固定为 AB，新圆与 ⊙O 的交点到上一个顶点的距离都等于 AB。选择沿圆周继续前进的一支，就得到与前一条边等长的下一条弦。',
      formula: `每条边 = AB，每个基本圆心角 = 360°/${model.n}`
    },
    '直尺连接 · 完成': {
      title: '为什么连起来是正多边形',
      text: `基本角构造先保证 ∠AOB = 360°/${model.n}，等弦复制再保证所有相邻圆心角相同。${model.n} 个相邻角恰好转满一周，所有顶点在同一圆上，因而相邻顶点连成的边和内角分别相等。`,
      formula: `${model.n} × (360°/${model.n}) = 360°`
    }
  };
  if (phase === '基本角组合') {
    const {primes, coefficients, baseCount} = model.combination;
    return {
      title: '为什么组合这些基本角',
      text: '互素的基本边数可以通过整数组合得到更小的基本角。程序找出下面的整数组合，用已构造的基本弦反复复制，实现对应角度的相加或相减。转过整周后，射线方向仍相同。',
      formula: `${primes.map((p, i) => `${coefficients[i]}×(360°/${p})`).join(' + ')} ≡ 360°/${baseCount}（模 360°）`
    };
  }
  const result = common[phase];
  if (!result) throw new Error(`缺少阶段原理：${phase}`);
  if ((phase.includes('·') && phase.includes('=0')) || phase === '五边形 · 黄金分割') {
    return {
      ...result,
      text: result.text + '一般地，以 (0,1)、(s,p) 为直径端点的圆满足 x(x−s)+(y−1)(y−p)=0。与基准直线相交时 y=0，便得到 x²−sx+p=0。直径端点、中点与垂线都由此前的尺规步骤构造。'
    };
  }
  return result;
}

export function constructionPrinciple(model, stepIndex) {
  const step = model.steps[stepIndex];
  return {
    stepTitle: step.title,
    operation: operationReason(model, step),
    phase: phaseReason(model, step)
  };
}
