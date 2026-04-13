---
name: screenshot-annotator
description: Capture annotated screenshots of any web UI for documentation, tutorials, blog posts, or product walkthroughs. Use this skill whenever the user asks for screenshots of their app, wants to annotate UI with arrows or callouts or highlights, needs documentation images, or mentions visual guides, even if they don't explicitly say "annotated screenshot." It uses Playwright to drive a real browser, injects styled overlays as DOM elements before capture, and saves PNGs that look polished and on-brand.
---

# screenshot-annotator

Capture clean, annotated screenshots of any web UI. Annotations (highlight boxes, numbered callouts, text labels) are injected into the page as real DOM elements before the screenshot is taken, so they render at full resolution, scale with the page, and can match any color scheme.

## When to use this skill

Reach for this skill whenever the user wants visual documentation of a web app:

- "Take screenshots of my dashboard for the docs"
- "I need to show users how to use this feature, can we get screenshots with arrows?"
- "Make a guide showing the settings page"
- "Capture the modal and label the parts"
- "Get me a screenshot of the checkout flow with callouts"

The skill works on any URL: local dev servers (`localhost:5173`) or production sites.

## How it works

The skill provides a Playwright script that:

1. Launches a headless browser at a configurable viewport
2. Navigates to the target URL and runs setup actions (clicks, navigations, scrolls)
3. Injects an overlay layer onto the page using DOM elements
4. Resolves Playwright Locators to bounding boxes, then renders annotations at those positions
5. Takes a screenshot at 2x DPI for crisp output
6. Saves the PNG to a configurable directory

Because annotations are real DOM elements rendered by the browser, they look pixel-perfect and inherit the page's font rendering. They never look like "stickers pasted on top."

## Annotation primitives

Four primitives ship with the skill. They cover the vast majority of documentation needs:

### `highlight`

Draws a colored rectangle around a target element with a darkened backdrop. Use for "this is the thing I'm talking about."

```js
{ type: 'highlight', target: page.getByRole('button', { name: 'Save' }), color: '#C9A84C', padding: 8, radius: 12 }
```

### `callout`

Places a numbered circle at a corner of the target element. Use for sequential steps (1, 2, 3...) referenced from the surrounding text.

```js
{ type: 'callout', target: page.getByText('Filters'), n: '1', position: 'top-left', color: '#C9A84C' }
```

`position`: `top-left | top-right | bottom-left | bottom-right`

### `label`

Floats a text pill anchored to a target element. Use for inline explanations.

```js
{ type: 'label', target: page.locator('.search-bar'), text: 'Search any card', position: 'right', color: '#3b82f6', textColor: '#fff' }
```

`position`: `right | left | above | below`

### `arrow`

Draws an SVG arrow between two points. Two ways to anchor it:

**Locator-based** (preferred, robust to layout changes):

```js
{
  type: 'arrow',
  fromTarget: page.getByText('Step 1'),
  toTarget: page.getByRole('button', { name: 'Continue' }),
  fromSide: 'right',     // 'top' | 'bottom' | 'left' | 'right' | 'center'
  toSide: 'left',
  color: '#C9A84C',
  thickness: 3,
  headSize: 12,
}
```

**Coordinate-based** (when you need pixel control):

```js
{ type: 'arrow', from: { x: 100, y: 200 }, to: { x: 400, y: 250 }, color: '#C9A84C' }
```

## Spec replay (re-render when UI changes)

The biggest pain point with documentation screenshots is they go stale every time the UI changes. This skill solves that by saving the *intent* of each screenshot as a JSON sidecar file, which can be replayed against the new UI to produce a fresh annotated screenshot, no script edits needed.

### Save a spec

When capturing a screenshot, also write a `.spec.json` next to it:

```js
import { saveSpec } from './annotate.js';

saveSpec('public/guide/add-cards-filters.spec.json', {
  url: 'http://localhost:5173/binder/abc',
  viewport: { width: 1440, height: 900 },
  setup: [
    { action: 'click', selector: '[title="Add Cards"]' },
    { action: 'waitForSelector', selector: 'img[alt]' },
  ],
  annotations: [
    { type: 'label', selector: 'text=Sets', text: 'Pick a set', position: 'right', color: '#C9A84C' },
    { type: 'arrow', fromSelector: 'text=Sets', toSelector: 'text=Romance Dawn', color: '#C9A84C' },
  ],
});
```

Note the spec uses **selector strings** (the Playwright generic selector syntax: `text=...`, `role=...`, raw CSS) rather than Locator objects, since Locators can't be JSON-serialized.

### Replay a spec

When the UI changes, re-render every screenshot from its spec:

