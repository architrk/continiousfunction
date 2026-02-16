# Static Production Audit Report — Continuous Function

> Note (2026-02-06): This audit report is a historical snapshot. The repo has evolved since it was generated
> (Foundations now contains 100 concepts; `/foundations/[id]` math rendering now supports headings/rules/lists).
> Re-validate findings against current code before acting on them.

## 1) Executive Summary

**Overall readiness:** The repo is broadly aligned with **static export** (`output: 'export'`) and the **pages router**, with deterministic build-time data for `/foundations/[id]`. The main production risks are (a) **trailing-slash portability on static hosts**, (b) a **latent XSS footgun** in KaTeX fallback HTML, and (c) a couple of **animation loops without unmount cancellation** in interactive visualizations. Evidence: `next.config.mjs:19-22`, `pages/foundations/[id].tsx:715-744`, `pages/foundations/[id].tsx:127-138`, `components/foundations/DPOViz.tsx:199-221`, `components/foundations/ScalingLawsViz.tsx:429-453`.

**Top 5 risks**
1. **P0 (Med confidence):** Trailing-slash static-hosting portability risk (links typically omit `/` while export emits `/.../`). Evidence: `next.config.mjs:20-22`, `components/Layout.tsx:30-44`, `pages/foundations/index.tsx:66-67`, `components/KnowledgeGraph.tsx:8-9`.
2. **P1 (High confidence):** XSS footgun: KaTeX error fallback injects unescaped HTML inside `dangerouslySetInnerHTML`. Evidence: `pages/foundations/[id].tsx:127-138`, `pages/foundations/[id].tsx:326-341`.
3. **P2 (High confidence):** `coreMath` strings contain Markdown headers/rules that `MathContent` does not render, causing visible raw markup. Evidence: `data/foundationsData.ts:2825-2878`, `pages/foundations/[id].tsx:123-159`.
4. **P2 (High confidence):** `requestAnimationFrame` loops without cancellation in at least 2 viz components (potential state-updates-after-unmount / wasted work). Evidence: `components/foundations/DPOViz.tsx:199-221`, `components/foundations/ScalingLawsViz.tsx:429-453`.
5. **P3 (High confidence):** Doc drift: architecture docs still say 33 concepts, but code/data shows 34. Evidence: `ARCHITECTURE_MAP.md:18-20`, `data/foundationsData.ts:1-2`, `pages/index.tsx:26-31`.

---

## 2) Route Map

