# Continuous Function Image Asset Plan

Created: 2026-05-01

## Visual Role

Generated raster images should support orientation, memory, and mood. They should not replace precise interactive diagrams, SVG math, D3, canvas, or React demos when accuracy and manipulation matter.

## Platform Coherence Objective

Every generated UI direction image should optimize for the full learner experience, not just the local screen. The prompt should ask the image model to think like a product designer, teacher, researcher, and learner at once: what the user is trying to understand, what evidence they can inspect, what action comes next, and how this surface fits the same atlas/notebook/lab language as the rest of Continuous Function.

A strong direction image makes the platform feel cohesive, serious, intuitive, and worth returning to. It should clarify:

- where the learner is in a concept, route, paper, graph, or experiment
- what object, equation, code witness, source, or demo is currently alive
- what prediction or observation the learner should make next
- how the same interaction pattern can repeat across Search, Graph, Paper Mapper, concept notebooks, and learning paths
- which ideas should become repo-native components instead of remaining static imagery

## Visual Language

- Warm ivory notebook paper, faint grid, tactile print texture.
- Deep navy ink for structure.
- Teal for correct paths, alignment, and convergence.
- Amber for energy, selection, gradients, and active flow.
- Sparse construction marks instead of decorative clutter.
- No generated text inside images unless the exact asset explicitly needs it.

## Asset Families

1. Editorial direction boards
   - Used for choosing and reviewing the visual system.
   - Current file: `/public/images/editorial/concept-visual-language-contact-sheet.png`

2. Page hero images
   - Used sparingly on landing, domain, and pillar pages.
   - Current file: `/public/images/editorial/home-atlas-hero-direction.png`

3. Concept cover images
   - Used on concept hero surfaces or social/share previews.
   - Current files:
     - `/public/images/concepts/linear-algebra/dot-product-cover.png`
     - `/public/images/concepts/linear-algebra/vector-spaces-cover.png`
     - `/public/images/concepts/optimization/gradient-descent-cover.png`
     - `/public/images/concepts/optimization/adam-cover.png`
     - `/public/images/concepts/optimization/learning-rate-schedules-cover.png`
     - `/public/images/concepts/optimization/loss-landscapes-cover.png`
     - `/public/images/concepts/calculus/derivatives-cover.png`
     - `/public/images/concepts/calculus/computation-graphs-cover.png`
     - `/public/images/concepts/calculus/reverse-mode-autodiff-cover.png`
     - `/public/images/concepts/calculus/backpropagation-cover.png`
     - `/public/images/concepts/probability/probability-basics-cover.png`
     - `/public/images/concepts/probability/random-variables-cover.png`
     - `/public/images/concepts/probability/distributions-cover.png`
     - `/public/images/concepts/probability/maximum-likelihood-cover.png`
     - `/public/images/concepts/probability/bayesian-inference-cover.png`
     - `/public/images/concepts/probability/cross-entropy-cover.png`
     - `/public/images/concepts/information-theory/kl-divergence-cover.png`
     - `/public/images/concepts/alignment/rlhf-cover.png`
     - `/public/images/concepts/alignment/dpo-cover.png`
     - `/public/images/concepts/alignment/kto-cover.png`
     - `/public/images/concepts/alignment/reward-hacking-cover.png`
     - `/public/images/concepts/alignment/process-reward-models-cover.png`
     - `/public/images/concepts/generative-models/vaes-cover.png`
     - `/public/images/concepts/generative-models/diffusion-cover.png`
     - `/public/images/concepts/generative-models/score-matching-cover.png`
     - `/public/images/concepts/generative-models/normalizing-flows-cover.png`
     - `/public/images/concepts/generative-models/flow-matching-cover.png`
     - `/public/images/concepts/representation-learning/representations-cover.png`
     - `/public/images/concepts/representation-learning/sparse-autoencoders-cover.png`
     - `/public/images/concepts/efficiency/efficiency-cover.png`
     - `/public/images/concepts/efficiency/knowledge-distillation-cover.png`
     - `/public/images/concepts/efficiency/mixture-of-experts-cover.png`
     - `/public/images/concepts/efficiency/pruning-cover.png`
     - `/public/images/concepts/efficiency/quantization-cover.png`
     - `/public/images/concepts/attention-transformers/attention-transformers-cover.png`
     - `/public/images/concepts/attention-transformers/efficient-attention-cover.png`
     - `/public/images/concepts/attention-transformers/layer-normalization-cover.png`
     - `/public/images/concepts/attention-transformers/flash-attention-cover.png`
     - `/public/images/concepts/attention-transformers/rope-cover.png`
     - `/public/images/concepts/attention-transformers/long-context-cover.png`
     - `/public/images/concepts/attention-transformers/tokenization-vocabulary-cover.png`
     - `/public/images/concepts/attention-transformers/ssm-hybrids-cover.png`
     - `/public/images/concepts/llm-systems/llm-serving-cover.png`
     - `/public/images/concepts/llm-systems/decoding-sampling-cover.png`
     - `/public/images/concepts/llm-systems/speculative-decoding-cover.png`
     - `/public/images/concepts/llm-systems/moe-serving-cover.png`
     - `/public/images/concepts/llm-systems/structured-decoding-cover.png`
     - `/public/images/concepts/scaling/test-time-compute-cover.png`
     - `/public/images/concepts/scaling/double-descent-cover.png`
     - `/public/images/concepts/scaling/ntk-cover.png`
     - `/public/images/concepts/scaling/scaling-laws-cover.png`
     - `/public/images/concepts/scaling/pretraining-data-mixtures-cover.png`
     - `/public/images/concepts/scaling/tree-search-reasoning-cover.png`

