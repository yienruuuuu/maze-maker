import type { Marker, ReviewCell, Tile } from './engine';
import type { MazeClipboard } from './selection';

export type ClipboardSelection = { token: string; clip: MazeClipboard };
const tiles = new Set(['floor', 'wall', 'block', 'up', 'right', 'down', 'left', 'stop']);
const kinds = new Set(['item', 'stairs', 'lift', 'npc']);

// Plain text makes the same data available to native paste events and clipboard.readText.
export function encodeClipboard(clip: MazeClipboard, token: string): string {
  return JSON.stringify({ type: 'maze-lab-selection', version: 1, token, ...clip });
}

export function decodeClipboard(text: string): ClipboardSelection {
  const invalid = () => { throw new Error('剪貼簿不是有效的迷宮選取內容，請先在 Maze Lab 複製。'); };
  if (text.length > 3_000_000) return invalid();
  let data: Record<string, unknown>;
  try { data = JSON.parse(text); } catch { return invalid(); }
  if (!data || typeof data !== 'object' || data.type !== 'maze-lab-selection' || data.version !== 1 || typeof data.token !== 'string' || !data.token || data.token.length > 128) return invalid();
  const width = data.width as number, height = data.height as number;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 100 || height > 100) return invalid();
  if (!Array.isArray(data.tiles) || data.tiles.length !== width * height || !data.tiles.every(t => tiles.has(t))) return invalid();
  const point = (p: Record<string, unknown>) => p && typeof p === 'object' && Number.isInteger(p.x) && Number.isInteger(p.y) && (p.x as number) >= 0 && (p.y as number) >= 0 && (p.x as number) < width && (p.y as number) < height;
  if (!Array.isArray(data.markers) || data.markers.length > 10_000 || !data.markers.every(m => point(m) && kinds.has(m.kind) && typeof m.label === 'string')) return invalid();
  if (!Array.isArray(data.review) || data.review.length > 10_000 || !data.review.every(p => point(p) && typeof p.reason === 'string')) return invalid();
  // Construct only supported fields: clipboard contents can never introduce In/Out.
  return { token: data.token, clip: {
    width, height, tiles: [...data.tiles] as Tile[],
    markers: data.markers.map(m => ({ x: m.x, y: m.y, kind: m.kind, label: m.label })) as Marker[],
    review: data.review.map(p => ({ x: p.x, y: p.y, reason: p.reason })) as ReviewCell[],
  } };
}
