import reference from '../data/rocket-hideout.json';
import { parseMaze } from './engine';

// CLI and rule tests share the JSON imported into the editor.
export function rocketHideout() {
  return parseMaze(reference);
}
