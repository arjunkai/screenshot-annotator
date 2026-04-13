/**
 * Screenshot script template — copy this and modify for your project.
 *
 * Prereqs:
 *   npm install -D playwright
 *   npx playwright install chromium
 *
 * Usage:
 *   node scripts/screenshot-guides.js
 *
 * The dev server (or target site) must be reachable at BASE_URL.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { annotate, clearAnnotations } from './annotate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Where screenshots are saved. Adjust to your project layout.
const OUT_DIR = join(__dirname, '..', 'public', 'guide');
mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = process.env.SCREENSHOT_URL || 'http://localhost:5173';

// ── Scenes ─────────────────────────────────────────────────────────────
// Each scene captures one screenshot. Add more by appending to the array.

const scenes = [
  {
    name: 'home-overview',
    async run(page) {
      await page.goto(BASE_URL);
      await page.screenshot({ path: join(OUT_DIR, 'home-overview.png') });
    },
  },
  {
    name: 'home-cta-annotated',
    async run(page) {
      await page.goto(BASE_URL);
      await annotate(page, [
        { type: 'highlight', target: page.getByRole('button', { name: 'Get Started' }), color: '#C9A84C' },
        { type: 'label', target: page.getByRole('button', { name: 'Get Started' }), text: 'Click to begin', position: 'right' },
      ]);
      await page.screenshot({ path: join(OUT_DIR, 'home-cta.png') });
      await clearAnnotations(page);
    },
  },
];

// ── Main ───────────────────────────────────────────────────────────────

(async () => {
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Output dir: ${OUT_DIR}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  for (const scene of scenes) {
    console.log(`→ ${scene.name}`);
    const page = await context.newPage();
    try {
      await scene.run(page);
      console.log(`  ✓ saved`);
    } catch (err) {
      console.error(`  ✗ failed: ${err.message.split('\n')[0]}`);
      try {
        await page.screenshot({ path: join(OUT_DIR, `__failed-${scene.name}.png`) });
      } catch {}
    }
    await page.close();
  }

  await browser.close();
  console.log('Done.');
})();
