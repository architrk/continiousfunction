# Architecture Map: Continuous Function

A static educational website explaining deep learning mathematics through interactive visualizations.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BUILD TIME                                      │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ MDX Content │───▶│ remark-math  │───▶│ rehype-katex│───▶│ Static HTML │  │
│  │   + React   │    │ (parse $...$)│    │ (render TeX)│    │   + JS      │  │
│  └─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘  │
│                                                                    │         │
│  ┌─────────────┐    ┌──────────────┐                              ▼         │
│  │ foundations │───▶│ getStaticProps│───▶ 100 concept pages ──▶ out/       │
│  │  Data.ts    │    │ getStaticPaths│                                       │
│  └─────────────┘    └──────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              RUNTIME (Browser)                               │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐                     │
│  │ User scroll │───▶│ Intersection │───▶│ Update viz  │                     │
│  │ / interact  │    │  Observer    │    │   state     │                     │
│  └─────────────┘    └──────────────┘    └─────────────┘                     │
│                                                │                             │
│  ┌─────────────┐    ┌──────────────┐          ▼                             │
│  │ Slider/btn  │───▶│ React state  │───▶ D3/Canvas/SVG re-render           │
│  └─────────────┘    └──────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
continiousfunction/
├── pages/                          # Next.js routing (file-based)
│   ├── _app.tsx                    # App wrapper (imports KaTeX CSS)
│   ├── _document.tsx               # HTML document (lang="en")
│   ├── index.tsx                   # Homepage
│   ├── graph.tsx                   # Knowledge graph page
│   ├── vision.mdx                  # Vision/philosophy page
│   ├── foundations/
│   │   ├── index.tsx               # Concept grid + study path
│   │   └── [id].tsx                # Dynamic route: /foundations/:conceptId
│   ├── pillars/
│   │   ├── index.tsx               # Five pillars grid
│   │   ├── optimization.tsx        # Explorable: optimization
│   │   ├── sequence-modeling.tsx   # Explorable: transformers/SSMs
│   │   ├── generative-physics.tsx  # Explorable: diffusion/flow
│   │   ├── geometric-dl.tsx        # Explorable: equivariance
│   │   └── mech-interp.tsx         # Explorable: interpretability
│   └── concepts/optimizers/
│       ├── overview.mdx            # MDX: optimizer families
│       ├── adamw.mdx               # MDX: AdamW deep dive
│       └── muon.mdx                # MDX: Muon optimizer
│
├── components/
│   ├── app/                        # Global app shell
│   │   └── Layout.tsx              # Header, footer, baseline SEO
│   ├── shared/                     # Generic cross-feature utilities
│   │   └── ErrorBoundary.tsx
│   ├── explorable/                 # Scroll-synced explorable article primitives
│   │   ├── ExplorableLayout.tsx
│   │   └── ExplorableSection.tsx
│   ├── charts/                     # Reusable low-level canvas/SVG chart primitives
│   │   ├── PhasePortrait2D.tsx
│   │   ├── TimeSeriesPlot.tsx
│   │   ├── KernelHeatmap.tsx
│   │   └── StateTimeline.tsx
│   ├── graphs/                     # D3 graph visualizations
│   │   ├── FoundationsGraph.tsx
│   │   ├── KnowledgeGraph.tsx
│   │   └── ForceGraph.tsx
│   ├── foundations/                # Concept-specific visualizations (one file per viz)
│   │   ├── index.ts                # Barrel export + viz mapping re-export
│   │   ├── GradientDescentPlayground.tsx
│   │   ├── MuonConceptualDemo.tsx
│   │   ├── CrossEntropyViz.tsx
│   │   ├── AttentionGeometryViz.tsx
│   │   ├── TokenizationViz.tsx
│   │   └── ... (see folder for full list)
│   ├── home/                       # Homepage-only sections
│   ├── site/                       # Shared site panels and chrome
│   ├── concepts/                   # Domain concept page composition
│   ├── editorial/                  # Notebook/editorial layouts
│   ├── viz/                        # Shared visualization framing
│   └── visualizations/             # Older pillar-specific visualizations
│       ├── sequence/               # Transformers, SSMs, Mamba
│       ├── optimization/           # Loss landscapes, optimizers
│       ├── generative/             # Diffusion, flow matching
│       ├── geometric/              # Equivariance, parallel transport
│       └── mechinterp/             # Superposition, circuits
│
├── data/
│   ├── foundationsData.ts          # SOURCE OF TRUTH: 100 concepts
│   ├── visualizationMappings.ts    # concept → viz component mapping
│   └── conceptGraphData.ts         # Graph edges for KnowledgeGraph
│
├── lib/
│   └── mathObjects.ts              # Types, colors, math utilities
│
├── styles/
│   └── globals.css                 # CSS variables, grid, components
│
└── next.config.mjs                 # MDX + static export config
```

---

## Data Flow

### 1. Concept Data Pipeline

```
┌──────────────────────────────────────────────────────────────────────────┐
│  data/foundationsData.ts                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  foundationsConcepts: Concept[] = [                                │  │
│  │    {                                                               │  │
│  │      id: 'attention-transformers',                                 │  │
│  │      number: 2,                                                    │  │
│  │      title: 'Attention & Transformers',                            │  │
│  │      shortTitle: 'Attention',                                      │  │
│  │      icon: '⊗',                                                    │  │
│  │      category: 'architecture',                                     │  │
│  │      color: '#14b8a6',                                             │  │
│  │      canonicalPapers: [...],                                       │  │
│  │      coreMath: '...',           // LaTeX content                   │  │
│  │      coreEquation: '...',       // Single key equation             │  │
│  │      whyItMatters: [...],                                          │  │
│  │      missingIntuition: [...],                                      │  │
│  │      prereqs: ['maximum-likelihood'],                              │  │
│  │      dependents: ['rope', 'efficient-attention'],                  │  │
│  │    },                                                              │  │
│  │    ... (100 concepts total)                                        │  │
│  │  ]                                                                 │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  pages/foundations/[id].tsx (getStaticPaths + getStaticProps)            │
│                                                                          │
│  1. getStaticPaths(): Generate 100 paths from foundationsConcepts.map()  │
│  2. getStaticProps(): Lookup concept by id, compute prev/next           │
│  3. Render: MathContent + vizMap[conceptVisualizationMap[id]]           │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  data/visualizationMappings.ts                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  conceptVisualizationMap: Record<string, string[]> = {             │  │
│  │    'attention-transformers': [                                     │  │
│  │      'AttentionGeometryViz',                                       │  │
│  │      'TransformerArchitectureViz',                                 │  │
│  │      'KVCacheViz',                                                 │  │
│  │      'SlidingWindowViz',                                           │  │
│  │      'SelfAttentionViz',                                           │  │
│  │      'AttentionBackpropViz'                                        │  │
│  │    ],                                                              │  │
│  │    'tokenization-vocabulary': ['TokenizationViz'],                 │  │
│  │    ...                                                             │  │
│  │  }                                                                 │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  components/foundations/{VizName}.tsx                                    │
│                                                                          │
│  - React component with D3/Canvas/SVG                                   │
│  - Uses lib/mathObjects.ts for MATH_COLORS, utilities                   │
│  - Dynamically imported with { ssr: false }                             │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2. MDX Rendering Pipeline

