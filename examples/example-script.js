/**
 * End-to-end example: capture an annotated screenshot of a public site,
 * with a label, an arrow, and a saved JSON spec for later replay.
 *
 * Target: https://opbindr.com (real site this skill was built against)
 *
 * Usage:
 *   npm install -D playwright
 *   npx playwright install chromium
 *   node example-script.js
 *
 * Output:
 *   - opbindr-home.png             (screenshot with annotations)
 *   - opbindr-home.spec.json       (replayable spec)
 *
 * Then to refresh the screenshot after the site changes:
 *   node ../snippets/replay-all-specs.js .
 */

import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { annotate, clearAnnotations, saveSpec } from '../snippets/annotate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const URL_TARGET = 'https://opbindr.com';
const PNG_PATH = join(__dirname, 'opbindr-home.png');
const SPEC_PATH = join(__dirname, 'opbindr-home.spec.json');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // 1. Navigate
  await page.goto(URL_TARGET, { waitUntil: 'domcontentloaded' });
  // Wait for the hero heading to render
  await page.getByRole('heading', { name: /one piece tcg collection/i }).waitFor({ timeout: 10000 });

  // 2. Annotate (using Playwright Locators — robust to layout changes)
  await annotate(page, [
    {
      type: 'label',
      target: page.getByRole('button', { name: /create your first binder/i }),
      text: 'Click to begin',
      position: 'right',
      color: '#ef4444',
    },
    {
      type: 'arrow',
      fromTarget: page.getByRole('heading', { name: /one piece tcg collection/i }),
      toTarget: page.getByRole('button', { name: /create your first binder/i }),
      fromSide: 'bottom',
      toSide: 'top',
      color: '#ef4444',
    },
  ]);

  // 3. Screenshot
  await page.screenshot({ path: PNG_PATH });
  console.log(`✓ saved ${PNG_PATH}`);

  // 4. Clear annotations and save the spec for later replay
  await clearAnnotations(page);
  saveSpec(SPEC_PATH, {
    url: URL_TARGET,
    // `viewports` array → render once per viewport, suffixing the filename
    // (e.g. opbindr-home.desktop.png, opbindr-home.mobile.png).
    // Use `viewport` (singular) for a single render.
    viewports: [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ],
    setup: [
      { action: 'waitForSelector', selector: 'h1' },
    ],
    annotations: [
      // In specs, use selector strings (not Locator objects).
      // Use text="..." with quotes for exact match (text=... is substring).
      {
        type: 'label',
        selector: 'role=button[name=/create your first binder/i]',
        text: 'Click to begin',
        position: 'right',
        color: '#ef4444',
      },
      {
        type: 'arrow',
        fromSelector: 'role=heading[name=/one piece tcg collection/i]',
        toSelector: 'role=button[name=/create your first binder/i]',
        fromSide: 'bottom',
        toSide: 'top',
        color: '#ef4444',
      },
    ],
  });
  console.log(`✓ saved ${SPEC_PATH}`);

  await browser.close();
  console.log('Done. Run replay-all-specs.js to refresh from the spec.');
})();
