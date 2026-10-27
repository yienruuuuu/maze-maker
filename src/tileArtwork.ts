import type { CSSProperties } from 'react';
import type { Tile } from './engine';

// User-selected artwork, copied unchanged. Rectangles are sampled at render time;
// no source-map layout is used to position tiles or determine collision.
export const TILE_ART_URL = '/assets/rocket-hideout-frlg.png';
const ART_WIDTH = 1736, ART_HEIGHT = 576;
type Rect = readonly [number, number, number, number];
export const tileRects: Record<Tile, Rect> = {
  floor: [784, 120, 16, 16],
  wall: [640, 168, 32, 32],
  block: [640, 168, 32, 32],
  left: [512, 88, 16, 16],
  right: [512, 120, 16, 16],
  up: [608, 104, 16, 16],
  down: [656, 104, 16, 16],
  stop: [480, 88, 16, 16],
};

export function drawArtwork(ctx: CanvasRenderingContext2D, image: HTMLImageElement, tile: Tile, x: number, y: number, size: number) {
  const [sx, sy, sw, sh] = tileRects[tile];
  ctx.drawImage(image, sx, sy, sw, sh, x, y, size, size);
}

export function tilePreview(tile: string): CSSProperties | undefined {
  if (!(tile in tileRects)) return;
  const [x, y, w, h] = tileRects[tile as Tile];
  return {
    backgroundImage: `url(${TILE_ART_URL})`,
    backgroundSize: `${ART_WIDTH * 24 / w}px ${ART_HEIGHT * 24 / h}px`,
    backgroundPosition: `${-x * 24 / w}px ${-y * 24 / h}px`,
    backgroundRepeat: 'no-repeat', imageRendering: 'pixelated',
    width: 24, height: 24, flexShrink: 0, fontSize: 0,
  };
}
