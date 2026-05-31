# Continuous Function Design Language

Created: 2026-05-20

## Name

**The Living Notebook Lab**

Continuous Function should feel like a serious learner opened a beautiful research notebook and found that the equations, diagrams, papers, code, and experiments were alive.

The character is:

- patient, not flashy
- rigorous, not cold
- tactile, not decorative
- exploratory, not random
- source-grounded, not overconfident
- personal, but not cute

The visual system should make a learner feel: "I know where I am, I know what object I am studying, I know what to try next, and the page is helping me think."

## Pedagogical Spine

Every design decision should support this learning loop:

**Question -> Object -> Prediction -> Manipulation -> Evidence -> Invariant -> Next Move**

This loop is the design language. It should be visible in layout, color, typography, animation, AI prompts, demos, graph routes, paper mapping, and search.

The learner should never be asked to decode the product before they can decode the idea.

## Research Anchors

Use these as design influences, not slogans.

- Cognitive load theory: reduce extraneous load, preserve useful challenge, reveal one active structure at a time. This drives compact panels, clear grouping, low visual noise, and one current object per interaction.
- Multimedia learning: synchronize words, diagrams, symbols, and controls. A label should live near the thing it explains, and visuals should select, organize, and integrate the idea rather than decorate it.
- Retrieval practice and effective study techniques: ask the learner to predict or recall before revealing. Prediction gates, quick checks, and saved observations are not optional garnish; they are the core memory mechanism.
- ICAP active-learning framing: move learners from passive reading toward active, constructive, and interactive behavior. The UI should invite learners to choose, predict, explain, manipulate, compare, and ask.
- Universal Design for Learning: support engagement, representation, and action/expression. The same concept should be approachable through intuition, math, code, visual inspection, paper context, and experiment.
- Desirable difficulty: make the learner work on the right thing. The interface should create friction around the concept claim, not friction around navigation or control decoding.

Reference starting points:

- CAST UDL Guidelines 3.0: https://udlguidelines.cast.org/
- Mayer, Cognitive Theory of Multimedia Learning: https://www.cambridge.org/core/services/aop-cambridge-core/content/view/A49922ACB5BC6A37DDCCE4131AC217E5
- Dunlosky et al. 2013, effective learning techniques: https://www.psychologicalscience.org/publications/journals/pspi/learning-techniques.html
- Chi & Wylie 2014, ICAP framework: https://education.asu.edu/lcl/publications/chi-m-t-h-wylie-r-2014-icap-framework-linking-cognitive-engagement-active-learning
- Sweller 1988 / cognitive load theory background: https://ajet.org.au/index.php/AJET/article/view/2322/0

## Aesthetic Thesis

The site is not a dashboard, a course catalog, or a marketing page. It is a **mathematical field notebook with instruments**.

Use three recurring surfaces:

1. **Atlas**
   Shows where the learner is in a domain, path, graph, or paper route.

2. **Notebook**
   Holds explanation, definitions, math, code, sources, and saved observations.

3. **Lab**
   Lets the learner manipulate a mechanism, commit a prediction, reveal measurements, and carry an invariant forward.

Every page should make these three surfaces legible, even when one dominates.

## Color Semantics

Color should teach state. Avoid one-note palettes and decorative gradients.

- **Ivory paper**: reading, explanation, source cards, quiet notebook surfaces.
- **Deep navy ink**: structure, diagrams, serious lab surfaces, graph space.
- **Teal**: stable truth, correct prediction, convergence, preserved invariant, source-grounded confirmation.
- **Amber**: active variable, selected object, experimental energy, current route step, change in progress.
- **Rose / red**: misconception, failing regime, conflict, caveat, answer mismatch. Use sparingly.
- **Violet / blue**: context, route memory, optional bridge, neighboring concept. Use quietly.
- **Graphite lines**: axes, grids, separators, non-semantic structure.

Never use color alone as the only cue. Pair it with label, position, shape, or icon.

## Typography Voice

Typography should carry cognitive roles:

- **Display serif** for concept identity, big questions, and reflective notebook voice.
- **Humanist sans** for body reading, controls, explanations, and navigation.
- **Monospace** for code, variables, object keys, route chips, and measured state.
- **Math rendering** should be close to explanatory labels and code witnesses.

