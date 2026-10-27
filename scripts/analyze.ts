import { readFile } from 'node:fs/promises';
import { analyze, parseMaze } from '../src/engine';
const path = process.argv[2];
if (!path) { console.error('Usage: npm run analyze -- maze.json'); process.exit(1); }
try { console.log(JSON.stringify(analyze(parseMaze(JSON.parse(await readFile(path, 'utf8')))), null, 2)); } catch (e) { console.error(String(e)); process.exitCode = 1; }