4. Component backplates
   - Subtle supporting imagery behind demo shells, graph pages, and learning paths.
   - Should be quiet enough that controls and math stay readable.

5. AI-first UX direction boards
   - Used as implementation references for pages, components, responsive layouts, learner journeys, navigation, and assessment loops.
   - Current files:
     - `/public/images/editorial/ai-first/concept-bridge-directions.png`
     - `/public/images/editorial/ai-first/page-experience-directions.png`
     - `/public/images/editorial/ai-first/component-system-directions.png`
     - `/public/images/editorial/ai-first/responsive-learning-directions.png`
     - `/public/images/editorial/ai-first/advanced-concept-directions.png`
     - `/public/images/editorial/ai-first/learner-journey-directions.png`
     - `/public/images/editorial/ai-first/discovery-navigation-directions.png`
     - `/public/images/editorial/ai-first/assessment-feedback-directions.png`
   - Working implementation boards in `responses/ux-vision/generated/`:
     - `/responses/ux-vision/generated/continuous-function-ux-direction-board-20260520.png`
     - `/responses/ux-vision/generated/living-notebook-lab-design-language-20260520.png`

## First Batch Prompt Summaries

- Contact sheet: six-panel visual language board covering vector projection, Bayesian updating, gradient descent, transformer attention, structured decoding, and diffusion/flow.
- Home hero: an explorable mathematical atlas surface with concept neighborhoods and linked diagram motifs.
- Dot Product cover: two vectors, projection shadow, angle arc, coordinate grid.
- Structured Decoding cover: finite automaton gates valid token paths while invalid paths fade.

## Second Batch Prompt Summaries

- Vector Spaces cover: basis arrows, translucent subspace sheet, linear-combination vector.
- Gradient Descent cover: contour loss landscape, descending step path, convergence toward a basin.
- Adam cover: adaptive optimizer path with first-moment smoothing, second-moment scaling, and corrected step arrows.
- Learning Rate Schedules cover: warmup, decay, cycling, and restart curves over a stable training timeline.
- Loss Landscapes cover: contour basins contrasting flat and sharp minima with descent and perturbation trajectories.
- Derivatives cover: smooth curve, shrinking secant, tangent slope, and local rate-of-change marker.
- Computation Graphs cover: typed computation nodes with forward value flow and backward sensitivity arrows.
- Reverse-Mode Autodiff cover: forward tape of operations contrasted with a reverse cotangent sweep.
- Backpropagation cover: neural network layers with activations flowing forward and error signals propagating backward.
- Probability Basics cover: sample space with overlapping event regions, probability particles, and a conditional-renormalization side panel.
- Random Variables cover: raw outcomes flowing through a measurement map into support bars and grouped value mass.
- Distributions cover: probability mass and density shapes pushed into PMF bars and smooth law curves.
- Cross-Entropy cover: target/model categorical distributions with agreement mass and mismatch ribbons.
- Scaled Dot-Product Attention cover: token rows, score matrix, active query path, and routed output.

## Third Batch Prompt Summaries

- Maximum Likelihood cover: Bernoulli observations, sufficient statistic brace, NLL-like curve, and parameter marker moving toward the empirical optimum.
- Bayesian Inference cover: prior distribution, likelihood evidence shape, and posterior distribution sharpening into a compromise belief.
- KL Divergence cover: two probability distributions with asymmetric mismatch regions and local contribution bars, without generated text labels.
- Process Reward Models cover: branching reasoning tree with step-level verifier badges, a clean selected path, and a fading invalid path.

## Fourth Batch Prompt Summaries

- RLHF cover: paired candidate trajectories, a human preference gesture, a reward landscape, and an anchored policy distribution.
- DPO cover: chosen/rejected trajectories directly tipping a log-odds balance and updating a model distribution without a reward-model stage.
- KTO cover: pointwise desirable/undesirable feedback streams feeding an asymmetric value curve and cautious policy shift.
- Reward Hacking cover: proxy-reward hill, true-goal target, and a high-scoring path that bends into a misaligned loophole.

## Fifth Batch Prompt Summaries

- VAEs cover: data cloud through encoder funnel into latent uncertainty, then decoder flow back to reconstructed samples with posterior-approximation gap.
- Diffusion cover: noisy particles progressively denoised through score-vector fields into a structured data manifold.
- Score Matching cover: noisy samples with score-vector fields pointing toward high-density structure and denoising directions.
- Normalizing Flows cover: simple latent grid transformed by reversible warps, with local volume-correction patches.
- Flow Matching cover: particles transported from diffuse source to target distribution by a learned velocity field, with rectified paths becoming straighter.
- Representations cover: embedding clusters, feature directions, neighborhoods, and bridge geometry between learned spaces.
- Sparse Autoencoders cover: dense activations passing through sparse dictionary atoms, selected features, and reconstructed outputs.