Rules:

- Reserve hero-scale type for true orientation moments.
- Use compact headings inside tools, cards, and panels.
- Avoid oversized labels inside dense learning surfaces.
- Do not use all-caps as decoration; use it only for small instrument labels.
- Keep line length readable and leave enough whitespace around formulas.

## Layout Grammar

Every important surface needs five visible answers:

- **Where am I?** domain, route, concept, paper, or object.
- **What am I looking at?** equation, code witness, source, mechanism, graph node, or demo state.
- **What should I do?** predict, inspect, run, map, ask, compare, repair.
- **What changed?** measurement, difference, failure, saved observation.
- **Where next?** prerequisite repair, route continuation, paper object, source check, related mechanism.

Preferred shapes:

- Route strips for continuity.
- Object bars for current mathematical objects.
- Prediction gates before reveal.
- Evidence ledgers after meaningful interactions.
- Mechanism stages for diagrams and demos.
- Source cards for trust and caveats.
- Next-move docks for one to three clear actions.

Avoid:

- Decorative cards nested inside cards.
- Large static hero areas that hide the learning action.
- Generic feature-description text inside the app.
- Motion that does not reveal a mechanism.
- Dense grids without a named current object.

## Interaction Character

The site should behave like a thoughtful tutor, not a quiz app.

- Ask for a prediction before revealing a mechanism.
- Reveal measurements and invariants, not just "correct" or "wrong".
- Keep the learner's answer visible after reveal.
- Save the smallest useful observation: what changed, what stayed invariant, what to test next.
- Let learners switch lenses: Learner, Researcher, Experimenter, Teacher.
- Make AI prompts object-attached and evidence-aware.

Feedback tone:

- Calm and specific.
- No triumphalism.
- No shame language.
- Correctness is framed as model repair.
- Surprise is welcome when it clarifies the mechanism.

## Motion And Imagery

Motion should show causality:

- flow of attention
- update of a state vector
- movement along a loss surface
- routing of tokens
- compression, memory, retrieval, or bottleneck formation

Generated imagery should be used for:

- direction boards
- concept covers
- spatial mood
- learner-journey exploration
- static conceptual atmosphere

Repo-native visuals should be used for:

- equations
- diagrams needing precision
- interactive demos
- controls
- accessible UI
- browser-verified learning states

## Component Doctrine

The recurring component families should become the recognizable product character:

- **RouteStateStrip**: continuity and current question.
- **SelectedObjectBar**: one live mathematical object.
- **PredictionCheckpoint**: commit before reveal.
- **ObservationLedgerCard**: memory of useful evidence.
- **WitnessTriad**: equation, code, and demo alignment.
- **ResearchReadingRoom**: source-grounded inspection.
- **GraphProductNavigator**: map as next-move tutor.
- **PaperConceptMapper**: paper clue into route, equation, and experiment.

Each component should ask: what cognitive job am I doing?

## Design QA

A surface is visually good only if it passes these checks:

- The first viewport tells the learner where they are and what to do next.
- One current object or question is visually dominant.
- The learner can predict or inspect before consuming an answer.
- At least two representations are connected: words/math/code/demo/source.
- Controls have stable layout and mobile tap targets.
- Text does not clip, collide, or require decoding the UI.
- Color state is consistent with the platform semantics.
- The page can save or carry a meaningful observation.
- Desktop and 390px mobile have no horizontal overflow.
- Any generated visual idea has been translated into maintainable UI where precision matters.

## Working Method

For major UI/product work:

1. Read `PRODUCT_NORTH_STAR.md`, `CONCEPT_QUALITY_BAR.md`, and this document.
2. Ask Oracle/GPT Pro for a focused critique of the learning goal.
3. Generate one targeted visual direction image if spatial or aesthetic direction is unclear.
4. Extract only the useful interaction ideas.
5. Implement repo-native components and CSS.
6. Inspect in browser on desktop and mobile.
7. Update `TODO.yaml` with evidence and next work.

The design language is successful when a new learner can enter from a paper, graph, search, concept, or demo and feel the same underlying promise: the platform knows what they are trying to understand and helps them take the next rigorous step.
