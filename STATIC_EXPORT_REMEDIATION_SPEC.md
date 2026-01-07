# Continuous Function — Remediation Spec (Static Export Production Readiness)

This document converts the audit findings into **implementation-ready engineering tasks** with: root cause, exact file touch-points, proposed patches (as diffs/snippets), acceptance criteria, and rollback notes. It’s written so a reviewer can approve each change as a small PR.

> Repo guardrail note: per the repo’s AGENTS instructions, **run Oracle preflight before making non-trivial edits**. This spec is intended to be the input to that preflight + PR plan.

---

## Status update (Dec 28, 2025)

This remediation spec is **partially outdated** relative to the current repo state. Based on static inspection, the following items appear already implemented:
- `next.config.mjs` includes `output: 'export'` **and** `trailingSlash: true`.
- The MDX pipeline includes `rehype-slug` (so `#momentum` / `#rmsprop` anchors can work).
- `pages/_document.tsx` exists and sets `<Html lang="en">`.
- `components/Layout.tsx` sets baseline `<Head>` tags (title/meta/OG/Twitter).
- KaTeX is configured with `trust: false` in the MDX pipeline and the foundations concept renderer.
- The previously mentioned unintended route file (`pages/foundations/index 2.tsx`) does not exist in the current repo tree.

For the current prioritized issue list and patch-style diffs, see `AUDIT_REPORT.md` (especially §7).

## Overview: Why it’s not production-ready today

**Primary blocker (P0):** The site is configured for Next.js static export (`output: 'export'`), but clean URL deep links (e.g. `/pillars/optimization`) are not guaranteed to work on a generic static host without server rewrites. The repo’s `DEPLOYMENT_GUIDE.md` acknowledges this and describes an `.htaccess` rewrite, but **the rewrite file is not source-controlled** and is **host-specific** (Apache).

Secondary issues (P1/P2) include:
- MDX pages lack stable heading IDs (no slug plugin), but graph navigation relies on `#hash` fragments.
- Missing baseline SEO (title/meta, `lang`).
- Unsafe KaTeX rendering defaults (`trust: true` + unescaped fallback HTML).
- Over-coupled foundation visualization mapping module.
- Numeric helper edge cases (divide-by-zero → NaN/Infinity).
- Missing CSS variables referenced in multiple places.
- Unintended route file (`pages/foundations/index 2.tsx`) + inconsistent “17 vs 32” copy.

---

## PR/Task Breakdown (recommended sequencing)

### PR 1 (P0): Static-export deep links + deployment invariants
- Goal: make `/route` refresh and direct navigation work on “dumb” static hosting.
- This should land first because it affects URL structure and site deploy behavior.

### PR 2 (P1): MDX heading IDs + KnowledgeGraph route fixes
- Goal: ensure graph deep-links into MDX pages are deterministic.

### PR 3 (P1): SEO baseline
- Goal: add `lang`, default `<title>`, meta description, basic OG/Twitter tags.

### PR 4 (P1): KaTeX hardening
- Goal: eliminate unsafe KaTeX HTML injection defaults.

### PR 5 (P1/P2): Decouple foundations visualization map + numeric guards + CSS vars + remove unintended route
- Goal: reduce coupling and eliminate known static bugs.

---

## Task CF-001 (P0): Make clean URLs work in pure static export

### Problem
- `next.config.mjs` sets:
  ```js
  output: 'export'
  ```
  but does not set `trailingSlash: true`.
- `DEPLOYMENT_GUIDE.md` states clean URLs require `.htaccess` rewrite, but `find . -name .htaccess` yields none (not checked in).

### Root cause
Default Next export commonly emits `out/route.html` (or host-dependent structure). Without:
- directory-style output (`/route/index.html`) **or**
- server rewrite rules (`/route → /route.html`)
…deep links are not portable.

### Recommended fix (host-agnostic)
Use **directory-style output**:
- Set `trailingSlash: true` in `next.config.mjs`.
- Ensure internal links continue to use clean URLs (they already do).
- Update deployment docs: `.htaccess` becomes optional (only for hosts that don’t serve `index.html` for directories or don’t normalize missing trailing slash).

### Proposed patch (illustrative)
`next.config.mjs`
```diff
 /** @type {import('next').NextConfig} */
 const nextConfig = {
   pageExtensions: ['ts', 'tsx', 'mdx'],
-  output: 'export'
+  output: 'export',
+  trailingSlash: true
 }
```

