import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Lists bundled Lottie samples served statically by the web app from /lottie/*. */

export const lottieRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/studio-server/src/routes → apps/studio-web/{public,dist}/lottie
const PUBLIC_DIR = path.resolve(__dirname, '../../../studio-web/public/lottie');
const DIST_DIR = path.resolve(__dirname, '../../../studio-web/dist/lottie');

lottieRouter.get('/list', (_req, res) => {
  const dir = fs.existsSync(PUBLIC_DIR) ? PUBLIC_DIR : DIST_DIR;
  const items: { id: string; name: string; url: string }[] = [];
  try {
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.json')) continue;
        const id = f.replace(/\.json$/, '');
        items.push({ id, name: prettify(id), url: `/lottie/${f}` });
      }
    }
  } catch {
    /* ignore */
  }
  res.json({ items });
});

function prettify(id: string): string {
  return id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
