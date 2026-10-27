import { type Maze, parseMaze } from './engine';
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('maze-lab', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('documents');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function load(): Promise<Maze | undefined> {
  const db = await database();
  try { return await new Promise((resolve, reject) => { const r = db.transaction('documents').objectStore('documents').get('current'); r.onsuccess = () => { try { resolve(r.result ? parseMaze(r.result) : undefined); } catch (e) { reject(e); } }; r.onerror = () => reject(r.error); }); } finally { db.close(); }
}
export async function save(maze: Maze) {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('documents','readwrite'); tx.objectStore('documents').put(maze,'current'); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); } finally { db.close(); }
}