### Edge cases / notes
- Some hosts treat `/pillars/optimization` (no trailing slash) differently from `/pillars/optimization/`. Most static hosts will redirect or resolve to directory `index.html`. If yours does not, add a host-specific redirect rule (see “Optional host rewrites” below).

### Acceptance criteria
- Export output contains `out/pillars/optimization/index.html` (or equivalent for all routes).
- Direct navigation + refresh works for:
  - `/pillars/optimization/`
  - `/foundations/adam/`
  - `/concepts/optimizers/overview/`

### Optional host rewrites (only if your host needs them)
If a host doesn’t auto-resolve directory indexes or doesn’t normalize missing `/`, document and add one of:
- **Apache:** `public/.htaccess` to redirect missing trailing slash to slash form.
- **Netlify:** `public/_redirects`
- **Cloudflare Pages:** `_headers` / `_routes.json` (depending on config)

This should be explicitly documented as **host-specific**, not required for “pure static export”.

### Rollback plan
Revert `trailingSlash: true` and reinstate `.html` rewrite strategy (but that reintroduces host assumptions).

---

## Task CF-002 (P1): Add stable MDX heading IDs + fix KnowledgeGraph hashes

### Problem
- `components/KnowledgeGraph.tsx` routes include hashes:
  ```ts
  'SGD & Momentum': '/concepts/optimizers/overview#momentum',
  RMSProp: '/concepts/optimizers/overview#rmsprop',
  ```
- `next.config.mjs` uses:
  ```js
  rehypePlugins: [rehypeKatex]
  ```
  but no slugging plugin. Result: headings likely render without `id=...`, so `#momentum` won’t resolve.
- `pages/concepts/optimizers/overview.mdx` has `## Momentum` but **no `## RMSProp` section**.

### Root cause
No `rehype-slug`, and content doesn’t match the expected fragment identifiers.

### Fix
1) Add `rehype-slug` to MDX pipeline.
2) Add an `## RMSProp` section to `overview.mdx` or remove the `#rmsprop` link from the graph dataset and/or UI.

### Proposed patch
**1) Add dependency**
`package.json`
```diff
 "dependencies": {
   ...
   "rehype-katex": "^7.0.0",
+  "rehype-slug": "^6.0.0",
   "remark-math": "^6.0.0"
 }
```

**2) Wire into MDX**
`next.config.mjs`
```diff
 import createMDX from '@next/mdx'
 import remarkMath from 'remark-math'
 import rehypeKatex from 'rehype-katex'
+import rehypeSlug from 'rehype-slug'

 const withMDX = createMDX({
   extension: /\.mdx?$/,
   options: {
     remarkPlugins: [remarkMath],
-    rehypePlugins: [rehypeKatex]
+    rehypePlugins: [rehypeKatex, rehypeSlug]
   }
 })
```

**3) Add missing section to MDX**
`pages/concepts/optimizers/overview.mdx` (add near other optimizer family sections)
```mdx
## RMSProp

RMSProp keeps an exponential moving average of squared gradients and scales updates by the RMS magnitude:

$$
v_t = \beta v_{t-1} + (1-\beta) g_t^2,\quad
w_{t+1} = w_t - \eta \frac{g_t}{\sqrt{v_t} + \epsilon}
$$

Intuition: divide by a running estimate of “how big gradients usually are” per parameter.
```
With `rehype-slug`, this should produce `id="rmsprop"` and make `#rmsprop` work.

### Acceptance criteria
- Clicking the graph node “SGD & Momentum” navigates to `overview#momentum` and scrolls to the correct section.
- Clicking “RMSProp” navigates to `overview#rmsprop` and scrolls to the new section.
- No build-time MDX errors with the new plugin.

### Rollback plan
Remove `rehype-slug` and hashes in graph routes (but that degrades UX and linkability).

---

## Task CF-003 (P1): Baseline SEO + document language

### Problem
- No `next/head` usage in pages or layout (no global title/meta).
- No `pages/_document.tsx` to set `<html lang="...">`.

### Fix
1) Add `pages/_document.tsx` with `<Html lang="en">`.
2) Add a default `<Head>` block in `components/Layout.tsx` (site-wide title template + meta description + OG/Twitter).
3) Add per-page `<Head>` titles for key pages (`/`, pillars, foundations, vision, concepts) so the title is meaningful.

### Proposed patch (minimal baseline)
**1) Add document**
`pages/_document.tsx`
```tsx
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
```