```
pages/concepts/optimizers/overview.mdx
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  next.config.mjs                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  remarkPlugins: [remarkMath]        // $...$ → math AST       │  │
│  │  rehypePlugins: [                                              │  │
│  │    [rehypeKatex, { trust: false }], // AST → KaTeX HTML       │  │
│  │    rehypeSlug                        // headings → id attrs    │  │
│  │  ]                                                             │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
        Static HTML with rendered math + anchor links
```

---

## Routing Graph

```
/                           Homepage (hero, pillars nav, GD playground)
│
├── /foundations/           Concept grid + study order + D3 graph
│   ├── /maximum-likelihood
│   ├── /attention-transformers
│   ├── /adam
│   ├── ... (100 dynamic routes)
│   └── /tokenization-vocabulary
│
├── /pillars/               Five pillars index
│   ├── /sequence-modeling  Explorable: attention → SSMs → Mamba
│   ├── /optimization       Explorable: GD → Muon → Edge of Stability
│   ├── /generative-physics Explorable: diffusion → flow matching
│   ├── /geometric-dl       Explorable: equivariance → parallel transport
│   └── /mech-interp        Explorable: superposition → circuits
│
├── /concepts/optimizers/
│   ├── /overview           MDX: optimizer families
│   ├── /adamw              MDX: AdamW details
│   └── /muon               MDX: Muon details
│
├── /graph                  Full knowledge graph (D3 force layout)
│
└── /vision                 MDX: philosophy and roadmap
```

---

## Component Hierarchy