| Route | Source file | Key deps (major imports) | Build-time vs client-time notes |
|---|---|---|---|
| `/` | `pages/index.tsx` | `components/GradientDescentPlayground` (`pages/index.tsx:3`) | Static HTML generated at build; interactive playground hydrates client-side. Evidence: `pages/index.tsx:13-78`. |
| `/foundations` | `pages/foundations/index.tsx` | `data/foundationsData` (`pages/foundations/index.tsx:6`), `components/FoundationsGraph` via `next/dynamic` with `ssr:false` (`pages/foundations/index.tsx:9-13`) | Graph is **client-only** and gated behind `mounted` (no SSR render). Evidence: `pages/foundations/index.tsx:55-63`, `pages/foundations/index.tsx:91-99`. |
| `/foundations/[id]` | `pages/foundations/[id].tsx` | `getStaticPaths/getStaticProps` (`pages/foundations/[id].tsx:715-744`), `data/foundationsData` (`pages/foundations/[id].tsx:6`), `data/visualizationMappings` (`pages/foundations/[id].tsx:7`), many viz via `next/dynamic` `ssr:false` (`pages/foundations/[id].tsx:16-67`), KaTeX runtime (`pages/foundations/[id].tsx:5`) | **All concept pages built at export time**. Visualizations are **client-only** chunks; KaTeX rendering runs during render (build + client hydration). Evidence: `pages/foundations/[id].tsx:16-67`, `pages/foundations/[id].tsx:121-199`, `pages/foundations/[id].tsx:715-744`. |
| `/graph` | `pages/graph.tsx` | `components/KnowledgeGraph` via `next/dynamic` `ssr:false` (`pages/graph.tsx:4-7`) | Graph is client-only. Evidence: `pages/graph.tsx:1-17`. |
| `/pillars` | `pages/pillars/index.tsx` | Static data + `next/link` (`pages/pillars/index.tsx:1-55`) | Build-time static HTML; no dynamic data. Evidence: `pages/pillars/index.tsx:57-107`. |
| `/pillars/optimization` | `pages/pillars/optimization.tsx` | `components/ExplorableLayout` (`pages/pillars/optimization.tsx:5`), `components/ExplorableSection` (`pages/pillars/optimization.tsx:6`), multiple viz via `React.lazy` + `Suspense` (`pages/pillars/optimization.tsx:3`, `pages/pillars/optimization.tsx:13-22`), one `next/dynamic ssr:false` (`pages/pillars/optimization.tsx:18`) | Initial `activeSection` is `null`, so visual panel starts as a placeholder (no viz on first render). Evidence: `components/ExplorableLayout.tsx:92-105`, `pages/pillars/optimization.tsx:36-227`. |
| `/pillars/sequence-modeling` | `pages/pillars/sequence-modeling.tsx` | `ExplorableLayout/Section` + `React.lazy` viz (`pages/pillars/sequence-modeling.tsx:5-22`) | Same pattern: initial `activeSection:null` placeholder; viz load after scroll activation. Evidence: `components/ExplorableLayout.tsx:92-105`, `components/ExplorableSection.tsx:29-55`. |
| `/pillars/generative-physics` | `pages/pillars/generative-physics.tsx` | `ExplorableLayout/Section` + `React.lazy` (`pages/pillars/generative-physics.tsx:5-13`) | Uses client-side `requestAnimationFrame` with cleanup in local simulation path. Evidence: `pages/pillars/generative-physics.tsx:79-131`. |
| `/pillars/geometric-dl` | `pages/pillars/geometric-dl.tsx` | `ExplorableLayout/Section` + canvas drawing (`pages/pillars/geometric-dl.tsx:3-13`, `pages/pillars/geometric-dl.tsx:29-144`) | Canvas draw is in `useEffect` (SSR-safe). Evidence: `pages/pillars/geometric-dl.tsx:29-144`. |
| `/pillars/mech-interp` | `pages/pillars/mech-interp.tsx` | `ExplorableLayout/Section` + `React.lazy` (`pages/pillars/mech-interp.tsx:5-15`) | Uses `Math.random()` in `useMemo`; currently not rendered on initial `activeSection:null` placeholder. Evidence: `pages/pillars/mech-interp.tsx:24-50`, `components/ExplorableLayout.tsx:92-105`. |
| `/vision` | `pages/vision.mdx` | MDX + `next/head` (`pages/vision.mdx:1-7`) | MDX compiled at build with `remark-math` + `rehype-katex`. Evidence: `next.config.mjs:6-14`. |
| `/concepts/optimizers/overview` | `pages/concepts/optimizers/overview.mdx` | MDX imports `GradientDescentPlayground` (`pages/concepts/optimizers/overview.mdx:1-3`) | MDX compiled at build; interactive component hydrates client-side. Evidence: `pages/concepts/optimizers/overview.mdx:1-112`. |
| `/concepts/optimizers/adamw` | `pages/concepts/optimizers/adamw.mdx` | MDX + `next/head` (`pages/concepts/optimizers/adamw.mdx:1-7`) | Static MDX page with math via rehype-katex. Evidence: `next.config.mjs:6-14`. |
| `/concepts/optimizers/muon` | `pages/concepts/optimizers/muon.mdx` | MDX imports `MuonConceptualDemo` (`pages/concepts/optimizers/muon.mdx:1-7`, `components/MuonConceptualDemo.tsx:32-125`) | Static MDX + interactive SVG demo. Evidence: `components/MuonConceptualDemo.tsx:45-124`. |

---

## 3) Foundations Dependency Map (`/foundations/[id]`)

