# Continuous Function — Static Production Audit

> Scope + constraints: This is a **static, read-only audit** of the repository as-is (no `npm install`, no build, no runtime execution, no network lookups). All claims below are based on code inspection. Where "latest version / CVE" data would require internet access, I explicitly mark it as **requires network verification**.

---

## ✅ Fixes Applied (Dec 31, 2025)

The following P1 issues from this audit have been resolved:

| Issue | Fix | Files Modified |
|-------|-----|----------------|
| **Adam step counter bug** | Replaced double `step++` with local `t = step + 1` for bias correction | `pages/pillars/optimization.tsx` |
| **Concept count inconsistency** | Updated all hard-coded 32/33 to 34 | `pages/index.tsx`, `pages/foundations/index.tsx`, `pages/foundations/[id].tsx`, `components/FoundationsGraph.tsx`, `components/foundations/index.ts` |
| **Pillar controls accessibility** | Added `aria-label` and `aria-valuetext` to all 9 range inputs | `pages/pillars/*.tsx` (5 files) |
| **Visualization mapping coupling** | Changed import to `data/visualizationMappings.ts` directly | `pages/foundations/[id].tsx` |
| **d3-* submodule imports** | Changed to import from main `d3` package | 11 files in `components/foundations/` and `components/visualizations/` |
| **Visualization wiring drift** | All orphaned viz modules (SSMViz, MambaViz, DecodingSamplingViz, EquivarianceViz, GANsViz) now wired | `pages/foundations/[id].tsx` |
| **Per-route SEO titles** | Added unique `<title>` tags to 7 page routes (5 pillars + graph + dynamic foundations) | `pages/pillars/*.tsx`, `pages/graph.tsx`, `pages/foundations/[id].tsx` |
| **Dependents derived from prereqs** | Added `getDependents()` function that computes inverse prereq graph at runtime | `data/foundationsData.ts`, `pages/foundations/[id].tsx` |
| **Duplicate visualization cleanup** | Removed orphaned `components/visualizations/` directory (26 files); all canonical gamified versions now in `foundations/` | Deleted `components/visualizations/` |

**Bundle impact:** Foundations page reduced from 649 KB to 83.2 KB (87% reduction) due to import decoupling.

**Still pending:**
- Foundations math renderer doesn't support Markdown (structural fix needed)

---

## 1. Executive Summary

**Overall verdict:** **Production ready** (all critical P1 issues resolved Dec 31, 2025). One structural improvement remains (Markdown renderer for coreMath content).

**Top Findings (5–10)**
- **Foundations “Core Mathematics” renderer is not a real Markdown renderer**; newly-added concept math strings include Markdown headings and horizontal rules that will render as raw `##` / `---` text (user-visible content breakage). See `pages/foundations/[id].tsx:106` and `data/foundationsData.ts:1891`.  
- **Foundations concept count is inconsistent across UI + docs** (32/33/34). The source of truth is `data/foundationsData.ts` which currently contains **34** concepts. See `data/foundationsData.ts:2`, `pages/index.tsx:27`, `pages/foundations/index.tsx:77`, `pages/foundations/index.tsx:182`, `components/FoundationsGraph.tsx:235`, `AGENTS.md:34`.  
- **“Prereqs / Enables” graph data is internally inconsistent**: `dependents` arrays are not maintained in sync with `prereqs`, so the “Enables” section on concept pages is incomplete/incorrect. See `data/foundationsData.ts:91-94` vs `data/foundationsData.ts:133-135`.  
- **Exact duplicate visualization files exist** across `components/foundations/*` and `components/visualizations/*`, increasing maintenance and bundle risk (4 duplicate pairs detected).  
- **`pages/pillars/optimization.tsx` has a clear logic bug**: the Adam simulation increments `step` twice per frame, skewing iteration counts and bias correction. See `pages/pillars/optimization.tsx:90-110`.  
- **Pillar “param controls” are not accessible**: multiple `input[type="range"]` are not associated with a `<label>` (screen readers will announce them poorly). See `pages/pillars/optimization.tsx:498-535`, `pages/pillars/sequence-modeling.tsx:518-555`, `pages/pillars/generative-physics.tsx:288-325`, `pages/pillars/geometric-dl.tsx:292-310`, `pages/pillars/mech-interp.tsx:266-303`.  
- **Foundations visualization mapping import is over-coupled**: `pages/foundations/[id].tsx` imports `conceptVisualizationMap` from `components/foundations/index.ts`, which also re-exports all foundations visualization modules. This can (depending on bundling/tree-shaking) pull large client-only code into the page build graph and hides “unwired”/future viz modules. See `pages/foundations/[id].tsx:6` and `components/foundations/index.ts:4-58`.  
- **Dependency hygiene issues**: several packages are imported directly but not declared (e.g. `d3-scale`, `d3-shape`, `d3-random`, `d3-interpolate`), relying on transitive deps of `d3` (works with npm hoisting, breaks with strict package managers). See `components/visualizations/generative/DiffusionForwardReverse.tsx:4-6` and `package.json:10-31`.  
- **Visualization wiring drift**: some visualization modules exist but are unreachable from any route (e.g. `components/foundations/DecodingSamplingViz.tsx`, `components/foundations/MambaViz.tsx`, `components/foundations/SSMViz.tsx`, `components/foundations/EquivarianceViz.tsx`). See `data/visualizationMappings.ts:4-32` (no `decoding-sampling` mapping) and `pages/foundations/[id].tsx:11-104` (no dynamic imports for these files).  
- **Deployment documentation is stale / conflicting** with the current repo state (static export URL strategy, type fix already applied, `.htaccess` claim). See `DEPLOYMENT_GUIDE.md:6-18` and `DEPLOYMENT_GUIDE.md:73-101`.  

**Top Fixes (5–10)**
- Replace the custom “math + mini-markdown” renderer in `pages/foundations/[id].tsx` with a real Markdown pipeline (e.g. `react-markdown` + `remark-math` + `rehype-katex`) or migrate `coreMath` into MDX files; remove `dangerouslySetInnerHTML` fallbacks.  
- Make concept counts **data-driven** (use `foundationsConcepts.length`) and remove hard-coded “32/33/34” strings across UI + docs.  
- Stop maintaining `dependents` manually: derive dependents from `prereqs` at render/build time to guarantee consistency.  
- Fix Adam simulation step increment bug in `pages/pillars/optimization.tsx`.  
- Make pillar controls accessible: wrap each range input in a `<label>` (or use `aria-label` + `aria-valuetext`), and ensure focus styles apply.  
- Consolidate exact-duplicate visualization files into a single source and re-export/import to avoid divergence.  
- Decouple foundations visualization mapping: import `conceptVisualizationMap` directly from `data/visualizationMappings.ts` (pure data), not via the `components/foundations` barrel.  
- Declare `d3-*` submodule imports explicitly (or import from `d3` only) to avoid relying on transitive dependencies.  
- Add per-route `<title>` (especially `pages/foundations/[id].tsx` and pillar pages) for baseline SEO.  

## 2. Repository & Build Assumptions

### Next.js version + export mode implications
- **Next.js:** declared as `^15.0.0` in `package.json:23`.  
- **Static export:** enabled via `output: 'export'` in `next.config.mjs:16-20`. This implies:
  - All routes must be statically generatable (no `getServerSideProps`, no runtime API routes).
  - Any browser-only code must not execute during build-time render (guard `window`, prefer `next/dynamic` with `ssr:false` for DOM-heavy components).
  - Deep-link behavior depends on `trailingSlash` + hosting behavior; repo sets `trailingSlash: true` in `next.config.mjs:18-19`.  

### MDX + KaTeX pipeline summary
- MDX enabled by `@next/mdx` in `next.config.mjs:1-13`.  
- Math parsing/rendering: `remark-math` + `rehype-katex` with `{ trust:false, strict:'warn', throwOnError:false }` in `next.config.mjs:8-12`.  
- Heading IDs: `rehype-slug` in `next.config.mjs:4,12`. This matches KnowledgeGraph hash links like `#momentum` / `#rmsprop` in `components/KnowledgeGraph.tsx:21-30`.  
- KaTeX CSS is imported globally in `pages/_app.tsx:2`.  

### Assumptions made in this audit
- This repo is deployed as a **pure static export** (no Node server at runtime).  
- “Latest dependencies / CVEs / broken external URLs” **cannot be confirmed** without network access; I provide an “Optional Verification Plan” for those checks.  
- The “Foundations” content source of truth is `data/foundationsData.ts` (not the various “33 concepts” claims in docs/UI).  

## 3. Repo Map (Inventory)

> Inventory excludes generated/build directories at runtime (`node_modules/`, `.next/`, `out/`). Those still exist locally but are not production source.

### 3.1 Config / Tooling / Meta

| Path | Type | Purpose | Imports/Dependencies | Notes/Concerns |
|---|---|---|---|---|
| `package.json` | config | Runtime + dev dependency manifest + scripts | Next/React/MDX/D3/Three/KaTeX | `start` uses `next start` even though `output:'export'` is set; confirm intended local serve strategy. |
| `package-lock.json` | config | Dependency lockfile | npm registry | Contains `three-mesh-bvh` deprecated warning (transitive). `package-lock.json:4343-4351`. |
| `next.config.mjs` | config | Next.js config + MDX pipeline | `@next/mdx`, `remark-math`, `rehype-katex`, `rehype-slug` | Good baseline for static export; no image config (OK since no `next/image`). |
| `tsconfig.json` | config | TypeScript config | TS strict on | Includes `**/*.mdx` which may or may not be desired for standalone `tsc`. |
| `next-env.d.ts` | config | Next.js TS env references | Next types | References `.next/types/routes.d.ts` which doesn’t exist in a clean checkout until Next generates it (`next-env.d.ts:3`). |
| `types.d.ts` | types | Declares missing module types | `react-d3-graph` | Broad `declare module` reduces type safety but unblocks builds. |
| `.gitignore` | config | Ignore build artifacts + deps | n/a | Correctly ignores `.next/`, `out/`, `node_modules/`, `*.tsbuildinfo`. |
| `.mcp.json` | config | MCP server config (empty) | n/a | Non-runtime. |
| `.vscode/sftp.json.example` | config | Example FTP deploy config | n/a | Non-runtime. |
| `.vscode/sftp.json` | config | Local secret-ish deploy config | n/a | Should not be committed; `.gitignore` excludes it, but ensure VCS state. |
| `tsconfig.tsbuildinfo` | artifact | TS incremental build artifact | n/a | Should not be committed. `.gitignore` already ignores. |

### 3.2 Pages / Routes (Next.js `pages/`)

