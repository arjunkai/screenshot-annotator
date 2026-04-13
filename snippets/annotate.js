/**
 * Annotation primitives for screenshot-annotator.
 *
 * Renders annotation overlays as DOM elements on a Playwright page,
 * then takes a screenshot. Annotations are removed between calls
 * via `clearAnnotations()`.
 *
 * Usage:
 *   import { annotate, clearAnnotations } from './annotate.js';
 *
 *   await annotate(page, [
 *     { type: 'highlight', target: page.getByRole('button', { name: 'Save' }), color: '#C9A84C' },
 *     { type: 'callout', target: page.getByText('Step 1'), n: '1', position: 'top-left' },
 *     { type: 'label', target: page.locator('.search'), text: 'Search any card', position: 'right' },
 *   ]);
 *   await page.screenshot({ path: 'out.png' });
 *   await clearAnnotations(page);
 */

const overlayScript = `
window.__annotate = window.__annotate || {
  ensureRoot() {
    let root = document.getElementById('__annotation-root');
    if (root) return root;
    root = document.createElement('div');
    root.id = '__annotation-root';
    Object.assign(root.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '999999',
    });
    document.body.appendChild(root);
    return root;
  },
  ensureSvg() {
    let svg = document.getElementById('__annotation-svg');
    if (svg) return svg;
    const root = this.ensureRoot();
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = '__annotation-svg';
    Object.assign(svg.style, {
      position: 'fixed', top: '0', left: '0',
      width: '100%', height: '100%',
      pointerEvents: 'none',
    });
    svg.setAttribute('width', String(window.innerWidth));
    svg.setAttribute('height', String(window.innerHeight));
    root.appendChild(svg);
    return svg;
  },
  arrow({ from, to, color = '#C9A84C', thickness = 3, headSize = 12 }) {
    const svg = this.ensureSvg();
    const ns = 'http://www.w3.org/2000/svg';
    // Marker for arrowhead — unique ID per arrow so multiple colors work
    const markerId = '__arrowhead-' + Math.random().toString(36).slice(2, 8);
    let defs = svg.querySelector('defs');
    if (!defs) { defs = document.createElementNS(ns, 'defs'); svg.appendChild(defs); }
    const marker = document.createElementNS(ns, 'marker');
    marker.setAttribute('id', markerId);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', String(headSize / 2));
    marker.setAttribute('markerHeight', String(headSize / 2));
    marker.setAttribute('orient', 'auto-start-reverse');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    path.setAttribute('fill', color);
    marker.appendChild(path);
    defs.appendChild(marker);
    // The line itself
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', String(from.x));
    line.setAttribute('y1', String(from.y));
    line.setAttribute('x2', String(to.x));
    line.setAttribute('y2', String(to.y));
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', String(thickness));
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('marker-end', 'url(#' + markerId + ')');
    svg.appendChild(line);
  },
  highlight({ rect, color = '#C9A84C', padding = 8, radius = 12 }) {
    const root = this.ensureRoot();
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed',
      left: (rect.x - padding) + 'px',
      top: (rect.y - padding) + 'px',
      width: (rect.width + padding * 2) + 'px',
      height: (rect.height + padding * 2) + 'px',
      border: '3px solid ' + color,
      borderRadius: radius + 'px',
      boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
      pointerEvents: 'none',
    });
    root.appendChild(box);
  },
  callout({ rect, n, position = 'top-left', color = '#C9A84C' }) {
    const root = this.ensureRoot();
    const dot = document.createElement('div');
    const offsets = {
      'top-left':    { left: rect.x - 16, top: rect.y - 16 },
      'top-right':   { left: rect.x + rect.width - 16, top: rect.y - 16 },
      'bottom-left': { left: rect.x - 16, top: rect.y + rect.height - 16 },
      'bottom-right':{ left: rect.x + rect.width - 16, top: rect.y + rect.height - 16 },
    };
    const o = offsets[position] || offsets['top-left'];
    Object.assign(dot.style, {
      position: 'fixed',
      left: o.left + 'px', top: o.top + 'px',
      width: '32px', height: '32px',
      borderRadius: '50%',
      background: color,
      color: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      fontWeight: '700', fontSize: '16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    });
    dot.textContent = n;
    root.appendChild(dot);
  },
  label({ rect, text, position = 'right', color = '#C9A84C', textColor = '#000' }) {
    const root = this.ensureRoot();
    const pill = document.createElement('div');
    const positions = {
      right: { left: rect.x + rect.width + 12, top: rect.y + rect.height / 2 - 14 },
      left:  { left: rect.x - 12, top: rect.y + rect.height / 2 - 14, transform: 'translateX(-100%)' },
      above: { left: rect.x + rect.width / 2, top: rect.y - 32, transform: 'translateX(-50%)' },
      below: { left: rect.x + rect.width / 2, top: rect.y + rect.height + 8, transform: 'translateX(-50%)' },
    };
    const p = positions[position] || positions.right;
    Object.assign(pill.style, {
      position: 'fixed',
      left: p.left + 'px', top: p.top + 'px',
      transform: p.transform || 'none',
      background: color, color: textColor,
      padding: '6px 12px', borderRadius: '999px',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px', fontWeight: '600',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      whiteSpace: 'nowrap',
    });
    pill.textContent = text;
    root.appendChild(pill);
  },
  clear() {
    const root = document.getElementById('__annotation-root');
    if (root) root.remove();
  },
};
`;

