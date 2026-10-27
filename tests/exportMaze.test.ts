import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blank, parseMaze } from '../src/engine';
import { exportMaze } from '../src/exportMaze';

test('save picker receives JSON options and success waits for write and close', async () => {
  const m = blank(); const events: string[] = [];
  m.name = '中文名稱';
  const result = await exportMaze(m, async options => {
    assert.equal(options.suggestedName, 'maze.json');
    assert.deepEqual(options.types[0].accept, { 'application/json': ['.json'] });
    events.push('picked');
    return { async createWritable() { return {
      async write(blob) { assert.equal(blob.type, 'application/json'); assert.deepEqual(parseMaze(JSON.parse(await blob.text())), m); events.push('written'); },
      async close() { events.push('closed'); },
    }; } };
  });
  assert.equal(result, 'saved'); assert.deepEqual(events, ['picked', 'written', 'closed']);
});

test('cancelling the file picker does not trigger fallback download', async () => {
  assert.equal(await exportMaze(blank(), async () => { throw new DOMException('Cancelled', 'AbortError'); }), 'cancelled');
});

test('save permission, write and close errors propagate without fallback or false success', async () => {
  for (const stage of ['picker', 'write', 'close']) {
    const error = new Error(stage);
    await assert.rejects(exportMaze(blank(), async () => {
      if (stage === 'picker') throw error;
      return { async createWritable() { return {
        async write() { if (stage === 'write') throw error; },
        async close() { if (stage === 'close') throw error; },
      }; } };
    }), error);
  }
});
