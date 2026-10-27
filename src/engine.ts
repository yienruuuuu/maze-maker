export type Tile = 'floor' | 'wall' | 'block' | 'up' | 'right' | 'down' | 'left' | 'stop';
export type Direction = 'up' | 'right' | 'down' | 'left';
export type Point = { x: number; y: number };
export type Exit = Point & { id: string };
export type Marker = Point & { label: string; kind: 'item' | 'stairs' | 'lift' | 'npc' };
export type ReviewCell = Point & { reason: string };
export type Maze = { version: 1; name: string; width: number; height: number; tiles: Tile[]; entrance: Point; exits: Exit[]; appearance?: 'rocket'; markers?: Marker[]; review?: ReviewCell[] };
export const directions: Direction[] = ['up', 'right', 'down', 'left'];
export const vectors = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] } as const;
export const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export const key = (p: Point) => `${p.x},${p.y}`;
export const inside = (m: Maze, p: Point) => p.x >= 0 && p.y >= 0 && p.x < m.width && p.y < m.height;
export const tileAt = (m: Maze, p: Point): Tile => inside(m, p) ? m.tiles[p.y * m.width + p.x] : 'wall';
export const solid = (tile: Tile) => tile === 'wall' || tile === 'block';
export type Move = { end: Point; trace: Point[]; sliding: boolean[]; loop: boolean };
// A command starts with one voluntary step; forced motion runs to rest or a repeated (position, direction).
export function move(m: Maze, start: Point, direction: Direction): Move {
  let p = start, d = direction, forced = false;
  const trace: Point[] = [], sliding: boolean[] = [], seen = new Set<string>();
  while (true) {
    const [dx, dy] = vectors[d], next = { x: p.x + dx, y: p.y + dy };
    if (solid(tileAt(m, next))) return { end: p, trace, sliding, loop: false };
    p = next; trace.push(p); sliding.push(forced);
    const tile = tileAt(m, p);
    if (directions.includes(tile as Direction)) { d = tile as Direction; forced = true; }
    else if (tile === 'stop' || !forced) return { end: p, trace, sliding, loop: false };
    const state = `${key(p)}:${d}`;
    if (seen.has(state)) return { end: p, trace, sliding, loop: true };
    seen.add(state);
  }
}
export type Route = { exit: Exit; reachable: boolean; commands: Direction[]; trace: Point[]; sliding: boolean[] };
export function analyze(m: Maze): { routes: Route[]; reachable: Point[]; loopTransitions: number } {
  const queue: Point[] = [m.entrance];
  const previous = new Map<string, { from: Point; direction: Direction; move: Move }>();
  const visited = new Set([key(m.entrance)]);
  let loopTransitions = 0;
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head];
    for (const direction of directions) {
      const result = move(m, p, direction);
      if (result.loop) { loopTransitions++; continue; }
      if (!visited.has(key(result.end))) {
        visited.add(key(result.end)); queue.push(result.end);
        previous.set(key(result.end), { from: p, direction, move: result });
      }
    }
  }
  const routes = m.exits.map(exit => {
    const segments: { direction: Direction; move: Move }[] = [];
    let p: Point = exit;
    while (previous.has(key(p))) { const step = previous.get(key(p))!; segments.push(step); p = step.from; }
    segments.reverse();
    return { exit, reachable: visited.has(key(exit)), commands: segments.map(s => s.direction), trace: [m.entrance, ...segments.flatMap(s => s.move.trace)], sliding: [false, ...segments.flatMap(s => s.move.sliding)] };
  });
  return { routes, reachable: queue, loopTransitions };
}
export function blank(width = 28, height = 20): Maze {
  return { version: 1, name: '未命名迷宮', width, height, tiles: Array.from({ length: width * height }, (_, i) => i % width === 0 || i % width === width - 1 || i < width || i >= width * (height - 1) ? 'wall' : 'floor'), entrance: { x: 2, y: 2 }, exits: [{ id: 'OUT-01', x: width - 3, y: height - 3 }] };
}
export function demo(): Maze {
  const m = blank(); m.name = '轉向實驗 / Turning Point';
  const put = (x: number, y: number, tile: Tile) => { m.tiles[y * m.width + x] = tile; };
  for (let y = 1; y < 19; y++) { if (![4, 14].includes(y)) put(9, y, 'wall'); if (![7, 16].includes(y)) put(19, y, 'wall'); }
  for (let x = 2; x < 18; x++) if (![5, 13].includes(x)) put(x, 10, 'wall');
  for (let x = 11; x < 27; x++) if (![16, 23].includes(x)) put(x, 13, 'wall');
  [[4,4,'right'],[12,4,'down'],[12,8,'left'],[10,8,'stop'],[5,8,'down'],[5,14,'right'],[16,14,'up'],[16,7,'right'],[24,7,'down'],[24,16,'left'],[21,16,'stop'],[14,16,'right'],[7,16,'up'],[7,12,'stop']].forEach(([x,y,t]) => put(x as number,y as number,t as Tile));
  m.exits = [{ id: 'OUT-01', x: 25, y: 17 }, { id: 'OUT-02', x: 14, y: 8 }, { id: 'OUT-03', x: 3, y: 17 }];
  return m;
}
export function parseMaze(value: unknown): Maze {
  const m = value as Maze;
  if (!m || m.version !== 1 || typeof m.name !== 'string' || !Number.isInteger(m.width) || !Number.isInteger(m.height) || m.width < 5 || m.height < 5 || m.width > 100 || m.height > 100) throw Error('地圖格式不正確；寬高須為 5–100。');
  const types = ['floor','wall','block','up','right','down','left','stop'];
  if (!Array.isArray(m.tiles) || m.tiles.length !== m.width * m.height || !m.tiles.every(t => types.includes(t))) throw Error('地板資料不正確。');
  const valid = (p: Point) => p && Number.isInteger(p.x) && Number.isInteger(p.y) && inside(m,p) && !solid(tileAt(m,p));
  if (!valid(m.entrance) || !Array.isArray(m.exits) || !m.exits.every(e => valid(e) && typeof e.id === 'string') || new Set(m.exits.map(e => e.id)).size !== m.exits.length) throw Error('入口／出口資料不正確。');
  if (m.appearance !== undefined && m.appearance !== 'rocket') throw Error('未知的地圖外觀。');
  if (m.markers !== undefined && (!Array.isArray(m.markers) || !m.markers.every(p => p && inside(m,p) && Number.isInteger(p.x) && Number.isInteger(p.y) && typeof p.label === 'string' && ['item','stairs','lift','npc'].includes(p.kind)))) throw Error('參考標記格式不正確。');
  if (m.review !== undefined && (!Array.isArray(m.review) || !m.review.every(p => p && inside(m,p) && Number.isInteger(p.x) && Number.isInteger(p.y) && typeof p.reason === 'string'))) throw Error('待核對座標格式不正確。');
  return structuredClone(m);
}
