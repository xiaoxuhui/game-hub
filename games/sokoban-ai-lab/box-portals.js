(function (root) {
  'use strict';

  const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const key = (x, y) => x + ',' + y;

  function convert(map, state) {
    if (map.transfer) throw Error('转移关卡需要保留出入口位置，不能转成传送门地图。');
    if (map.portalConversion === false) throw Error(map.conversionReason ?? '当前关卡的规则暂不支持转成传送门地图。');
    const tiles = new Map();
    const portals = [];
    const portalGeometry = [];
    const offsets = [];
    const flipped = state.flipped ?? map.flipped;
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
      tiles.set(cell, map.players.includes(id) ? (goal ? '+' : '@') : (goal ? '*' : '$'));
    }
    for (const [roomId, room] of map.rooms.entries()) {
      if (room.owner < 0) continue;
      const owner = location(state.positions[room.owner]);
      for (const [side, [dx, dy]] of directions.entries()) {
        const size = dx ? room.height : room.width;
        const face = [...owner, flipped?.[room.owner] && dx ? side ^ 2 : side];
        const exits = Array.from({ length: size }, (_, lane) => {
          const x = dx ? (dx < 0 ? 0 : room.width - 1) : lane;
          const y = dy ? (dy < 0 ? 0 : room.height - 1) : lane;
          return room.tiles[y * room.width + x] === '#' ? null : [offsets[roomId] + x + dx, y + dy, side ^ 2];
        });
        if (!exits.some(Boolean)) continue;
        for (let lane = 0; lane < size; lane++) {
          const x = dx ? (dx < 0 ? 0 : room.width - 1) : lane;
          const y = dy ? (dy < 0 ? 0 : room.height - 1) : lane;
          if (room.tiles[y * room.width + x] === '#' && lane !== Math.floor(size / 2)) continue;
          const edge = [offsets[roomId] + x + dx, y + dy, side ^ 2];
          // Entry from the surrounding room starts at the middle of the face.
          const faceGeometry = { kind: 'face', size, flipped: Boolean(flipped?.[room.owner]), exits };
          const edgeGeometry = { kind: 'edge', size, lane };
          if (lane === Math.floor(size / 2) && !map.rooms[state.positions[room.owner][0]].void) {
            portals.push([face, edge]);
            portalGeometry.push(faceGeometry, edgeGeometry);
          } else {
            portals.push([edge, face, 'one-way']);
            portalGeometry.push(edgeGeometry, faceGeometry);
          }
        }
      }
    }
    // Clone faces are entrances only. Every exit still belongs to the original shell.
    for (let entity = 0; entity < state.positions.length; entity++) {
      if (!map.clones?.[entity]) continue;
      if (map.rooms[state.positions[entity][0]].void) continue;
      const roomId = map.inside[entity];
      const room = map.rooms[roomId];
      const owner = location(state.positions[entity]);
      for (const [side, [dx, dy]] of directions.entries()) {
        const lane = Math.floor((dx ? room.height : room.width) / 2);
        const x = dx ? (dx < 0 ? 0 : room.width - 1) : lane;
        const y = dy ? (dy < 0 ? 0 : room.height - 1) : lane;
        const size = dx ? room.height : room.width;
        const exits = Array.from({ length: size }, (_, lane) => {
          const x = dx ? (dx < 0 ? 0 : room.width - 1) : lane;
          const y = dy ? (dy < 0 ? 0 : room.height - 1) : lane;
          return room.tiles[y * room.width + x] === '#' ? null : [offsets[roomId] + x + dx, y + dy, side ^ 2];
        });
        if (!exits.some(Boolean)) continue;
        portals.push([[...owner, flipped?.[entity] && dx ? side ^ 2 : side], [offsets[roomId] + x + dx, y + dy, side ^ 2], 'one-way']);
        portalGeometry.push({ kind: 'face', size, flipped: Boolean(flipped?.[entity]), exits }, { kind: 'edge', size, lane });
      }
    }
    return {
      version: 1,
      chainPush: true,
      tiles: Array.from(tiles, ([cell, tile]) => [...cell.split(',').map(Number), tile]),
      portals,
      portalGeometry,
      finish: location(map.finish),
      ...(map.players.length > 1 || map.players.some(id => map.inside[id] >= 0) ? {
        players: map.players.map(id => location(state.positions[id])),
        finishes: map.finishes.map(location),
        playerMode: (state.playerMode ?? map.playerMode) === 'single' && map.players.length > 1 ? 'select' : state.playerMode ?? map.playerMode,
      } : {}),
    };
  }

  if (typeof module === 'object') module.exports = { convert };
  else root.BoxPortals = { convert };
})(globalThis);
