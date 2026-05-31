# AI-First Product Direction

Created: 2026-05-02

## Product Thesis

Continuous Function should become the best of several learning modes at once:

- the guided, low-friction interactivity of Brilliant
- the free structured foundation-building of Khan Academy
- the visual mathematical play of Mathigon
- the rigor and problem-solving seriousness of AoPS, Project Euler, and MIT OCW
- the code-by-doing muscle of Codecademy, freeCodeCamp, Exercism, and DataCamp
- an AI companion that helps each learner turn content into understanding

The platform is not only a library of explanations. It is an AI-first learning environment where the content, demos, code, and companion all reinforce the same concept.

## Experience Pillars

1. Guided atlas
   Learners should never feel dumped into a random graph. The app should recommend paths, prerequisites, and next steps.

2. Interactive notebook
   Every serious concept keeps the existing contract: Intuition -> Math -> Code -> Interactive Demo.

3. AI beside the content
   AI should sit next to the learner while they read, code, and manipulate demos. It should explain, quiz, diagnose misconceptions, connect prerequisites, and turn notation into runnable code.

4. Learn-by-doing loops
   The best moment is: read a claim, predict the demo, manipulate it, ask AI why the result changed, then try a small code witness.

5. Joy and trust
   The interface should feel beautiful, tactile, and exploratory, but never sacrifice correctness, accessibility, or the learner's agency.

## AI Companion Contract

The companion should:

- know the current concept, domain, section, prerequisites, and next concept
- produce Socratic help before giving full answers
- explain with intuition first, then notation
- generate short checks for understanding
- connect math to code and demo controls
- expose uncertainty and avoid false analogies
- end with one concrete thing to try on the page

The companion should not:

- replace the concept page
- hide weak content behind fluent generated text
- hallucinate prerequisites or graph links
- become a generic chat bubble with no page context
- give answers without helping the learner build a mental model

## Implementation Track

Done:

- Added a static-export-safe prompt companion component.
- Wired the companion into the homepage AI-first band.
- Wired the companion into concept-page rails with page-specific context.
- Added per-section AI actions for explain, quiz, prerequisite connection, code translation, and misconception debugging.
- Added a static-export-safe gateway contract: `NEXT_PUBLIC_CF_AI_GATEWAY_URL` enables a separate companion service, while missing config keeps prompt-copy fallback.
- Added lightweight learner preferences for goal, comfort level, explanation style, and current stuck reason.
- Preserved the AI-first generated UX image boards as project assets and exposed them in `/editorial-prototype` as implementation references.
- Added code-native `SurfaceBackplate` fields for atlas, companion, demo, path, and assessment surfaces so generated-image texture translates into reusable UI.
- Added reader-value lenses for learners, researchers, and professors so the homepage names why the same atlas matters at different depths.
- Added conceptual bridges to concept pages, route bridge cues to domain pages, and an editorial search surface so moving between ideas feels intentional instead of like jumping between disconnected pages.
- Brought `/vision`, `/pillars`, and `/graph` onto the light editorial surface as a bridge step toward one coherent product experience.
- Deepened `/vision`, `/pillars`, and `/graph` into first-class notebook routes with hero figures, reader lenses, bridge panels, compact mobile navigation, responsive graph framing, and clearer transitions into domains and concept notebooks.
- Bridged legacy `/foundations` index and detail routes into the editorial notebook system while preserving existing dark interactive demos and making the concept map usable on desktop and mobile.

Next:

- Deploy the companion gateway described in `content/_agent/AI_COMPANION_GATEWAY_CONTRACT.md`.
- Let demos emit state summaries that the companion can use.
- Let learners attach highlighted paragraph, equation, or code selections to the companion prompt.
- Build a reusable AI-first practice shell from the assessment-feedback direction board.
- Audit the highest-traffic legacy visualization components for mobile framing, companion state summaries, and migration candidates into filesystem concept notebooks.
