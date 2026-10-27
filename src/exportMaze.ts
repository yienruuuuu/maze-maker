import type { Maze } from './engine';

export type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }>;

export async function exportMaze(maze: Maze, picker?: SaveFilePicker): Promise<'saved' | 'downloaded' | 'cancelled'> {
  const blob = new Blob([JSON.stringify(maze, null, 2) + '\n'], { type: 'application/json' });
  if (picker) {
    try {
      const handle = await picker({ suggestedName: 'maze.json', types: [{ description: '迷宮 JSON', accept: { 'application/json': ['.json'] } }] });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'maze.json';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