**Build-time SSG generation**
1. `getStaticPaths` enumerates **all concept IDs** from `foundationsConcepts` and sets `fallback:false`. Evidence: `pages/foundations/[id].tsx:715-721`, `data/foundationsData.ts:983-987`.
2. `getStaticProps`:
   - Reads `params.id`
   - Looks up `conceptIndex` and `concept`
   - Returns `notFound:true` if missing
   - Computes `prevConcept` / `nextConcept` based on ordering in `foundationsConcepts`. Evidence: `pages/foundations/[id].tsx:723-744`.

**Runtime render (hydrated client + static HTML)**
- Concept data source-of-truth: `data/foundationsData.ts` exports `foundationsConcepts`, `Concept`, category labels, and derived dependents helpers. Evidence: `pages/foundations/[id].tsx:6`, `data/foundationsData.ts:927-942`, `data/foundationsData.ts:983-1007`, `data/foundationsData.ts:3079-3104`.
- Visualization selection is **data-driven**:
  - `vizNames = conceptVisualizationMap[concept.id] || []` (pure data mapping). Evidence: `pages/foundations/[id].tsx:239-240`, `data/visualizationMappings.ts:1-6`.
  - `vizMap` maps string names to dynamically imported React components (`ssr:false`). Evidence: `pages/foundations/[id].tsx:16-67`, `pages/foundations/[id].tsx:69-119`.
  - Unknown names are silently dropped (`filter(Boolean)`). Evidence: `pages/foundations/[id].tsx:239-240`.
- Math rendering pipeline on this route is **custom KaTeX** (not MDX):
  - `MathContent` splits paragraphs and injects KaTeX HTML via `dangerouslySetInnerHTML`. Evidence: `pages/foundations/[id].tsx:121-199`.
  - `coreEquation` is rendered via `katex.renderToString` and injected. Evidence: `pages/foundations/[id].tsx:324-343`.
- Connections:
  - “Prerequisites” come from `concept.prereqs` and are linked by ID. Evidence: `pages/foundations/[id].tsx:383-404`.
  - “Enables” is computed by `getDependents(concept.id)` derived from prereqs. Evidence: `pages/foundations/[id].tsx:405-426`, `data/foundationsData.ts:3079-3104`.
- Next-moves navigation:
  - `NextMovesPanel` uses `getConceptRelations` (typed semantic relations) and renders links to related concepts. Evidence: `pages/foundations/[id].tsx:8`, `components/foundations/NextMovesPanel.tsx:3-10`, `data/foundationsData.ts:3063-3077`.

---

## 4) Findings Table (P0–P3 + confidence)

| ID | Severity | Confidence | Area | Finding | Evidence | Recommended fix strategy |
|---|---:|---|---|---|---|---|
| F-1 | P0 | Med | Static export / routing | Potential broken deep-links on strict static hosts due to `trailingSlash:true` but internal navigation uses non-trailing-slash paths. | `next.config.mjs:20-22`, `components/Layout.tsx:30-44`, `pages/foundations/index.tsx:66-67` | Normalize link generation (either always include trailing `/` in internal paths, or disable `trailingSlash`). Validate on target host. |
| F-2 | P1 | High | Security / content | XSS footgun: KaTeX fallback returns unescaped HTML inside `dangerouslySetInnerHTML`. | `pages/foundations/[id].tsx:127-138`, `pages/foundations/[id].tsx:326-341` | Escape fallback content or render fallback as text nodes (no HTML injection). Keep `trust:false`. |
| F-3 | P2 | High | Content correctness | `coreMath` includes Markdown headers/rules that `MathContent` does not parse → raw markup in UI. | `data/foundationsData.ts:2825-2878`, `pages/foundations/[id].tsx:123-159` | Use a real Markdown/MDX renderer for `coreMath` (with math support) or constrain `coreMath` format to what `MathContent` supports. |
| F-4 | P2 | High | Viz lifecycle | `requestAnimationFrame` loop lacks cancellation in `DPOViz`. | `components/foundations/DPOViz.tsx:199-221` | Store RAF id in a ref and cancel in effect cleanup; guard setState on unmount. |
| F-5 | P2 | High | Viz lifecycle | `requestAnimationFrame` loop lacks cancellation in `ScalingLawsViz`. | `components/foundations/ScalingLawsViz.tsx:429-453` | Same as F-4. |
| F-6 | P3 | Med | Viz lifecycle | `MoERoutingViz` uses GSAP timeline stored in `routeTimelineRef` but no explicit unmount cleanup; also has a bare `setTimeout`. | `components/foundations/MoERoutingViz.tsx:256-360`, `components/foundations/MoERoutingViz.tsx:208-214` | Add unmount cleanup to `kill()` timeline and clear pending timeouts. |
| F-7 | P3 | High | Maintainability / docs | Docs drift: architecture map references 33 concepts, but site/data uses 34. | `ARCHITECTURE_MAP.md:18-20`, `data/foundationsData.ts:1-2`, `pages/index.tsx:26-31` | Update docs to match current concept count and directory usage. |
| F-8 | P3 | High | Type hygiene | `types.d.ts` declares `react-d3-graph` but repo uses a custom D3 graph; dependency not in `package.json`. | `types.d.ts:1`, `components/ForceGraph.tsx:1-4`, `package.json:10-30` | Remove stale type shim or add the actual dependency if still needed. |