## Sixth Batch Prompt Summaries

- LLM Serving cover: prompt-token slabs through prefill, KV-cache shelves, continuous batching lanes, and staggered decode streams.
- Speculative Decoding cover: fast draft token chain checked by a larger verifier gate, with accepted tokens passing forward and rejected branches correcting.
- MoE Serving cover: sparse routed tokens fan out to experts, with all-to-all exchange rails and an overloaded straggler expert.
- Test-Time Compute cover: prompt branches into candidate traces, spends budget ticks, passes through verifier gauges, and selects a stronger candidate.

## Seventh Batch Prompt Summaries

- FlashAttention cover: a ghosted full attention matrix remains unmaterialized while one active tile streams through a compact scratchpad with online-softmax and accumulator cues.
- Long Context cover: a long token scroll combines stretched rotary phase arcs, paged KV-cache blocks, compressed cards, grouped rails, and a few selective long-range query links.
- Pretraining Data Mixtures cover: raw web, math, code, and multilingual source streams pass through filtering, deduplication, mixture-weight controls, token-distribution bars, validation curves, and a separate leakage warning gauge.
- Scaling Laws cover: empirical points and descending power-law curves sit over compute contours, with one balanced frontier point contrasted against inefficient off-frontier points.
- Tree Search Reasoning cover: a partially expanded reasoning tree shows budget ticks flowing to selected frontiers, local score gauges, fading weak branches, and backed-up value arrows.

## Eighth Batch Prompt Summaries

- Efficient Attention cover: KV-cache sharing, grouped query lanes, and memory-bandwidth reduction cues.
- Layer Normalization cover: activation vector bars being centered, scaled, and stabilized by a normalization panel.
- RoPE cover: rotary position vectors, relative phase arcs, and query-key geometry.
- Tokenization and Vocabulary cover: text fragments becoming token blocks, merge paths, and vocabulary entries.

## Ninth Batch Prompt Summaries

- Efficiency cover: compression, memory bandwidth, sparse routing, and speed-quality tradeoff curves.
- Knowledge Distillation cover: teacher-to-student transfer with softened probability structure.
- Mixture of Experts cover: tokens routed sparsely into experts with load imbalance and routing paths.
- Pruning cover: dense weight grids being trimmed into a smaller sparse structure.
- Quantization cover: smooth weights snapped to discrete integer levels with quantization error cues.
- Decoding and Sampling cover: logits, top-p filtering, temperature shaping, and sampled token paths.
- Double Descent cover: interpolation threshold, first descent, peak, and second descent generalization curve.
- NTK cover: kernel matrix, infinite-width curve, and function-space training dynamics.

## SSM Hybrids Follow-Up Prompt Summary

- SSM Hybrids cover: a growing explicit cache ribbon is contrasted with a compact recurrent state carried forward through time, selective write-copy-forget gates, and a small local-attention region near the current step.

## Rollout Order

1. Fix visual contrast issues on the existing light notebook system before wiring images broadly.
2. Add one image field to concept metadata or a small mapping layer. Done via `/lib/conceptImages.ts`.
3. Wire `dot-product` and `structured-decoding` first. Done via the concept hero snapshot.
4. Wire the homepage atlas image and editorial prototype contact sheet. Done.
5. Generate concept covers domain by domain, starting with published critical prerequisites. In progress; seventh batch wired for transformer/scaling bridges, and the SSM Hybrids review page now has a focused follow-up cover.
6. Generate component backplates only for shared shells after the concept image contract is stable.

## 2026-05-02 UX Translation

- The generated images are now treated as atmosphere and spatial reference, not only as inline artwork.
- `NotebookLayout` accepts an ambient image and uses it as a muted page field behind the hero.
- The homepage atlas image now forms the immersive first-screen surface behind the learning-path chooser.
- Concept pages with registered cover images use the cover as both the hero image and a subtle background field.
- Concept notebooks now reuse registered cover images inside `ConceptMechanismStoryboard` as a muted visual anchor, and pages without registered covers still get a code-native animated SVG mechanism board.
- Concept notebooks now reuse registered cover images inside `ConceptVisualInquiryPanel` as an inspectable image field with animated scan/focus/flow overlays, cropped cue tiles, prediction choices, and a route-saved visual reveal.
- Mobile concept pages use a single-column metadata stack to keep the image-led hero from causing horizontal overflow.
- The new AI-first UX direction boards are preserved under `/public/images/editorial/ai-first/` and surfaced in `/editorial-prototype`.
- `SurfaceBackplate` translates the visual language into code-native atlas, companion, demo, path, and assessment fields for shared shells.
- The homepage learning loop, track grid, domain atlas, AI companion, section AI actions, and `VizShell` now have quiet implementation backplates that do not replace precise demos.
- Next step: generate and wire covers for the remaining high-traffic transformer/scaling bridge pages before creating component backplates.