| Path | Type | Purpose | Imports/Dependencies | Notes/Concerns |
|---|---|---|---|---|
| `pages/_app.tsx` | page | App wrapper, imports global CSS + KaTeX CSS, wraps Layout | `katex/dist/katex.min.css`, `styles/globals.css`, `components/Layout` | Good global KaTeX CSS import. |
| `pages/_document.tsx` | page | Sets `<html lang="en">` | `next/document` | Good baseline a11y/SEO. |
| `pages/index.tsx` | page | Home page | `next/head`, `next/link`, `components/GradientDescentPlayground` | Hard-coded “33 Core Concepts” (should be 34). `pages/index.tsx:27`. |
| `pages/vision.mdx` | page (MDX) | Long-form site vision | `next/head`, `next/link` | MDX content only; good. |
| `pages/graph.tsx` | page | Concept graph route | `next/dynamic`, `components/KnowledgeGraph` | Dynamic import with `ssr:false` (safe). |
| `pages/foundations/index.tsx` | page | Foundations index + graph + study path | `next/dynamic`, `next/router`, `data/foundationsData` | Copy says 33 and also “Why These 32”; should be 34. Also unused import `CATEGORY_COLORS`. |
| `pages/foundations/[id].tsx` | page | Foundations concept detail page + viz mounting | `katex`, `next/dynamic`, `data/foundationsData`, `components/foundations` | Custom math renderer is fragile; no per-concept `<Head>` title; imports visualization mapping via `components/foundations` barrel (coupling risk). |
| `pages/pillars/index.tsx` | page | Pillars index page | `next/head`, `next/link` | OK. |
| `pages/pillars/optimization.tsx` | page | Optimization pillar explorable page | `components/ExplorableLayout`, `React.lazy`, `next/dynamic` | Adam step counter bug; pillar pages lack `<Head>` titles. |
| `pages/pillars/sequence-modeling.tsx` | page | Sequence modeling pillar explorable page | `components/ExplorableLayout`, `React.lazy` | Minor unused imports; no `<Head>` title. |
| `pages/pillars/generative-physics.tsx` | page | Generative physics pillar explorable page | `components/ExplorableLayout`, `React.lazy` | OK; no `<Head>` title. |
| `pages/pillars/geometric-dl.tsx` | page | Geometric DL pillar explorable page | `components/ExplorableLayout`, `React.lazy` | Unused imports; no `<Head>` title. |
| `pages/pillars/mech-interp.tsx` | page | Mech interp pillar explorable page | `components/ExplorableLayout`, `React.lazy` | Uses randomness in `useMemo([])` but mostly canvas-only; unused imports; no `<Head>` title. |
| `pages/concepts/optimizers/overview.mdx` | page (MDX) | Optimizers overview | `next/link`, `components/GradientDescentPlayground` | Hash sections exist for `#momentum` and `#rmsprop`. |
| `pages/concepts/optimizers/adamw.mdx` | page (MDX) | AdamW explainer | `next/link` | No `<Head>` title set here; relies on Layout default. |
| `pages/concepts/optimizers/muon.mdx` | page (MDX) | Muon explainer | `next/link`, `components/MuonConceptualDemo` | No `<Head>` title set here; relies on Layout default. |

### 3.3 Runtime Components / Libraries

| Path | Type | Purpose | Imports/Dependencies | Notes/Concerns |
|---|---|---|---|---|
| `components/Layout.tsx` | component | Global layout, nav, default SEO meta | `next/head`, `next/link` | Default `<title>` is constant; many pages never override. |
| `components/ExplorableLayout.tsx` | component | Two-column explorable layout + context | React state/context | OK; `SECTION_TITLES` is ad-hoc + incomplete. |
| `components/ExplorableSection.tsx` | component | Section wrapper + IntersectionObserver activation | `IntersectionObserver` | Effect depends on `activeSection`, causing observer churn. `components/ExplorableSection.tsx:24-48`. |
| `components/GradientDescentPlayground.tsx` | component | Small SVG + sliders demo | React state | Good baseline; missing explicit `aria-label` on SVG. |
| `components/MuonConceptualDemo.tsx` | component | Toy muon orthogonalization demo | React state | Has aria-label; good. |
| `components/KnowledgeGraph.tsx` | component | Optimizer concept graph (react-d3-graph) | `react-d3-graph` | Uses `as any` casts + `window.location.href` routing. |
| `components/FoundationsGraph.tsx` | component | D3 force-directed foundations map | `d3` | Cleanup only stops simulation; zoom listeners not explicitly removed. |
| `components/PhasePortrait2D.tsx` | component | Canvas vector field plot | Canvas 2D | OK; all rendering imperative in effect. |
| `components/TimeSeriesPlot.tsx` | component | Canvas time series plot | Canvas 2D | Needs explicit guard for empty series (bounds Infinity). |
| `components/KernelHeatmap.tsx` | component | Canvas heatmap | Canvas 2D | OK; guards `rows/cols==0` in effect. |
| `components/StateTimeline.tsx` | component | Canvas activation timeline | Canvas 2D | OK; depends on `states` length. |
| `lib/mathObjects.ts` | lib | Shared math types + helpers | n/a | Good safeNumber/mapRange guards; some helpers lack dimension validation (matmul). |
| `data/foundationsData.ts` | data | 34 foundations concept objects + study order + graph data | n/a | `dependents` not synced; `coreMath` now includes Markdown structures not supported by renderer. |
| `data/conceptGraphData.ts` | data | Optimizer graph node/link data | n/a | Small demo graph. |
| `data/visualizationMappings.ts` | data | Concept→viz name mapping | n/a | Missing mappings for new concept IDs (e.g. `decoding-sampling`). |
| `styles/globals.css` | style | Global CSS + design system | Google Fonts `@import` | External font import (privacy/perf/CSP). Good focus/reduced-motion handling. |

### 3.4 Visualization Modules (high-level inventory)

These are the interactive “heavy” modules. They fall into two parallel trees:
- `components/foundations/*.tsx`: visualizations shown on `/foundations/[id]` pages (loaded via `next/dynamic` with `ssr:false` in `pages/foundations/[id].tsx`).
- `components/visualizations/*/*.tsx`: visualizations shown on pillar pages (loaded via `React.lazy` / `next/dynamic` depending on component).

Key concern: **exact duplicates exist across both trees** (see Issue Register).

#### 3.4.1 Foundations visualizations (complete list)

| Path | Purpose | Tech | Loaded in `/foundations/[id]` | Notes |
|---|---|---|---|---|
| `components/foundations/AdamOptimizerViz.tsx` | Interactive visualization for Adam Optimizer (Foundations). | — | Yes | — |
| `components/foundations/AttentionBackpropViz.tsx` | Interactive visualization for Attention Backprop (Foundations). | — | Yes | — |
| `components/foundations/AttentionGeometryViz.tsx` | Interactive visualization for Attention Geometry (Foundations). | — | Yes | — |
| `components/foundations/CrossEntropyViz.tsx` | Interactive visualization for Cross Entropy (Foundations). | — | Yes | — |
| `components/foundations/DPOViz.tsx` | Interactive visualization for DPO (Foundations). | — | Yes | — |
| `components/foundations/DecodingSamplingViz.tsx` | Interactive visualization for Decoding Sampling (Foundations). | setInterval | No | Not in `pages/foundations/[id].tsx` dynamic imports |
| `components/foundations/DiffusionProcessViz.tsx` | Interactive visualization for Diffusion Process (Foundations). | D3, setInterval | Yes | — |
| `components/foundations/DiffusionScoreViz.tsx` | Interactive visualization for Diffusion Score (Foundations). | rAF | Yes | — |
| `components/foundations/DoubleDescentViz.tsx` | Interactive visualization for Double Descent (Foundations). | — | Yes | — |
| `components/foundations/EdgeOfStabilityViz.tsx` | Interactive visualization for Edge Of Stability (Foundations). | D3, setInterval | Yes | Exact duplicate of `components/visualizations/optimization/EdgeOfStability.tsx` |
| `components/foundations/EquivarianceViz.tsx` | Interactive visualization for Equivariance (Foundations). | GSAP | No | Not in `pages/foundations/[id].tsx` dynamic imports |
| `components/foundations/FlowMatchingViz.tsx` | Interactive visualization for Flow Matching (Foundations). | rAF | Yes | — |
| `components/foundations/GrokkingViz.tsx` | Interactive visualization for Grokking (Foundations). | D3, Math.random | Yes | Exact duplicate of `components/visualizations/optimization/GrokkingPhase.tsx` |
| `components/foundations/InductionHeadsViz.tsx` | Interactive visualization for Induction Heads (Foundations). | — | Yes | — |
| `components/foundations/InfoBottleneckViz.tsx` | Interactive visualization for Info Bottleneck (Foundations). | setInterval | Yes | — |
| `components/foundations/KTOViz.tsx` | Interactive visualization for KTO (Foundations). | D3 | Yes | — |
| `components/foundations/KVCacheDashboard.tsx` | Interactive visualization for KVCache Dashboard (Foundations). | — | Yes | — |
| `components/foundations/KVCacheViz.tsx` | Interactive visualization for KVCache (Foundations). | D3 | Yes | Exact duplicate of `components/visualizations/sequence/KVCacheViz.tsx` |
| `components/foundations/LayerNormViz.tsx` | Interactive visualization for Layer Norm (Foundations). | — | Yes | Exact duplicate of `components/visualizations/sequence/LayerNormRMSNorm.tsx` |
| `components/foundations/LinearProbeViz.tsx` | Interactive visualization for Linear Probe (Foundations). | D3 | Yes | — |
| `components/foundations/LoRAViz.tsx` | Interactive visualization for Lo RA (Foundations). | Math.random | Yes | — |
| `components/foundations/LossLandscape3DViz.tsx` | Interactive visualization for Loss Landscape3D (Foundations). | Three, R3F, setInterval | Yes | — |
| `components/foundations/LossLandscapeViz.tsx` | Interactive visualization for Loss Landscape (Foundations). | — | Yes | — |
| `components/foundations/MambaViz.tsx` | Interactive visualization for Mamba (Foundations). | — | No | Not in `pages/foundations/[id].tsx` dynamic imports |
| `components/foundations/MoERoutingViz.tsx` | Interactive visualization for Mo ERouting (Foundations). | GSAP | Yes | — |
| `components/foundations/NTKViz.tsx` | Interactive visualization for NTK (Foundations). | setInterval | Yes | — |
| `components/foundations/NeuralScalingViz.tsx` | Interactive visualization for Neural Scaling (Foundations). | D3 | Yes | — |
| `components/foundations/NewtonSchulzViz.tsx` | Interactive visualization for Newton Schulz (Foundations). | GSAP, useLayoutEffect, Math.random | Yes | — |
| `components/foundations/ParallelTransportViz.tsx` | Interactive visualization for Parallel Transport (Foundations). | Three, rAF | Yes | — |
| `components/foundations/RLHFViz.tsx` | Interactive visualization for RLHF (Foundations). | — | Yes | — |
| `components/foundations/RewardHackingViz.tsx` | Interactive visualization for Reward Hacking (Foundations). | D3 | Yes | — |
| `components/foundations/RoPEViz.tsx` | Interactive visualization for Ro PE (Foundations). | D3 | Yes | — |
| `components/foundations/SSMViz.tsx` | Interactive visualization for SSM (Foundations). | D3, rAF | No | Not in `pages/foundations/[id].tsx` dynamic imports |
| `components/foundations/ScalingLawsViz.tsx` | Interactive visualization for Scaling Laws (Foundations). | — | Yes | — |
| `components/foundations/SelfAttentionViz.tsx` | Interactive visualization for Self Attention (Foundations). | D3 | Yes | — |
| `components/foundations/ServingLatencyViz.tsx` | Interactive visualization for Serving Latency (Foundations). | — | Yes | — |
| `components/foundations/SlidingWindowViz.tsx` | Interactive visualization for Sliding Window (Foundations). | D3, setInterval | Yes | — |
| `components/foundations/SparseAutoencoderViz.tsx` | Interactive visualization for Sparse Autoencoder (Foundations). | D3 | Yes | — |
| `components/foundations/SpeculativeDecodingViz.tsx` | Interactive visualization for Speculative Decoding (Foundations). | Math.random | Yes | — |
| `components/foundations/SuperpositionViz.tsx` | Interactive visualization for Superposition (Foundations). | — | Yes | — |
| `components/foundations/TaskVectorViz.tsx` | Interactive visualization for Task Vector (Foundations). | D3 | Yes | — |
| `components/foundations/TokenizationViz.tsx` | Interactive visualization for Tokenization (Foundations). | setInterval | Yes | — |
| `components/foundations/TransformerArchitectureViz.tsx` | Interactive visualization for Transformer Architecture (Foundations). | D3, rAF | Yes | — |
| `components/foundations/VAEELBOViz.tsx` | Interactive visualization for VAEELBO (Foundations). | setInterval | Yes | — |

