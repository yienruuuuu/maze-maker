import type { CSSProperties } from 'react';
import type { Tile } from './engine';

// User-selected artwork, copied unchanged. Rectangles are sampled at render time;
// no source-map layout is used to position tiles or determine collision.
export const TILE_ART_URL = '/assets/rocket-hideout-frlg.png';
export const ITEM_ART_URL = '/assets/outdoor-3870.png';
export const STAIRS_ART_URL = '/assets/tileset-2.png';
export const NPC_ART_URL = '/assets/overworld-npcs.png';
const ART_WIDTH = 1736, ART_HEIGHT = 576;
type Rect = readonly [number, number, number, number];

export function createMarkerArtwork(image: HTMLImageElement, rect: Rect, background?: readonly [number, number, number]): HTMLCanvasElement {
  const [x, y, width, height] = rect;
  const sprite = document.createElement('canvas');
  sprite.width = width; sprite.height = height;
  const ctx = sprite.getContext('2d')!;
  ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
  if (background) {
    const pixels = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      if (pixels.data[i] === background[0] && pixels.data[i + 1] === background[1] && pixels.data[i + 2] === background[2]) pixels.data[i + 3] = 0;
    }
    ctx.putImageData(pixels, 0, 0);
  }
  return sprite;
}

export const createStairsArtwork = (image: HTMLImageElement) => createMarkerArtwork(image, [1, 766, 16, 16]);
export const createNpcArtwork = (image: HTMLImageElement) => createMarkerArtwork(image, [26, 42, 16, 24], [255, 127, 39]);

export function createItemArtwork(image: HTMLImageElement): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 10;
  const ctx = sprite.getContext('2d')!;
  // Small ground-item Poké Ball selected by the user, not a building emblem.
  ctx.drawImage(image, 78, 144, 10, 10, 0, 0, 10, 10);
  const pixels = ctx.getImageData(0, 0, 10, 10);
  for (let i = 0; i < pixels.data.length; i += 4) {
    if (pixels.data[i] === 153 && pixels.data[i + 1] === 51 && pixels.data[i + 2] === 204) pixels.data[i + 3] = 0;
  }
  ctx.putImageData(pixels, 0, 0);
  return sprite;
}
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
