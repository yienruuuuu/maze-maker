import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, blank, parseMaze } from '../src/engine';
import { placeMarker, removeMarker } from '../src/markers';

test('placing markers preserves underlying mechanisms, endpoints and analysis', () => {
  const m = blank(8, 8); m.tiles[3 * 8 + 3] = 'right';
  const before = analyze(m);
  const next = placeMarker(m, { x: 3, y: 3 }, 'stairs', '樓梯 A');
  assert.deepEqual(next.tiles, m.tiles); assert.deepEqual(next.entrance, m.entrance); assert.deepEqual(next.exits, m.exits);
  assert.deepEqual(analyze(next), before); assert.equal(m.markers, undefined);
  assert.deepEqual(parseMaze(next), next);
});

test('same-cell replacement and deletion preserve unrelated and legacy markers', () => {
  const m = blank(8, 8);
  m.markers = [{ x: 2, y: 3, kind: 'lift', label: '電梯' }, { x: 3, y: 3, kind: 'npc', label: '舊人物' }, { x: 3, y: 3, kind: 'item', label: '舊道具' }];
  const next = placeMarker(m, { x: 3, y: 3 }, 'npc', ' 新人物 ');
  assert.deepEqual(next.markers, [m.markers[0], { x: 3, y: 3, kind: 'npc', label: '新人物' }]);
  assert.deepEqual(removeMarker(next, { x: 3, y: 3 }).markers, [m.markers[0]]);
  assert.equal(m.markers.length, 3);
});

test('walls, blocks and out-of-bounds placements are rejected without mutation', () => {
  const m = blank(8, 8); m.tiles[3 * 8 + 3] = 'block';
  for (const p of [{ x: 0, y: 0 }, { x: 3, y: 3 }, { x: -1, y: 4 }, { x: 8, y: 4 }]) assert.equal(placeMarker(m, p, 'item', ''), m);
  assert.equal(removeMarker(m, { x: 2, y: 3 }), m);
});

test('all new marker kinds round-trip through JSON with default names', () => {
  let m = blank(8, 8);
  m = placeMarker(m, { x: 2, y: 3 }, 'item', '');
  m = placeMarker(m, { x: 3, y: 3 }, 'stairs', '  ');
  m = placeMarker(m, { x: 4, y: 3 }, 'npc', '人物甲');
  assert.deepEqual(parseMaze(JSON.parse(JSON.stringify(m))), m);
  assert.deepEqual(m.markers?.map(m => m.label), ['道具', '樓梯', '人物甲']);
});
