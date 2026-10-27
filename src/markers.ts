import { inside, same, solid, type Marker, type Maze, type Point } from './engine';

export type MarkerTool = 'item' | 'stairs' | 'npc';
export const markerNames: Record<MarkerTool, string> = { item: '道具', stairs: '樓梯', npc: '人物' };

export function placeMarker(maze: Maze, point: Point, kind: MarkerTool, label: string): Maze {
  if (!inside(maze, point) || solid(maze.tiles[point.y * maze.width + point.x])) return maze;
  const marker: Marker = { ...point, kind, label: label.trim() || markerNames[kind] };
  return { ...maze, markers: [...(maze.markers ?? []).filter(m => !same(m, point)), marker] };
}

export function removeMarker(maze: Maze, point: Point): Maze {
  if (!maze.markers?.some(m => same(m, point))) return maze;
  return { ...maze, markers: maze.markers.filter(m => !same(m, point)) };
}