/**
 * Pick a connection point on a bounding box.
 * Side: 'top' | 'bottom' | 'left' | 'right' | 'center'.
 */
function pointOn(rect, side) {
  switch (side) {
    case 'top':    return { x: rect.x + rect.width / 2, y: rect.y };
    case 'bottom': return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    case 'left':   return { x: rect.x, y: rect.y + rect.height / 2 };
    case 'right':  return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
    default:       return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }
}

/**
 * Annotate the page with overlays.
 *
 * - `highlight`, `callout`, `label` take a `target` (Playwright Locator).
 * - `arrow` takes either `from`/`to` as `{x,y}` coords, OR `fromTarget`/`toTarget`
 *   as Locators with optional `fromSide`/`toSide` ('top'|'bottom'|'left'|'right').
 *
 * If any target can't be resolved, that single annotation is skipped with
 * a warning. The screenshot still proceeds.
 */
export async function annotate(page, calls) {
  await page.evaluate(overlayScript);
  const resolved = [];
  for (const call of calls) {
    if (call.type === 'arrow') {
      let from = call.from;
      let to = call.to;
      if (!from && call.fromTarget) {
        const r = await call.fromTarget.first().boundingBox({ timeout: 3000 }).catch(() => null);
        if (!r) { console.warn(`  ⚠ skipped arrow: fromTarget not found`); continue; }
        from = pointOn(r, call.fromSide || 'right');
      }
      if (!to && call.toTarget) {
        const r = await call.toTarget.first().boundingBox({ timeout: 3000 }).catch(() => null);
        if (!r) { console.warn(`  ⚠ skipped arrow: toTarget not found`); continue; }
        to = pointOn(r, call.toSide || 'left');
      }
      if (!from || !to) { console.warn(`  ⚠ skipped arrow: missing endpoints`); continue; }
      const { fromTarget, toTarget, fromSide, toSide, ...rest } = call;
      resolved.push({ ...rest, from, to });
      continue;
    }
    const rect = await call.target.first().boundingBox({ timeout: 3000 }).catch(() => null);
    if (!rect) {
      console.warn(`  ⚠ skipped ${call.type}: target not found`);
      continue;
    }
    const { target, ...rest } = call;
    resolved.push({ ...rest, rect });
  }
  await page.evaluate((calls) => {
    for (const call of calls) {
      window.__annotate[call.type](call);
    }
  }, resolved);
}