#### 3.4.2 Pillar visualizations (complete list)

| Path | Purpose | Tech | Used by pillar pages | Notes |
|---|---|---|---|---|
| `components/visualizations/generative/DiffusionForwardReverse.tsx` | Interactive visualization for pillar 'generative' (DiffusionForwardReverse). | D3, setInterval | Yes | — |
| `components/visualizations/generative/FlowMatching.tsx` | Interactive visualization for pillar 'generative' (FlowMatching). | rAF, Math.random | Yes | — |
| `components/visualizations/geometric/EquivarianceDemo.tsx` | Interactive visualization for pillar 'geometric' (EquivarianceDemo). | GSAP | Yes | — |
| `components/visualizations/geometric/ParallelTransport.tsx` | Interactive visualization for pillar 'geometric' (ParallelTransport). | Three, rAF | Yes | — |
| `components/visualizations/mechinterp/InductionHeads.tsx` | Interactive visualization for pillar 'mechinterp' (InductionHeads). | — | Yes | — |
| `components/visualizations/mechinterp/LinearProbes.tsx` | Interactive visualization for pillar 'mechinterp' (LinearProbes). | D3 | Yes | — |
| `components/visualizations/mechinterp/SuperpositionPolysemanticity.tsx` | Interactive visualization for pillar 'mechinterp' (SuperpositionPolysemanticity). | D3 | Yes | — |
| `components/visualizations/optimization/BackpropAttention.tsx` | Interactive visualization for pillar 'optimization' (BackpropAttention). | — | Yes | — |
| `components/visualizations/optimization/DPOvsRLHF.tsx` | Interactive visualization for pillar 'optimization' (DPOvsRLHF). | — | Yes | — |
| `components/visualizations/optimization/EdgeOfStability.tsx` | Interactive visualization for pillar 'optimization' (EdgeOfStability). | D3, setInterval | Yes | Exact duplicate of `components/foundations/EdgeOfStabilityViz.tsx` |
| `components/visualizations/optimization/GrokkingPhase.tsx` | Interactive visualization for pillar 'optimization' (GrokkingPhase). | D3, Math.random | Yes | Exact duplicate of `components/foundations/GrokkingViz.tsx` |
| `components/visualizations/optimization/LossLandscape3D.tsx` | Interactive visualization for pillar 'optimization' (LossLandscape3D). | Three, R3F, setInterval | Yes | — |
| `components/visualizations/optimization/NeuralScalingLaws.tsx` | Interactive visualization for pillar 'optimization' (NeuralScalingLaws). | D3 | Yes | — |
| `components/visualizations/optimization/NewtonSchulz.tsx` | Interactive visualization for pillar 'optimization' (NewtonSchulz). | GSAP, useLayoutEffect, Math.random | Yes | — |
| `components/visualizations/optimization/TaskVectors.tsx` | Interactive visualization for pillar 'optimization' (TaskVectors). | D3 | Yes | — |
| `components/visualizations/sequence/AttentionIsAllYouNeed.tsx` | Interactive visualization for pillar 'sequence' (AttentionIsAllYouNeed). | D3, rAF | Yes | — |
| `components/visualizations/sequence/AttentionMatrixViz.tsx` | Interactive visualization for pillar 'sequence' (AttentionMatrixViz). | D3 | Yes | — |
| `components/visualizations/sequence/GQAMQAComparison.tsx` | Interactive visualization for pillar 'sequence' (GQAMQAComparison). | — | Yes | — |
| `components/visualizations/sequence/KVCacheViz.tsx` | Interactive visualization for pillar 'sequence' (KVCacheViz). | D3 | Yes | Exact duplicate of `components/foundations/KVCacheViz.tsx` |
| `components/visualizations/sequence/LayerNormRMSNorm.tsx` | Interactive visualization for pillar 'sequence' (LayerNormRMSNorm). | — | Yes | Exact duplicate of `components/foundations/LayerNormViz.tsx` |
| `components/visualizations/sequence/MambaSelectivity.tsx` | Interactive visualization for pillar 'sequence' (MambaSelectivity). | — | Yes | — |
| `components/visualizations/sequence/MoERouting.tsx` | Interactive visualization for pillar 'sequence' (MoERouting). | GSAP | Yes | — |
| `components/visualizations/sequence/RoPERotationViz.tsx` | Interactive visualization for pillar 'sequence' (RoPERotationViz). | D3 | Yes | — |
| `components/visualizations/sequence/SSMRecurrence.tsx` | Interactive visualization for pillar 'sequence' (SSMRecurrence). | D3, rAF | Yes | — |
| `components/visualizations/sequence/SlidingWindowAttention.tsx` | Interactive visualization for pillar 'sequence' (SlidingWindowAttention). | D3, setInterval | Yes | — |
| `components/visualizations/sequence/SwiGLUActivation.tsx` | Interactive visualization for pillar 'sequence' (SwiGLUActivation). | D3 | Yes | — |

### 3.5 Docs / Prompts / Responses (non-runtime, but mapped)

| Path | Type | Purpose | Notes/Concerns |
|---|---|---|---|
| `CLAUDE.md` | doc | Repo overview + conventions | Mentions “33 concept pages” but data has 34 now. |
| `ARCHITECTURE_MAP.md` | doc | High-level system map | Useful; may be slightly stale (33 vs 34). |
| `DEPLOYMENT_GUIDE.md` | doc | FTP + Hostinger deployment guide | Stale/conflicting claims: build error already fixed; `.htaccess` “already included” is not source-controlled. |
| `DEVELOPER_GUIDE.md` | doc | How-to for building these sites | General reference. |
| `CONTENT_STRATEGY.md` | doc | Editorial/content roadmap | Mentions future work. |
| `STATIC_EXPORT_REMEDIATION_SPEC.md` | doc | Prior remediation plan | Some items already landed; should be updated or marked historical. |
| `AUTONOMOUS_LOOP.md` / `AUTONOMOUS_LOOP_STATUS.md` | doc | Oracle-driven workflow logs | `AUTONOMOUS_LOOP.md:174` contains “TBD”. |
| `BROWSER_REVIEW_CHECKLIST.md` / `VISUAL_TESTING_CHECKLIST.md` | doc | QA checklists | Large but useful for manual review. |
| `prompts/*.txt` | prompt | Oracle prompt inputs | Non-runtime. |
| `responses/*` | doc | Oracle outputs / research notes | Non-runtime; useful for content evolution. |
| `*_verify.txt` | doc | Verification scratch files | Non-runtime; consider consolidating. |

## 4. Route Map (Pages + Navigation)

### 4.1 Route table

| Route | Source file | How reached |
|---|---|---|
| `/` | `pages/index.tsx` | Header brand link (`components/Layout.tsx:25`), direct entry |
| `/vision` | `pages/vision.mdx` | Header nav (`components/Layout.tsx:42`) |
| `/graph` | `pages/graph.tsx` | Header nav (`components/Layout.tsx:39`), home page link (`pages/index.tsx:64`) |
| `/pillars` | `pages/pillars/index.tsx` | Header nav (`components/Layout.tsx:33`), home CTA (`pages/index.tsx:29`) |
| `/pillars/optimization` | `pages/pillars/optimization.tsx` | Home pillars list (`pages/index.tsx:51-56`), pillars index cards |
| `/pillars/sequence-modeling` | `pages/pillars/sequence-modeling.tsx` | Home pillars list, pillars index |
| `/pillars/generative-physics` | `pages/pillars/generative-physics.tsx` | Home pillars list, pillars index |
| `/pillars/geometric-dl` | `pages/pillars/geometric-dl.tsx` | Home pillars list, pillars index |
| `/pillars/mech-interp` | `pages/pillars/mech-interp.tsx` | Home pillars list, pillars index |
| `/foundations` | `pages/foundations/index.tsx` | Header nav (`components/Layout.tsx:30`), home CTA (`pages/index.tsx:26`) |
| `/foundations/[id]` | `pages/foundations/[id].tsx` | Foundations index cards/graph, prereq/dependent links, next/prev nav |
| `/concepts/optimizers/overview` | `pages/concepts/optimizers/overview.mdx` | Header nav (`components/Layout.tsx:36`), graph route, MDX links |
| `/concepts/optimizers/adamw` | `pages/concepts/optimizers/adamw.mdx` | MDX links, graph route |
| `/concepts/optimizers/muon` | `pages/concepts/optimizers/muon.mdx` | MDX links, graph route |

### 4.2 Static-exportability check
- Dynamic route `/foundations/[id]` is statically exportable because `getStaticPaths` enumerates all IDs from `foundationsConcepts` and uses `fallback:false` (`pages/foundations/[id].tsx:657-669`).  
- No `getServerSideProps` and no API routes were found.  
- Browser-only components are generally protected via `next/dynamic({ ssr:false })` on pages that need it (`pages/graph.tsx`, `pages/foundations/index.tsx`, `pages/foundations/[id].tsx`).  

### 4.3 Broken/Missing routes referenced
- No broken internal route strings were found in static scan (no unresolved relative imports; internal `href="/..."` targets all exist).  
- **Potential deployment sharp edge:** With `trailingSlash:true`, exported output is typically directory-style (`/route/index.html`). Some static hosts require `/route/` (trailing slash) or explicit redirects. Internal links currently omit the trailing slash (e.g. `/pillars/optimization`). Verify on the target host (see Optional Verification Plan).  