---

## 5) Detailed Findings

### A) Static export & routing

**F-1 (P0, Med): trailing-slash portability risk**
- The build is configured for static export + trailing slashes. Evidence: `next.config.mjs:19-22`.
- Internal navigation commonly uses paths without a trailing slash:
  - Header nav: `/foundations`, `/pillars`, `/graph`, `/vision`. Evidence: `components/Layout.tsx:30-44`.
  - Programmatic navigation: `router.push(\`/foundations/${conceptId}\`)`. Evidence: `pages/foundations/index.tsx:65-67`.
  - Graph click uses `window.location.href = \`/foundations/${conceptId}\``. Evidence: `components/KnowledgeGraph.tsx:5-10`.
- Impact: On some static hosts, `/route` may not resolve to `/route/` + `index.html` without rewrite/redirect support. **Requires hosting/runtime to confirm** (see Appendix B).

### B) Routing/data correctness

**SSG correctness for `/foundations/[id]` (High confidence)**
- All concept pages are enumerated with `fallback:false`. Evidence: `pages/foundations/[id].tsx:715-721`.
- Missing concept IDs are handled via `notFound:true`. Evidence: `pages/foundations/[id].tsx:728-730`.

**Silent visualization mapping failures (P3, High confidence)**
- Mapping selects visualization names from `conceptVisualizationMap` and then drops missing entries via `.filter(Boolean)`. Evidence: `pages/foundations/[id].tsx:239-240`.
- Impact: A typo in `data/visualizationMappings.ts` can silently remove a viz from the page without obvious error.

**Graph data integrity (High confidence; spot-checked by static comparisons)**
- `conceptRelations` IDs match defined concept IDs (no unknown `from/to`). Evidence: `data/foundationsData.ts:20-26`, `data/foundationsData.ts:3063-3077`.
- `NODE_ID_MAP` maps graph node labels to valid foundation concept IDs (used for navigation). Evidence: `data/conceptGraphData.ts:128-164`, `components/KnowledgeGraph.tsx:5-10`.

### C) Visualization lifecycle & safety (D3/GSAP/Three)

**Client-only containment on concept pages is strong**
- All foundation visualizations on `/foundations/[id]` are dynamically imported with `ssr:false`. Evidence: `pages/foundations/[id].tsx:16-67`.
- This prevents SSR crashes from browser-only dependencies in those components on the concept pages.

**F-4 (P2, High): `DPOViz` RAF loop has no cancellation**
- The animation effect schedules `requestAnimationFrame(animate)` but does not store/cancel the frame on cleanup. Evidence: `components/foundations/DPOViz.tsx:199-221`.
- Impact: potential updates after unmount + wasted CPU when navigating away mid-animation.

**F-5 (P2, High): `ScalingLawsViz` RAF loop has no cancellation**
- Same pattern as above. Evidence: `components/foundations/ScalingLawsViz.tsx:429-453`.

