/* The board engine is shared by manual play, training, and replay. */
(function (root) {
  'use strict';

  const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const symbols = '# .@$*+';
  const deviceKinds = ['pusher', 'power'];
  const gameplays = ['classic', 'powered', 'direct'];
  const examples = [
    ['##########', '#        #', '# .  .   #', '#   #    #', '# $  $   #', '#   @    #', '#     #  #', '##########'],
    ['########', '#      #', '#  $ . #', '# @    #', '#      #', '########'],
    ['###########', '#         #', '# . . .   #', '#    #    #', '# $ $ $   #', '#   #     #', '#    @    #', '#         #', '###########'],
  ];

  function readMap(text) {
    const rows = text.replace(/\r/g, '').split('\n');
    while (rows[0] === '') rows.shift();
    while (rows.at(-1) === '') rows.pop();
    const width = rows[0]?.length ?? 0;
    if (!width || !rows.length ||
        rows.some(row => row.length !== width || [...row].some(tile => !symbols.includes(tile)))) {
      throw new Error('字符地图的每行须等宽，仅支持 # 空格 . @ $ * +。');
    }
    if (rows.join('').split('').filter(tile => tile === '@' || tile === '+').length > 1) {
      throw new Error('地图只能有一个玩家。');
    }
    return rows;
  }

  const opposite = direction => (direction + 2) % 4;
  const portalHost = tile => tile === '#' || tile === '$' || tile === '*';

  function addPortalFace(index, cell, side, endpoint) {
    let faces = index.get(cell);
    if (!faces) {
      faces = [];
      index.set(cell, faces);
    }
    faces[side] ??= endpoint;
  }

  function indexPortals(portals, isWall, adjacent) {
    const fixed = new Map();
    const movable = [];
    const exitOnly = portals.map(end => end.exitOnly === true);
    portals.forEach(({ cell, side }, endpoint) => {
      if (!isWall(cell)) movable.push(endpoint);
      else if (!exitOnly[endpoint]) addPortalFace(fixed, cell, side, endpoint);
    });
    const fixedExits = portals.map(({ cell, side }) => {
      if (!isWall(cell)) return null;
      const next = adjacent(cell, side);
      const wall = isWall(next);
      return { cell: next, wall, entrance: wall ? fixed.get(next)?.[opposite(side)] ?? -1 : -1 };
    });
    return { fixed, fixedExits, movable, exitOnly, cache: new WeakMap() };
  }

  function movingFaces(map, portalCells) {
    const { movable, exitOnly, cache } = map.portalIndex;
    let index = cache.get(portalCells);
    if (!index) {
      const entries = new Map();
      const endpoints = new Map();
      for (const endpoint of movable) {
        const cell = portalCells[endpoint];
        if (!endpoints.has(cell)) endpoints.set(cell, []);
        endpoints.get(cell).push(endpoint);
        if (!exitOnly[endpoint]) addPortalFace(entries, cell, map.portalSides[endpoint], endpoint);
      }
      index = { entries, endpoints };
      cache.set(portalCells, index);
    }
    return index;
  }

  function compile(rows, chainPush = false, portals = [], finish = null) {
    const width = rows[0].length;
    const tiles = rows.join('');
    const goals = new Set();
    const boxes = [];
    let player = -1;
    for (let i = 0; i < tiles.length; i++) {
      if ('.*+'.includes(tiles[i])) goals.add(i);
      if ('$*'.includes(tiles[i])) boxes.push(i);
      if ('@+'.includes(tiles[i])) player = i;
    }
    const adjacent = Array.from(tiles, (_, i) => directions.map(([dx, dy]) => {
      const x = i % width + dx;
      const y = Math.floor(i / width) + dy;
      const cell = y * width + x;
      return x < 0 || x >= width || y < 0 || y >= rows.length ? -1 : cell;
    }));
    const isWall = cell => tiles[cell] === '#';
    const next = adjacent.map(neighbors => neighbors.map(cell => isWall(cell) ? -1 : cell));
    const adjacentCell = (cell, direction) => adjacent[cell][direction];
    return {
      width, tiles, goals, finish, next, chainPush, isWall,
      adjacent: adjacentCell,
      neighbor: (cell, direction) => next[cell][direction],
      portalSides: portals.map(end => end.side),
      portalIndex: indexPortals(portals, isWall, adjacentCell),
      initial: { player, boxes, moves: 0, pushes: 0, portalCells: portals.map(end => end.cell) },
    };
  }

  const key = (x, y) => x + ',' + y;
  const point = cell => cell.split(',').map(Number);

  function fromRows(rows) {
    const tiles = new Map();
    rows.forEach((row, y) => [...row].forEach((tile, x) => {
      if (tile !== ' ') tiles.set(key(x, y), tile);
    }));
    return tiles;
  }

  function readLevel(text) {
    if (!text.trim()) return { tiles: new Map(), chainPush: false };
    if (!text.trimStart().startsWith('{')) return { tiles: fromRows(readMap(text)), chainPush: false };
    const data = JSON.parse(text);
    if (data?.version !== 1 || !Array.isArray(data.tiles)) throw new Error('地图 JSON 须包含 version: 1 和 tiles 数组。');
    const tiles = new Map();
    let hasPlayer = false;
    for (const entry of data.tiles) {
      if (!Array.isArray(entry) || entry.length !== 3) throw new Error('每格须写成 [横坐标, 纵坐标, 字符]。');
      const [x, y, tile] = entry;
      const cell = key(x, y);
      if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) ||
          Math.abs(x) > 1e12 || Math.abs(y) > 1e12 ||
          typeof tile !== 'string' || tile.length !== 1 || !symbols.includes(tile) || tile === ' ' || tiles.has(cell)) {
        throw new Error('请检查地图坐标、重复格子和地图字符。');
      }
      if ('@+'.includes(tile)) {
        if (hasPlayer) throw new Error('地图只能有一个玩家。');
        hasPlayer = true;
      }
      tiles.set(cell, tile);
    }
    const pairs = data.portals ?? [];
    if (!Array.isArray(pairs)) throw new Error('传送门须成对设置。');
    const entrances = new Set();
    const portals = pairs.flatMap(pair => {
      if (!Array.isArray(pair) || (pair.length !== 2 && !(pair.length === 3 && pair[2] === 'one-way'))) {
        throw new Error('传送门须指定两个端点，单向门可加 one-way 标记。');
      }
      const ends = pair.slice(0, 2).map((endpoint, index) => {
        if (!Array.isArray(endpoint) || endpoint.length !== 3) throw new Error('请检查传送门端点。');
        const [x, y, side] = endpoint;
        const cell = key(x, y);
        if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isInteger(side) ||
            !directions[side] || !portalHost(tiles.get(cell))) {
          throw new Error('传送门须绑定在箱子或墙的边上。');
        }
        if (index === 1 && pair.length === 3) return { cell, side, exitOnly: true };
        const face = cell + ',' + side;
        if (entrances.has(face)) throw new Error('同一个入口只能通往一个出口。');
        entrances.add(face);
        return { cell, side };
      });
      if (ends[0].cell === ends[1].cell && ends[0].side === ends[1].side) {
        throw new Error('同一条连接的入口和出口须选不同的边。');
      }
      return ends;
    });
    let finish = null;
    if (data.finish != null) {
      const location = data.finish;
      if (!Array.isArray(location) || location.length !== 2 ||
          location.some(value => !Number.isSafeInteger(value) || Math.abs(value) > 1e12)) {
        throw new Error('玩家终点须写成 [横坐标, 纵坐标]。');
      }
      finish = key(...location);
      if (tiles.get(finish) === '#') throw new Error('玩家终点须放在可行走的格子上。');
    }
    const gameplay = data.gameplay ?? 'classic';
    const devices = new Map();
    if (!gameplays.includes(gameplay) || !Array.isArray(data.devices ?? [])) {
      throw new Error('请检查玩法和装置列表。');
    }
    for (const entry of data.devices ?? []) {
      if (!Array.isArray(entry) || entry.length !== 4) throw new Error('装置须写成 [横坐标, 纵坐标, 类型, 朝向]。');
      const [x, y, kind, direction] = entry;
      const cell = key(x, y);
      if (![x, y].every(value => Number.isSafeInteger(value) && Math.abs(value) <= 1e12) ||
          !deviceKinds.includes(kind) || !Number.isInteger(direction) || !directions[direction] ||
          devices.has(cell) || '$*'.includes(tiles.get(cell) ?? ' ')) {
        throw new Error('请检查装置坐标、朝向或重叠的方块。');
      }
      devices.set(cell, { kind, direction });
    }
    return { tiles, chainPush: data.chainPush === true, portals, finish, gameplay, devices, unlimitedTraining: data.unlimitedTraining !== false };
  }

  function readWorld(text) {
    return readLevel(text).tiles;
  }

  function writeWorld(tiles, chainPush = false, portals = [], finish = null, { gameplay = 'classic', devices, unlimitedTraining = true } = {}) {
    const lines = [...tiles].map(([cell, tile]) => JSON.stringify([...point(cell), tile]));
    const pairs = [];
    for (let i = 0; i < portals.length; i += 2) {
      const pair = portals.slice(i, i + 2).map(end => [...point(end.cell), end.side]);
      if (portals[i + 1]?.exitOnly) pair.push('one-way');
      pairs.push(JSON.stringify(pair));
    }
    const links = pairs.length ? '],\n  "portals": [\n    ' + pairs.join(',\n    ') + '\n  ]' : ']';
    const finishField = finish === null ? '' : ',\n  "finish": ' + JSON.stringify(point(finish));
    const gameplayField = gameplay === 'classic' ? '' : ',\n  "gameplay": ' + JSON.stringify(gameplay);
    const deviceField = devices?.size ? ',\n  "devices": [\n    ' + [...devices].map(([cell, { kind, direction }]) =>
      JSON.stringify([...point(cell), kind, direction])).join(',\n    ') + '\n  ]' : '';
    const trainingField = unlimitedTraining ? '' : ',\n  "unlimitedTraining": false';
    return '{\n  "version": 1,\n  "chainPush": ' + chainPush + ',\n  "tiles": [' + (lines.length ? '\n    ' + lines.join(',\n    ') + '\n  ' : '') + links + finishField + gameplayField + deviceField + trainingField + '\n}';
  }

  function world(tiles, chainPush = false, portals = [], finish = null, { gameplay = 'classic', devices = new Map(), unlimitedTraining = true } = {}) {
    const goals = new Set();
    const boxes = [];
    let player = -1;
    for (const [cell, tile] of tiles) {
      if ('.*+'.includes(tile)) goals.add(cell);
      if ('$*'.includes(tile)) boxes.push(cell);
      if ('@+'.includes(tile)) player = cell;
    }
    const adjacent = (cell, direction) => {
      const [dx, dy] = directions[direction];
      const comma = cell.indexOf(',');
      return dx ? (Number(cell.slice(0, comma)) + dx) + cell.slice(comma) :
        cell.slice(0, comma + 1) + (Number(cell.slice(comma + 1)) + dy);
    };
    const pusherMode = gameplay !== 'classic';
    const isWall = cell => !pusherMode && tiles.get(cell) === '#';
    const initial = { player: pusherMode ? -1 : player, boxes, moves: 0, pushes: 0, portalCells: [] };
    if (pusherMode) {
      portals = [];
      finish = null;
      initial.devices = gameplay === 'direct' ? new Map([...devices].filter(([, device]) => device.kind === 'pusher')) : devices;
    } else initial.portalCells = portals.map(end => end.cell);
    return {
      tiles, goals, finish, chainPush, gameplay, unlimitedTraining, isWall, adjacent, portalSides: portals.map(end => end.side),
      portalIndex: indexPortals(portals, isWall, adjacent),
      initial,
      neighbor(cell, direction) {
        const next = adjacent(cell, direction);
        return isWall(next) ? -1 : next;
      },
    };
  }

  function bounds(tiles, finish = null, devices) {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    if (finish !== null) {
      [left, top] = point(finish);
      right = left;
      bottom = top;
    }
    const include = cell => {
      const [x, y] = point(cell);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    };
    for (const [cell, tile] of tiles) if (!devices || !'#@'.includes(tile)) include(cell);
    if (devices) for (const cell of devices.keys()) include(cell);
    return { left, top, right, bottom };
  }

  function trainingMap(tiles, area, chainPush = false, portals = [], finish = null) {
    const { left, top, right, bottom } = area;
    const margin = 3;
    const width = right - left + 1 + margin * 2;
    const height = bottom - top + 1 + margin * 2;
    if (width * height > 40000) return null;
    const rows = Array.from({ length: height }, () => Array(width).fill(' '));
    const toIndex = cell => {
      const [x, y] = point(cell);
      return (y - top + margin) * width + x - left + margin;
    };
    for (const [cell, tile] of tiles) {
      const index = toIndex(cell);
      rows[Math.floor(index / width)][index % width] = tile;
    }
    return {
      ...compile(rows.map(row => row.join('')), chainPush,
        portals.map(end => ({ ...end, cell: toIndex(end.cell) })), finish === null ? null : toIndex(finish)),
      worldCell: cell => key(left - margin + cell % width, top - margin + Math.floor(cell / width)),
    };
  }

  function validate(map) {
    if (map.initial.player === -1 && !map.initial.devices) return '请放置一个玩家起点。';
    if (!map.goals.size && map.finish === null) return '请至少放置一个箱子目标或玩家终点。';
    if (map.initial.boxes.length < map.goals.size) return '箱子不足，无法覆盖所有目标点。';
    return '';
  }

  function placed(map, state) {
    let count = 0;
    for (const box of state.boxes) if (map.goals.has(box)) count++;
    return count;
  }

  function won(map, state, covered) {
    if (map.finish !== null && state.player !== map.finish) return false;
    return (map.goals.size > 0 || map.finish !== null) && (covered ?? placed(map, state)) === map.goals.size;
  }

  function pushLanding(map, first, direction, occupied) {
    let next = map.neighbor(first, direction);
    while (next !== -1 && occupied.has(next)) {
      if (!map.chainPush) return -1;
      next = map.neighbor(next, direction);
    }
    return next;
  }

  function step(map, state, direction) {
    if (state.devices) return typeof direction === 'string' ? activateDevice(map, state, direction).state : state;
    if (state.player === -1 || !directions[direction]) return state;
    if (map.portalSides.length) return portalStep(map, state, direction);
    const player = map.neighbor(state.player, direction);
    if (player === -1) return state;
    const box = state.boxes.indexOf(player);
    if (box < 0) return { ...state, player, moves: state.moves + 1 };
    const landing = pushLanding(map, player, direction, new Set(state.boxes));
    if (landing === -1) return state;
    return moveStraight(map, state, player, box, landing, direction);
  }

  function activateDevice(map, state, cell) {
    const devices = state.devices;
    const selected = devices?.get(cell);
    if (!selected) return { state };
    let base = cell;
    if (map.gameplay === 'powered') {
      if (selected.kind !== 'power') return { state };
      base = map.adjacent(cell, selected.direction);
      if (devices.get(base)?.kind !== 'pusher') {
        return { state, message: '电源的箭头要指向紧邻的拉推头。' };
      }
    }
    const pusher = devices.get(base);
    if (pusher?.kind !== 'pusher') return { state };

    const { direction } = pusher;
    const front = map.adjacent(base, direction);
    const boxes = new Set(state.boxes);
    const occupied = coordinate => boxes.has(coordinate) || devices.has(coordinate);
    const moved = new Map();
    if (occupied(front)) {
      for (let position = front; occupied(position); ) {
        const next = map.adjacent(position, direction);
        if (!map.chainPush && occupied(next)) return { state, message: '前面有多个方块。可开启连推后一起推。' };
        moved.set(position, next);
        position = next;
      }
    } else {
      const beyond = map.adjacent(front, direction);
      if (!occupied(beyond)) return { state, message: '拉推头前方两格内没有方块。' };
      moved.set(beyond, front);
    }
    let movesDevice = false;
    let movesBox = false;
    for (const position of moved.keys()) {
      if (devices.has(position)) movesDevice = true;
      else movesBox = true;
    }
    const nextDevices = movesDevice ? new Map([...devices].map(([position, device]) =>
      [moved.get(position) ?? position, device])) : devices;
    const nextBoxes = movesBox ? state.boxes.map(position => moved.get(position) ?? position) : state.boxes;
    return { state: {
      ...state, boxes: nextBoxes, devices: nextDevices,
      moves: state.moves + 1, pushes: state.pushes + 1, lastClick: cell,
    } };
  }

  function moveStraight(map, state, player, box, landing, direction, single = !map.chainPush) {
    // Every intermediate square still contains a box after the chain moves.
    const boxes = [...state.boxes];
    boxes[box] = landing;
    if (typeof landing === 'number') boxes.sort((a, b) => a - b);
    let portalCells = state.portalCells;
    const { movable } = map.portalIndex;
    if (movable.length) {
      const moveFace = (endpoint, next) => {
        if (portalCells === state.portalCells) portalCells = portalCells.slice();
        portalCells[endpoint] = next;
      };
      const index = movable.length > 4 ? movingFaces(map, portalCells).endpoints : null;
      for (let cell = player; cell !== landing;) {
        const next = single ? landing : map.adjacent(cell, direction);
        if (index) {
          index.get(cell)?.forEach(endpoint => moveFace(endpoint, next));
        } else {
          for (const endpoint of movable) if (state.portalCells[endpoint] === cell) moveFace(endpoint, next);
        }
        cell = next;
      }
    }
    return { ...state, player, boxes, portalCells, moves: state.moves + 1, pushes: state.pushes + 1 };
  }

  function portalOn(map, portalCells, cell, side) {
    if (map.isWall(cell)) return map.portalIndex.fixed.get(cell)?.[side] ?? -1;
    if (!map.portalIndex.movable.length) return -1;
    return movingFaces(map, portalCells).entries.get(cell)?.[side] ?? -1;
  }

  function tracePortalExit(map, portalCells, entrance, { occupied, player, visited, removed } = {}) {
    const pairs = new Set(visited);
    while (entrance >= 0) {
      const pair = entrance >> 1;
      if (pairs.has(pair)) return null;
      pairs.add(pair);
      const exit = entrance ^ 1;
      const direction = map.portalSides[exit];
      const fixed = map.portalIndex.fixedExits[exit];
      const cell = fixed ? fixed.cell : map.adjacent(portalCells[exit], direction);
      if (cell === -1) return null;
      const wall = fixed ? fixed.wall : map.isWall(cell);
      if (wall) {
        entrance = fixed ? fixed.entrance : portalOn(map, portalCells, cell, opposite(direction));
        continue;
      }
      if (cell !== removed && occupied?.has(cell)) {
        const facing = portalOn(map, portalCells, cell, opposite(direction));
        if (facing >= 0) {
          const landing = pushLanding(map, cell, direction, occupied);
          if (landing === -1 || landing === player) {
            entrance = facing;
            continue;
          }
        }
      }
      return { cell, direction, pairs };
    }
    return null;
  }

  function playerPortal(map, state, occupied, player, direction) {
    const host = map.adjacent(player, direction);
    if (!map.isWall(host) && !occupied.has(host)) return -1;
    // portalStep tries every box move before letting the player enter the touched face.
    return portalOn(map, state.portalCells, host, opposite(direction));
  }

  function portalStep(map, state, direction) {
    const first = map.adjacent(state.player, direction);
    if (first === -1) return state;
    const box = state.boxes.indexOf(first);
    const wall = map.isWall(first);
    if (box < 0 && !wall) return { ...state, player: first, moves: state.moves + 1 };

    let occupied;
    if (box >= 0) {
      const ahead = map.neighbor(first, direction);
      if (ahead !== -1 && !state.boxes.includes(ahead)) {
        return moveStraight(map, state, first, box, ahead, direction, true);
      }
      occupied = new Set(state.boxes);
      if (map.chainPush && ahead !== -1) {
        const landing = pushLanding(map, first, direction, occupied);
        if (landing !== -1) return moveStraight(map, state, first, box, landing, direction);
      }
      const pushed = pushThroughPortal(map, state, occupied, first, direction);
      if (pushed !== state) return pushed;
    }
    let entrance = portalOn(map, state.portalCells, first, opposite(direction));
    if (entrance < 0) return state;
    occupied ??= new Set(state.boxes);
    let visited;
    while (entrance >= 0) {
      const exit = tracePortalExit(map, state.portalCells, entrance, { visited });
      if (!exit || exit.cell === state.player) return state;
      if (!occupied.has(exit.cell)) return { ...state, player: exit.cell, moves: state.moves + 1 };

      // A blocked straight push can still send a box through another portal.
      const pushed = pushThroughPortal(map, state, occupied, exit.cell, exit.direction, exit.pairs);
      if (pushed !== state) return pushed;
      entrance = portalOn(map, state.portalCells, exit.cell, opposite(exit.direction));
      visited = exit.pairs;
    }
    return state;
  }

  function pushPlans(map, state, occupied, first, direction) {
    const moved = new Map();
    const rear = [];
    const front = [];
    const wall = [];
    for (let box = first; ;) {
      const ahead = map.adjacent(box, direction);
      if (ahead === -1) return [];
      if (map.isWall(ahead)) {
        const entrance = portalOn(map, state.portalCells, ahead, opposite(direction));
        if (entrance >= 0) wall.push({ entrance, cargo: box, moved });
        break;
      }
      if (!occupied.has(ahead)) {
        if (!map.chainPush && moved.size > 1) break;
        moved.set(box, ahead);
        return [{ moved }];
      }
      const beyond = map.adjacent(ahead, direction);
      const forward = portalOn(map, state.portalCells, box, direction);
      const facing = portalOn(map, state.portalCells, ahead, opposite(direction));
      if (facing >= 0) rear.push({ entrance: facing, cargo: box, moved: map.chainPush ? new Map(moved) : new Map() });
      if (forward >= 0) {
        // In a chain push, the boxes behind transmitted cargo fill the gap.
        const advance = map.chainPush ? new Map(moved).set(box, ahead) : new Map();
        front.push({ entrance: forward, cargo: ahead, moved: advance });
        if (!map.chainPush) break;
      }
      if (!map.chainPush && facing < 0 && !map.isWall(beyond)) break;
      if (!map.chainPush && map.isWall(beyond)) {
        const wallEntrance = portalOn(map, state.portalCells, beyond, opposite(direction));
        if (wallEntrance < 0) break;
      }
      moved.set(box, ahead);
      box = ahead;
    }
    // Chain pushes reach this fallback only when the leading box hits a wall.
    // Resolve the leading box before a trailing box enters an earlier face.
    return [...(map.chainPush ? rear.reverse() : rear), ...front, ...wall];
  }

  function pushThroughPortal(map, state, occupied, first, direction, entryRoute = null) {
    const entryCell = first;
    const pending = [];
    const tryFrom = (cell, heading, visited) => {
      const plans = pushPlans(map, state, occupied, cell, heading);
      for (let i = plans.length - 1; i >= 0; i--) pending.push({ plan: plans[i], visited });
    };
    tryFrom(first, direction, new Set(entryRoute));
    while (pending.length) {
      const { plan, visited } = pending.pop();
      const { moved, entrance, cargo } = plan;
      const boxes = [];
      for (const box of state.boxes) if (box !== cargo) boxes.push(moved.get(box) ?? box);
      let portalCells = state.portalCells;
      let indexedCells = portalCells;
      const moveEndpoint = (endpoint, cell) => {
        if (portalCells === indexedCells) portalCells = portalCells.slice();
        portalCells[endpoint] = cell;
      };
      if (moved.size) {
        for (const endpoint of map.portalIndex.movable) {
          const cell = moved.get(state.portalCells[endpoint]);
          if (cell !== undefined) moveEndpoint(endpoint, cell);
        }
      }
      if (cargo !== undefined) {
        if (state.portalCells[entrance ^ 1] === cargo) continue;
        const projected = moved.size ? new Set(boxes) : occupied;
        const exit = tracePortalExit(map, portalCells, entrance, {
          occupied: projected, player: state.player, visited, removed: moved.size ? undefined : cargo,
        });
        if (!exit || exit.cell === cargo || exit.cell === state.player) continue;
        const landing = exit.cell;
        if (projected.has(landing)) {
          // Reserve the local moves while the outgoing cargo pushes at the exit.
          // Commit both sides only after the exit has room for the cargo.
          const projectedState = { ...state, boxes, portalCells };
          const relayed = pushThroughPortal(map, projectedState, new Set(boxes), landing, exit.direction, exit.pairs);
          if (relayed === projectedState || relayed.boxes.includes(landing)) continue;
          boxes.splice(0, boxes.length, ...relayed.boxes);
          portalCells = relayed.portalCells;
        }
        boxes.push(landing);
        // The projected locations may already be indexed by the exit search.
        indexedCells = portalCells;
        for (const endpoint of map.portalIndex.movable) {
          if (state.portalCells[endpoint] === cargo) moveEndpoint(endpoint, landing);
        }
      }
      if (boxes.includes(state.player)) continue;
      // If the player entered a portal, follow the push into the vacated exit cell.
      const canFollow = entryRoute !== null || !visited.size;
      const player = canFollow && !boxes.includes(entryCell) ? entryCell : state.player;
      if (typeof first === 'number') boxes.sort((a, b) => a - b);
      return { player, boxes, portalCells, moves: state.moves + 1, pushes: state.pushes + 1 };
    }
    return state;
  }

  function reach(map, state) {
    const previous = new Int32Array(map.tiles.length).fill(-1);
    const via = new Uint8Array(map.tiles.length);
    const boxes = new Set(state.boxes);
    const queue = [state.player];
    let first = state.player;
    previous[state.player] = state.player;
    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i];
      first = Math.min(first, cell);
      map.next[cell].forEach((neighbor, direction) => {
        if (map.portalSides.length && (neighbor === -1 || boxes.has(neighbor))) {
          if (playerPortal(map, state, boxes, cell, direction) < 0) return;
          const next = portalStep(map, { ...state, player: cell }, direction);
          if (next.pushes !== state.pushes) return;
          neighbor = next.player;
        }
        if (neighbor < 0 || previous[neighbor] >= 0 || boxes.has(neighbor)) return;
        previous[neighbor] = cell;
        via[neighbor] = direction;
        queue.push(neighbor);
      });
    }
    return { first, previous, via, boxes };
  }

  function distancesToGoals(map) {
    const distances = new Int32Array(map.tiles.length).fill(-1);
    const queue = [...map.goals];
    queue.forEach(goal => { distances[goal] = 0; });
    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i];
      map.next[cell].forEach((from, reverse) => {
        if (from < 0 || map.next[from][reverse] < 0 || distances[from] >= 0) return;
        distances[from] = distances[cell] + 1;
        queue.push(from);
      });
    }
    return distances;
  }

  function deviceStateKey(state) {
    const layout = [...state.devices].map(([cell, { kind, direction }]) => cell + ':' + kind + ':' + direction);
    return state.boxes.slice().sort().join(';') + '|' + layout.sort().join(';');
  }

  function deviceChoices(map, state, visited) {
    const key = deviceStateKey(state);
    visited?.add(key);
    const clickKind = map.gameplay === 'powered' ? 'power' : 'pusher';
    const actions = [];
    for (const [cell, { kind }] of state.devices) {
      if (kind !== clickKind) continue;
      const next = activateDevice(map, state, cell).state;
      if (next !== state && (!visited || !visited.has(deviceStateKey(next)))) actions.push({ id: cell, next });
    }
    return { key, actions, finishReachable: false };
  }

  function choices(map, state, distances, visited) {
    if (state.devices) return deviceChoices(map, state, visited);
    const area = reach(map, state);
    const actions = [];
    const hasPortals = map.portalSides.length > 0;
    const finishReachable = map.finish !== null && area.previous[map.finish] >= 0 &&
      placed(map, state) === map.goals.size;
    // Extra boxes can occupy squares from which no goal is reachable.
    const spare = state.boxes.length - map.goals.size;
    const stranded = state.boxes.filter(box => distances[box] < 0).length;
    const addPortalPush = (from, direction) => {
      if (from < 0 || area.previous[from] < 0) return;
      const next = portalStep(map, { ...state, player: from }, direction);
      if (next.pushes === state.pushes) return;
      const after = new Set(next.boxes);
      const box = state.boxes.find(cell => !after.has(cell));
      const to = next.boxes.find(cell => !area.boxes.has(cell));
      actions.push({ box, to, from, direction, id: from * 4 + direction });
    };
    state.boxes.forEach(box => {
      map.next[box].forEach((_, direction) => {
        const from = map.next[box][(direction + 2) % 4];
        if (hasPortals) {
          addPortalPush(from, direction);
          return;
        }
        if (from < 0 || area.previous[from] < 0) return;
        const to = pushLanding(map, box, direction, area.boxes);
        if (to < 0) return;
        const nextStranded = stranded - Number(distances[box] < 0) + Number(distances[to] < 0);
        if (nextStranded <= spare) actions.push({ box, to, from, direction, id: box * 4 + direction });
      });
    });
    state.portalCells.forEach((cell, index) => {
      if (map.portalIndex.exitOnly[index] || !map.isWall(cell)) return;
      const side = map.portalSides[index];
      addPortalPush(map.neighbor(cell, side), opposite(side));
    });
    const key = hasPortals ?
      [state.player, state.boxes.join(','), state.portalCells.join(',')].join(':') :
      area.first + ':' + state.boxes.join(',');
    return { area, actions, key, finishReachable };
  }

  function walkingPath(area, from, to) {
    const path = [];
    for (let cell = to; cell !== from; cell = area.previous[cell]) path.push(area.via[cell]);
    return path.reverse();
  }

  class Trainer {
    constructor(map, random = Math.random) {
      this.map = map;
      this.random = random;
      this.distances = map.initial.devices ? null : distancesToGoals(map);
      this.q = new Map();
      this.episodes = 0;
      this.successes = 0;
      this.recent = [];
      this.history = [];
      this.best = won(map, map.initial) ? { path: [], pushes: 0 } : null;
      this.partial = { covered: -1, moves: Infinity, routes: new Map() };
      this.last = map.initial;
      this.state = map.initial;
      this.demonstration = null;
      this.guidedStart = 0;
      this.guided = false;
    }

    get maxPushes() {
      const { devices, boxes } = this.map.initial;
      if (devices && this.map.unlimitedTraining) return Infinity;
      return Math.min(160, Math.max(35, boxes.length * 28, (devices?.size ?? 0) * 4));
    }

    setDemonstration(directions) {
      const map = this.map;
      let state = map.initial;
      let decision = state;
      const trace = [];
      const milestones = [];
      const demonstrated = new Map();
      for (const direction of directions) {
        const next = step(map, state, direction);
        if (next === state || won(map, state)) return false;
        if (next.pushes > state.pushes) {
          milestones.push({ state: next, length: next.moves });
          const { key, actions } = choices(map, decision, this.distances);
          const action = actions.find(candidate => state.devices ? candidate.id === direction :
            candidate.from === state.player && candidate.direction === direction);
          if (action) {
            trace.push([key, action, this.reward(decision, next, action, false)]);
            demonstrated.set(key, { action, actions });
          }
          decision = next;
        }
        state = next;
      }
      const complete = won(map, state);
      if (complete) {
        // Use the last successful continuation for each state in a looping demonstration.
        for (const [key, { action, actions }] of demonstrated) {
          const bestValue = actions.reduce((best, candidate) => Math.max(best, this.value(key, candidate)), 0);
          this.learn(key, action, bestValue + 1);
        }
      }
      this.demonstration = directions.length ? { directions: directions.slice(), state, trace, milestones, complete } : null;
      this.guidedStart = this.episodes;
      this.guided = false;
      this.state = map.initial;
      return true;
    }

    get epsilon() {
      if (this.demonstration) {
        const sinceDemo = this.episodes - this.guidedStart;
        return Math.max(0.12, 0.75 * Math.exp(-sinceDemo / 280));
      }
      return Math.max(0.12, 0.96 * Math.exp(-this.episodes / 280));
    }

    get rate() {
      return this.recent.length ? this.recent.reduce((sum, value) => sum + value, 0) / this.recent.length : 0;
    }

    estimate(action) {
      if (!this.distances) return 0;
      const from = this.distances[action.box];
      const to = this.distances[action.to];
      return from === undefined || to === undefined || from < 0 || to < 0 ? 0 : 0.24 * (from - to);
    }

    value(key, action) {
      return this.q.get(key)?.get(action.id) ?? this.estimate(action);
    }

    learn(key, action, value) {
      let values = this.q.get(key);
      if (!values && this.q.size < 100000) {
        values = new Map();
        this.q.set(key, values);
      }
      values?.set(action.id, value);
    }

    reward(state, next, action, stuck, solved = won(this.map, next)) {
      if (solved) return 18;
      if (stuck) return -5;
      return -0.13 + 0.8 * (placed(this.map, next) - placed(this.map, state)) + this.estimate(action);
    }

    episode() {
      for (const _ of this.attempt()) { /* Complete the episode synchronously. */ }
    }

    keepPartial(state, path, length = path.length) {
      if (this.best || won(this.map, state)) return;
      const covered = placed(this.map, state);
      const previous = this.partial;
      if (covered < previous.covered || (covered === previous.covered && length > previous.moves)) return;
      if (covered > previous.covered || length < previous.moves) {
        this.partial = { covered, moves: length, routes: new Map() };
      }
      const prefix = path.slice(0, length);
      this.partial.routes.set(prefix.join(';'), { path: prefix, pushes: state.pushes });
    }

    *attempt() {
      const map = this.map;
      let state = this.state = map.initial;
      let path = [];
      let trace = [];
      this.keepPartial(state, path);
      const opening = this.demonstration;
      const sinceDemo = this.episodes - this.guidedStart;
      const demonstratedPushes = opening?.complete ? opening.state.pushes : 0;
      const maxPushes = this.maxPushes;
      const canUseOpening = opening && (!state.devices || opening.state.pushes <= maxPushes);
      this.guided = Boolean(canUseOpening && (opening.complete ? sinceDemo === 0 : sinceDemo % 2 === 0));
      // A successful demonstration gives independent episodes a policy to exploit.
      const epsilon = opening?.complete ?
        (sinceDemo % 4 === 0 ? 1 / Math.max(demonstratedPushes, 4) : 0) : this.epsilon;
      if (this.guided) {
        path = opening.directions.slice();
        trace = opening.trace.slice();
        for (const point of opening.milestones) this.keepPartial(point.state, path, point.length);
        state = this.state = opening.state;
        yield { from: map.initial, directions: opening.directions, demonstration: true };
      }
      const pushLimit = state.devices ? maxPushes : state.pushes + Math.max(maxPushes, demonstratedPushes);
      const visited = state.devices ? new Set() : undefined;
      let current = choices(map, state, this.distances, visited);
      while (current.actions.length && state.pushes < pushLimit && !current.finishReachable && !won(map, state)) {
        const actions = current.actions;
        let action = actions[Math.floor(this.random() * actions.length)];
        if (this.random() >= epsilon) {
          for (const candidate of actions) {
            if (this.value(current.key, candidate) > this.value(current.key, action)) action = candidate;
          }
        }
        const beforePush = state;
        let inputs, nextState;
        if (action.next) {
          inputs = [action.id];
          nextState = action.next;
        } else {
          inputs = walkingPath(current.area, state.player, action.from);
          nextState = step(map, { ...state, player: action.from, moves: state.moves + inputs.length }, action.direction);
          inputs.push(action.direction);
        }
        path.push(...inputs);
        const next = choices(map, nextState, this.distances, visited);
        const solved = next.finishReachable || won(map, nextState);
        const stuck = next.actions.length === 0;
        const timedOut = nextState.pushes >= pushLimit;
        const reward = this.reward(state, nextState, action, stuck, solved);
        const future = solved || stuck || timedOut ? 0 : Math.max(...next.actions.map(choice => this.value(next.key, choice)));
        const before = this.value(current.key, action);
        const learned = before + 0.35 * (reward + 0.94 * future - before);
        this.learn(current.key, action, learned);
        trace.push([current.key, action, reward]);
        state = this.state = nextState;
        this.keepPartial(state, path);
        current = next;
        yield { from: beforePush, directions: inputs };
      }

      if (current.finishReachable && state.player !== map.finish) {
        const walking = walkingPath(current.area, state.player, map.finish);
        path.push(...walking);
        const beforeWalk = state;
        state = this.state = { ...state, player: map.finish, moves: state.moves + walking.length };
        yield { from: beforeWalk, directions: walking };
      }
      const success = won(map, state);
      if (success) {
        this.successes++;
        // Replay the successful experience backwards to propagate its reward sooner.
        let value = 0;
        for (let i = trace.length - 1; i >= 0; i--) {
          const [key, action, reward] = trace[i];
          value = reward + 0.94 * value;
          const before = this.value(key, action);
          if (value > before) this.learn(key, action, before + 0.45 * (value - before));
        }
        if (!this.best || state.pushes < this.best.pushes ||
            (state.pushes === this.best.pushes && path.length < this.best.path.length)) {
          this.best = { path, pushes: state.pushes };
          this.partial.routes.clear();
        }
      }
      this.last = state;
      this.episodes++;
      if (!this.guided) {
        this.recent.push(Number(success));
        if (this.recent.length > 100) this.recent.shift();
      }
      if (this.recent.length && (!this.history.length || this.episodes % 10 === 0)) {
        this.history.push({ episode: this.episodes, rate: this.rate });
        if (this.history.length > 240) this.history.shift();
      }
    }
  }

  const api = { examples, readMap, fromRows, readLevel, readWorld, writeWorld, world, bounds, key, point, portalHost, trainingMap, compile, validate, placed, won, step, activateDevice, Trainer };
  if (typeof module === 'object') module.exports = api;
  else root.Sokoban = api;
})(globalThis);
