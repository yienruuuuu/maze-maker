import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blank, move, analyze, parseMaze } from '../src/engine';
import { placeMarker, removeMarker } from '../src/markers';
import { copySelection, pasteSelection } from '../src/selection';
import { decodeClipboard, encodeClipboard } from '../src/clipboard';
import { collectAt, indexItems, startCollection } from '../src/play';
const fixture = () => {
  const m = blank(10, 8); m.entrance = { x: 1, y: 2 }; m.exits = [{ id: 'OUT', x: 7, y: 4 }];
  return placeMarker(placeMarker(m, { x: 2, y: 2 }, 'portal', 'A'), { x: 7, y: 4 }, 'portal', 'A');
};
test('walking teleports and rests without bouncing; leaving and re-entering returns', () => {
  const m = fixture(), step = move(m, m.entrance, 'right');
  assert.deepEqual(step.end, { x: 7, y: 4 }); assert.deepEqual(step.teleported, [false, true]);
  assert.equal(step.loop, false); assert.deepEqual(move(m, step.end, 'left').end, { x: 6, y: 4 });
  assert.deepEqual(move(m, { x: 6, y: 4 }, 'right').end, { x: 2, y: 2 });
});
test('sliding triggers portals before the underlying arrow and stops at an arrow destination', () => {
  let m = fixture(); m = removeMarker(m, { x: 2, y: 2 }); m = placeMarker(m, { x: 4, y: 2 }, 'portal', 'A');
  m.tiles[22] = 'right'; m.tiles[24] = 'down'; m.tiles[47] = 'up';
  const step = move(m, m.entrance, 'right'); assert.deepEqual(step.end, { x: 7, y: 4 });
  assert.deepEqual(step.trace, [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 7, y: 4 }]);
});
test('incomplete groups stay inert, placement rejects third point and obstacles', () => {
  const m = fixture(); assert.equal(placeMarker(m, { x: 5, y: 5 }, 'portal', 'A'), m);
  assert.equal(placeMarker(m, { x: 0, y: 0 }, 'portal', 'B'), m);
  const single = removeMarker(m, { x: 7, y: 4 }); assert.deepEqual(move(single, single.entrance, 'right').end, { x: 2, y: 2 });
});
test('JSON and clipboard round-trip; copies isolate groups while cuts preserve pairing', () => {
  const m = fixture(); assert.deepEqual(parseMaze(JSON.parse(JSON.stringify(m))), m);
  const rect = { x: 2, y: 2, width: 6, height: 3 }, clip = copySelection(m, rect);
  const decoded = decodeClipboard(encodeClipboard(clip, 'portal')).clip;
  assert.deepEqual(decoded, clip);
  const pasted = pasteSelection(m, decoded, { x: 2, y: 3 });
  assert.equal(pasted.markers?.filter(p => p.label === 'A-2').length, 2);
  const one = { x: 2, y: 2, width: 1, height: 1 };
  const cut = pasteSelection(m, copySelection(m, one), { x: 3, y: 3 }, one);
  assert.equal(cut.markers?.filter(p => p.label === 'A').length, 2);
  const invalid = fixture(); invalid.markers![0].x = 0;
  assert.throws(() => parseMaze(invalid));
});
test('solver uses teleport in one operation; collection visits both endpoints only', () => {
  const m = fixture();
  const route = analyze(m).routes[0]; assert.equal(route.reachable, true); assert.deepEqual(route.commands, ['right']);
  assert.deepEqual(route.teleported, [false, false, true]);
  m.markers!.push({ x: 2, y: 2, kind: 'item', label: 'entry' }, { x: 7, y: 4, kind: 'item', label: 'arrival' }, { x: 5, y: 3, kind: 'item', label: 'between' });
  let collected = startCollection(m); const items = indexItems(m);
  for (const p of move(m, m.entrance, 'right').trace) collected = collectAt(items, p, collected);
  assert.equal(collected.size, 2);
});
