(function (root) {
  'use strict';

  const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const key = (x, y) => x + ',' + y;

  function convert(map, state) {
    if (map.transfer) throw Error('转移关卡需要保留出入口位置，不能转成传送门地图。');
    if (map.portalConversion === false) throw Error('开放关卡的跨边界联动暂不支持转成传送门地图。');
    const tiles = new Map();
    const portals = [];
    const offsets = [];
    let left = 0;
    for (const room of map.rooms) {
      offsets.push(left);
      for (let y = -1; y <= room.height; y++) {
        for (let x = -1; x <= room.width; x++) {
          if (x === -1 || x === room.width || y === -1 || y === room.height || room.tiles[y * room.width + x] === '#') {
            tiles.set(key(left + x, y), '#');
          }
        }
      }
      left += room.width + 4;
    }

    const location = ([room, x, y]) => [offsets[room] + x, y];
    for (const goal of map.goals) tiles.set(key(...location(goal)), '.');
    for (const [id, position] of state.positions.entries()) {
      const cell = key(...location(position));
      const goal = tiles.get(cell) === '.';
      tiles.set(cell, id === 0 ? (goal ? '+' : '@') : (goal ? '*' : '$'));
    }
    for (const [roomId, room] of map.rooms.entries()) {
      if (room.owner < 0) continue;
      const owner = location(state.positions[room.owner]);
      for (const [side, [dx, dy]] of directions.entries()) {
        const size = dx ? room.height : room.width;
        const face = [...owner, side];
        for (let lane = 0; lane < size; lane++) {
          const x = dx ? (dx < 0 ? 0 : room.width - 1) : lane;
          const y = dy ? (dy < 0 ? 0 : room.height - 1) : lane;
          if (room.tiles[y * room.width + x] === '#') continue;
          const edge = [offsets[roomId] + x + dx, y + dy, side ^ 2];
          // Entry from the surrounding room starts at the middle of the face.
          if (lane === Math.floor(size / 2) && !map.rooms[state.positions[room.owner][0]].void) portals.push([face, edge]);
          else portals.push([edge, face, 'one-way']);
        }
      }
    }
    // Clone faces are entrances only. Every exit still belongs to the original shell.
    for (let entity = 1; entity < state.positions.length; entity++) {
      if (!map.clones?.[entity]) continue;
      if (map.rooms[state.positions[entity][0]].void) continue;
      const roomId = map.inside[entity];
      const room = map.rooms[roomId];
      const owner = location(state.positions[entity]);
      for (const [side, [dx, dy]] of directions.entries()) {
        const lane = Math.floor((dx ? room.height : room.width) / 2);
        const x = dx ? (dx < 0 ? 0 : room.width - 1) : lane;
        const y = dy ? (dy < 0 ? 0 : room.height - 1) : lane;
        if (room.tiles[y * room.width + x] === '#') continue;
        portals.push([[...owner, side], [offsets[roomId] + x + dx, y + dy, side ^ 2], 'one-way']);
      }
    }
    return {
      version: 1,
      chainPush: true,
      tiles: Array.from(tiles, ([cell, tile]) => [...cell.split(',').map(Number), tile]),
      portals,
      finish: location(map.finish),
    };
  }

  if (typeof module === 'object') module.exports = { convert };
  else root.BoxPortals = { convert };
})(globalThis);
