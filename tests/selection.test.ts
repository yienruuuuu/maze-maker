import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blank, parseMaze, type Maze } from '../src/engine';
import { clearSelection, copySelection, pasteError, pasteSelection, rectangle } from '../src/selection';

function fixture(): Maze {
  const m = blank(10, 10);
  m.tiles[3 * 10 + 3] = 'right'; m.tiles[3 * 10 + 4] = 'stop'; m.tiles[4 * 10 + 3] = 'block';
  m.markers = [{ x: 3, y: 3, kind: 'item', label: '道具 A' }, { x: 4, y: 3, kind: 'lift', label: '電梯' }, { x: 4, y: 4, kind: 'npc', label: '人物' }];
  m.review = [{ x: 3, y: 3, reason: '待核對' }];
  return m;
}

test('click, reverse drag and dragging outside produce inclusive clamped rectangles', () => {
  const m = blank(10, 10);
  assert.deepEqual(rectangle(m, { x: 4, y: 4 }, { x: 4, y: 4 }), { x: 4, y: 4, width: 1, height: 1 });
  assert.deepEqual(rectangle(m, { x: 5, y: 4 }, { x: 3, y: 2 }), { x: 3, y: 2, width: 3, height: 3 });
  assert.deepEqual(rectangle(m, { x: 2, y: 2 }, { x: -5, y: 20 }), { x: 0, y: 2, width: 3, height: 8 });
});

test('copy snapshots terrain, relative markers and review without endpoints or source mutation', () => {
  const m = fixture(), before = structuredClone(m);
  const clip = copySelection(m, { x: 3, y: 3, width: 2, height: 2 });
  assert.deepEqual(clip.tiles, ['right', 'stop', 'block', 'floor']);
  assert.deepEqual(clip.markers.map(m => [m.x, m.y, m.kind]), [[0, 0, 'item'], [1, 0, 'lift'], [1, 1, 'npc']]);
  assert.equal('entrance' in clip, false); assert.equal('exits' in clip, false);
  clip.markers[0].label = 'changed'; clip.tiles[0] = 'wall'; clip.review[0].reason = 'changed';
  assert.deepEqual(m, before);
});

test('delete clears all selected layers and exits but preserves entrance and unrelated cells', () => {
  const m = fixture(); m.entrance = { x: 3, y: 3 }; m.exits.push({ x: 4, y: 3, id: 'inside' });
  const next = clearSelection(m, { x: 3, y: 3, width: 2, height: 2 });
  assert.deepEqual(next.entrance, m.entrance); assert.equal(next.exits.length, 1);
  assert.deepEqual(next.markers, []); assert.deepEqual(next.review, []);
  for (const i of [33, 34, 43, 44]) assert.equal(next.tiles[i], 'floor');
  assert.equal(next.tiles[0], 'wall'); assert.equal(m.tiles[33], 'right'); parseMaze(next);
});

test('paste copies to a new location, replaces target layers and supports repetition', () => {
  const m = fixture(); m.markers!.push({ x: 6, y: 3, kind: 'stairs', label: 'old target' });
  const clip = copySelection(m, { x: 3, y: 3, width: 2, height: 2 });
  const next = pasteSelection(m, clip, { x: 6, y: 3 });
  assert.deepEqual(next.exits, m.exits); assert.deepEqual(next.entrance, m.entrance);
  assert.equal(next.tiles[36], 'right'); assert.equal(next.tiles[46], 'block');
  assert.equal(next.markers!.filter(m => m.x === 6 && m.y === 3).length, 1);
  assert.equal(next.markers!.find(m => m.x === 6 && m.y === 3)!.label, '道具 A');
  assert.equal(next.review!.find(m => m.x === 6)!.reason, '待核對');
  assert.equal(m.markers!.find(m => m.x === 6)!.label, 'old target');
  assert.equal(pasteSelection(next, clip, { x: 6, y: 3 }).markers!.length, next.markers!.length); parseMaze(next);
});

test('out-of-bounds or obstacle-over-endpoint paste is rejected before cutting any source', () => {
  const m = fixture(), before = structuredClone(m), rect = { x: 3, y: 3, width: 2, height: 2 };
  const clip = copySelection(m, rect);
  for (const at of [{ x: -1, y: 3 }, { x: 9, y: 9 }, { x: 10, y: 0 }]) {
    assert.ok(pasteError(m, clip, at)); assert.throws(() => pasteSelection(m, clip, at, rect));
  }
  const wall = copySelection(m, { x: 3, y: 4, width: 1, height: 1 });
  assert.throws(() => pasteSelection(m, wall, m.entrance, rect));
  assert.throws(() => pasteSelection(m, wall, m.exits[0], rect));
  assert.deepEqual(m, before);
});

test('overlapping cut clears source before pasting its snapshot, preserving In/Out coordinates', () => {
  const m = fixture(), rect = { x: 3, y: 3, width: 2, height: 2 };
  m.entrance = { x: 3, y: 3 }; m.exits.push({ x: 4, y: 3, id: 'source exit' });
  const clip = copySelection(m, rect), before = structuredClone(m);
  const next = pasteSelection(m, clip, { x: 4, y: 3 }, rect);
  assert.deepEqual(next.entrance, m.entrance); assert.deepEqual(next.exits, m.exits);
  assert.equal(next.tiles[33], 'floor'); assert.equal(next.tiles[43], 'floor');
  assert.equal(next.tiles[34], 'right'); assert.equal(next.tiles[35], 'stop'); assert.equal(next.tiles[44], 'block');
  assert.equal(next.markers!.length, 3); assert.ok(next.markers!.every(m => m.x >= 4));
  assert.deepEqual(m, before); parseMaze(next);
});

test('pasting passable terrain onto endpoints retains them; same-place cut is a no-op', () => {
  const m = fixture(), rect = { x: 3, y: 3, width: 2, height: 2 };
  const floor = copySelection(m, { x: 5, y: 5, width: 1, height: 1 });
  assert.deepEqual(pasteSelection(m, floor, m.exits[0]).exits, m.exits);
  assert.deepEqual(pasteSelection(m, copySelection(m, rect), { x: 3, y: 3 }, rect), m);
});
