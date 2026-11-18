// Sunset Harbor — make.fun entrypoint for gta6-01 (Node 22, stdlib only).
// Copies game/ and screenshots/ to /output and writes /output/dossier.json
// with the kit's buildDossier. mkdir + cpSync ONLY: the grader runs as
// uid 65534 on a read-only filesystem, so deleting /output would throw
// EACCES (that bug killed round 2). The grader guarantees an empty /output.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const root = new URL('.', import.meta.url).pathname;

mkdirSync(out, { recursive: true });
cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(root, 'screenshots'), join(out, 'screenshots'), { recursive: true });
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
console.log('Sunset Harbor entry written to ' + out);