**F-6 (P3, Med): GSAP timeline cleanup gaps in `MoERoutingViz`**
- GSAP timeline stored in a ref and killed only when starting a new route animation. Evidence: `components/foundations/MoERoutingViz.tsx:256-360`.
- There is also a bare `setTimeout` without cleanup in a prediction outcome branch. Evidence: `components/foundations/MoERoutingViz.tsx:208-214`.
- Impact: low-to-moderate leak risk if navigating away mid-animation or mid-timeout.

**Examples of good cleanup patterns present elsewhere**
- Three.js loop cancels RAF and disposes resources in cleanup (`ParallelTransportViz`). Evidence: `components/foundations/ParallelTransportViz.tsx:538-562`.
- RAF loop cancellation present (`DiffusionScoreViz`). Evidence: `components/foundations/DiffusionScoreViz.tsx:449-492`.
- D3 force simulations are stopped on cleanup in graph components. Evidence: `components/ForceGraph.tsx:214-218`, `components/FoundationsGraph.tsx:261-264`.

### D) Content + math rendering pipeline correctness

**MDX math pipeline is configured (High confidence)**
- MDX is enabled and uses `remark-math` + `rehype-katex` with `trust:false`, `throwOnError:false`. Evidence: `next.config.mjs:6-14`.
- MDX pages include `<Head>` titles and use inline/display math. Evidence: `pages/vision.mdx:4-7`, `pages/concepts/optimizers/overview.mdx:5-7`.

**KaTeX CSS is globally loaded**
- `_app.tsx` imports KaTeX CSS globally. Evidence: `pages/_app.tsx:1-4`.

**F-3 (P2, High): `coreMath` is not Markdown-rendered on concept pages**
- Concept pages use a custom `MathContent` renderer that only supports:
  - paragraph splitting
  - `$$...$$`, `$...$`, `**bold**`, and backticks. Evidence: `pages/foundations/[id].tsx:123-199`.
- At least one concept’s `coreMath` includes Markdown structure (`---`, `##`, `###`) which will render as literal text. Evidence: `data/foundationsData.ts:2825-2878`.

### E) Security

**F-2 (P1, High): XSS footgun via fallback HTML**
- `MathContent` injects KaTeX HTML into the DOM with `dangerouslySetInnerHTML`. Evidence: `pages/foundations/[id].tsx:145-153`, `pages/foundations/[id].tsx:176-185`.
- On KaTeX error, the fallback returns `<code>${latex}</code>` (unescaped). Evidence: `pages/foundations/[id].tsx:135-138`.
- `coreEquation` injection has the same unescaped fallback. Evidence: `pages/foundations/[id].tsx:326-341`.
- Current practical exposure is limited because the strings come from repo-controlled data (`data/foundationsData.ts:983-1015`), but the pattern is unsafe if content sources expand.

### F) UX / Accessibility / SEO

**Baseline a11y improvements exist**
- Skip link exists in layout and is styled to appear on focus. Evidence: `components/Layout.tsx:20-22`, `styles/globals.css:1933-1948`.
- Visible focus states are defined for keyboard users. Evidence: `styles/globals.css:1923-1930`.

**SEO is mostly baseline**
- Global default `<title>` and meta description exist. Evidence: `components/Layout.tsx:12-19`.
- Most routes define per-page titles via `next/head` (examples). Evidence: `pages/index.tsx:16-18`, `pages/foundations/index.tsx:71-73`, `pages/graph.tsx:12-14`, `pages/vision.mdx:4-6`.

**Potential gaps (requires runtime/audit-by-interaction)**
- Many interactive SVG/canvas visualizations may not expose semantic equivalents (keyboard/ARIA). This is inherently hard to fully validate without interaction; see Appendix B.

### G) Perf / maintainability

**Doc drift (F-7, P3, High)**
- `ARCHITECTURE_MAP.md` still references 33 concepts in multiple places. Evidence: `ARCHITECTURE_MAP.md:18-20`, `ARCHITECTURE_MAP.md:75-92`.
- The codebase itself advertises 34 concepts. Evidence: `data/foundationsData.ts:1-2`, `pages/index.tsx:26-31`, `pages/foundations/index.tsx:77-80`.

