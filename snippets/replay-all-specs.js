/**
 * Replay every *.spec.json file in a directory tree, re-rendering each
 * annotated screenshot from its spec.
 *
 * Use this after a UI change: instead of editing screenshot scripts and
 * re-running them, just run this once and every screenshot whose spec
 * still has resolvable selectors gets refreshed automatically.
 *
 * Usage:
 *   node replay-all-specs.js <directory>
 *
 *   # Examples:
 *   node scripts/replay-all-specs.js public/guide
 *   SCREENSHOT_URL=https://staging.myapp.com node scripts/replay-all-specs.js docs/screenshots
 *
 * Each *.spec.json produces a same-named .png next to it (e.g.,
 * `feature.spec.json` -> `feature.png`). If the spec's URL is relative
 * or you want to override it, set SCREENSHOT_URL — it replaces the
 * origin while keeping the path.
 */

import { chromium } from 'playwright';
import { readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { replaySpec, loadSpec } from './annotate.js';

function findSpecs(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...findSpecs(full));
    else if (entry.endsWith('.spec.json')) out.push(full);
  }
  return out;
}

function pngPathFor(specPath) {
  return specPath.replace(/\.spec\.json$/, '.png');
}

function applyUrlOverride(spec, override) {
  if (!override) return spec;
  try {
    const original = new URL(spec.url);
    const newUrl = new URL(override);
    newUrl.pathname = original.pathname;
    newUrl.search = original.search;
    newUrl.hash = original.hash;
    return { ...spec, url: newUrl.toString() };
  } catch {
    return { ...spec, url: override };
  }
}

(async () => {
  const targetDir = process.argv[2];
  if (!targetDir) {
    console.error('Usage: node replay-all-specs.js <directory>');
    process.exit(1);
  }

  const specs = findSpecs(targetDir);
  if (specs.length === 0) {
    console.log(`No *.spec.json files found in ${targetDir}`);
    return;
  }
  console.log(`Found ${specs.length} spec(s) in ${targetDir}`);

  const urlOverride = process.env.SCREENSHOT_URL;
  if (urlOverride) console.log(`URL override: ${urlOverride}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  let succeeded = 0, failed = 0;
  for (const specPath of specs) {
    const name = basename(specPath);
    const spec = applyUrlOverride(loadSpec(specPath), urlOverride);

    // Multi-viewport: if `viewports` is set, render once per viewport
    // with a `.{name}` suffix on the filename. Otherwise single render.
    const viewports = spec.viewports || [{ ...spec.viewport, name: null }];

    for (const vp of viewports) {
      const label = vp.name ? `${name} @ ${vp.name}` : name;
      process.stdout.write(`→ ${label} ... `);
      const page = await context.newPage();
      try {
        const variant = vp.name
          ? { ...spec, viewport: { width: vp.width, height: vp.height } }
          : spec;
        const outPath = vp.name
          ? pngPathFor(specPath).replace(/\.png$/, `.${vp.name}.png`)
          : pngPathFor(specPath);
        await replaySpec(page, variant, outPath);
        console.log('✓');
        succeeded++;
      } catch (err) {
        console.log(`✗ ${err.message.split('\n')[0]}`);
        failed++;
      }
      await page.close();
    }
  }

  await browser.close();
  console.log(`Done. ${succeeded} succeeded, ${failed} failed.`);
})();
