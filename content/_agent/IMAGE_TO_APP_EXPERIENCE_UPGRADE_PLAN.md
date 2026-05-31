# Image-To-App Experience Upgrade Plan

Created: 2026-05-24

## Why This Exists

The generated image direction boards make Continuous Function feel more cohesive, immersive, and alive than the current app. The live product has strong ideas and many useful components, but the experience can still feel like assembled panels instead of one continuous learning instrument.

The working diagnosis from GPT Pro is:

```txt
The app has the raw ingredients. The missing layer is a dominant spatial grammar:
route spine -> selected object -> prediction/manipulation instrument -> evidence ledger -> invariant -> next move.
```

The goal is not to add more generated images. The goal is to translate the strongest image-board patterns into repo-native components and interaction states.

## GPT Pro Critique Artifacts

Useful:

- `responses/cf-image-vs-live-app-p0-build-plan-20260524.md`
- `responses/cf-efficient-attention-first-slice-short-20260524.md`

Prompt files:

- `prompts/cf-image-vs-live-app-ux-gap-20260524.txt`
- `prompts/cf-image-vs-live-app-p0-build-plan-20260524.txt`
- `prompts/cf-efficient-attention-first-slice-short-20260524.txt`

Failed or partial runs to ignore except as process evidence:

- `responses/cf-image-vs-live-app-ux-gap-20260524.md`
- `responses/cf-efficient-attention-living-lab-first-slice-20260524.md`

## Design Thesis

Continuous Function should stop treating the Living Notebook Lab as a visual mood and make it the default interaction contract. Every major surface needs the same perceptual structure: a persistent route spine, one selected object, a prediction/manipulation instrument, an evidence ledger, and a next-move dock.

Generated images feel better because they make learning state spatial, tactile, and memorable. The live app should collapse dense panels into a shared lab grammar so Home, Domains, Concept Notebooks, Paper Mapper, Graph, Search, and Study Memory feel like rooms in the same research notebook.

## P0 Upgrade Sequence

1. **Efficient Attention flagship Living Lab**
   - Make the KV-cache memory equation the dominant object.
   - The first viewport should show route spine, selected object, prediction, manipulation controls, evidence, invariant, and next move.
   - Use this as the proof of the shared app grammar.

2. **Attention Path as reference route**
   - Promote the current strongest route module into the canonical walk-the-route experience.
   - Ensure a learner can predict, manipulate, reveal evidence, save invariant, and continue.

3. **Paper Mapper as paper-to-atlas transformation**
   - Make a paper clue visibly become a source span, equation/claim object, prerequisite route, demo witness, and saved next move.
   - Reduce the feeling of form plus panels.

4. **Graph as teaching map**
   - Represent prerequisite pressure, weak link, repair step, evidence, and next experiment.
   - Avoid graph-as-decoration.

5. **Search as route-entry instrument**
   - Results should read as object, prerequisite repair, paper clue, demo witness, and next route.
   - Keep route state visible.

6. **Home/Domains as cockpit/routing rooms**
   - First viewport should show the route, first object, lens, and first prediction/action.
   - Reduce catalog/card-grid feeling.

7. **Study Memory as learner evidence trail**
   - Recast `/me` from contract preview into saved invariants, unresolved confusions, route timeline, and recommended next move.

## First Slice: Efficient Attention Living Lab

### Anchor Object

The dominant object is the KV-cache memory equation for grouped-query attention:

```txt
M_KV = B · L · T · 2 · H_kv · d · s
H_kv = H_q / g
```

This object is ideal because it connects mechanism, visualization, measurement, source evidence, and route memory. It also stays stable across learner, researcher, experimenter, and professor lenses.

### First Prediction

```txt
Before you move the controls: if 32 query heads share K/V heads in groups of 4, what happens to KV-cache memory during decoding compared with ordinary multi-head attention?
```

Answer choices:

```txt
A. It stays about the same, because the number of query heads is unchanged.
B. It drops to about one quarter, because only 8 K/V heads are stored instead of 32.
C. It drops only a little, because sequence length dominates everything.
D. It increases, because each K/V head must serve more queries.
```