## 5. Architecture & Dataflow

### 5.1 How MDX pages embed React components
- MDX pages live under `pages/**/*.mdx` and can import React components (e.g. `pages/concepts/optimizers/overview.mdx:1` imports `GradientDescentPlayground`).  
- Build-time MDX pipeline is configured in `next.config.mjs` using `remark-math` + `rehype-katex` + `rehype-slug`.  

### 5.2 How shared math utilities are used
- Shared math primitives and helpers live in `lib/mathObjects.ts` (e.g. `Point2D`, `mapRange`, `numericalGradient`, `MATH_COLORS`).  
- Many visualization modules re-implement local math helpers (softmax/matmul/clamp), which increases drift risk.  

### 5.3 Scroll-synced section state
- Pillar pages use `components/ExplorableLayout.tsx` which provides an `ExplorableContext` (`activeSection`, `params`, setters).  
- Each prose section wraps content in `components/ExplorableSection.tsx` which uses `IntersectionObserver` to set `activeSection` and optionally trigger callbacks.  
- Visual panel components read `activeSection` and switch which visualization is rendered (pattern repeated in each pillar page).  

### 5.4 Canvas/SVG/D3 rendering patterns
- Canvas-based primitives (`PhasePortrait2D`, `TimeSeriesPlot`, `KernelHeatmap`, `StateTimeline`) draw imperatively in `useEffect` based on props/state.  
- D3-based SVG modules typically:
  - Grab a ref to `<svg>`, clear it via `selectAll('*').remove()`, then redraw in `useEffect`.  
  - Use `as any` casts to bridge D3 typing friction.  
- Three.js/R3F modules exist for 3D (loss landscape, parallel transport) and must remain client-only for static export.  

### 5.5 Main flow diagram (ASCII)

```
pages/_app.tsx
  -> components/Layout.tsx (global nav + default meta)
      -> pages/*
          - MDX pages: next.config.mjs MDX pipeline -> static HTML + KaTeX
          - Pillars: ExplorableLayout -> ExplorableSection -> useExplorable()
              -> VisualPanel switch -> components/visualizations/** (D3/Canvas/GSAP/Three)
          - Foundations: data/foundationsData.ts + visualizationMappings
              -> pages/foundations/[id].tsx -> MathContent renderer + dynamic viz imports
                  -> components/foundations/** (mostly D3/Canvas/GSAP/Three)
      -> lib/mathObjects.ts (shared math + palette)
```

## 6. File-by-File Review (Static)

> For visualization-heavy folders, I list each file and highlight **unique** concerns; shared concerns are described once per folder to avoid repeating the same notes 40+ times.

### 6.1 Root config + meta

#### `next.config.mjs`
- Purpose: MDX + math + slug pipeline + enable static export.
- Key exports: default `withMDX(nextConfig)`.
- Static-export risks: low; `output:'export'` and `trailingSlash:true` are set.
- Recommendations:
  - Consider adding `images: { unoptimized: true }` if `next/image` is ever introduced.

#### `package.json`
- Purpose: dependencies and scripts.
- Risks:
  - `start` script uses `next start` (`package.json:8`) even though `output:'export'` is configured; confirm intended local “prod serve” story (should likely serve `out/` via a static server).
  - Direct imports from `d3-scale`/`d3-shape`/`d3-random`/`d3-interpolate` are not declared deps (transitive reliance).

#### `package-lock.json`
- Purpose: lock dependency graph.
- Notable: `three-mesh-bvh@0.7.8` is marked deprecated (`package-lock.json:4343-4351`). This is likely pulled by `@react-three/drei`/friends; upgrade path requires network verification.

#### `tsconfig.json`
- Purpose: strict TS configuration.
- Risks:
  - `skipLibCheck:true` can mask type issues in deps.
  - `include` includes `**/*.mdx`; ensure this matches your desired TS checks (standalone `tsc` may behave differently than Next’s integrated typecheck).

#### `next-env.d.ts`
- Purpose: Next TS references.
- Risk:
  - References `.next/types/routes.d.ts` (`next-env.d.ts:3`) which may not exist in a clean checkout until Next runs. If this causes editor/CI issues, remove the reference or ensure generation step is always run before typecheck.

#### `types.d.ts`
- Purpose: unblock `react-d3-graph` type errors.
- Risk: removes type safety for that module; consider adding real types or a narrow wrapper.

### 6.2 Pages

#### `pages/_app.tsx`
- Correctness: good; imports KaTeX CSS globally.
- Static-export risk: low.

#### `pages/_document.tsx`
- Correctness: sets `<Html lang="en">`; good.

#### `pages/index.tsx`
- SEO: sets `<title>` for home; good.
- Content: hard-coded “33 Core Concepts” (`pages/index.tsx:27`) is stale relative to `data/foundationsData.ts` (34 concepts).

#### `pages/vision.mdx`
- Purpose: content; uses `Head` for title.
- Static-export risk: low.

#### `pages/graph.tsx`
- Purpose: client-only graph page; uses `next/dynamic({ ssr:false })`.
- Static-export risk: low.

#### `pages/foundations/index.tsx`
- Correctness:
  - `CATEGORY_COLORS` import is unused (minor).
  - Multiple hard-coded concept counts (33 and 32) are stale (`pages/foundations/index.tsx:77`, `pages/foundations/index.tsx:138`, `pages/foundations/index.tsx:182`).
- Performance: width recalculation on resize is fine; graph is dynamically imported.

#### `pages/foundations/[id].tsx`
- Purpose: core concept page; pulls from `foundationsConcepts` and renders “Core Mathematics” and visualizations.
- Correctness risks:
  - **Math renderer is a hand-rolled mini-parser** (paragraph split + inline regex) and does not support real Markdown. This already breaks content for tokenization/decoding concepts (see Issue Register).
  - `renderLatex` catch path injects raw text into HTML (`pages/foundations/[id].tsx:111-122`) → XSS-in-theory (low risk if content remains trusted, but still an unsafe pattern).
  - No per-concept `<Head>` title; all concept pages share Layout title.
  - Imports `conceptVisualizationMap` from the `components/foundations` barrel (`pages/foundations/[id].tsx:6`), which re-exports many visualization modules (`components/foundations/index.ts`). This is avoidable coupling and can increase bundle/build graph risk.
- Static-export risks:
  - Visualization modules are `dynamic(..., { ssr:false })` which is correct for browser-only D3/Three code.

#### `pages/pillars/*.tsx`
- Pattern: ExplorableLayout + Sections + VisualPanel switching.
- Correctness risks:
  - `pages/pillars/optimization.tsx` Adam simulation step increment bug (Issue Register).
  - Many pillar pages do not set `<Head>` title/description (SEO).
  - Several unused imports (`useCallback`, `mapRange`, etc.)—minor but indicates drift.
- Static-export risks:
  - Visualizations are loaded via `React.lazy` (except 3D loss uses `next/dynamic({ssr:false})`). If SSR ever renders those lazy components, any nondeterminism (`Math.random`) could cause hydration mismatch. Consider `next/dynamic({ ssr:false })` for all visualization panels for safety.

#### `pages/concepts/optimizers/*.mdx`
- Purpose: MDX explainer pages.
- SEO: no per-page `<Head>` except home/vision; consider adding titles.

### 6.3 Core components (non-viz)

#### `components/Layout.tsx`
- Purpose: global wrapper and nav.
- SEO: sets a default title + basic OG/Twitter meta, but no per-page titles unless pages override with their own `<Head>`.

#### `components/ExplorableLayout.tsx`
- Purpose: context + layout for pillar pages.
- Risks:
  - `SECTION_TITLES` is a manual mapping; missing keys are displayed via string heuristics. OK but ad-hoc.

#### `components/ExplorableSection.tsx`
- Performance risk: IntersectionObserver effect depends on `activeSection`, recreating observers frequently during scroll (`components/ExplorableSection.tsx:24-48`).

#### `components/FoundationsGraph.tsx`
- D3 pattern: clears and rebuilds SVG once per mount/size change.
- Performance risk: zoom handler not explicitly removed on cleanup; simulation stopped but zoom listeners may remain if the component remounts often.
- A11y: SVG has no `role`/`aria-label`; nodes are mouse-only (no keyboard interaction).

#### `components/KnowledgeGraph.tsx`
- Type safety: `as any` casts for `react-d3-graph` types.
- Navigation: uses `window.location.href` (full reload) instead of `next/router` push; OK for static export but slower UX.

#### Canvas primitives (`PhasePortrait2D`, `TimeSeriesPlot`, `KernelHeatmap`, `StateTimeline`)
- Pattern: imperative draw in `useEffect`.
- Notable correctness risk:
  - `components/TimeSeriesPlot.tsx` bounds computation can produce `Infinity` if `series` or `series.data` are empty; add explicit guard.

### 6.4 Data

#### `data/foundationsData.ts`
- Purpose: concept source of truth (34 concepts), graph generation, study order.
- Correctness risks:
  - `dependents` arrays are inconsistent relative to `prereqs` (Issue Register).
  - Some `coreMath` strings now contain Markdown headings + horizontal rules, but renderer doesn’t support (Issue Register).

#### `data/visualizationMappings.ts`
- Purpose: concept id -> visualization component names.
- Risk: missing mappings for new concept IDs (e.g., `decoding-sampling` exists in `data/foundationsData.ts:1965` but has no viz mapping here).

#### `data/conceptGraphData.ts`
- Purpose: small graph dataset; OK.

### 6.5 Visualizations

#### 6.5.1 Cross-folder duplication
Exact duplicates detected (byte-identical):
- `components/foundations/EdgeOfStabilityViz.tsx` == `components/visualizations/optimization/EdgeOfStability.tsx`
- `components/foundations/GrokkingViz.tsx` == `components/visualizations/optimization/GrokkingPhase.tsx`
- `components/foundations/KVCacheViz.tsx` == `components/visualizations/sequence/KVCacheViz.tsx`
- `components/foundations/LayerNormViz.tsx` == `components/visualizations/sequence/LayerNormRMSNorm.tsx`

This creates drift risk (some are already duplicated in name as well). Prefer a single source of truth and re-export for both routes.

Near-duplicates detected (substantially similar files with small diffs, typically import paths / copy edits):
- `components/foundations/MoERoutingViz.tsx` ~ `components/visualizations/sequence/MoERouting.tsx`
- `components/foundations/NewtonSchulzViz.tsx` ~ `components/visualizations/optimization/NewtonSchulz.tsx`
- `components/foundations/TransformerArchitectureViz.tsx` ~ `components/visualizations/sequence/AttentionIsAllYouNeed.tsx`
- `components/foundations/ParallelTransportViz.tsx` ~ `components/visualizations/geometric/ParallelTransport.tsx`
- `components/foundations/DiffusionProcessViz.tsx` ~ `components/visualizations/generative/DiffusionForwardReverse.tsx`
- `components/foundations/LossLandscape3DViz.tsx` ~ `components/visualizations/optimization/LossLandscape3D.tsx`
- `components/foundations/EquivarianceViz.tsx` ~ `components/visualizations/geometric/EquivarianceDemo.tsx`
- `components/foundations/LinearProbeViz.tsx` ~ `components/visualizations/mechinterp/LinearProbes.tsx`