```
_app.tsx
└── Layout.tsx                              # Header + main + footer
    ├── pages/index.tsx
    │   └── GradientDescentPlayground       # Interactive demo
    │
    ├── pages/foundations/index.tsx
    │   └── FoundationsGraph                # D3 force graph (dynamic import)
    │
    ├── pages/foundations/[id].tsx
    │   ├── MathContent                     # Renders coreMath with KaTeX
    │   └── vizMap[name]                    # Dynamic viz (CrossEntropyViz, etc.)
    │
    ├── pages/pillars/{pillar}.tsx
    │   └── ExplorableLayout
    │       ├── ExplorableSection           # Scroll-triggered sections
    │       └── Sticky visualization panel
    │
    └── pages/graph.tsx
        └── KnowledgeGraph                  # Full D3 graph
```

---

## Critical Path Flows

### 1. Concept Page Load

```
User navigates to /foundations/attention-transformers
                    │
                    ▼
[1] Next.js serves pre-rendered HTML (static export)
                    │
                    ▼
[2] React hydration begins
                    │
                    ▼
[3] Dynamic imports trigger:
    - AttentionGeometryViz
    - TransformerArchitectureViz
    - KVCacheViz (etc.)
                    │
                    ▼
[4] D3/Canvas visualizations render
                    │
                    ▼
[5] User interacts (sliders, buttons)
                    │
                    ▼
[6] React state updates → re-render viz
```

### 2. Explorable Scroll Sync

```
User scrolls through /pillars/optimization
                    │
                    ▼
[1] IntersectionObserver detects section in viewport
                    │
                    ▼
[2] ExplorableSection calls setActiveSection(id)
                    │
                    ▼
[3] Context propagates to sticky viz panel
                    │
                    ▼
[4] Visualization component switches based on activeSection
                    │
                    ▼
[5] D3/Canvas updates to show relevant viz
```

---

## Key Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `data/foundationsData.ts` | Single source of truth for 100 concepts | ~1500 |
| `data/visualizationMappings.ts` | Maps concept ID → viz component names | ~45 |
| `pages/foundations/[id].tsx` | Dynamic concept page with KaTeX + viz | ~720 |
| `components/graphs/FoundationsGraph.tsx` | D3 force-directed concept map | ~350 |
| `lib/mathObjects.ts` | Types, MATH_COLORS, safeNumber, lerp, etc. | ~190 |
| `styles/globals.css` | CSS variables, explorable layout styles | ~1650 |
| `next.config.mjs` | MDX + rehype plugins + static export | ~22 |

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 15 (static export) | File-based routing, SSG |
| **Language** | TypeScript | Type safety |
| **Content** | MDX + remark-math + rehype-katex | Math-rich markdown |
| **Visualization** | D3.js, Canvas, SVG | Interactive charts |
| **3D** | Three.js + React Three Fiber | Loss landscapes |
| **Animation** | CSS transitions, requestAnimationFrame | Smooth updates |
| **Styling** | CSS Modules (via styled-jsx) + globals.css | Scoped styles |

---

## Build Output

```bash
npm run build
# Outputs to: out/

out/
├── index.html                    # Homepage
├── foundations/
│   ├── index.html                # Concept grid
│   ├── maximum-likelihood/index.html
│   ├── attention-transformers/index.html
│   └── ... (100 concept pages)
├── pillars/
│   ├── index.html
│   ├── optimization/index.html
│   └── ...
├── concepts/optimizers/
│   ├── overview/index.html
│   └── ...
├── graph/index.html
├── vision/index.html
└── _next/                        # JS/CSS chunks
```

**Key setting:** `trailingSlash: true` generates `/route/index.html` for clean URLs on any static host.

---

## Adding a New Concept (If Expanding Beyond 100)

1. **Add to `data/foundationsData.ts`**:
   ```ts
	   {
	     id: 'new-concept',
	     number: 101,
	     title: 'New Concept Name',
	     ...
	   }
	   ```

2. **Create visualization** in `components/foundations/NewConceptViz.tsx`

3. **Export from `components/foundations/index.ts`**:
   ```ts
   export { default as NewConceptViz } from './NewConceptViz'
   ```

4. **Add to `data/visualizationMappings.ts`**:
   ```ts
   'new-concept': ['NewConceptViz'],
   ```

5. **Add dynamic import** in `pages/foundations/[id].tsx`:
   ```ts
   const NewConceptViz = dynamic(() => import('...'), { ssr: false })
   ```

6. **Add to vizMap** in same file:
   ```ts
   'NewConceptViz': NewConceptViz,
   ```

7. **Update counts** only if you intentionally changed the curriculum size (UI derives most counts from data)

---

*Last updated: 2026-02-06 | 100 concepts | Static export build*
