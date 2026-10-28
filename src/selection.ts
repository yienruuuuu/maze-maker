import { inside, solid, type Marker, type Maze, type Point, type ReviewCell, type Tile } from './engine';

export type Selection = Point & { width: number; height: number };
export type MazeClipboard = { width: number; height: number; tiles: Tile[]; markers: Marker[]; review: ReviewCell[] };

export function rectangle(maze: Maze, start: Point, end: Point): Selection {
  const clampX = (x: number) => Math.max(0, Math.min(maze.width - 1, x));
  const clampY = (y: number) => Math.max(0, Math.min(maze.height - 1, y));
  const x = Math.min(clampX(start.x), clampX(end.x)), y = Math.min(clampY(start.y), clampY(end.y));
  return { x, y, width: Math.abs(clampX(end.x) - clampX(start.x)) + 1, height: Math.abs(clampY(end.y) - clampY(start.y)) + 1 };
}

export const contains = (rect: Selection, p: Point) => p.x >= rect.x && p.y >= rect.y && p.x < rect.x + rect.width && p.y < rect.y + rect.height;

export function copySelection(maze: Maze, rect: Selection): MazeClipboard {
  const tiles: Tile[] = [];
  for (let y = 0; y < rect.height; y++) for (let x = 0; x < rect.width; x++) tiles.push(maze.tiles[(rect.y + y) * maze.width + rect.x + x]);
  return {
    width: rect.width, height: rect.height, tiles,
    markers: (maze.markers ?? []).filter(m => contains(rect, m)).map(m => ({ ...m, x: m.x - rect.x, y: m.y - rect.y })),
    review: (maze.review ?? []).filter(m => contains(rect, m)).map(m => ({ ...m, x: m.x - rect.x, y: m.y - rect.y })),
  };
}

// Delete clears exits; cutting deliberately leaves In/Out at their original coordinates.
export function clearSelection(maze: Maze, rect: Selection, preserveExits = false): Maze {
  const next = structuredClone(maze);
  for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) if (inside(next, { x, y })) next.tiles[y * next.width + x] = 'floor';
  next.exits = next.exits.filter(e => preserveExits || !contains(rect, e));
  if (next.markers) next.markers = next.markers.filter(m => !contains(rect, m));
  if (next.review) next.review = next.review.filter(m => !contains(rect, m));
  return next;
}

export function pasteError(maze: Maze, clip: MazeClipboard, at: Point): string | undefined {
  const rect = { ...at, width: clip.width, height: clip.height };
  if (!inside(maze, at) || at.x + clip.width > maze.width || at.y + clip.height > maze.height) return '超出地圖邊界，請換個位置。';
  for (const endpoint of [maze.entrance, ...maze.exits]) {
    if (contains(rect, endpoint) && solid(clip.tiles[(endpoint.y - at.y) * clip.width + endpoint.x - at.x])) return '貼上會用障礙蓋住 IN／OUT，請換個位置。';
  }
}

export function pasteSelection(maze: Maze, clip: MazeClipboard, at: Point, cut?: Selection): Maze {
  const error = pasteError(maze, clip, at);
  if (error) throw new Error(error);
  const next = cut ? clearSelection(maze, cut, true) : structuredClone(maze);
  const rect = { ...at, width: clip.width, height: clip.height };
  for (let y = 0; y < clip.height; y++) for (let x = 0; x < clip.width; x++) next.tiles[(at.y + y) * next.width + at.x + x] = clip.tiles[y * clip.width + x];
  // Copies receive a fresh group when that name already exists outside the destination.
  // Cuts preserve the group so moving one endpoint keeps its original partner.
  const remaining = (next.markers ?? []).filter(m => !contains(rect, m));
  const groups = new Set(remaining.filter(m => m.kind === 'portal').map(m => m.label));
  const renamed = new Map<string, string>();
  if (!cut) for (const m of clip.markers.filter(m => m.kind === 'portal')) {
    if (renamed.has(m.label)) continue;
    let label = m.label, n = 2;
    while (groups.has(label)) label = `${m.label}-${n++}`;
    renamed.set(m.label, label); groups.add(label);
  }
  if (next.markers || clip.markers.length) next.markers = [
    ...(next.markers ?? []).filter(m => !contains(rect, m)),
    ...clip.markers.map(m => ({ ...m, label: m.kind === 'portal' ? renamed.get(m.label) ?? m.label : m.label, x: m.x + at.x, y: m.y + at.y })),
  ];
  if (next.review || clip.review.length) next.review = [
    ...(next.review ?? []).filter(m => !contains(rect, m)),
    ...clip.review.map(m => ({ ...m, x: m.x + at.x, y: m.y + at.y })),
  ];
  return next;
}
