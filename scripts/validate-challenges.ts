import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { analyze, directions, key, move, parseMaze } from '../src/engine';

const folder = 'data/challenge-19x19';
const files = readdirSync(folder).filter(f => /^level-\d{2}\.json$/.test(f)).sort();
assert.equal(files.length, 10, 'Expected ten levels');
for (const file of files) {
  const m = parseMaze(JSON.parse(readFileSync(`${folder}/${file}`, 'utf8')));
  assert.equal(m.width, 19); assert.equal(m.height, 19); assert.equal(m.exits.length, 1);
  for (let n = 0; n < 19; n++) for (const i of [n, 18 * 19 + n, n * 19, n * 19 + 18]) assert.equal(m.tiles[i], 'wall');
  const a = analyze(m), route = a.routes[0];
  assert.ok(route.reachable, `${file}: unreachable exit`);
  assert.ok(route.commands.length >= 18, `${file}: route too short`);
  assert.ok(route.sliding.filter(Boolean).length >= 22, `${file}: insufficient sliding`);
  assert.equal(a.loopTransitions, 0, `${file}: reachable sliding loop`);
  let player = m.entrance;
  for (const d of route.commands) { const r = move(m, player, d); assert.equal(r.loop, false); player = r.end; }
  assert.equal(key(player), key(route.exit));
  // Reverse reachability catches recoverable-looking branches that actually strand the player.
  const reverse = new Map<string, string[]>();
  for (const p of a.reachable) for (const d of directions) {
    const r = move(m, p, d), k = key(r.end);
    reverse.set(k, [...reverse.get(k) ?? [], key(p)]);
  }
  const queue = [key(route.exit)], seen = new Set(queue);
  for (let h = 0; h < queue.length; h++) for (const p of reverse.get(queue[h]) ?? []) if (!seen.has(p)) { seen.add(p); queue.push(p); }
  assert.equal(seen.size, a.reachable.length, `${file}: irreversible dead end`);
  // Search only moves without forced steps: an exit here would bypass the core mechanic.
  const walk = [m.entrance], walked = new Set([key(m.entrance)]);
  for (let h = 0; h < walk.length; h++) for (const d of directions) {
    const r = move(m, walk[h], d);
    if (r.loop || r.sliding.some(Boolean) || walked.has(key(r.end))) continue;
    walked.add(key(r.end)); walk.push(r.end);
  }
  assert.ok(!walked.has(key(route.exit)), `${file}: exit reachable without sliding`);
  console.log(`${file}: verified (solvable, sliding required, all branches recoverable)`);
}