**2) Add defaults in layout**
`components/Layout.tsx`
```tsx
import Head from 'next/head'
...
<Head>
  <title>Continuous Function</title>
  <meta name="description" content="Explorable explanations of deep learning mathematics through interactive visualizations." />
  <meta property="og:title" content="Continuous Function" />
  <meta property="og:description" content="Explorable explanations of deep learning mathematics through interactive visualizations." />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
</Head>
```

**3) Add per-page titles**
Example for `pages/index.tsx`:
```tsx
import Head from 'next/head'
...
<Head>
  <title>Continuous Function — The Mathematics of Learning</title>
</Head>
```
Do similarly for:
- `pages/pillars/*.tsx`
- `pages/foundations/index.tsx`
- `pages/foundations/[id].tsx` (title should include `concept.title`)
- `pages/concepts/optimizers/*.mdx` (optional: MDX can `import Head from 'next/head'` and set it at top)
- `pages/vision.mdx`

### Acceptance criteria
- HTML output includes correct `<title>` and `<meta name="description">`.
- `<html lang="en">` is present.
- Social previews have reasonable defaults.

### Rollback plan
Remove `_document.tsx` and revert Head additions (not recommended).

---

## Task CF-004 (P1): Harden KaTeX rendering in foundations concept pages

### Problem
`pages/foundations/[id].tsx` renders KaTeX HTML with:
```ts
trust: true
```
and falls back with:
```ts
return `<code>${latex}</code>`
```
This fallback injects raw, unescaped content into HTML.

### Root cause
Using `dangerouslySetInnerHTML` without escaping and enabling KaTeX trust.

### Fix
- Set `trust: false` (default-safe).
- Escape fallback content before injecting.
- Prefer avoiding `console.error` in render paths (optional).

### Proposed patch (illustrative)
`pages/foundations/[id].tsx` (near `renderLatex`)
```ts
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;')
   .replace(/</g, '&lt;')
   .replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;')
   .replace(/'/g, '&#39;')

const renderLatex = (latex: string, displayMode = false): string => {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
    })
  } catch {
    return `<code>${escapeHtml(latex)}</code>`
  }
}
```

### Acceptance criteria
- Rendering still works for existing `coreMath` and `coreEquation` strings in `data/foundationsData.ts`.
- No raw HTML injection possible via concept strings.

### Rollback plan
Revert to previous KaTeX options if any concept relies on trusted KaTeX features; if so, implement a limited `trust` function instead of global `true`.

---

## Task CF-005 (P1): Split `conceptVisualizationMap` into a pure data module

### Problem
`pages/foundations/[id].tsx` imports:
```ts
import { conceptVisualizationMap } from '../../components/foundations'
```
But `components/foundations/index.ts` is a barrel that also re-exports many visualization components. Even if tree-shaken, this is brittle coupling and can create unwanted import graphs.

### Fix
- Create `components/foundations/conceptVisualizationMap.ts` containing only:
  - `conceptVisualizationMap`
  - (optional) `sequenceVisualizationMap`, `geometricVisualizationMap`
- Update imports to use the new file.
- Keep `components/foundations/index.ts` as “export components only” (optional but recommended).

### Proposed structure
- `components/foundations/conceptVisualizationMap.ts`:
  ```ts
  export const conceptVisualizationMap: Record<string, string[]> = { ... }
  export const sequenceVisualizationMap = { ... }
  export const geometricVisualizationMap = { ... }
  ```
- Update:
  - `pages/foundations/[id].tsx` to import from `../../components/foundations/conceptVisualizationMap`

### Acceptance criteria
- No behavior changes; only import graph changes.
- Tree shaking and bundle splitting become more reliable.

### Rollback plan
Revert imports to barrel and remove new file.

---

## Task CF-006 (P1): Guard numeric helpers against degenerate inputs

### Problem
`lib/mathObjects.ts`:
```ts
return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin
```
and:
```ts
const stepX = (domain.x[1] - domain.x[0]) / resolution
```
If `(inMax - inMin) == 0` or `resolution <= 0`, consumers can render NaN/Infinity and break canvas/D3 logic.

### Fix
Make helpers total-function:
- `mapRange`: if denom is 0 or non-finite, return midpoint `(outMin+outMax)/2`.
- `generateGrid2D`: if `resolution <= 0`, return an empty array or a single point.