/** Remove all annotations from the page. */
export async function clearAnnotations(page) {
  await page.evaluate(() => window.__annotate?.clear());
}

// ── Spec format ────────────────────────────────────────────────────────
// Annotation specs save the *intent* of a screenshot to a JSON sidecar
// file. When the UI changes, replay the spec to re-render — the selectors
// resolve against the current DOM and the screenshot stays current.
//
// Spec example (saved as `add-cards-filters.spec.json` next to the PNG):
// {
//   "url": "http://localhost:5173/binder/abc",
//   "viewport": { "width": 1440, "height": 900 },
//   "setup": [
//     { "action": "click", "selector": "[title=\"Add Cards\"]" },
//     { "action": "waitForSelector", "selector": "img[alt]" }
//   ],
//   "annotations": [
//     { "type": "label", "selector": "text=Sets", "text": "Pick a set", "position": "right", "color": "#C9A84C" }
//   ]
// }

import { writeFileSync, readFileSync } from 'fs';

/**
 * Save the annotation spec for a screenshot as a JSON sidecar.
 * The spec captures URL, viewport, setup actions, and annotation defs
 * with selector strings (not Playwright Locators) so it can be re-rendered.
 */
export function saveSpec(filePath, spec) {
  writeFileSync(filePath, JSON.stringify(spec, null, 2));
}

/**
 * Load a spec from disk.
 */
export function loadSpec(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

/**
 * Replay a spec against a fresh page: navigate, run setup, annotate, screenshot.
 * Lets you re-render annotated screenshots after a UI change without
 * editing the original script.
 *
 * Supported setup actions:
 *   { action: 'click', selector }           — click the element
 *   { action: 'hover', selector }           — hover (reveals tooltips, dropdowns)
 *   { action: 'focus', selector }           — focus (reveals focus rings, autocomplete)
 *   { action: 'fill', selector, value }     — type into an input
 *   { action: 'type', selector, text }      — type with realistic per-key delay
 *   { action: 'press', key }                — press a keyboard key (e.g. 'Enter', 'Tab')
 *   { action: 'scroll', selector }          — scroll the element into view
 *   { action: 'waitForSelector', selector } — wait for an element to appear
 *   { action: 'waitForTimeout', ms }        — wait N milliseconds
 */
export async function replaySpec(page, spec, screenshotPath) {
  if (spec.viewport) await page.setViewportSize(spec.viewport);
  await page.goto(spec.url);
  for (const step of spec.setup || []) {
    switch (step.action) {
      case 'click':
        await page.locator(step.selector).first().click();
        break;
      case 'hover':
        await page.locator(step.selector).first().hover();
        break;
      case 'focus':
        await page.locator(step.selector).first().focus();
        break;
      case 'fill':
        await page.locator(step.selector).first().fill(step.value);
        break;
      case 'type':
        await page.locator(step.selector).first().pressSequentially(step.text, { delay: step.delay ?? 50 });
        break;
      case 'press':
        await page.keyboard.press(step.key);
        break;
      case 'scroll':
        await page.locator(step.selector).first().scrollIntoViewIfNeeded();
        break;
      case 'waitForSelector':
        await page.waitForSelector(step.selector, step.options);
        break;
      case 'waitForTimeout':
        await page.waitForTimeout(step.ms);
        break;
      default:
        console.warn(`  ⚠ unknown setup action: ${step.action}`);
    }
  }
  // Convert spec annotations (with selector strings) into annotate() calls (with Locators)
  const calls = (spec.annotations || []).map(a => {
    const out = { ...a };
    if (a.selector) out.target = page.locator(a.selector);
    if (a.fromSelector) out.fromTarget = page.locator(a.fromSelector);
    if (a.toSelector) out.toTarget = page.locator(a.toSelector);
    delete out.selector; delete out.fromSelector; delete out.toSelector;
    return out;
  });
  await annotate(page, calls);
  if (screenshotPath) await page.screenshot({ path: screenshotPath });
  await clearAnnotations(page);
}