**Stale type shim (F-8, P3, High)**
- `types.d.ts` declares `react-d3-graph` but code uses custom D3 `ForceGraph`. Evidence: `types.d.ts:1`, `components/ForceGraph.tsx:1-4`.

---

## Suggested fixes (no edits performed)

1. **Normalize internal routing for static export**
   - Decide: either (a) keep `trailingSlash:true` and ensure internal links include trailing `/`, or (b) set `trailingSlash:false` and validate host behavior. Evidence: `next.config.mjs:20-22`, `components/Layout.tsx:30-44`.
2. **Remove unsafe HTML fallbacks in KaTeX rendering**
   - Escape fallback strings or render fallback as text nodes; avoid interpolating untrusted content into HTML. Evidence: `pages/foundations/[id].tsx:135-138`, `pages/foundations/[id].tsx:338-340`.
3. **Unify `coreMath` rendering**
   - Either enforce a strict “KaTeX-only + minimal inline formatting” format for `coreMath`, or render it with a Markdown pipeline consistent with MDX (with math support). Evidence: `pages/foundations/[id].tsx:123-159`, `data/foundationsData.ts:2825-2878`, `next.config.mjs:6-14`.
4. **Fix animation cleanup in RAF-driven viz**
   - Add RAF cancellation in `DPOViz` and `ScalingLawsViz`. Evidence: `components/foundations/DPOViz.tsx:199-221`, `components/foundations/ScalingLawsViz.tsx:429-453`.
5. **Add unmount cleanup for GSAP timelines/timeouts**
   - Kill `MoERoutingViz` timeline on unmount and clear pending timeout. Evidence: `components/foundations/MoERoutingViz.tsx:256-360`, `components/foundations/MoERoutingViz.tsx:208-214`.
6. **Update docs and type shims**
   - Refresh concept counts in docs and remove stale `react-d3-graph` type shim. Evidence: `ARCHITECTURE_MAP.md:18-20`, `data/foundationsData.ts:1-2`, `types.d.ts:1`.

---

## 6) Appendix A: File Inventory (reviewed)

### Root / config
- `next.config.mjs` — MDX + KaTeX settings; static export + trailing slash. Evidence: `next.config.mjs:1-24`.
- `package.json` — Next 15 + React 18 + D3/GSAP/Three dependencies. Evidence: `package.json:10-30`.
- `package-lock.json` — dependency lockfile (not semantically audited beyond presence). Evidence: `package-lock.json:1` (requires opening for line refs).
- `tsconfig.json` — includes `**/*.mdx` in TS project; `skipLibCheck:true`. Evidence: `tsconfig.json:6-20`.
- `next-env.d.ts` — Next TS references (includes `.next/types/routes.d.ts` reference). Evidence: `next-env.d.ts:1-6`.
- `types.d.ts` — declares `react-d3-graph` (stale). Evidence: `types.d.ts:1`.

