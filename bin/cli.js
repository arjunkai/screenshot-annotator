#!/usr/bin/env node
/**
 * screenshot-annotator CLI
 *
 * Usage:
 *   npx screenshot-annotator replay <dir>           # re-render every spec in dir
 *   npx screenshot-annotator example                # write example.spec.json template
 *   npx screenshot-annotator --help
 *
 * Env vars:
 *   SCREENSHOT_URL  override the origin of every spec (great for staging)
 */

import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const cmd = args[0];

const HELP = `screenshot-annotator — annotated screenshot tooling

Commands:
  replay <dir>      Walk <dir>, replay every *.spec.json into a fresh .png
  example           Write a sample example.spec.json in the current directory
  --help, -h        Show this help

Env:
  SCREENSHOT_URL    Override origin in every spec (e.g. point at staging)

Examples:
  npx screenshot-annotator replay public/guide
  SCREENSHOT_URL=https://staging.app npx screenshot-annotator replay docs/`;

function showHelp() {
  console.log(HELP);
  process.exit(0);
}

if (!cmd || cmd === '--help' || cmd === '-h') showHelp();

if (cmd === 'replay') {
  const dir = args[1];
  if (!dir) {
    console.error('replay: missing <dir> argument');
    console.error('Try: npx screenshot-annotator replay public/guide');
    process.exit(1);
  }
  // Spawn the bundled replay-all-specs script with the user's dir
  const script = join(PKG_ROOT, 'snippets', 'replay-all-specs.js');
  const child = spawn(process.execPath, [script, dir], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code ?? 0));
} else if (cmd === 'example') {
  const out = join(process.cwd(), 'example.spec.json');
  if (existsSync(out)) {
    console.error(`example.spec.json already exists in ${process.cwd()}, refusing to overwrite`);
    process.exit(1);
  }
  const template = {
    url: 'https://example.com',
    viewports: [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ],
    setup: [
      { action: 'waitForSelector', selector: 'h1' },
    ],
    annotations: [
      {
        type: 'highlight',
        selector: 'h1',
        color: '#3b82f6',
        padding: 8,
      },
      {
        type: 'label',
        selector: 'h1',
        text: 'Page heading',
        position: 'right',
        color: '#3b82f6',
        textColor: '#fff',
      },
    ],
  };
  writeFileSync(out, JSON.stringify(template, null, 2));
  console.log(`✓ wrote ${out}`);
  console.log(`Now run: npx screenshot-annotator replay ${process.cwd()}`);
} else {
  console.error(`Unknown command: ${cmd}`);
  showHelp();
}
