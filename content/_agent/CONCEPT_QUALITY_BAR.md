# Continuous Function Concept Quality Bar

Source: synthesized from `responses/cf-platform-philosophy-20260501.md`.

## Mission

Continuous Function is a mathematical atlas for understanding modern AI and its foundations. Its job is to take ideas that are mathematically important, practically consequential, and usually poorly internalized, then explain them slowly through intuition, geometry, notation, code, interaction, and honest links to neighboring ideas.

The project should not become:

- a content treadmill where page count matters more than clarity
- a demo gallery where motion substitutes for mechanism
- a research-news tracker
- a false-unification machine where loose analogies are treated as deep links
- a paper-summary site
- a premature community platform before the atlas is excellent
- a framework-churn project

## Page Contract

Every serious concept should help the learner move between four forms without losing the invariant idea:

1. Intuition: the felt problem and mental model.
2. Math: the formal object, assumptions, shapes, and derivation.
3. Code: the executable witness that mirrors the notation.
4. Interactive Demo: the manipulable system that tests a claim.

The existing structure `Intuition -> Math -> Code -> Interactive Demo` is not just a template. It is the pedagogy.

## User-First Clarity

Every product, page, component, explanation, image, and demo should make the learner's next thought easier.

Before adding or shipping anything, ask:

- What is the learner trying to understand, decide, build, or question here?
- Does the first screen make that next step obvious without requiring insider knowledge?
- Does the page reduce cognitive load, or does it ask the learner to decode our product structure?
- Can a student, researcher, professional, professor, or enthusiast each find a valuable entry point without leaving the shared learning loop?
- Does the AI, graph, demo, or visual help the user think, or is it only impressive?

If a feature is beautiful but makes the idea harder to learn, simplify it. If a feature is rigorous but hides the path forward, add orientation. If a feature is powerful but only understandable to the builder, it is not done.

Every learner-facing route must carry the learner's current question forward. A page is not done when it shows concepts, equations, labs, or discussion prompts; it is done when it preserves the learner's current paper/question, names the next best action, marks what is live versus preview, and gives one rigorous interaction that tests the claim.

The homepage should also honor continuity. If a learner already mapped a paper or opened a route in the same browser, home should help them resume the last question before asking them to browse from scratch.

When a learner performs a meaningful interaction, preserve the smallest useful observation, not a full activity log. The best resume state says what changed, what stayed invariant, and what question to test next.

## Publish Rubric

`status: published` should mean the page can survive a serious reader.

Intuition is publishable when:

- it begins with a concrete question, tension, or confusion
- the mental model is specific enough to be useful
- the analogy says what it captures and where it breaks
- the reader can restate the mechanism in one sentence

Math is publishable when:

- every symbol is defined before use
- domains, dimensions, shapes, or probability spaces are explicit when relevant
- the central equation is motivated, decomposed, or derived
- assumptions and common edge cases are named
- notation matches the code

Code is publishable when:

- it is runnable
- it mirrors the math section
- it exposes intermediate quantities where useful
- it avoids production abstractions that hide the idea
- tensor shapes are shown for ML concepts

Visual explanation is publishable when:

- each diagram, animation, or image has a pedagogical job
- visual labels match the notation
- generated images or visual mockups clarify the UI, concept, or mood instead of decorating it
- the visual does not imply a false geometry

Interactive demos are publishable when:

- the demo has one central claim
- controls are few and meaningful
- the learner can predict, manipulate, and observe
- at least one surprising or failure regime is visible
- it works on mobile or degrades cleanly
- timers, listeners, and animation frames are cleaned up

Links are publishable when:

- prerequisites are strict and minimal
- `leads_to` points to concepts that genuinely build on the current one
- `related` is sparse and each edge is defensible in one sentence
- important cross-domain edges state what carries over, what changes, and where the analogy breaks

## Oracle Review Loop

Oracle is a second mind and critique partner, not final authority. Use it extensively for serious concepts, visual systems, and product/design direction, then verify against sources, code, and tests.

For a serious concept or major UI direction, use this loop:

1. Concept brief: domain, reader, prerequisites, one-sentence mechanism, misconceptions, desired demo, sources, and non-goals.
2. Research scan: canonical sources, common wrong explanations, subtle math, and what to avoid.
3. Outline review: order, prerequisites, missing intuition, and the first demo's central claim.
4. Math audit: symbols, dimensions, derivation gaps, hidden assumptions, and misleading simplifications.
5. Code equivalence audit: whether the snippet implements the same object as the math.
6. Visualization critique: controls, visible state, failure regime, and what can be removed.
7. Full draft review: publish/no-publish judgment with issues classified as blocking correctness, blocking pedagogy, important improvement, optional polish, or out of scope.

Stop iterating only when the concept meets the quality bar, validation passes, and remaining feedback is taste-level or future work.

## Image And UI Exploration

Use image generation when a generated bitmap can materially improve understanding or UI direction:

- concept hero/reference visuals for a mathematical scene or learning mood
- UI mockups for an atlas, notebook, lab surface, or concept page before implementation
- scientific/educational diagrams where a raster sketch helps reveal the intended visual language
- visual variants for comparing tone, density, hierarchy, and learner trust

Prefer code-native SVG, canvas, D3, Three, CSS, or existing component primitives when the final artifact must be precise, interactive, accessible, or easy to maintain. Generated images are strongest as exploration inputs or static pedagogical assets, not as substitutes for live demos.

When using image generation for UI/UX:

1. Start from the whole-platform learner objective: the image should help Continuous Function feel like one cohesive, high-quality learning experience, not an isolated pretty screen.
2. Ask Oracle/GPT Pro to critique the learning and interaction goal first.
3. Prompt for the user journey: what a learner, researcher, experimenter, and teacher should understand, notice, decide, and do next.
4. Generate only targeted visual directions or assets, not broad moodboard dumps.
5. Translate good ideas into repo-native components where possible.
6. Verify in the browser on desktop and mobile before calling the UI direction good.

## Slow-Growth Arcs

Prefer compounding arcs over broad topic dumping:

- transformer mechanics into production systems
- representation learning into mechanistic interpretability
- generative dynamics across probability, calculus, vector fields, and physics
- alignment as probability shaping
- inference-time computation and systems constraints

New fields should enter through load-bearing bridges: shared mathematical structures, not broad survey domains.
