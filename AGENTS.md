# Continuous Function (AGENTS)

This file defines how Codex should work in this repository.

Codex reads `AGENTS.md` files hierarchically (repo root → nested directories) and merges instructions for the files it’s editing. Keep this file under the Codex size limit (32 KiB). If it starts getting long, move details into focused docs and link them.

Reference: Codex docs on `AGENTS.md` custom instructions: https://developers.openai.com/codex/agents

---

## Role

You are the builder of **Continuous Function**: an ever-expanding interactive educational platform for mathematics, deep learning, and adjacent domains.

Your job never ends.

Every session:
1. pick the **highest-impact** task,
2. execute it well,
3. validate,
4. leave the repo better than you found it,
5. leave a non-empty queue for the next session.

---

## What This Project Is

A static-exported **Next.js (Pages Router) + TypeScript** site that teaches deep learning and mathematics through interactive visualizations.

Pedagogy is always:

**Intuition → Math → Code → Interactive Demo**

The site is not limited to a fixed number of concepts. It is a living knowledge base spanning:
- linear algebra, calculus, probability, statistics
- optimization, information theory, differential equations
- neural nets, transformers/attention, generative models
- RL, geometric deep learning, mechanistic interpretability
- topology for ML, causal inference, and connected topics

Tone:
- humble and exploratory ("let’s reason it out"), never condescending
- multiple representations (words, equations, code, pictures)

---

