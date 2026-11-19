// SOLMAR HEAT — the make.fun gta6-01 entrypoint (Node 22, stdlib only).
//
// What it does, in order:
//   1. Copies this repository's game/ (the playable static game) into the
//      output directory, and screenshots/ beside it.
//   2. Writes /output/dossier.json with buildDossier from the vendored
//      make.fun library (vendor/makefun-game.ts, kit copy, unchanged).
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The run is deterministic: same files in, same bytes out, every time.
// Nothing here touches the network, and nothing is installed.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// --- guard rails, so a broken tree fails loudly instead of shipping ------
function assertGameTree() {
  const gameDir = join(here, 'game');
  const index = join(gameDir, 'index.html');
  if (!existsSync(index)) throw new Error('game/index.html is missing');
  const indexBytes = statSync(index).size;
  if (indexBytes > 1024 * 1024) throw new Error('game/index.html is over the 1 MiB cap');
  const shots = existsSync(join(here, 'screenshots')) ? readdirSync(join(here, 'screenshots')) : [];
  const images = shots.filter((n) => !n.startsWith('.'));
  if (images.length < 3 || images.length > 4) {
    throw new Error(`screenshots/ must hold 3 or 4 images, found ${images.length}`);
  }
  for (const name of images) {
    const size = statSync(join(here, 'screenshots', name)).size;
    if (size > 256 * 1024) throw new Error(`screenshot ${name} is over the 256 KiB cap`);
  }
}

assertGameTree();

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (kit reference/gate.json): only text_max_bytes
// shapes the dossier bytes; the others refuse an entry the scorer would
// refuse (more than 4 screenshots or one over 256 KiB; more than 993
// files in game/ or 48 MiB of game files in all, or a path under game/
// over 1000 bytes — game/ counts beside /output's own 1000-entry cap).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