```js
import { replaySpec, loadSpec } from './annotate.js';

const spec = loadSpec('public/guide/add-cards-filters.spec.json');
await replaySpec(page, spec, 'public/guide/add-cards-filters.png');
```

If a selector still resolves, the annotation re-renders at the new position. If it doesn't (element was removed/renamed), the annotation is skipped with a warning so you know to update the spec.

### Why this matters

Without spec replay: every time you redesign a feature, you have to manually re-take and re-annotate every screenshot. This usually means screenshots in docs lag the actual UI by months.

With spec replay: change the UI, run a single command, get a fresh set of screenshots that match the current design.

### Bulk replay

`snippets/replay-all-specs.js` walks a directory tree, finds every `*.spec.json`, and re-renders the matching `.png` next to it:

```bash
node snippets/replay-all-specs.js public/guide
```

To point all specs at a different host (e.g., staging instead of prod), set `SCREENSHOT_URL`:

```bash
SCREENSHOT_URL=https://staging.myapp.com node snippets/replay-all-specs.js docs/screenshots
```

It only overrides the origin. Paths and search params from each spec are preserved.

### Multi-viewport rendering

For documentation that needs both desktop and mobile screenshots, use `viewports` (plural) instead of `viewport`:

```js
saveSpec('docs/feature.spec.json', {
  url: 'https://myapp.com/feature',
  viewports: [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile',  width: 390,  height: 844 },
  ],
  setup: [...],
  annotations: [...],
});
```

`replay-all-specs.js` will produce one PNG per viewport with the name as a suffix: `feature.desktop.png`, `feature.mobile.png`. Annotations may skip on smaller viewports if targets are off-screen, so design your selectors with both layouts in mind.

## Capturing interactive states

Tooltips, dropdowns, hover effects, focus rings: these only appear when a user interacts with the page. The `setup` block in a spec supports actions for triggering them before the screenshot:

| Action | What it does | Example |
|---|---|---|
| `click` | Click an element | `{ action: 'click', selector: 'button.menu' }` |
| `hover` | Hover (reveals tooltips, dropdowns) | `{ action: 'hover', selector: '.user-avatar' }` |
| `focus` | Focus an input (reveals focus ring, autocomplete) | `{ action: 'focus', selector: 'input[name="search"]' }` |
| `fill` | Set an input value instantly | `{ action: 'fill', selector: 'input', value: 'hello' }` |
| `type` | Type text with realistic per-key delay | `{ action: 'type', selector: 'input', text: 'hello', delay: 50 }` |
| `press` | Press a keyboard key | `{ action: 'press', key: 'Enter' }` |
| `scroll` | Scroll an element into view | `{ action: 'scroll', selector: '.footer' }` |
| `waitForSelector` | Wait for an element to appear | `{ action: 'waitForSelector', selector: '.modal' }` |
| `waitForTimeout` | Wait N ms (use sparingly) | `{ action: 'waitForTimeout', ms: 500 }` |

## Setup

The skill requires Playwright and the chromium browser. From the user's project:

```bash
npm install -D playwright
npx playwright install chromium
```

Copy `snippets/annotate.js` into the user's project (typically into a `scripts/` directory). It exports the annotation primitives and the overlay script.

## Workflow

When the user asks for annotated screenshots:

1. **Identify the target URL**: production site, dev server, or static file. If a dev server is needed, start it first (e.g., `npm run dev`).

2. **Identify the scenes**: each "scene" is one screenshot. For each, write down: starting URL, setup actions (clicks, scrolls), annotation calls, output filename.

3. **Find selectors for annotation targets**: prefer Playwright's user-facing locators (`getByRole`, `getByText`, `getByPlaceholder`, `getByTitle`) over raw CSS selectors. They're more robust to design changes.

4. **Write a script** based on the example in `snippets/script-template.js`. Each scene is a small async function.

5. **Run it** with `node scripts/screenshot-guides.js`. Iterate on selectors and annotation positions until shots look right.

6. **Review the output**. Annotations sometimes skip if a target isn't visible (e.g., it's scrolled off-screen). The script logs warnings but doesn't fail. Fix by scrolling the relevant element into view before annotating.

## Selector tips

These are the patterns that will save the most grief, learned from real use:

- **Use the actual text in the HTML, not the rendered text.** A label that displays as "SETS" via CSS `text-transform: uppercase` is actually the string "Sets" in the DOM. `getByText('Sets')` works; `getByText('SETS')` doesn't.

- **`text=Foo` does substring match.** In specs (which use selector strings), `text=Color` matches "Color" anywhere in the DOM, including hidden elements. Use `text="Color"` with quotes for exact match, or use `getByText('Color', { exact: true })` in script form.