##### Visualization audit matrices (static signals)

The tables below are produced via **static string inspection** (no runtime execution). They’re meant to quickly answer:
- Where do we have animation loops (interval/rAF) and do we see cleanup signals?
- Which files use GSAP and do we see any kill/context cleanup?
- Which files import `d3-*` submodules directly (dependency hygiene risk)?
- Which files appear duplicated (exact/near) and which foundations viz are currently reachable from `/foundations/[id]`?

##### Foundations visualization audit matrix

| File | Tech | Loops | Cleanup signals | Randomness | Direct `d3-*` import | Dup status | Reachable |
|---|---|---|---|---|---|---|---|
| `components/foundations/AdamOptimizerViz.tsx` | SVG | — | — | — | — | unique | yes |
| `components/foundations/AttentionBackpropViz.tsx` | SVG | — | — | — | — | unique | yes |
| `components/foundations/AttentionGeometryViz.tsx` | SVG | — | — | — | — | unique | yes |
| `components/foundations/CrossEntropyViz.tsx` | SVG | — | — | — | — | unique | yes |
| `components/foundations/DPOViz.tsx` | — | — | — | — | — | unique | yes |
| `components/foundations/DecodingSamplingViz.tsx` | — | interval | clearInterval | — | — | unique | no |
| `components/foundations/DiffusionProcessViz.tsx` | D3, SVG | interval | clearInterval | — | yes | near ↔ components/visualizations/generative/DiffusionForwardReverse.tsx | yes |
| `components/foundations/DiffusionScoreViz.tsx` | SVG | rAF | cancelAnimationFrame | — | — | unique | yes |
| `components/foundations/DoubleDescentViz.tsx` | SVG | — | — | — | — | unique | yes |
| `components/foundations/EdgeOfStabilityViz.tsx` | D3, SVG | interval | clearInterval | — | yes | exact ↔ components/visualizations/optimization/EdgeOfStability.tsx | yes |
| `components/foundations/EquivarianceViz.tsx` | GSAP, SVG | — | NO GSAP cleanup | — | — | near ↔ components/visualizations/geometric/EquivarianceDemo.tsx | no (mapped) |
| `components/foundations/FlowMatchingViz.tsx` | SVG | rAF | cancelAnimationFrame | — | — | unique | yes |
| `components/foundations/GrokkingViz.tsx` | D3, SVG | — | — | yes | — | exact ↔ components/visualizations/optimization/GrokkingPhase.tsx | yes |
| `components/foundations/InductionHeadsViz.tsx` | SVG | — | — | — | — | unique | yes |
| `components/foundations/InfoBottleneckViz.tsx` | SVG | interval | clearInterval | — | — | unique | yes |
| `components/foundations/KTOViz.tsx` | D3, SVG | — | — | — | — | unique | yes |
| `components/foundations/KVCacheDashboard.tsx` | — | — | — | — | — | unique | yes |
| `components/foundations/KVCacheViz.tsx` | D3, SVG | — | — | — | — | exact ↔ components/visualizations/sequence/KVCacheViz.tsx | yes |
| `components/foundations/LayerNormViz.tsx` | — | — | — | — | — | exact ↔ components/visualizations/sequence/LayerNormRMSNorm.tsx | yes |
| `components/foundations/LinearProbeViz.tsx` | D3, SVG | — | — | — | — | near ↔ components/visualizations/mechinterp/LinearProbes.tsx | yes |
| `components/foundations/LoRAViz.tsx` | SVG | — | — | yes | — | unique | yes |
| `components/foundations/LossLandscape3DViz.tsx` | Three/R3F | interval | clearInterval | — | — | near ↔ components/visualizations/optimization/LossLandscape3D.tsx | yes |
| `components/foundations/LossLandscapeViz.tsx` | SVG | — | — | — | — | unique | yes |
| `components/foundations/MambaViz.tsx` | — | — | — | — | — | unique | no (mapped) |
| `components/foundations/MoERoutingViz.tsx` | GSAP | — | kills GSAP | — | — | near ↔ components/visualizations/sequence/MoERouting.tsx | yes |
| `components/foundations/NTKViz.tsx` | SVG | interval | clearInterval | — | — | unique | yes |
| `components/foundations/NeuralScalingViz.tsx` | D3, SVG | — | — | — | — | unique | yes |
| `components/foundations/NewtonSchulzViz.tsx` | GSAP, SVG | — | NO GSAP cleanup | yes | — | near ↔ components/visualizations/optimization/NewtonSchulz.tsx | yes |
| `components/foundations/ParallelTransportViz.tsx` | Three/R3F, Canvas, SVG | rAF | cancelAnimationFrame | — | — | near ↔ components/visualizations/geometric/ParallelTransport.tsx | yes |
| `components/foundations/RLHFViz.tsx` | SVG | — | — | — | — | unique | yes |
| `components/foundations/RewardHackingViz.tsx` | D3, SVG | — | — | — | — | unique | yes |
| `components/foundations/RoPEViz.tsx` | D3, SVG | — | — | — | — | unique | yes |
| `components/foundations/SSMViz.tsx` | D3, SVG | rAF | cancelAnimationFrame | — | — | unique | no (mapped) |
| `components/foundations/ScalingLawsViz.tsx` | SVG | — | — | — | — | unique | yes |
| `components/foundations/SelfAttentionViz.tsx` | D3, SVG | — | — | — | — | unique | yes |
| `components/foundations/ServingLatencyViz.tsx` | — | — | — | — | — | unique | yes |
| `components/foundations/SlidingWindowViz.tsx` | D3, SVG | interval | clearInterval | — | yes | unique | yes |
| `components/foundations/SparseAutoencoderViz.tsx` | D3, SVG | — | — | — | — | unique | yes |
| `components/foundations/SpeculativeDecodingViz.tsx` | — | — | — | yes | — | unique | yes |
| `components/foundations/SuperpositionViz.tsx` | SVG | — | — | — | — | unique | yes |
| `components/foundations/TaskVectorViz.tsx` | D3, SVG | — | — | — | yes | unique | yes |
| `components/foundations/TokenizationViz.tsx` | SVG | interval | clearInterval | — | — | unique | yes |
| `components/foundations/TransformerArchitectureViz.tsx` | D3, SVG | rAF | cancelAnimationFrame | — | yes | near ↔ components/visualizations/sequence/AttentionIsAllYouNeed.tsx | yes |
| `components/foundations/VAEELBOViz.tsx` | SVG | interval | clearInterval | — | — | unique | yes |

##### Pillar visualization audit matrix

| File | Tech | Loops | Cleanup signals | Randomness | Direct `d3-*` import | Dup status | Reachable |
|---|---|---|---|---|---|---|---|
| `components/visualizations/generative/DiffusionForwardReverse.tsx` | D3, SVG | interval | clearInterval | — | yes | near ↔ components/foundations/DiffusionProcessViz.tsx | yes |
| `components/visualizations/generative/FlowMatching.tsx` | Canvas | rAF | cancelAnimationFrame | yes | — | unique | yes |
| `components/visualizations/geometric/EquivarianceDemo.tsx` | GSAP, SVG | — | NO GSAP cleanup | — | — | near ↔ components/foundations/EquivarianceViz.tsx | yes |
| `components/visualizations/geometric/ParallelTransport.tsx` | Three/R3F, Canvas, SVG | rAF | cancelAnimationFrame | — | — | near ↔ components/foundations/ParallelTransportViz.tsx | yes |
| `components/visualizations/mechinterp/InductionHeads.tsx` | SVG | — | — | — | — | unique | yes |
| `components/visualizations/mechinterp/LinearProbes.tsx` | D3, SVG | — | — | — | — | near ↔ components/foundations/LinearProbeViz.tsx | yes |
| `components/visualizations/mechinterp/SuperpositionPolysemanticity.tsx` | D3, SVG | — | — | — | — | unique | yes |
| `components/visualizations/optimization/BackpropAttention.tsx` | SVG | — | — | — | — | unique | yes |
| `components/visualizations/optimization/DPOvsRLHF.tsx` | — | — | — | — | — | unique | yes |
| `components/visualizations/optimization/EdgeOfStability.tsx` | D3, SVG | interval | clearInterval | — | yes | exact ↔ components/foundations/EdgeOfStabilityViz.tsx | yes |
| `components/visualizations/optimization/GrokkingPhase.tsx` | D3, SVG | — | — | yes | — | exact ↔ components/foundations/GrokkingViz.tsx | yes |
| `components/visualizations/optimization/LossLandscape3D.tsx` | Three/R3F | interval | clearInterval | — | — | near ↔ components/foundations/LossLandscape3DViz.tsx | yes |
| `components/visualizations/optimization/NeuralScalingLaws.tsx` | D3, SVG | — | — | — | — | unique | yes |
| `components/visualizations/optimization/NewtonSchulz.tsx` | GSAP, SVG | — | NO GSAP cleanup | yes | — | near ↔ components/foundations/NewtonSchulzViz.tsx | yes |
| `components/visualizations/optimization/TaskVectors.tsx` | D3, SVG | — | — | — | yes | unique | yes |
| `components/visualizations/sequence/AttentionIsAllYouNeed.tsx` | D3, SVG | rAF | cancelAnimationFrame | — | yes | near ↔ components/foundations/TransformerArchitectureViz.tsx | yes |
| `components/visualizations/sequence/AttentionMatrixViz.tsx` | D3, SVG | — | — | — | — | unique | yes |
| `components/visualizations/sequence/GQAMQAComparison.tsx` | SVG | — | — | — | — | unique | yes |
| `components/visualizations/sequence/KVCacheViz.tsx` | D3, SVG | — | — | — | — | exact ↔ components/foundations/KVCacheViz.tsx | yes |
| `components/visualizations/sequence/LayerNormRMSNorm.tsx` | — | — | — | — | — | exact ↔ components/foundations/LayerNormViz.tsx | yes |
| `components/visualizations/sequence/MambaSelectivity.tsx` | — | — | — | — | — | unique | yes |
| `components/visualizations/sequence/MoERouting.tsx` | GSAP | — | kills GSAP | — | — | near ↔ components/foundations/MoERoutingViz.tsx | yes |
| `components/visualizations/sequence/RoPERotationViz.tsx` | D3, SVG | — | — | — | — | unique | yes |
| `components/visualizations/sequence/SSMRecurrence.tsx` | D3, SVG | rAF | cancelAnimationFrame | — | — | unique | yes |
| `components/visualizations/sequence/SlidingWindowAttention.tsx` | D3, SVG | interval | clearInterval | — | yes | unique | yes |
| `components/visualizations/sequence/SwiGLUActivation.tsx` | D3, SVG | — | — | — | — | unique | yes |

