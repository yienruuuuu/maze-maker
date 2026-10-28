import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, blank, move } from '../src/engine';
import { collectAt, indexItems, startCollection } from '../src/play';

test('touching an item collects it once without changing the map or previous state', () => {
  const m = blank(8, 8);
  m.markers = [{ x: 3, y: 2, kind: 'item', label: '道具' }];
  const before = JSON.stringify(m), initial = startCollection(m), items = indexItems(m);
  const next = collectAt(items, { x: 3, y: 2 }, initial);
  assert.equal(initial.size, 0); assert.equal(next.size, 1);
  assert.equal(collectAt(items, { x: 3, y: 2 }, next), next);
  assert.equal(JSON.stringify(m), before);
});

test('sliding collects items on entry, along the path and at the stopping tile', () => {
  const m = blank(10, 8); m.entrance = { x: 1, y: 2 };
  m.tiles[2 * 10 + 2] = 'right'; m.tiles[2 * 10 + 7] = 'stop';
  m.markers = [2, 4, 7].map(x => ({ x, y: 2, kind: 'item', label: `道具${x}` }));
  const items = indexItems(m), step = move(m, m.entrance, 'right');
  let collected = startCollection(m);
  for (const p of step.trace) collected = collectAt(items, p, collected);
  assert.equal(collected.size, 3); assert.deepEqual(step.end, { x: 7, y: 2 }); assert.equal(step.loop, false);
});

test('stairs, lift and NPC markers do not count as items; off-route items remain', () => {
  const m = blank(8, 8);
  m.markers = [
    { x: 3, y: 2, kind: 'stairs', label: '樓梯' }, { x: 3, y: 2, kind: 'lift', label: '電梯' },
    { x: 3, y: 2, kind: 'npc', label: '人物' }, { x: 4, y: 3, kind: 'item', label: '道具' },
  ];
  const items = indexItems(m); assert.equal(items.total, 1);
  assert.equal(collectAt(items, { x: 3, y: 2 }, startCollection(m)).size, 0);
});

test('start and restart collect spawn items and restore all other pickups', () => {
  const m = blank(8, 8);
  m.markers = [{ ...m.entrance, kind: 'item', label: '入口道具' }, { x: 4, y: 3, kind: 'item', label: '其他道具' }];
  const initial = startCollection(m); assert.deepEqual([...initial], [0]);
  assert.equal(collectAt(indexItems(m), { x: 4, y: 3 }, initial).size, 2);
  assert.deepEqual([...startCollection(m)], [0]);
});

test('overlapping legacy items are individual pickups and maps without items remain valid', () => {
  const m = blank(8, 8);
  assert.equal(indexItems(m).total, 0); assert.equal(startCollection(m).size, 0);
  m.markers = [{ x: 3, y: 3, kind: 'item', label: 'A' }, { x: 3, y: 3, kind: 'item', label: 'B' }];
  const next = collectAt(indexItems(m), { x: 3, y: 3 }, startCollection(m));
  assert.equal(next.size, 2); assert.equal(indexItems(m).total, 2);
});

test('exit reachability and movement do not depend on collected items', () => {
  const m = blank(8, 8); m.markers = [{ x: 3, y: 3, kind: 'item', label: '道具' }];
  const before = analyze(m);
  collectAt(indexItems(m), { x: 3, y: 3 }, startCollection(m));
  assert.deepEqual(analyze(m), before);
  assert.equal(before.routes[0].reachable, true);
});