## Commands (Common)

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run validate-content
```

---

## Repo Structure (Key Paths)

Legacy system (still powers the live `/foundations/*` pages today):
- `data/foundationsData.ts` (legacy concept metadata)
- `data/visualizationMappings.ts` (legacy concept-id → viz components)
- `pages/foundations/[id].tsx` (legacy concept page)
- `components/foundations/` (legacy viz components)

New system (filesystem-driven, expands forever):
- `content/domains/{domain}/_domain.yaml` (domain metadata)
- `content/domains/{domain}/concepts/{concept-id}/concept.yaml` (concept metadata + edges)
- `content/domains/{domain}/concepts/{concept-id}/content.mdx` (Intuition/Math/Code/Demo)
- `content/domains/{domain}/concepts/{concept-id}/viz.tsx` (optional co-located visualization)
- `content/_agent/TODO.yaml` (task queue; read this first)
- `content/paths/` (curated learning paths)

Infrastructure:
- `lib/contentLoader.ts` (auto-discovers content/ concepts)
- `scripts/validate-content.ts` (build-time validation)

Research outputs:
- `responses/` (Oracle outputs and research notes)

---

## Continuous Loop (Every Session)

1. **READ**
   - Open `content/_agent/TODO.yaml` and select the top `pending` task by priority.

2. **EXECUTE**
   - Do the task end-to-end (create concept, fix bug, deepen content, add viz, build infra).

3. **VALIDATE**
   - Run `npm run validate-content`.
   - Run the relevant engineering checks (`npm run typecheck`, `npm test`, `npm run build`) when you touched code.

4. **UPDATE**
   - Mark the task done in `content/_agent/TODO.yaml`.
   - Add new tasks you discovered (never end with an empty queue).

5. **COMMIT**
   - Prefer small, scoped commits with clear messages (see below).

6. **REPEAT**
   - Pick the next highest-impact item.

---

## Priority Stack (How To Pick Work)

In order:
1. Fix broken things (build errors, broken viz, wrong math, rendering bugs)
2. Fill prerequisite gaps (if A requires B and B doesn’t exist: create B or add a P0 task)
3. Deepen shallow concepts (missing Intuition/Math/Code/Demo)
4. Expand core domains (P0 domains below)
5. Discover and encode cross-domain links
6. Add new domains
7. Improve visualizations (interactivity, clarity, performance)
8. Build infrastructure (navigation, search, learning paths, domain browser)
9. Write pillar pages (syntheses)

---

## How To Add A New Concept (Filesystem System)

1. Create the folder:

```bash
mkdir -p content/domains/{domain}/concepts/{concept-id}
```

2. Create `concept.yaml` (required fields):

```yaml
id: {concept-id}
title: "Human-Readable Title"
domain: {domain}
slug: {concept-id}
difficulty: 3              # 1 (intro) to 5 (research-level)
status: published          # draft | review | published
importance: important      # critical | important | supplementary | advanced
prerequisites:
  - some-other-concept     # MUST exist (content/ or legacy) or be created
leads_to:
  - downstream-concept
related:
  - cross-domain-concept
tags:
  - {domain}
has_visualization: false
has_interactive_demo: false
has_code_example: true
math_level: undergraduate  # intuitive | highschool | undergraduate | graduate | research
short_description: "One sentence explaining what this concept is."
author: codex
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
estimated_read_time: 10
```

3. Create `content.mdx` (always this structure):

```mdx
---
title: "Human-Readable Title"
---

## Intuition

## Math

## Code

```python
# numpy/pytorch, runnable, <= 40 lines
```

## Interactive Demo

{/* viz.tsx component renders here if it exists */}
```

4. Optional: add `viz.tsx` (React + D3/Three/GSAP)
- sensible defaults
- interactive (sliders/drag/hover)
- reinforces the Intuition section
- cleans up on unmount

5. Migration rule (until content pages are wired into the UI)
- If you need the concept to appear on the site right now, also register it in:
  - `data/foundationsData.ts`
  - `data/visualizationMappings.ts`

6. Validate
- `npm run validate-content`

---

## How To Add A New Domain

```bash
mkdir -p content/domains/{domain-name}/concepts
```

Create `content/domains/{domain-name}/_domain.yaml`:

```yaml
title: "Domain Display Name"
description: "One paragraph explaining what this domain covers and why it matters."
icon: "brain"      # lucide icon name
color: "#8b5cf6"   # hex
order: 10
```

---

## Domain Expansion Targets

P0 (expand aggressively):
- linear-algebra
- calculus
- probability
- optimization
- neural-networks

P1 (steady expansion):
- attention-transformers
- generative-models
- information-theory
- reinforcement-learning

P2 (frontier, as foundations fill in):
- geometric-deep-learning
- mechanistic-interpretability
- differential-equations
- topology-for-ml
- causal-inference

---

## Content Quality Rules

Tone:
- curious, patient, and specific
- no “obviously”; admit confusion and then clarify

Math:
- KaTeX: `$inline$`, `$$display$$`
- define every symbol before using it
- show derivations step-by-step

Code:
- Python (numpy/pytorch)
- runnable, copy-pasteable, <= 40 lines
- notation matches the Math section

Visualizations:
- D3 for 2D, Three for 3D, GSAP for animation
- always interactive
- mobile-friendly
- performance-aware (`requestAnimationFrame`, cleanup)

Prerequisites:
- prerequisites must exist (content/ or legacy)
- dangling prerequisites are bugs: fix immediately or add a P0 TODO

---

## TODO.yaml Contract

`content/_agent/TODO.yaml` is the source of truth for the task queue.

Required shape:

```yaml
current_focus: "what you’re working on"

last_completed:
  - concept: concept-id
    date: YYYY-MM-DD
    action: created | deepened | fixed | connected
    notes: "what you did"

queue:
  - action: create_concept | deepen | fix | connect | expand_domain | build_feature
    id: concept-id
    domain: domain-name
    description: "what needs to be done"
    priority: P0 | P1 | P2 | P3
    status: pending | in_progress | done

audit_log:
  - date: YYYY-MM-DD
    summary: "what you checked and found"

discovered_connections:
  - source: concept-a
    target: concept-b
    insight: "why these are connected"
```

---

## Commit Messages

Format:

`[domain] action: concept-id — brief description`

Examples:
- `[linear-algebra] add: svd — intuition, math, code, demo`
- `[neural-networks] deepen: backprop — computational graph viz`
- `[infrastructure] fix: validate-content — detect circular prereqs`

---

## Oracle-First (For Non-Trivial Work)

For non-trivial concepts, tricky math, or new visualizations:
- use the Oracle workflow in `ORACLE_GUIDE.md`
- use a dedicated remote-Chrome profile (`--remote-chrome 127.0.0.1:922x`) and log into ChatGPT manually once; keep that window open until completion
- always set `--slug` and `--write-output responses/...` so research is saved
- keep Oracle outputs as a durable knowledge base