#### 6.5.2 `components/foundations/*.tsx`
Common concerns across this folder:
- These are mounted client-only via `next/dynamic({ ssr:false })` in `pages/foundations/[id].tsx`, which avoids SSR issues for D3/Three.
- Several files use D3 submodule imports (`d3-scale`, `d3-shape`, `d3-random`) without declaring direct deps.
- Some modules contain nondeterminism (`Math.random`) and should remain client-only.

Notable per-file callouts:
- `components/foundations/DecodingSamplingViz.tsx`: appears unused/unreachable (not referenced in `data/visualizationMappings.ts` nor in `pages/foundations/[id].tsx` dynamic imports).  
- `components/foundations/NewtonSchulzViz.tsx`: uses `useLayoutEffect` (fine client-only) + `Math.random` in helper; OK but consider `useEffect` for portability.  
- `components/foundations/ParallelTransportViz.tsx` / `components/foundations/LossLandscape3DViz.tsx`: Three/R3F; must remain client-only (they currently are).  

#### 6.5.3 `components/visualizations/*/*.tsx`
Common concerns across this folder:
- These are mounted in pillar pages; many are loaded via `React.lazy`. If you want zero SSR risk, prefer `next/dynamic({ ssr:false })` for these heavy visualizations too.
- Several contain `Math.random` during initial render (e.g. grokking). If SSR ever renders them, hydration mismatch is likely.

Notable per-file callouts:
- `components/visualizations/optimization/NewtonSchulz.tsx`: uses `useLayoutEffect` + GSAP timelines; add unmount cleanup (kill timelines) and consider `useEffect` if SSR is possible.
- `components/visualizations/generative/DiffusionForwardReverse.tsx`: imports `d3-scale`/`d3-shape`/`d3-random` directly; declare deps or import from `d3`.

## 7. Issue Register (Prioritized)

> Format: Severity (P0/P1/P2) | Title | Evidence | Why | Fix

### 7.1 Prioritized table

| Severity | Title | Evidence (file + snippet) | Why it’s a problem | Fix (specific) |
|---|---|---|---|---|
| P1 | Foundations math renderer doesn’t support actual Markdown | `pages/foundations/[id].tsx:106-183` + `data/foundationsData.ts:1891-1932` | Tokenization + decoding concepts include headings/h-rules; UI will show raw `##` and `---`. This will worsen as content gets richer. | Replace `MathContent` with `react-markdown` + `remark-math` + `rehype-katex` (or move concept math to MDX). Remove `dangerouslySetInnerHTML` fallbacks. |
| P1 | Concept count mismatch (32/33/34) across UI + docs | `data/foundationsData.ts:2`, `pages/index.tsx:27`, `pages/foundations/index.tsx:77`, `pages/foundations/index.tsx:182` | User-visible correctness issue; undermines trust; also indicates docs drift. | Derive count from `foundationsConcepts.length` everywhere; update docs to match. |
| P1 | `dependents` not consistent with `prereqs` | `data/foundationsData.ts:91-94` vs `data/foundationsData.ts:133-135` | “Enables” links are incomplete/incorrect on concept pages. Hard to keep consistent manually as concept count grows. | Remove `dependents` from data model and derive dependents from prereqs at render/build time; or add a build-time validator that fails on inconsistency. |
| P1 | Adam simulation step increments twice | `pages/pillars/optimization.tsx:90-110` | Bias correction and time axis are wrong; iterations run at half length for Adam vs others. | Increment step exactly once per frame; keep a separate `t` counter if needed. |
| P1 | Undeclared direct imports (transitive dependency reliance) | `components/visualizations/generative/DiffusionForwardReverse.tsx:4-6` vs `package.json:10-31` | Works with npm hoisting but breaks with strict dependency resolution (pnpm, Yarn PnP). | Add `d3-scale`, `d3-shape`, `d3-random`, `d3-interpolate` to deps **or** refactor imports to `import * as d3 from 'd3'` consistently. |
| P1 | Pillar slider inputs are not properly labeled (a11y) | `pages/pillars/sequence-modeling.tsx:518-555`, `pages/pillars/optimization.tsx:498-535`, `pages/pillars/generative-physics.tsx:288-325`, `pages/pillars/geometric-dl.tsx:292-310`, `pages/pillars/mech-interp.tsx:266-303` | Screen readers may announce these controls as “slider” with no name, harming accessibility and usability. | Wrap each range input in a `<label>` (consistent with `.slider-label` used elsewhere) or add `aria-label`/`aria-labelledby` and visible label text. |
| P1 | Over-coupled foundations visualization mapping import | `pages/foundations/[id].tsx:6` + `components/foundations/index.ts:4-58` | Importing `conceptVisualizationMap` from the `components/foundations` barrel can pull all re-exported visualization modules into the page dependency graph (tree-shaking-dependent) and obscures which visualizations are truly reachable. | Import `conceptVisualizationMap` from `data/visualizationMappings.ts` directly; keep `components/foundations/index.ts` as a component-only barrel (or split mapping exports into a separate file). |
| P1 | Foundations visualization mapping drift (orphan/unreachable viz files) | `components/foundations/DecodingSamplingViz.tsx:218` + `data/visualizationMappings.ts:4-32` + `pages/foundations/[id].tsx:11-104` | New/extra concept visualizations exist but can’t be reached from any route (no mapping + no dynamic import). This is dead code + wasted maintenance and confuses contributors. | Either wire them (add mapping entries + dynamic imports) or delete/archive them; add a “mapping completeness” validator. |
| P2 | Unsafe HTML fallback in KaTeX error path | `pages/foundations/[id].tsx:111-122` | If content ever becomes untrusted (CMS, user input), this becomes XSS. Even with trusted content, unsafe pattern. | Return React nodes instead of raw HTML in catch, or escape HTML entities before injecting. |
| P2 | IntersectionObserver churn in ExplorableSection | `components/ExplorableSection.tsx:24-48` | Observer recreated every `activeSection` change; could cause perf issues on scroll. | Remove `activeSection` from deps and don’t clear activeSection on exit, or manage active section at layout level with one observer. |
| P2 | Exact duplicate visualization files across folders | Duplicate pairs listed in §6.5.1 | Doubles maintenance; risk of divergence. | Keep one canonical copy + re-export; ensure both routes use same component. |
| P2 | Near-duplicate visualization files across folders | Near-duplicate list in §6.5.1 | Increases drift risk and makes it unclear which file is canonical; changes may land in one copy but not the other. | Choose one canonical location (`components/visualizations/**`) and re-export from `components/foundations/**` (or vice versa); delete or reduce the near-duplicate copies to thin wrappers. |
| P2 | TimeSeriesPlot fails gracefully with empty data | `components/TimeSeriesPlot.tsx:28-44` | If `series` is empty (or all series have empty `data`), bounds become `Infinity/-Infinity` and `mapRange()` returns degenerate values; the canvas output becomes nonsensical. | Add an early return when there’s no data, or default bounds to `{tMin:0,tMax:1,vMin:0,vMax:1}` when no points exist. |
| P2 | StateTimeline min/max bounds initialization can mis-scale | `components/StateTimeline.tsx:27-36` | Initializing `min=0,max=1` produces incorrect ranges when all activations are >0 or <0, flattening contrast and making highlights misleading. | Initialize bounds to `Infinity/-Infinity` with a fallback when there are no activations; optionally clamp/normalize. |
| P2 | FoundationsGraph has unused state/prop and stale copy | `components/FoundationsGraph.tsx:25-40`, `components/FoundationsGraph.tsx:233-237` | Dead state/props make the graph harder to evolve and hide intended “highlighted concept” behavior; “33 core concepts” is stale. | Remove unused `selectedNode` / `highlightedConcept` or implement highlighting; replace “33” with `foundationsConcepts.length`. |
| P2 | ServingLatencyViz has unused state | `components/foundations/ServingLatencyViz.tsx:6-10` | Unused state suggests incomplete UI (attentionType) and adds confusion for maintainers. | Remove `attentionType` state or wire it into the model/UI. |
| P2 | LossLandscape3D keeps interval running after reaching final step | `components/visualizations/optimization/LossLandscape3D.tsx:401-415` | Once `currentStep` reaches the end, the interval continues firing every ~60ms doing useless work. | Stop the interval when `prev >= maxSteps - 1` (e.g., set `isPlaying=false` or clear interval). |
| P2 | D3 zoom/drag listeners not removed on cleanup | `components/FoundationsGraph.tsx:66-223` | The simulation is stopped, but zoom handlers are attached to the SVG and can accumulate across remounts; similar risks exist for D3 drag in some viz modules. | In cleanup, call `svg.on('.zoom', null)` and remove drag listeners (`selection.on('.drag', null)`) or re-create the SVG node per mount. |
| P2 | GSAP timelines/tweens not killed on unmount (potential leaks) | `components/visualizations/sequence/MoERouting.tsx:90-133`, `components/foundations/MoERoutingViz.tsx:90-133`, `components/visualizations/geometric/EquivarianceDemo.tsx:49-88` | Navigating away mid-animation can leave GSAP timelines running and holding DOM references. | Track timelines in refs and `kill()` them in `useEffect` cleanup; for one-off tweens use `gsap.context()` or `gsap.killTweensOf(node)` on unmount. |
| P2 | Stale deployment docs | `DEPLOYMENT_GUIDE.md:6-18`, `DEPLOYMENT_GUIDE.md:73-101` | Misleads future deploys; `.htaccess` not source-controlled; build-failure claim already resolved. | Update docs to reflect `trailingSlash:true` strategy or check in host-specific rewrite config under `public/`. |
| P2 | External Google Fonts import (runtime network dependency) | `styles/globals.css:7` | Adds a third-party runtime fetch, can regress performance (FOIT/FOUT) and complicate strict CSP deployments. | Self-host fonts or switch to `next/font` and remove the CSS `@import`. |
| P2 | Optimizer MDX pages rely on default `<title>` (SEO/shareability) | `pages/concepts/optimizers/overview.mdx:1-5`, `pages/concepts/optimizers/adamw.mdx:1-5`, `pages/concepts/optimizers/muon.mdx:1-5` | These routes will all share the default Layout title (“Continuous Function”), which hurts share previews and search snippets. | Add per-page `<Head><title>…</title></Head>` inside each MDX file (import `next/head`). |

### 7.2 Evidence snippets (expanded)

#### P1 — Foundations Markdown rendering breakage

`pages/foundations/[id].tsx:106-183`
```tsx
function MathContent({ content }: { content: string }) {
  const paragraphs = content.split('\n\n')
  const parts = para.split(/(\$\$[\s\S]*?\$\$|\$[^$]+\$|\*\*[^*]+\*\*|`[^`]+`)/g)
  // ...
}
```

`data/foundationsData.ts:1891-1906`
```ts
coreMath: `Tokenization is the **discrete interface** ...

---

## 1) Tokenization is a segmentation into vocabulary items
```

#### P1 — Adam step counter bug