- **First-match the target.** Many selectors return collections. Wrap with `.first()` or `.nth(0)` to pick a single element for the bounding box.

- **Wait for content to load.** Card grids, image-heavy pages, and lazy-loaded UIs render asynchronously. Use `page.waitForFunction(...)` to wait for actual content (e.g., images with non-zero `naturalWidth`) before screenshotting. `waitForTimeout` is a fallback, not a primary mechanism.

- **Scroll before annotating.** If the target isn't in the current viewport, the bounding box is still computed but the annotation will render outside the screenshot. Scroll the target into view first with `element.scrollIntoView()`.

## Output quality

- Use `deviceScaleFactor: 2` for retina-quality PNGs
- Default viewport `1440x900` is a good desktop default; use `375x812` for mobile shots
- For a dark-mode app, dark backgrounds in the PNG are intentional. Don't override the page's color scheme

## Failure modes

The script is built to fail soft so one broken annotation doesn't kill the whole batch:

- **Target not found** → annotation is skipped, warning is logged, screenshot still saves
- **Selector timeout** → scene fails, but next scene proceeds. A `__failed-<scene>.png` is saved so you can see what state the page was in

## Common pitfalls (and helpers that fix them)

Real screenshot scripts keep hitting the same four gotchas. The skill exports helpers for each:

### 1. `locator.hover()` times out on re-rendering elements

Components that re-render frequently (virtualized lists, live-data subscriptions, CSS transitions, ambient animations) can make `locator.hover()` hang waiting for the element to "stabilize." The element looks still on screen, but Playwright's actionability check never passes.

Use `hoverByMouse(page, locator)` to bypass the stability check. This is typically needed when you're revealing a hover-only action (like a card's "..." menu or a table row's edit button) before clicking it:

```js
import { hoverByMouse } from 'screenshot-annotator';

// Reveal the hover actions on a card, then click the one you want
await hoverByMouse(page, page.locator('.product-card').first());
await page.getByRole('button', { name: 'Quick view' }).click({ force: true });
```

Pair with `click({ force: true })` on the revealed button. Since the parent was hovered via raw mouse events, Playwright's normal visibility checks on the child may still lag behind.

### 2. Don't use `waitUntil: 'networkidle'` on a Vite/Next dev server

Dev servers with HMR keep WebSockets open, so `'networkidle'` never triggers and `page.goto()` times out. Use `'domcontentloaded'` instead and wait for specific selectors separately.

```js
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading').waitFor();
```

### 3. Waiting for "any image to load" isn't enough for virtualized grids

Product listings, photo galleries, and dashboards load images lazily as they render. The common pattern `waitForFunction(() => imgs.some(i => i.complete))` returns as soon as **one** image loads, which is useless because your screenshot catches the grid half-filled.

Use `waitForImagesLoaded(page, opts)` to wait until ≥90% of *currently-visible* images have decoded:

```js
import { waitForImagesLoaded } from 'screenshot-annotator';

await page.goto('https://shop.example.com/category/shoes');
await waitForImagesLoaded(page, { ratio: 0.9, settleMs: 1200 });
await page.screenshot({ path: 'shoes-grid.png' });
```

Tune `selector` if your images use a different tag or class (e.g. `'picture img'`, `'.product-image'`). `minCount` guards against capturing before the grid has rendered at all.

### 4. Landing pages have branching state: race the buttons, don't guess

Real apps show different UI depending on who's visiting: a first-time user sees a marketing hero with "Get started", a returning user lands on their dashboard, a logged-out user sees a login form. Short `isVisible({ timeout: 1000 })` checks fall through the wrong branch when the page hasn't hydrated yet, and you end up clicking a button that doesn't exist in the current state.

Use `raceVisible(page, locatorMap)` to react to whichever element actually appears first:

```js
import { raceVisible } from 'screenshot-annotator';

const state = await raceVisible(page, {
  signedOut: page.getByRole('button', { name: 'Sign in' }),
  onboarding: page.getByRole('heading', { name: /welcome/i }),
  dashboard:  page.getByRole('heading', { name: 'Your workspace' }),
});

if (state === 'signedOut') await loginFlow(page);
else if (state === 'onboarding') await dismissOnboarding(page);
// state === 'dashboard' → already where we want to be
if (!state) throw new Error('no expected app state appeared within timeout');
```

This pattern is robust to hydration lag because it waits on *all* candidates concurrently and returns as soon as any one becomes visible.

## Files in this skill

- `snippets/annotate.js`: the overlay primitives and `annotate()` helper
- `snippets/script-template.js`: copy-paste-modify starting point for a screenshot script
- `examples/`: sample annotated screenshots
- `README.md`: public-facing intro