### First Controls

Show only these controls first:

- `Sequence length T`: `1k -> 128k`, default `32k`
- `KV sharing group size g`: `1 = MHA`, `2`, `4`, `8`, `32 = MQA`, default `4`
- `Value precision s`: `FP16/BF16 = 2 bytes`, `INT8 cache = 1 byte`

Keep `B`, `L`, `H_q`, and `d` locked as constants in the first viewport.

### Measurement

Changing controls should update:

- highlighted equation term: `T`, `H_kv = H_q / g`, or `s`
- visible number of K/V lanes
- cache memory in GB
- reduction ratio versus MHA
- bandwidth-pressure gauge

### Invariant

```txt
For a fixed batch size, layer count, sequence length, head dimension, and value precision, KV-cache memory scales linearly with the number of stored K/V heads, not with the number of query heads.
```

### Desktop Layout

Three-region first viewport:

1. Route spine
   - domain/concept
   - route question
   - loop ticks: Question, Object, Prediction, Manipulation, Evidence, Invariant, Next Move
   - compact role lenses

2. Object room
   - SelectedObjectBar specimen label
   - dominant KV-cache equation
   - locked constants row
   - prediction checkpoint
   - manipulation controls
   - cache-lane visualization
   - measurement strip

3. Evidence / next-move rail
   - `Pinned evidence for M_KV`
   - ObservationLedgerCard
   - invariant card
   - NextMoveDock

### Mobile Layout

Single-column order at 390px:

1. sticky compact route strip
2. SelectedObjectBar
3. KV-cache equation
4. prediction checkpoint
5. manipulation controls
6. visualization
7. measurement strip
8. collapsed evidence drawer
9. invariant card
10. next move dock

Do not hide prediction, equation, controls, measurement, invariant, or primary next action on mobile.

## Acceptance Checks

- First viewport shows the loop structure in order.
- Exactly one current object visually dominates.
- The selected object is `KV-cache memory equation`, not the whole concept.
- Learner can choose the prediction and see the manipulation bench without desktop scrolling.
- First controls are exactly `T`, `g`, and `s`.
- Changing `g` changes `H_kv`, K/V lanes, memory, and reduction ratio.
- Changing `T` changes memory and cache-block length, but not the reduction ratio for fixed `g`.
- Changing `s` changes memory while preserving lane structure.
- The learner answer stays visible after reveal.
- The invariant sentence appears and can become an ObservationLedgerCard.
- Evidence is pinned beside the object.
- Role lenses change framing and next move only; they do not reset the selected object.
- Desktop does not look like unrelated stacked panels.
- 390px mobile has no horizontal overflow, clipped slider, hidden prediction action, or off-screen measurement.
- The page works without AI assistance.

## What To Avoid

- Do not add more decorative imagery to hide weak interaction structure.
- Do not create a permanent sidebar before route/object/evidence jobs are clear.
- Do not let role lenses fork into four unrelated products.
- Do not make AI the center of the experience.
- Do not bury the selected object below hero copy.
- Do not treat evidence as generic citations.
- Do not make Graph/Search prettier versions of ordinary navigation.
- Do not overbuild personalization before Study Memory has concrete learner artifacts.

## Next GPT Pro Questions

Ask these in smaller runs, not one giant prompt:

1. What is the minimal prop contract for `LivingNotebookLabShell`?
2. How exactly should Paper Mapper transform a paper span into a route object?
3. What should the first reusable `NextMoveDock` API look like?
4. How should Graph represent prerequisite pressure without visual noise?
5. How should Search result cards become route-entry instruments?
6. What should `/me` look like when it becomes a personal evidence trail?
7. Which existing panels should be removed from Efficient Attention first?
8. How should role lenses be visually represented without tab clutter?
9. What screenshot checklist should define "Living Notebook Lab" acceptance?
10. What should the next image generation prompt ask for after this implementation slice?