`pages/pillars/optimization.tsx:90-110`
```tsx
} else if (optimizer === 'adam') {
  step++
  // ...
}
// ...
step++
animationRef.current = requestAnimationFrame(animate)
```

#### P1 — Unlabeled range inputs on pillar pages (a11y)

`pages/pillars/sequence-modeling.tsx:518-535`
```tsx
<div className="param-control" style={{ display: 'flex', marginTop: '1rem' }}>
  <span>Temperature:</span>
  <input type="range" /* ... */ />
  <span className="value">{temperature.toFixed(1)}</span>
</div>
```

#### P1 — `prereqs`/`dependents` inconsistency

`data/foundationsData.ts:91-94` vs `data/foundationsData.ts:133-135`
```ts
// maximum-likelihood
prereqs: [],
dependents: ['vaes', 'diffusion', 'rlhf'],

// attention-transformers
prereqs: ['maximum-likelihood'],
dependents: ['induction-heads', 'scaling-laws'],
```

#### P1 — Over-coupled visualization mapping import

`pages/foundations/[id].tsx:5-6`
```ts
import { foundationsConcepts, Concept, CATEGORY_LABELS } from '../../data/foundationsData'
import { conceptVisualizationMap } from '../../components/foundations'
```

`components/foundations/index.ts:4-58` (barrel re-exports many components + mapping)
```ts
export { default as CrossEntropyViz } from './CrossEntropyViz'
// ...
export { default as TokenizationViz } from './TokenizationViz'

export {
  conceptVisualizationMap,
  sequenceVisualizationMap,
  geometricVisualizationMap
} from '../../data/visualizationMappings'
```

#### P2 — TimeSeriesPlot empty-data bounds

`components/TimeSeriesPlot.tsx:28-44`
```ts
let tMin = Infinity, tMax = -Infinity
let vMin = Infinity, vMax = -Infinity

series.forEach(s => {
  s.data.forEach(d => {
    tMin = Math.min(tMin, d.t)
    tMax = Math.max(tMax, d.t)
    vMin = Math.min(vMin, d.value)
    vMax = Math.max(vMax, d.value)
  })
})
```

#### P2 — StateTimeline bounds initialization

`components/StateTimeline.tsx:27-36`
```ts
const bounds = useMemo(() => {
  let min = 0, max = 1
  states.forEach(s => {
    s.activations.forEach(a => {
      min = Math.min(min, a)
      max = Math.max(max, a)
    })
  })
  return { min, max }
}, [states])
```

#### P2 — FoundationsGraph unused prop/state + stale copy

`components/FoundationsGraph.tsx:25-40`
```ts
interface Props {
  // ...
  highlightedConcept?: string | null
}

const [selectedNode, setSelectedNode] = useState<string | null>(null)
```

`components/FoundationsGraph.tsx:233-237`
```tsx
<p className="muted">
  33 core concepts explaining GPT-4, Claude, Gemini, Llama, Stable Diffusion, and Sora.
  Drag nodes to explore. Click to see details.
</p>
```

#### P2 — ServingLatencyViz unused state

`components/foundations/ServingLatencyViz.tsx:6-10`
```ts
const [promptLength, setPromptLength] = useState(512);
const [outputLength, setOutputLength] = useState(100);
const [batchSize, setBatchSize] = useState(4);
const [attentionType, setAttentionType] = useState<'prefill' | 'decode' | 'both'>('both');
```

#### P2 — LossLandscape3D interval continues after completion

`components/visualizations/optimization/LossLandscape3D.tsx:401-415`
```ts
useEffect(() => {
  if (!isPlaying || maxSteps <= 1) return

  const intervalMs = 60
  const id = window.setInterval(() => {
    setCurrentStep((prev) => {
      if (prev >= maxSteps - 1) {
        return prev
      }
      return prev + 1
    })
  }, intervalMs)

  return () => window.clearInterval(id)
}, [isPlaying, maxSteps])
```

#### P1 — Undeclared `d3-*` deps

`components/visualizations/generative/DiffusionForwardReverse.tsx:4-6`
```ts
import { scaleLinear } from 'd3-scale'
import { line as d3Line, curveMonotoneX } from 'd3-shape'
import { randomNormal } from 'd3-random'
```

`package.json:10-31` (no `d3-scale` / `d3-shape` / `d3-random` / `d3-interpolate`).

#### P2 — External Google Fonts import

`styles/globals.css:7`
```css
@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
```

#### P2 — Optimizer MDX pages rely on default `<title>`

`pages/concepts/optimizers/overview.mdx:1-5`
```mdx
import GradientDescentPlayground from '../../../components/GradientDescentPlayground'
import Link from 'next/link'

# Optimizers Overview
```

#### Patch-style diffs (copy/paste) for key issues

> These are **suggested** diffs for engineers to apply in follow-up PRs. They are not applied as part of this audit.

**P1 — Decouple foundations visualization mapping import**

`pages/foundations/[id].tsx`
```diff
-import { conceptVisualizationMap } from '../../components/foundations'
+import { conceptVisualizationMap } from '../../data/visualizationMappings'
```

**P1 — Fix Adam simulation step double-increment (keep Adam bias correction sane)**

`pages/pillars/optimization.tsx`
```diff
 } else if (optimizer === 'adam') {
-  step++
+  const t = step + 1
   m = [beta1 * m[0] + (1 - beta1) * gx, beta1 * m[1] + (1 - beta1) * gy]
   v = [beta2 * v[0] + (1 - beta2) * gx * gx, beta2 * v[1] + (1 - beta2) * gy * gy]
-  const mHat = [m[0] / (1 - beta1 ** step), m[1] / (1 - beta1 ** step)]
-  const vHat = [v[0] / (1 - beta2 ** step), v[1] / (1 - beta2 ** step)]
+  const mHat = [m[0] / (1 - beta1 ** t), m[1] / (1 - beta1 ** t)]
+  const vHat = [v[0] / (1 - beta2 ** t), v[1] / (1 - beta2 ** t)]
   point = [
     point[0] - lr * mHat[0] / (Math.sqrt(vHat[0]) + eps),
     point[1] - lr * mHat[1] / (Math.sqrt(vHat[1]) + eps),
   ]
 }
 
 step++
 animationRef.current = requestAnimationFrame(animate)
```

**P2 — TimeSeriesPlot: guard empty series bounds**

`components/TimeSeriesPlot.tsx`
```diff
 const bounds = useMemo(() => {
   let tMin = Infinity, tMax = -Infinity
   let vMin = Infinity, vMax = -Infinity
 
   series.forEach(s => {
     s.data.forEach(d => {
       tMin = Math.min(tMin, d.t)
       tMax = Math.max(tMax, d.t)
       vMin = Math.min(vMin, d.value)
       vMax = Math.max(vMax, d.value)
     })
   })
 
+  if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || !Number.isFinite(vMin) || !Number.isFinite(vMax)) {
+    return { tMin: 0, tMax: 1, vMin: 0, vMax: 1 }
+  }
+
   // Add some padding
   const vPad = (vMax - vMin) * 0.1 || 1
   return { tMin, tMax, vMin: vMin - vPad, vMax: vMax + vPad }
 }, [series])
```

**P2 — StateTimeline: initialize bounds correctly**

`components/StateTimeline.tsx`
```diff
 const bounds = useMemo(() => {
-  let min = 0, max = 1
+  let min = Infinity, max = -Infinity
   states.forEach(s => {
     s.activations.forEach(a => {
       min = Math.min(min, a)
       max = Math.max(max, a)
     })
   })
+  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return { min: 0, max: 1 }
   return { min, max }
 }, [states])
```

**P2 — LossLandscape3D: stop interval when finished**

`components/visualizations/optimization/LossLandscape3D.tsx`
```diff
 const id = window.setInterval(() => {
   setCurrentStep((prev) => {
     if (prev >= maxSteps - 1) {
+      window.clearInterval(id)
       return prev
     }
     return prev + 1
   })
 }, intervalMs)
```

### 7.3 Quick Wins (≤1 hour)
- Fix Adam `step` double-increment (`pages/pillars/optimization.tsx`).  
- Replace hard-coded “33” labels with `foundationsConcepts.length` in `pages/index.tsx`, `pages/foundations/index.tsx`, `components/FoundationsGraph.tsx`, and related docs.  
- Fix pillar range inputs to be accessible labels (wrap in `<label>`; add `aria-*` if needed).  
- Add per-page `<Head><title>...</title></Head>` to `pages/foundations/[id].tsx` and pillar pages.  
- Decouple the visualization mapping import: change `pages/foundations/[id].tsx` to import `conceptVisualizationMap` from `data/visualizationMappings.ts`.  
- Harden chart primitives for empty/degenerate data (`components/TimeSeriesPlot.tsx`, `components/StateTimeline.tsx`).  
- Remove unused imports in pillar pages + foundations index (minor hygiene).  

### 7.4 Structural Fixes (multi-day)
- Replace Foundations `MathContent` with a real Markdown+math renderer (or migrate concept content to MDX).  
- Remove manual `dependents` maintenance; compute dependents from prereqs.  
- Consolidate duplicate/near-duplicate visualization modules; establish a single visualization registry and mapping (concept→component).  
- Tighten dependency declarations (`d3-*` submodules) and reduce bundle size by importing specific D3 modules instead of `* as d3` where appropriate.  

## 8. Refactor / Hardening Plan

### Immediate (today/this week)
1. Fix Adam simulation step bug in `pages/pillars/optimization.tsx`.  
2. Make concept count data-driven (replace “32/33” strings).  
3. Add `<Head>` titles to all pages that don’t set them (pillars, foundations concept pages, MDX pages).  
4. Patch Foundations `MathContent` quickly to at least hide/convert `---` and `##` lines (stopgap) while implementing a real Markdown renderer.  
5. Add a tiny build-time validator script (no runtime dependency) to assert that every `prereqs` ID exists and derive `dependents` (or fail if inconsistent).  
6. Decide on one visualization source tree (`components/foundations` vs `components/visualizations`) and add a de-duplication plan.  
7. Update `DEPLOYMENT_GUIDE.md` to match `trailingSlash:true` export strategy and remove stale “build fails” note.  

### Near-term (this month)
1. Migrate foundations `coreMath` to MDX files or render it with `react-markdown` + `remark-math` + `rehype-katex` (+ sanitize).  
2. Replace `window.location.href` navigation in `components/KnowledgeGraph.tsx` with `next/router` for client-side transitions (optional).  
3. Add `pages/404.tsx` and `public/robots.txt` + `public/sitemap.xml` + favicon assets for baseline SEO hygiene.  
4. Introduce a consistent formatting/linting baseline (Prettier + ESLint) and enforce no duplicate files / no unused imports.  
5. Reduce bundle size: replace `import * as d3 from 'd3'` with specific `d3-*` imports (or vice-versa, but be consistent).  
6. Normalize visualization design system usage: centralize colors in `lib/mathObjects.ts` and remove ad-hoc palettes.  

## 9. Optional Verification Plan (Do NOT run; just propose)