### Pages (routes + shell)
- `pages/_app.tsx` — global shell: loads KaTeX CSS + global CSS + fonts via `next/font`. Evidence: `pages/_app.tsx:1-38`.
- `pages/_document.tsx` — base HTML document with `lang="en"`. Evidence: `pages/_document.tsx:1-13`.
- `pages/index.tsx` — homepage + `GradientDescentPlayground`. Evidence: `pages/index.tsx:1-78`.
- `pages/foundations/index.tsx` — foundations index; client-only graph via `next/dynamic ssr:false`. Evidence: `pages/foundations/index.tsx:8-13`, `pages/foundations/index.tsx:91-99`.
- `pages/foundations/[id].tsx` — SSG concept page; KaTeX runtime; client-only viz via mapping. Evidence: `pages/foundations/[id].tsx:16-67`, `pages/foundations/[id].tsx:239-240`, `pages/foundations/[id].tsx:715-744`.
- `pages/graph.tsx` — graph route; client-only `KnowledgeGraph` via `ssr:false`. Evidence: `pages/graph.tsx:4-7`.
- `pages/pillars/index.tsx` — pillars index. Evidence: `pages/pillars/index.tsx:1-107`.
- `pages/pillars/optimization.tsx` — explorable pillar using `ExplorableLayout/Section`, local RAF sim (with cleanup), plus lazy-loaded foundation viz. Evidence: `pages/pillars/optimization.tsx:3-22`, `pages/pillars/optimization.tsx:58-123`.
- `pages/pillars/sequence-modeling.tsx` — explorable pillar; lazy-loaded foundation viz. Evidence: `pages/pillars/sequence-modeling.tsx:3-23`.
- `pages/pillars/generative-physics.tsx` — explorable pillar; local particle sim uses RAF with cleanup. Evidence: `pages/pillars/generative-physics.tsx:79-131`.
- `pages/pillars/geometric-dl.tsx` — explorable pillar; canvas draw in effect. Evidence: `pages/pillars/geometric-dl.tsx:29-144`.
- `pages/pillars/mech-interp.tsx` — explorable pillar; generates simulated states (uses randomness) but rendered under scroll control. Evidence: `pages/pillars/mech-interp.tsx:24-50`.
- `pages/vision.mdx` — MDX vision doc with math. Evidence: `pages/vision.mdx:1-36`.
- `pages/concepts/optimizers/overview.mdx` — MDX; imports `GradientDescentPlayground`. Evidence: `pages/concepts/optimizers/overview.mdx:1-112`.
- `pages/concepts/optimizers/adamw.mdx` — MDX AdamW. Evidence: `pages/concepts/optimizers/adamw.mdx:1-110`.
- `pages/concepts/optimizers/muon.mdx` — MDX Muon; imports `MuonConceptualDemo`. Evidence: `pages/concepts/optimizers/muon.mdx:1-60`.

### Data
- `data/foundationsData.ts` — source-of-truth concept data (34), relations, graph generator, dependents derivation. Evidence: `data/foundationsData.ts:1-2`, `data/foundationsData.ts:927-942`, `data/foundationsData.ts:3027-3061`, `data/foundationsData.ts:3079-3104`.
- `data/visualizationMappings.ts` — pure data: concept ID → visualization component names. Evidence: `data/visualizationMappings.ts:1-6`.
- `data/conceptGraphData.ts` — knowledge graph nodes/links + node→concept ID map. Evidence: `data/conceptGraphData.ts:4-57`, `data/conceptGraphData.ts:128-164`.

### Lib
- `lib/mathObjects.ts` — math types/utilities and palette used across visualizations. Evidence: `lib/mathObjects.ts:3-166`.

### Core components (shared)
- `components/Layout.tsx` — global layout, header nav, default SEO, skip link. Evidence: `components/Layout.tsx:9-51`.
- `components/ExplorableLayout.tsx` — two-column explorable layout + context; `activeSection` starts `null`. Evidence: `components/ExplorableLayout.tsx:85-105`, `components/ExplorableLayout.tsx:110-134`.
- `components/ExplorableSection.tsx` — IntersectionObserver scroll activation with cleanup. Evidence: `components/ExplorableSection.tsx:29-55`.
- `components/FoundationsGraph.tsx` — D3 force/subway map; stops simulation on cleanup. Evidence: `components/FoundationsGraph.tsx:68-110`, `components/FoundationsGraph.tsx:261-264`.
- `components/ForceGraph.tsx` — custom D3 graph; stops simulation on cleanup. Evidence: `components/ForceGraph.tsx:52-58`, `components/ForceGraph.tsx:214-218`.
- `components/KnowledgeGraph.tsx` — wraps `ForceGraph` and navigates via `window.location.href`. Evidence: `components/KnowledgeGraph.tsx:4-10`.
- `components/GradientDescentPlayground.tsx` — interactive optimizer demo (timers + cleanup present in countdown effect). Evidence: `components/GradientDescentPlayground.tsx:314-342`.
- `components/MuonConceptualDemo.tsx` — interactive SVG demo with labeled slider. Evidence: `components/MuonConceptualDemo.tsx:45-124`.
- `components/KernelHeatmap.tsx` — canvas heatmap renderer. Evidence: `components/KernelHeatmap.tsx:65-158`.
- `components/PhasePortrait2D.tsx` — canvas vector-field renderer. Evidence: `components/PhasePortrait2D.tsx:36-186`.
- `components/TimeSeriesPlot.tsx` — canvas time-series plot; guards empty data. Evidence: `components/TimeSeriesPlot.tsx:41-54`.
- `components/StateTimeline.tsx` — canvas activation timeline; guards empty data. Evidence: `components/StateTimeline.tsx:35-41`.

