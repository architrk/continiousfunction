# Flagship Path Product North Star Audit

Date: 2026-05-04

## Scope

Audit the Attention -> Efficient Attention -> RoPE -> FlashAttention -> Long Context -> LLM Serving -> Decoding path against:

- `content/_agent/PRODUCT_NORTH_STAR.md`
- `content/_agent/CONCEPT_QUALITY_BAR.md`

The question was whether the first flagship path already behaves like the premier one-stop research-learning experience Continuous Function is aiming to become.

## Current Strengths

- The path has a clear first-screen promise: move from attention math to KV memory, serving latency, and decoding behavior in one connected workspace.
- The path is not a passive article. It includes stage navigation, equation objects, symbol/shape explanations, a KV memory lab, MHA/GQA/MQA comparison, and a decoding probe.
- The KV lab is prediction-first: learners must commit to the memory term changed by GQA/MQA before using the calculator.
- The path can carry a paper-map or graph question into the route through the browser-local learning route snapshot.
- Discussion anchors already exist for claims, equations, toy experiments, and misconceptions.
- Local route observations preserve the useful invariant: what changed, what stayed fixed, the result, the caveat, and the next question.

## Fixes Applied

- Saved attention-serving snapshots now include route source objects, including live concepts and object-attached discussion placeholders.
- The attention-serving module now includes a route-aware AI companion prompt surface.
- The AI companion is gradual and static-export-safe: it can copy grounded prompts now and use the gateway when configured.
- Prompt modes are attached to actual research-learning objects: paper claim, equation object, lab observation, and research discussion thread.
- Companion context includes active stage, active equation, current KV lab settings, current KV estimate, saved observation when present, and the next best step.
- Saved route snapshots now support a `currentObject` payload.
- The module now has an explicit AI Focus Object selector for stages, equations, lab checkpoints, decoding probes, and discussion anchors.
- Selecting a route object updates the companion context and persists the focused object into the browser-local route snapshot.
- Paper-map saves now carry typed source objects and the currently inspected equation object.
- Curated graph routes and computed graph routes now choose a durable current object for resume and AI context.
- Home, paper-map, graph, and attention-serving now expose the saved question, current object, last observation, and one next action before asking the learner to browse again.
- Saved route updates broadcast locally so resume surfaces can refresh after a route is saved or cleared in the same browser session.
- Object discussion anchors now render as a research reading-room surface instead of static placeholder cards.
- The reading room shows the anchored object question, expected evidence, source ids, resolution rubric, and a grounded AI handoff prompt.
- Selecting a paper-map, graph, or attention-serving discussion object saves that exact anchor as the current route object.
- Research-room prompts keep AI gradual: copyable grounded prompts now, gateway-assisted discussion later, no generic chatbot.
- Paper-map route snapshots now carry bounded source evidence metadata: source ids, source detail, confidence, and the selected source-box equation when available.
- Graph saves preserve matching paper evidence when a paper-map route is converted into a graph route.
- Attention-serving now shows a compact paper evidence rail with original clue, grounding status, selected equation/source confidence, source ids, claims, and source detail.
- The companion context now includes carried paper evidence so AI help can distinguish source-checked evidence from local-preview assumptions.
- Attention-serving now includes a local route progress panel with stage readiness, checkpoint status, object focus count, and next repair.
- The saved route snapshot now supports a bounded `routeProgress` payload for stage readiness, checkpoints, resolved/inspected object ids, and next repair.
- KV checkpoints, route object focus changes, and reading-room focus changes persist updated progress into the browser-local route snapshot.
- The progress model distinguishes ready, active, next-repair, and not-started stages so unfinished future concepts do not all look like failures.
- Route progress includes a research discussion / AI handoff checkpoint, keeping AI help attached to the exact focused object rather than the whole page.

## Remaining Gaps

### P0: Generalize The North-Star Quality Bar Beyond The Flagship Route

The flagship route now has a product loop, but the broader atlas still needs an explicit coverage audit against the north star: intuition, math, runnable code, prediction-first demos, concept links, paper entry, source grounding, resumability, and AI/research discussion readiness.

## Completed Follow-Up

Object selection now drives AI context:

1. Added selected route object state for stage, equation, lab checkpoint, decoding probe, and discussion anchor.
2. Passes the selected object into the companion context.
3. Saves the selected object as `currentObject` in the route snapshot.
4. Validates `currentObject` through the learning-route snapshot contract tests.

Resume affordances now cover the first flagship loop:

1. Added a saved-route continuity banner for paper-map and graph.
2. Expanded home and attention-serving resume panels with current object and next action.
3. Paper-map, curated graph routes, computed graph routes, and KV lab checkpoints now all persist a current object.
4. Verified that saved route state survives the paper-map -> graph -> attention-serving -> home loop at the snapshot contract level.

Research reading rooms now make object discussion useful before a backend exists:

1. Show the anchored paper, claim, equation, lab, or misconception question as the first-class object.
2. Add expected evidence, source links, open assumptions, and "what would resolve this?" rubrics.
3. Keep AI gradual: copy grounded prompts first, gateway-assisted research discussion later, no generic chatbot.
4. Feed the selected discussion object back into the saved route's `currentObject` and companion context.

Paper-to-path source continuity now carries evidence into the flagship route:

1. Display original paper clue, extracted equation confidence, and source boxes inside the attention-serving route when carried from paper-map.
2. Let the route distinguish source-checked claims from local-preview claims before the learner opens a lab.
3. Add a compact route evidence rail that can feed both the reading room and AI companion.
4. Verify paper-map -> graph -> attention-serving preserves the same paper object, equation object, and source confidence labels.

Route-level progress now makes the flagship slice locally resumable:

1. Persist stage readiness for attention math, cache mechanics, position behavior, memory movement, long context, serving, and decoding.
2. Show which prediction checkpoints and reading-room objects have been resolved.
3. Compute the next prerequisite repair from unfinished stages and saved observations.
4. Add a research discussion / AI handoff checkpoint so gradual AI starts from grounded route state.
5. Keep the progress model local and snapshot-compatible before adding accounts.

## Next Recommended Move

Audit the whole published atlas against the product north star:

1. Build a coverage matrix for published concepts: intuition, math, code witness, prediction-first demo, source grounding, links, and AI context.
2. Identify the highest-traffic or flagship-adjacent concepts that lack one of the four required concept ingredients.
3. Convert the audit into a P0/P1 fix queue before adding more breadth.
4. Use the existing validator only as a support signal, not as proof of north-star quality.
5. Treat research discussion readiness and gradual object-attached AI readiness as first-class audit columns.
