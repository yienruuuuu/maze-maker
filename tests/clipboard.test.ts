import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeClipboard, encodeClipboard } from '../src/clipboard';
import { blank, parseMaze } from '../src/engine';
import { copySelection, pasteSelection } from '../src/selection';

function payload() {
  const maze = blank(10, 10);
  maze.tiles[3 * 10 + 3] = 'right'; maze.tiles[4 * 10 + 3] = 'block';
  maze.markers = [{ x: 3, y: 3, kind: 'item', label: '寶貝球' }, { x: 4, y: 4, kind: 'npc', label: '人物' }];
  maze.review = [{ x: 4, y: 3, reason: '待核對' }];
  return copySelection(maze, { x: 3, y: 3, width: 2, height: 2 });
}

test('system clipboard text round-trips all supported layers and pastes into another map', () => {
  const clip = payload(), { clip: received, token } = decodeClipboard(encodeClipboard(clip, 'source-tab-operation'));
  assert.equal(token, 'source-tab-operation'); assert.deepEqual(received, clip);
  const destination = blank(12, 12), result = pasteSelection(destination, received, { x: 5, y: 5 });
  assert.equal(result.tiles[5 * 12 + 5], 'right'); assert.equal(result.markers?.[1].label, '人物');
  assert.deepEqual(result.exits, destination.exits); assert.deepEqual(result.entrance, destination.entrance);
  parseMaze(result);
});

test('single cell, all-solid and maximum-size selections remain supported', () => {
  for (const [width, height] of [[1, 1], [100, 100]]) {
    const clip = { width, height, tiles: Array(width * height).fill('wall'), markers: [], review: [] };
    assert.deepEqual(decodeClipboard(encodeClipboard(clip, 'test')).clip, clip);
  }
});

test('clipboard rejects unrelated text, wrong versions and invalid or oversized dimensions', () => {
  for (const text of ['', 'hello', '{}', 'null', '[]', '3', '"text"', 'x'.repeat(3_000_001)]) assert.throws(() => decodeClipboard(text));
  const good = JSON.parse(encodeClipboard(payload(), 'test'));
  for (const patch of [{ type: 'maze' }, { version: 2 }, { token: '' }, { width: 0 }, { height: 101 }, { width: 1.5 }, { width: '2' }, { tiles: ['floor'] }, { tiles: ['floor', 'floor', 'floor', 'lava'] }]) {
    assert.throws(() => decodeClipboard(JSON.stringify({ ...good, ...patch })));
  }
});

test('clipboard validates relative marker and review coordinates, kinds and labels', () => {
  const good = JSON.parse(encodeClipboard(payload(), 'test'));
  for (const markers of [null, [null], [7], [{ x: -1, y: 0, kind: 'item', label: '' }], [{ x: 2, y: 0, kind: 'item', label: '' }], [{ x: .5, y: 0, kind: 'item', label: '' }], [{ x: 0, y: 0, kind: 'exit', label: '' }], [{ x: 0, y: 0, kind: 'item', label: 3 }]]) {
    assert.throws(() => decodeClipboard(JSON.stringify({ ...good, markers })));
  }
  for (const review of [null, [null], [{ x: 0, y: 2, reason: '' }], [{ x: 0, y: 0, reason: 7 }]]) assert.throws(() => decodeClipboard(JSON.stringify({ ...good, review })));
});

test('clipboard ignores extra endpoint and cut-source fields instead of importing them', () => {
  const good = JSON.parse(encodeClipboard(payload(), 'test'));
  const received = decodeClipboard(JSON.stringify({ ...good, entrance: { x: 0, y: 0 }, exits: [{ x: 1, y: 1, id: 'injected' }], cutSource: { x: 0, y: 0 } }));
  assert.deepEqual(Object.keys(received.clip).sort(), ['height', 'markers', 'review', 'tiles', 'width']);
});
