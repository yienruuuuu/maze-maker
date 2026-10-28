import { key, type Maze, type Point } from './engine';

export type ItemIndex = { total: number; at: Map<string, number[]> };

// Marker-array indices identify individual items without changing saved maze JSON.
export function indexItems(maze: Maze): ItemIndex {
  const at = new Map<string, number[]>(); let total = 0;
  (maze.markers ?? []).forEach((marker, index) => {
    if (marker.kind !== 'item') return;
    const position = key(marker);
    at.set(position, [...at.get(position) ?? [], index]); total++;
  });
  return { total, at };
}

export function collectAt(items: ItemIndex, position: Point, collected: Set<number>): Set<number> {
  const found = items.at.get(key(position)) ?? [];
  if (found.every(id => collected.has(id))) return collected;
  const next = new Set(collected);
  found.forEach(id => next.add(id));
  return next;
}

export function startCollection(maze: Maze): Set<number> {
  return collectAt(indexItems(maze), maze.entrance, new Set());
}
