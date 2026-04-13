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
 * Annotate the page with overlays. Each call has a `target` (a Playwright
 * Locator) which is resolved to a bounding box, plus annotation params.
 *
 * If a target can't be resolved (e.g., element not on page), that single
 * annotation is skipped with a warning. The screenshot still proceeds.
 */
export async function annotate(page, calls) {
  await page.evaluate(overlayScript);
  const resolved = [];
  for (const call of calls) {
    const rect = await call.target.first().boundingBox();
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