### Proposed patch (illustrative)
`lib/mathObjects.ts`
```ts
export function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const denom = inMax - inMin
  if (!Number.isFinite(denom) || Math.abs(denom) < 1e-12) {
    return (outMin + outMax) / 2
  }
  return ((value - inMin) * (outMax - outMin)) / denom + outMin
}

export function generateGrid2D(domain: { x: [number, number]; y: [number, number] }, resolution: number): Point2D[] {
  if (!Number.isFinite(resolution) || resolution <= 0) return []
  ...
}
```

### Acceptance criteria
- Heatmaps/time series render consistently even when all values are equal.
- No NaN coordinates in any canvas renderers.

### Rollback plan
Revert and add guards at call sites instead (worse ergonomics).

---

## Task CF-007 (P2): Define missing CSS variables used across pages/components

### Problem
Multiple files reference:
- `var(--accent)` (e.g. `pages/foundations/index.tsx`, `pages/foundations/[id].tsx`, various foundation viz)
- `var(--text-tertiary)` (e.g. `pages/foundations/[id].tsx`, `components/FoundationsGraph.tsx`, `components/foundations/KVCacheDashboard.tsx`)
But `styles/globals.css :root` defines neither.

### Fix
Define aliases in `styles/globals.css`:
- `--accent`: map to existing design token (recommend `--gradient-orange`).
- `--text-tertiary`: map to `--text-muted`.

### Proposed patch
`styles/globals.css` in `:root`:
```css
--accent: var(--gradient-orange);
--text-tertiary: var(--text-muted);
```

### Acceptance criteria
- No missing CSS variable fallbacks; accent styles render consistently.

### Rollback plan
Replace all uses of `--accent` and `--text-tertiary` with existing vars instead (more invasive).

---

## Task CF-008 (P2): Remove unintended route `pages/foundations/index 2.tsx`

### Problem
A filename with a space under `pages/` creates a real route:
- `pages/foundations/index 2.tsx` ⇒ `/foundations/index%202`
It also contains outdated copy (“17 concepts”).

### Fix
- Delete the file, or move it out of `pages/` into a non-routed directory like `drafts/` or `notes/`.

### Acceptance criteria
- No `/foundations/index%202` route in exported output.

### Rollback plan
Restore file if it was intentionally used (but then rename to a non-routed path).

---

## Task CF-009 (P2): Align “17 vs 32” concept messaging

### Problem
Data indicates 32 concepts:
- `data/foundationsData.ts` contains 32 concept IDs (and header comment says “32 concepts”)
But some UI copy says 17:
- `components/FoundationsGraph.tsx`:
  ```tsx
  17 core concepts explaining ...
  ```

### Fix options (pick one)
**Option A (simplest):** Standardize all copy to “32 concepts”.  
**Option B (more nuanced):** Explicitly frame “17 recommended core concepts” + “32 total concepts”, and ensure UI matches `studyOrder` vs `foundationsConcepts.length`.

Recommended: **Option B**, because `studyOrder` currently lists 17 concept IDs.

### Acceptance criteria
- No contradictory messaging on foundations landing/graph.

---

## Task CF-010 (Doc update): Make deployment docs match the new approach

### Problem
`DEPLOYMENT_GUIDE.md` currently instructs an Apache `.htaccess` rewrite strategy as if it’s required:
```md
Create out/.htaccess with this content (already included in the build):
```
…but it’s not source-controlled, and after `trailingSlash: true` it may not be needed.

### Fix
Update `DEPLOYMENT_GUIDE.md`:
- If adopting `trailingSlash: true`, explain that clean URLs work via `index.html` in folders.
- Keep `.htaccess` guidance as optional host-specific fallback.

### Acceptance criteria
- Docs describe the actual deployment mechanics and do not claim files exist when they don’t.

---

## Implementation Notes / Reviewer Checklist

- Ensure any change to URL strategy (`trailingSlash`) is reviewed for:
  - internal links in MDX and pages
  - any absolute asset paths (none observed)
  - external inbound links (may change canonical form)

- For MDX slugging:
  - verify heading slugs match expected fragments (`Momentum` → `#momentum`, `RMSProp` → `#rmsprop`)

- For KaTeX hardening:
  - confirm no concept strings rely on trusted KaTeX features/macros

- For visualization mapping refactor:
  - avoid circular imports and keep mapping data-only

---

## Optional Verification Plan (do later; don’t run during review)

- `npm ci`
- `npx tsc --noEmit`
- `npm run build`
- Serve `out/` with a static server and verify direct-load/refresh works:
  - `/pillars/optimization/`
  - `/foundations/adam/`
  - `/concepts/optimizers/overview/#momentum`
  - `/concepts/optimizers/overview/#rmsprop`