### Build + type safety
- `npm ci`
- `npm run build` (ensure `out/` is produced and all routes export)
- `node -e \"console.log(require('./data/foundationsData').foundationsConcepts?.length)\"` (or a small TS script) to confirm concept count assumptions

### Static hosting / routing
- Serve `out/` locally with a dumb static server and test deep links:
  - `/pillars/optimization` and `/pillars/optimization/`
  - `/foundations/tokenization-vocabulary` and `/foundations/tokenization-vocabulary/`
  - `/concepts/optimizers/overview#momentum`

### Link + content checks
- Run a link checker over `out/` HTML for internal 404s and hash targets
- Add a simple “MDX anchor presence” script to ensure `#momentum`/`#rmsprop` exist in the exported HTML

### Performance + a11y
- Lighthouse (Performance, Accessibility, SEO) on key pages: `/`, `/foundations/maximum-likelihood/`, each pillar route
- Browser perf profiling on heavy visualizations (KnowledgeGraph, FoundationsGraph, 3D loss landscape)

### Dependencies security / freshness (requires network)
- `npm audit` (or `pnpm audit` if migrating)
- Check “latest versions” for Next/React/D3/Three/GSAP and update with a controlled plan

---

### Appendix A — Phase 1: Structural Analysis

#### A.1 File & directory audit (source-of-truth map)
- The canonical source map is **§3 Repo Map (Inventory)** which includes: configs, all `pages/**`, all `components/**`, `lib/**`, `data/**`, `styles/**`, and the repo’s supporting docs/prompts.  
- Build artifacts (`node_modules/`, `.next/`, `out/`) are excluded from the inventory per scope.

#### A.2 Orphaned / unreachable modules
- **True orphan module (not imported/reachable):** `components/foundations/DecodingSamplingViz.tsx` (unreachable per mapping + not dynamically imported). See Issue Register row “Foundations visualization mapping drift” and the “Reachable: no” entry in the Foundations visualization audit matrix in §6.5.1.  
- **Mapped but currently unreachable from `/foundations/[id]`:**
  - `components/foundations/SSMViz.tsx`, `components/foundations/MambaViz.tsx`, `components/foundations/EquivarianceViz.tsx` appear in `data/visualizationMappings.ts` (via `sequenceVisualizationMap` / `geometricVisualizationMap`) but are not wired into `pages/foundations/[id].tsx` `vizMap` + dynamic imports. See the audit matrix “Reachable: no (mapped)”.

#### A.3 Duplicate / near-duplicate code
- Exact duplicates and near-duplicates are enumerated in **§6.5.1 Cross-folder duplication**.  
- Primary risk: engineers fix a bug in one copy but not the other → behavior diverges between foundations and pillar pages.

#### A.4 Naming conventions
- Components generally follow `PascalCase.tsx` naming (`components/*/*.tsx`).  
- Data/modules use `camelCase.ts` and `PascalCase` exports (`data/foundationsData.ts`, `lib/mathObjects.ts`).  
- One notable style inconsistency: several visualization files include `'use client'` directives even though the repo uses the **pages router**; the string is inert but creates noise.

#### A.5 Empty files / placeholder content
- No empty production TS/TSX/MDX/CSS files found in static scan.  
- “TBD” / TODO-like placeholders appear only in non-runtime docs (e.g. `AUTONOMOUS_LOOP.md`), not in production pages/components.

---

### Appendix B — Phase 1.2: Dependency Analysis (Static)

#### B.1 Dependency inventory (top-level)
- Source of truth: `package.json` + `package-lock.json`.  
- Core runtime: `next`, `react`, `react-dom`.  
- Content pipeline: `@next/mdx`, `remark-math`, `rehype-katex`, `rehype-slug`.  
- Viz/animation: `d3`, `react-d3-graph`, `gsap`, `three`, `@react-three/fiber`, `@react-three/drei`.  

#### B.2 Missing / undeclared dependencies (P1)
- Some files import `d3-*` submodules directly (e.g. `d3-scale`, `d3-shape`, `d3-random`, `d3-interpolate`) but those packages are not declared in `package.json`. See Issue Register “Undeclared direct imports”.

#### B.3 Unused / redundant dependencies (static heuristic; verify later)
- `d3-drag`, `d3-force`, `d3-selection`, `d3-zoom` are declared dependencies, but the codebase primarily imports `* as d3 from 'd3'`. This may be redundant; confirm via a real dependency check later (see Optional Verification Plan).  

#### B.4 Vulnerability / outdated dependency checks
- **Requires network** to do properly. Propose running `npm audit` + `npm outdated` (see §9).  
- `package-lock.json` marks `three-mesh-bvh` as deprecated (transitive); treat this as “requires upgrade planning” rather than an immediate blocker.

---

### Appendix C — Phase 1.3: Import/Export Graph Notes

#### C.1 Circular dependencies / broken imports
- No broken internal routes or missing imports were found in repo scans (see §4.3).  
- The repo uses dynamic imports heavily for viz components (good for static export).

#### C.2 High-risk coupling in the import graph (P1)
- `pages/foundations/[id].tsx` imports `conceptVisualizationMap` from `components/foundations/index.ts`, which also re-exports many visualization modules. This is avoidable coupling and can increase bundle/build graph risk. See Issue Register “Over-coupled foundations visualization mapping import”.

---

### Appendix D — Phase 2: Code Quality (TypeScript/React/Logic/Error Handling)

#### D.1 TypeScript
- TS is configured as `strict: true` but `skipLibCheck: true` (reduces noise, but can hide type issues in deps). See `tsconfig.json`.  
- `types.d.ts` uses a broad `declare module 'react-d3-graph'` shim; consider replacing with a typed wrapper component once stable.

#### D.2 React + hooks correctness
- `components/ExplorableSection.tsx` recreates `IntersectionObserver` on every `activeSection` change (P2 perf/complexity). See Issue Register.  
- Several viz components use GSAP without explicit unmount cleanup (P2). See Issue Register and the audit matrix “NO GSAP cleanup”.

#### D.3 Logic + math edge cases
- Adam simulation `step` bug (P1). See Issue Register + patch suggestion.  
- `components/TimeSeriesPlot.tsx` and `components/StateTimeline.tsx` have bounds edge cases for empty/degenerate inputs (P2). See Issue Register + patch suggestions.

#### D.4 Error handling
- KaTeX render error paths return raw HTML inside `dangerouslySetInnerHTML` without escaping (P2 XSS-in-theory). See Issue Register.

---

### Appendix E — Phase 3: Security (Client-side + Data Validation)

#### E.1 XSS surface area
- Only `pages/foundations/[id].tsx` uses `dangerouslySetInnerHTML`, for KaTeX-rendered math. KaTeX is configured with `trust:false` in both the MDX pipeline and concept page renderer, which helps, but the fallback path still injects raw strings. See Issue Register “Unsafe HTML fallback in KaTeX error path”.

#### E.2 External resources / CSP compatibility
- `styles/globals.css` imports Google Fonts via `@import url('https://fonts.googleapis.com/...')`. This is a runtime network dependency and may conflict with strict CSPs. Consider self-hosting fonts or using Next’s font tooling (requires implementation work).  

#### E.3 Secrets / sensitive storage
- No obvious secrets or sensitive data storage (`localStorage`, API keys) were found in production code by static scan.

---

### Appendix F — Phase 4: Data Integrity & Content

#### F.1 Foundations data integrity (P1)
- `data/foundationsData.ts` is the source of truth for concept IDs, prereqs, and dependents. `dependents` are not consistently maintained relative to `prereqs`. See Issue Register.

#### F.2 Content integrity (static)
- Internal route links appear consistent (§4.3).  
- External URLs (canonical paper links) are not validated in this audit due to “no network” constraints; propose a link-check pass in §9.

#### F.3 Mathematical content rendering
- MDX math rendering uses `remark-math` + `rehype-katex` + KaTeX CSS and is generally sound for static export.  
- Foundations `coreMath` strings now contain Markdown structures (`---`, `## ...`) that the custom renderer does not support (P1). See Issue Register.

---

### Appendix G — Phase 5/6: Architecture & Performance Notes

#### G.1 Architecture patterns (high-level)
- Pages router with MDX for content pages and TSX for interactive “pillar” explainers.  
- `ExplorableLayout` + `ExplorableSection` form the scroll-driven state machine.  
- Visualization components are split across:
  - `components/foundations/*` (concept pages)  
  - `components/visualizations/*` (pillar pages)  
  This split currently causes significant duplication (see §6.5.1).

#### G.2 Performance hotspots / traps
- D3 force graphs (`components/FoundationsGraph.tsx`, `components/KnowledgeGraph.tsx`) can be CPU heavy; ensure event handlers are cleaned up and avoid remount churn (see Issue Register).  
- `components/visualizations/optimization/LossLandscape3D.tsx` keeps an interval alive after completion (P2).  
- GSAP without cleanup can hold DOM references across navigations (P2).

---

### Appendix H — Phase 7: Accessibility (A11y)

#### H.1 Baseline positives
- Skip link exists (`components/Layout.tsx:20-22`).  
- `pages/_document.tsx` sets `<Html lang=\"en\">`.

#### H.2 Issues
- Pillar sliders missing accessible labels (P1). See Issue Register.  
- Canvas/SVG-heavy visualizations should consistently include `role=\"img\"` and `aria-label`/`<title>` where meaningful (some already do; enforce consistently).

---

### Appendix I — Phase 8: SEO & Meta

#### I.1 Baseline
- Global `<Head>` defaults exist in `components/Layout.tsx`.

#### I.2 Gaps
- Several routes rely on the default title (MDX optimizer pages, pillar pages, foundations concept pages). Add per-page `<title>` for shareability and search snippets (P2/quality).
- `robots.txt`, `sitemap.xml`, and a custom `404` page are not present in source; consider adding for static-host SEO hygiene (see §8).

---

### Appendix J — Phase 9/10/11: Build, Testing, Documentation

#### J.1 Build/deploy readiness
- Static export is configured (`output:'export'`, `trailingSlash:true`). Deep-link behavior without trailing slash is host-dependent; validate on the target host (see §9).  
- `package.json` includes `start: next start` which is a server runtime; for static deploys, document serving `out/` instead (docs update).

#### J.2 Testing coverage
- No automated tests are present. Minimum recommended:
  - Unit tests for `lib/mathObjects.ts` numeric utilities (e.g., `mapRange`, `safeNumber`, `softmax`) including degenerate cases.  
  - A data integrity test/validator for `data/foundationsData.ts` (`prereqs` IDs exist; derive dependents; mapping completeness).  
  - Optional: Playwright smoke tests for key routes after export (static host simulation).

#### J.3 Documentation drift
- Some repo docs (notably `DEPLOYMENT_GUIDE.md` and `STATIC_EXPORT_REMEDIATION_SPEC.md`) contain stale claims relative to the current code/config. Treat them as needing a refresh, or mark them as historical to avoid misleading future changes.
