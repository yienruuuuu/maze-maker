import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, blank, move, parseMaze, type Maze, type Tile } from '../src/engine';
import { rocketHideout } from '../src/rocketHideout';
const put = (m: Maze, x: number, y: number, tile: Tile) => { m.tiles[y*m.width+x] = tile; };
test('ordinary movement takes exactly one step', () => {
  const m = blank(8,8); assert.deepEqual(move(m,{x:2,y:2},'right').end,{x:3,y:2});
});
test('arrow slides across floor and stops immediately before a wall', () => {
  const m = blank(8,8); put(m,3,2,'right');
  assert.deepEqual(move(m,{x:2,y:2},'right').end,{x:6,y:2});
  put(m,5,2,'wall'); assert.deepEqual(move(m,{x:2,y:2},'right').end,{x:4,y:2});
});
test('arrows redirect forced motion and stop tiles end it', () => {
  const m = blank(8,8); put(m,3,2,'right'); put(m,5,2,'down'); put(m,5,5,'stop');
  const r = move(m,{x:2,y:2},'right');
  assert.deepEqual(r.end,{x:5,y:5}); assert.equal(r.trace.length,6); assert.equal(r.loop,false);
});
test('a blocked arrow ends motion; the next command can leave in another direction', () => {
  const m = blank(8,8); put(m,3,2,'right'); put(m,4,2,'wall');
  const r = move(m,{x:2,y:2},'right'); assert.deepEqual(r.end,{x:3,y:2});
  assert.deepEqual(move(m,r.end,'down').end,{x:3,y:3});
});
test('repeated position and direction detects an endless sliding loop', () => {
  const m = blank(8,8); put(m,3,2,'right'); put(m,5,2,'down'); put(m,5,5,'left'); put(m,3,5,'up');
  assert.equal(move(m,{x:2,y:2},'right').loop,true);
  assert.ok(analyze(m).loopTransitions > 0);
});
test('passing over an exit is not reaching it; a stop tile makes it reachable', () => {
  const m = blank(8,5); m.tiles.fill('wall');
  for(let x=1;x<7;x++) put(m,x,2,'floor');
  m.entrance={x:1,y:2}; m.exits=[{id:'goal',x:4,y:2}];
  for(let x=2;x<6;x++) put(m,x,2,'right');
  assert.equal(analyze(m).routes[0].reachable,false);
  put(m,4,2,'stop'); assert.equal(analyze(m).routes[0].reachable,true);
});
test('route commands replay to each reachable exit with minimal operation count', () => {
  const m=blank(8,8); m.entrance={x:1,y:2}; m.exits=[{id:'A',x:6,y:2},{id:'B',x:6,y:3}]; put(m,2,2,'right');
  const result=analyze(m); assert.equal(result.routes[0].commands.length,1); assert.equal(result.routes[1].commands.length,2);
  for(const route of result.routes) { let p=m.entrance; for(const d of route.commands) p=move(m,p,d).end; assert.deepEqual(p,{x:route.exit.x,y:route.exit.y}); }
});
test('boundaries stop motion even without enclosing walls', () => {
  const m=blank(5,5); m.tiles.fill('floor'); put(m,2,2,'right');
  assert.deepEqual(move(m,{x:1,y:2},'right').end,{x:4,y:2});
});
test('untrusted imports reject invalid dimensions, tiles and endpoints', () => {
  assert.throws(()=>parseMaze({})); const m=blank(); assert.deepEqual(parseMaze(m),m);
  assert.throws(()=>parseMaze({...m,width:1000})); assert.throws(()=>parseMaze({...m,tiles:[]}));
  assert.throws(()=>parseMaze({...m,entrance:{x:0,y:0}})); assert.throws(()=>parseMaze({...m,exits:[m.exits[0],m.exits[0]]}));
});
test('blue blocks stop sliding in the same way as structural walls', () => {
  const m=blank(8,8); put(m,3,2,'right'); put(m,5,2,'block');
  assert.deepEqual(move(m,{x:2,y:2},'right').end,{x:4,y:2});
  assert.throws(()=>parseMaze({...m,entrance:{x:5,y:2}}));
});
test('reference transcription has consistent coordinates and replayable routes', () => {
  const m=rocketHideout(); assert.equal(m.width,30); assert.equal(m.height,22);
  assert.equal(m.tiles.length,660);
  assert.equal(m.review?.length,22); assert.equal(m.tiles[3*30+2],'stop');
  assert.equal(m.tiles[4*30+10],'up'); assert.equal(m.tiles[20*30+4],'block');
  const result=analyze(m); assert.equal(result.routes.length,3);
  for(const route of result.routes.filter(r=>r.reachable)) {
    let p=m.entrance;
    for(const d of route.commands) { const step=move(m,p,d); assert.equal(step.loop,false); p=step.end; }
    assert.deepEqual(p,{x:route.exit.x,y:route.exit.y});
  }
  assert.equal(result.routes.filter(r=>r.reachable).length,3);
});