### Foundation visualization components (client-only on concept pages)
- `components/foundations/index.ts` — barrel exports + re-export mappings. Evidence: `components/foundations/index.ts:4-58`.
- Selected lifecycle highlights (non-exhaustive; see Findings for issues):
  - `components/foundations/DPOViz.tsx` — RAF cleanup missing (F-4). Evidence: `components/foundations/DPOViz.tsx:199-221`.
  - `components/foundations/ScalingLawsViz.tsx` — RAF cleanup missing (F-5). Evidence: `components/foundations/ScalingLawsViz.tsx:429-453`.
  - `components/foundations/MoERoutingViz.tsx` — GSAP timeline without unmount cleanup; bare timeout. Evidence: `components/foundations/MoERoutingViz.tsx:256-360`, `components/foundations/MoERoutingViz.tsx:208-214`.
  - `components/foundations/ParallelTransportViz.tsx` — Three.js loop with cleanup and disposal. Evidence: `components/foundations/ParallelTransportViz.tsx:538-562`.
  - `components/foundations/EquivarianceViz.tsx` — GSAP tweens killed in cleanup. Evidence: `components/foundations/EquivarianceViz.tsx:201-240`.

(Other `components/foundations/*.tsx` files were included in scope and scanned for timers/RAF/GSAP/Three usage; see Detailed Findings section C for the specific leak-risk items that rose to “finding” level.)

### Other components/visualizations
- `components/visualizations/**` — present but not wired from the main routes (pillar pages currently lazy-load from `components/foundations/*`). Evidence: `pages/pillars/sequence-modeling.tsx:11-22`, `pages/pillars/optimization.tsx:13-22`.

### Styles
- `styles/globals.css` — global theme + accessibility focus/skip-link styling. Evidence: `styles/globals.css:9-65`, `styles/globals.css:1923-1948`.

### Docs cross-checked (doc drift)
- `ARCHITECTURE_MAP.md` — stale concept count and some structural notes. Evidence: `ARCHITECTURE_MAP.md:18-20`, `ARCHITECTURE_MAP.md:89-92`.

---

## 7) Appendix B: “Requires runtime/build to confirm” questions list

1. **Trailing slash behavior on the actual host:** Does requesting `/foundations` reliably resolve to `/foundations/` (and similarly for `/foundations/<id>` vs `/foundations/<id>/`)? Evidence for configuration: `next.config.mjs:20-22`.
2. **Static export output structure:** Verify the exported `out/` structure matches the host’s routing expectations (directory indexes vs file paths). Requires running build/export.
3. **`next/font/google` in the build environment:** Confirm builds succeed in CI/offline environments (fonts are fetched at build time by Next’s font optimization). Evidence it’s used: `pages/_app.tsx:2-28`.
4. **`React.lazy` + `Suspense` behavior under static export:** Pillar pages rely on lazy-loaded components appearing after IntersectionObserver activation; validate there are no hydration or chunk-loading issues. Evidence: `pages/pillars/sequence-modeling.tsx:3-23`, `components/ExplorableSection.tsx:29-55`.
5. **KaTeX rendering correctness:** Confirm `MathContent` produces the intended formatting for all `coreMath` strings and that KaTeX CSS matches the visual design. Evidence: `pages/foundations/[id].tsx:121-199`, `pages/_app.tsx:3`.
6. **Interactive viz performance/memory on navigation:** Verify no lingering timers/RAF/GSAP timelines after navigating between routes repeatedly. Static analysis evidence of at least two missing RAF cancellations: `components/foundations/DPOViz.tsx:199-221`, `components/foundations/ScalingLawsViz.tsx:429-453`.
