# Product North Star Concept Coverage Audit

Date: 2026-05-04

## Scope

Audit the published filesystem atlas against:

- `content/_agent/PRODUCT_NORTH_STAR.md`
- `content/_agent/CONCEPT_QUALITY_BAR.md`
- the current `content/domains/*/concepts/*` tree
- the concept rendering scaffold in `pages/domains/[domain]/[slug].tsx`
- the concept notebook scaffold in `components/concepts/ConceptNotebookPage.tsx`

This is not a correctness review of every concept. It is a product-quality coverage audit: does the atlas have the required visible ingredients to become the premier one-stop research-learning destination for modern deep learning math?

## Method

I inspected the current filesystem concepts and scored each concept against seven evidence columns:

- `I`: has a substantive `## Intuition` section.
- `M`: has a substantive `## Math` section with formula or formal notation cues.
- `C`: declares `has_code_example: true` and contains at least one code fence in `## Code`.
- `D`: declares `has_interactive_demo: true` and has a co-located `viz.tsx`.
- `P`: has a live demo plus prediction/reveal/checkpoint cues in MDX or viz code.
- `L`: has enough route connectivity: at least two total graph links and at least one `leads_to` edge.
- `S`: has explicit source/paper/reference cues in MDX or concept `sources` metadata.

These are conservative heuristics. A `Y` means the artifact is present, not that the explanation is excellent. A `-` means the artifact is missing or weakly visible and needs human review before claiming north-star quality.

## Summary

- Filesystem concepts audited: 70.
- Published concepts: 51.
- Review concepts: 19.
- All 70 concepts currently have visible Intuition, Math, and Code sections.
- 56/70 have live demos by flag plus `viz.tsx`.
- 50/70 have clear prediction/reveal/checkpoint cues.
- 57/70 have explicit source/paper/reference cues or source metadata.
- 51/70 have structured `sources` metadata that can render in the concept source panel.
- 66/70 have enough graph connectivity by the heuristic.

Published-only coverage:

| Column | Published coverage | Product reading |
| --- | ---: | --- |
| Intuition | 51/51 | The template is broadly filled. |
| Math | 51/51 | Formal sections exist; correctness still needs per-page review. |
| Code | 51/51 | Runnable-code witness surface is broadly present. |
| Live demo | 51/51 | Every published concept now has a live interactive demo. |
| Prediction-first cue | 51/51 global shell; concept-specific retrofits in progress | Every published route now gets a demo-shell prediction checkpoint. Reverse-Mode Autodiff, Probability Basics, Random Variables, Variational Autoencoders, Tree Search Reasoning, Dot Product, Vector Spaces, Derivatives, Computation Graphs, Backpropagation, Scaled Dot-Product Attention Geometry, Self-Attention Value Mixing, Attention Backprop Gradient Credit, Transformer Architecture Residual Shape, and Structured Decoding Valid-Token Mask are completed in-demo retrofits in this P0 pass; older demos still need deeper concept-specific pre-reveal framing. |
| Links | 51/51 | Every published concept now has enough graph connectivity by the heuristic. |
| Source grounding | 51/51 | Every published concept now has explicit source/reference grounding. |
| Source metadata panel | 51/51 | Every published concept now renders the structured concept source panel. |

## Global AI, Discussion, And Resumability Readiness

The concept page scaffold now provides a stronger baseline for gradual AI and discussion:

- `ConceptNotebookPage` adds `ConceptMechanismStoryboard` to every filesystem concept page, giving each page a code-native animated visual board, cover-image anchor when registered, stage switching, prediction-lens commitment, and reveal check before the formal sections.
- `ConceptNotebookPage` adds `ConceptVisualInquiryPanel` to every filesystem concept page, turning registered concept cover imagery into an inspectable learning surface with animated scan/focus/flow overlays, cropped cue tiles, lens selection, inspection-depth control, prediction choices, and a route-saved reveal observation.
- `ConceptNotebookPage` adds `DemoPredictionCheckpoint` to the live demo shell, so every registered concept demo now asks the learner to choose a prediction lens and reveal a check before treating the demo result as known.
- Demo checkpoint reveals now persist into the browser-local learning-route snapshot as `prediction-checkpoint` observations focused on the exact visualization discussion object, so the continuity banner and future AI companion can resume from the learner's revealed demo lens instead of only the page URL.
- Demo checkpoints now listen to the shared `emitDemoState` event for the current concept. Demos that emit state can carry measured controls and outcomes, such as GQA's Q-to-KV mapping, KV-cache GB, MHA baseline, ratio, and reduction factor, into the saved observation and research-room prompt.
- The KV cache dashboard now emits its formula controls and measured outcomes into that same checkpoint path. Efficient Attention's default dashboard and Long Context's KV Cache tab can carry context length, heads, bytes, KV cache, MHA baseline, and memory-reduction values from the live demo into the saved observation and grounded AI handoff.
- The RoPE visualizer now emits relative-position geometry state into the checkpoint path. The RoPE route and Long Context's RoPE tab can carry token positions, global shift, relative distance, delta theta, dot product, and the translation-invariant offset check into the saved observation and grounded AI handoff.
- The Layer Normalization route now has a prediction-first centering reveal. The route can carry learner prediction, reveal state, prediction correctness, expected operation, normalization invariant, and lab mount state before handing off to the child lab's vector dimension, mean, standard deviation, RMS, output cosine similarity, max output delta, and scalar-op reduction.
- The Tokenization & Vocabulary route now has a prediction-first tokenizer-boundary checkpoint. The route can carry learner prediction, reveal state, prediction correctness, expected boundary, boundary invariant, tokenizer microscope mount state, and then the child microscope's tokenizer mode, normalization, character and UTF-8 byte counts, token count, vocabulary size, token density, BPE/unigram/byte comparison counts, Unicode warnings, and challenge phase into the saved observation and grounded AI handoff.
- The Long Context route now has a prediction-first constraint router. The route can carry active demo, learner prediction, reveal state, prediction correctness, expected constraint, constraint invariant, and demo-panel mount state before handing off to Sliding Window, RoPE, or KV Cache child demos.
- The RoPE route now has a prediction-first phase-invariant checkpoint. The route can carry learner prediction, reveal state, prediction correctness, expected invariant, phase invariant, and rotating-vector lab mount state before handing off to the child RoPE geometry lab.
- The core Attention/Transformers route now has a prediction-first mechanism router. The route can carry active tab, learner prediction, reveal state, prediction correctness, expected mechanism, mechanism invariant, and demo-panel mount state before handing off to the tab-specific child demos.
- The scaled dot-product attention geometry visualizer now has a local prediction-first top-key reveal. The core Attention route's Geometry tab keeps Q/K setup, active query, temperature, key choices, and neutral matrix/value shells visible before reveal, then carries prediction/actual/correctness, score row, attention row, top weight, entropy, effective attended tokens, output vector, and probability-row sum into the saved observation and grounded AI handoff only after reveal.
- The self-attention mechanics visualizer now has a local prediction-first value-mixing reveal. The core Attention route's Self-Attention tab keeps the active query, visible token/value choices, temperature, and neutral matrix/value shells visible before reveal, then carries prediction/actual/correctness, query token, score row, attention row, top attention token/weight, entropy/focus, value mixture, weighted value contribution norms, top value contributor, and row sum into the saved observation and grounded AI handoff only after reveal.
- The transformer architecture visualizer now has a local prediction-first residual-shape reveal. The core Attention route's Transformer Block tab keeps visible topology, architecture variant presets, neutral component roles, and token-flow controls visible before reveal while hiding tensor shape labels, overview hyperparameters, component tensor tables, formulas, hover formula tooltips, detailed stage labels, quiz access, correctness, and measured state. After reveal it carries prediction/actual/correctness, residual stream shape T x d_model, attention weights h x T x T, attention output T x d_model, FFN hidden T x d_ff, FFN output T x d_model, residual-add legality, d_model, d_ff, heads, d_k, active stage/focus/variant, animation state, and visible layer state into the saved observation and grounded AI handoff.
- The attention backpropagation visualizer now has a local prediction-first gradient-credit reveal. The core Attention route's Backprop tab keeps the computation graph topology, forward/backward mode toggle, key-scale stress setup, held-fixed variables, and accessible gradient formulas visible while hiding gradient magnitudes, dominant parameter update/path, softmax gate percentage, edge-strength encoding, answer copy, correctness, and measured state until reveal. After reveal it carries prediction/actual/correctness, key-scale stress, W_Q/W_K/W_V magnitudes, softmax gate, parameter credit path, formula witness, and the gradient-credit invariant into the saved observation and grounded AI handoff.
- The Adam optimizer visualizer now has a true prediction-first race reveal. The Adam route hides the winner and losses while a learner's optimizer pick is locked, then carries setup/race preset, prediction phase and locked pick, reveal status, prediction correctness, step count, learning-rate/beta/AdamW hyperparameters, SGD/Momentum/Adam losses, final winner, runner-up gap, winner mechanism, Adam position/loss/distance, and per-coordinate effective learning rates into the saved observation and grounded AI handoff.
- The learning-rate schedule visualizer now has a prediction-first curve reveal. The Learning Rate Schedules route can carry the learner's warmup-vs-decay-vs-flat prediction, reveal state, prediction correctness, schedule family, shape, behavior class, total steps, warmup fraction/steps, decay steps, max/min target learning rates, start/end/average learning rates, and peak-to-end ratio into the saved observation and grounded AI handoff.
- The Gradient Descent visualizer now has a concept-specific prediction checkpoint and animated trace reveal. The Gradient Descent route can carry the learner's crawl/contract/escape prediction, reveal state, outcome classification, eta, curvature/lambda_max, stable bound, stable margin, spectral radius, high-curvature contraction/amplification factor, first loss delta, current trace step/loss, final loss or escape status, first gradient, and first update into the saved observation and grounded AI handoff.
- The Derivatives visualizer now has a concept-specific secant-to-hidden-tangent reveal. The route hides the tangent line, f'(x), tangent slope, signed/absolute slope gap, convergence status, correctness, post-reveal tangent toggle, and measured demo state until the learner predicts whether the hidden local tangent slope is lower than, nearly equal to, or higher than the visible secant slope; after reveal it emits prediction/actual/correctness, function, x, x+h, h, f(x), f(x+h), secant slope, tangent slope, signed gap, absolute gap, relation tolerance, convergence status, and visible-layer state into the saved observation and grounded AI handoff.
- The KTO route now has a prediction-first KL-reference reveal. The route asks learners whether binary desirable/undesirable feedback compares against a pairwise winner, a KL-derived reference point, raw final-answer correctness, or an unbounded push before revealing the KTO loss lab and its reference-relative utility.
- The KTO loss lab now emits compact measured state only after the route reveal. Saved demo observations can carry the learner's label, r_theta, z0, delta, loss, dL/dr, gradient-descent effect, and saturation without leaking stale lab state before reveal.
- The Maximum Likelihood route now has a prediction-first likelihood-direction reveal. The route asks learners whether the likelihood should decrease theta, stay, or increase theta before revealing the Bernoulli NLL curve, MLE line, entropy baseline, KL mismatch, and logit-gradient direction.
- The KL Divergence route now has a prediction-first direction-dominance reveal. The route asks learners whether KL(p||q), KL(q||p), or neither direction should dominate before revealing the KL totals, cross-entropy identity, entropy baseline, and signed per-outcome contribution rows.
- The Reward Hacking route now has a prediction-first diagnostic reveal before the finite-action overoptimization lab mounts. The route can carry learner prediction, reveal state, prediction correctness, expected diagnostic, and lab mount state, then the mounted lab emits beta, uncertainty penalty, proxy-gap mode, top completion, expected proxy reward, expected true utility, reference true utility, selected proxy error, KL, and visible hacking diagnostic without parent state overwriting measured lab state.
- The Computation Graphs visualizer now has a concept-specific reused-node sensitivity reveal. The route hides cos(a), the sine-path contribution, total bar a, bar x, bar y, accumulation status, correctness, reverse-edge labels, and measured demo state until the learner predicts whether node a's hidden accumulated sensitivity is lower than, nearly equal to, or higher than the visible direct baseline; after reveal it emits prediction/actual/correctness, x/y, a/b/c, direct contribution, sine-path contribution, accumulated bar a, input cotangents, relation tolerance, accumulation status, and visible backward layer into the saved observation and grounded AI handoff.
- The Reverse-Mode Autodiff visualizer now has a concept-specific cotangent-accumulation prediction reveal. The route hides bar a, bar x, bar y, and row-level reverse pullbacks until the learner predicts whether the direct path and sine path reinforce, stay mostly direct, or cancel; after reveal it emits x, y, a, L, accumulated bar a, input cotangents, and prediction correctness into the saved observation and grounded AI handoff.
- The Backpropagation visualizer now has a concept-specific hidden learning-signal reveal. The route hides delta2, raw hidden signal W2*delta2, tanh gate values, delta1, row-gradient norms, parameter gradients, loss after update, loss delta, update effect, leaky preset names, backward/update phases, and measured demo state until the learner predicts whether H1, H2, H3, or no clear usable hidden signal receives the strongest first-layer learning signal; after reveal it emits prediction/actual/correctness, x, target, eta, yhat, loss before/after, loss delta, delta2, hidden activations, tanh gates, raw hidden signal, delta1, first-layer row-gradient norms, dominant gradient, update effect, and visible backward/update layer into the saved observation and grounded AI handoff.
- The Vector Spaces visualizer now has a concept-specific span-collapse reveal. The route hides det[u v], parallelogram area, normalized area |det|/(|u||v|), actual span status, span dimension, parallelogram area witness, correctness, and measured demo state until the learner predicts whether u and v sweep a 2D plane, nearly collapse, or collapse to a line/point; after reveal it emits prediction/actual/correctness, u/v, a/b, a u, b v, w=a u+b v, determinant, area, normalized area, span dimension, |w|, and visible parallelogram state into the saved observation and grounded AI handoff.
- The Dot Product visualizer now has a concept-specific signed-projection reveal. The route hides dot product, cos theta, angle, alignment styling, signed scalar projection, projection length, proj_v(u), perpendicular residual, angle arc, projection/residual arrows, right-angle marker, and measured demo state until the learner predicts whether the projection of u along v is positive, near zero, or negative; after reveal it emits prediction/actual/correctness, u/v, dot/cos/theta, norms, projection coefficient, signed scalar projection, nonnegative projection length, proj_v(u), perpendicular residual, perp length, and visible projection/angle layers into the saved observation and grounded AI handoff.
- The Probability Basics visualizer now has a concept-specific conditioning reveal. The route hides joint cells, evidence, posterior, and posterior bar width until the learner predicts whether the observation should decrease, preserve, or increase belief in coin B; after reveal it emits observation, prior, likelihoods, evidence denominator, joint numerator, posterior, posterior delta, and prediction correctness into the saved observation and grounded AI handoff.
- The Random Variables visualizer now has a concept-specific pushforward reveal. The route hides PMF bars, support, expectation, variance, largest mass, per-outcome X labels, and winning fibers until the learner predicts which measured value collects the most probability mass; after reveal it emits the measurement rule, tilt, raw probabilities, fibers, PMF, support, expected value, variance, winning fiber, and prediction correctness into the saved observation and grounded AI handoff.
- The Variational Autoencoders visualizer now has a concept-specific ELBO gap reveal. The route hides the true posterior, ELBO/evidence/gap values, KL(q || posterior), identity error, reconstruction term, KL(q || prior), and post-reveal helper actions until the learner predicts whether the hidden gap diagnoses a tight bound, shift/scale mismatch, or variational-family mismatch; after reveal it emits decoder, x, q parameters, prediction/correctness, posterior shape, reconstruction term, KL prior, ELBO, log p(x), gap, KL(q||posterior), identity error, and q grid mass into the saved observation and grounded AI handoff.
- The Tree Search Reasoning visualizer now has a concept-specific max-backup reveal. The route hides selected path, selected terminal, V(root), node V values, selected-path styling, root branch backups, and hidden correctness until the learner predicts whether root branch A, B, or C wins the visible verifier backup; after reveal it emits mode, budget, prediction/actual/correctness, selected path/terminal, expanded prefixes, frontier size, V(root), root branch backups, hidden-correctness state, and selected terminal correctness only when truth is shown.
- The Cross-Entropy visualizer now has a target-weighted surprise prediction checkpoint. The Cross-Entropy route can carry the learner's dominant-loss-token prediction, reveal state, prediction correctness, target distribution, model softmax distribution, H(p,q), H(p), KL(p||q), dominant loss contribution, model top class, largest target mass, strongest raise-logit pressure, and q-p gradient vector into the saved observation and grounded AI handoff.
- The Distributions visualizer now has a pushforward prediction checkpoint. The Distributions route can carry the learner's most-likely-X prediction, reveal state, prediction correctness, head probability, raw outcome probabilities, PMF of X, largest PMF mass, E[X], Var(X), observed values/masses, and i.i.d. log likelihood into the saved observation and grounded AI handoff.
- The Bayesian Inference visualizer now has a posterior-update prediction checkpoint. The Bayesian Inference route can carry the learner's prior-vs-data-vs-compromise prediction, reveal state, prediction correctness, prior pseudo-counts, observed heads/tails, data count, prior mean, MLE, posterior mean, posterior Beta parameters, posterior classification, posterior distances to prior/MLE, and sequence log evidence into the saved observation and grounded AI handoff.
- The DPO route now has a prediction-first comparator reveal before the older ratio lab mounts. The route can carry learner prediction, reveal state, prediction correctness, expected comparator, and lab mount state, then the mounted lab emits beta, reference winner probability, current policy winner probability, target preference probability, reference/policy log-odds, reference-relative margin, preference probability, DPO soft loss, and gradient effect without parent state overwriting measured lab state.
- The RLHF route now has a prediction-first probability-shaping reveal before the finite-action lab mounts. The route can carry learner prediction, reveal state, prediction correctness, expected update, and lab mount state, then the mounted lab emits beta, anchor strength, reward shift, proxy-gap mode, top completion, expected model reward, expected true reward, reference true reward, KL, shift-invariance error, and reward-hacking warning without parent state overwriting measured lab state.
- The Decoding/Sampling route now has a prediction-first distribution reveal. The route can carry learner prediction, reveal state, prediction correctness, expected mechanism, decoding invariant, and sampling-lab mount state before handing off to the decoding lab's temperature, top-p, top-k, entropy, and sequence behavior controls.
- The LLM Serving route now has a prediction-first bottleneck reveal. The route can carry learner prediction, reveal state, prediction correctness, expected bottleneck, serving invariant, and latency-lab mount state before handing off to the serving lab's TTFT, TPOT, prompt length, output length, and batch-size controls.
- The Speculative Decoding route now has a prediction-first speedup-condition reveal. The route can carry learner prediction, reveal state, prediction correctness, expected condition, speculation invariant, and draft-verify lab mount state before handing off to the speculative decoding lab's acceptance-rate, rejected-token, and toy-speedup controls.
- The Efficiency route now has a prediction-first cost-lever reveal across LoRA, Sparse MoE, and Task Vectors. The route can carry active demo, learner prediction, reveal state, prediction correctness, expected lever, efficiency invariant, and lab mount state before handing off to the child lab's rank, routing, or task-vector controls.
- The Representation Learning route now has a prediction-first invariant reveal across Normalization, Directions, Equivariance, and Geometry. The route can carry active demo, learner prediction, reveal state, prediction correctness, expected invariant, representation invariant, and lab mount state before handing off to the child lab's normalization, direction, symmetry, or transport controls.
- The Double Descent route now has a prediction-first scaling-curve reveal across Double Descent and Grokking. The route can carry active demo, learner prediction, reveal state, prediction correctness, expected curve mechanism, scaling invariant, and lab mount state before handing off to the child lab's capacity, interpolation, training-time, and validation-curve controls.
- The NTK route now has a prediction-first fixed-kernel reveal before the older kernel-dynamics lab mounts. The route can carry learner prediction, reveal state, prediction correctness, expected invariant, NTK invariant, and lab mount state before handing off to the child lab's width, learning-rate, freeze-feature, kernel-matrix, feature-motion, and function-space controls.
- The Scaling Laws route now has a prediction-first mechanism reveal across Loss Scaling and Emergence. The route can carry active view, learner prediction, reveal state, prediction correctness, expected mechanism, scaling invariant, and lab mount state before handing off to the Chinchilla compute-allocation lab or the thresholded-metric lab.
- The Test-Time Compute route now has a prediction-first selection-condition reveal. The route can carry learner prediction, reveal state, prediction correctness, expected condition, test-time invariant, and lab mount state before handing off to the sample-verify-select lab's sample budget, verifier mode, selected correctness, and proxy-exploit controls.
- The Process Reward Models route now has a prediction-first verifier-signal reveal. The route can carry learner prediction, reveal state, prediction correctness, expected signal, process invariant, and lab mount state before handing off to the step-level verifier lab's scorer, aggregation, verifier-error, beta, and policy-shift controls.
- `ConceptNotebookPage` adds `SectionAIActionStrip` to every Intuition, Math, Code, and Interactive Demo section.
- `ConceptNotebookPage` adds `PracticeShell` to every filesystem concept page.
- `ConceptNotebookPage` adds `ResearchReadingRoom` with anchored concept, equation/math, source, code-witness, claim, misconception, and visualization objects.
- `ResearchReadingRoom` now listens to the saved learning-route snapshot. If the saved current object appears in the room, it auto-selects that object, displays the carried observation, and includes the observation in the grounded AI handoff prompt.
- `ConceptNotebookPage` adds a Claim Review panel that connects the central claim to source-note support candidates and local equation/code/demo witnesses while keeping audit status explicit.
- `pages/domains/[domain]/[slug].tsx` passes compact section snippets into the AI action strips.

The baseline is useful, but it is not enough to claim the full north star:

- Discussion on concept pages is now an object-attached reading room, but it is still a static prompt handoff rather than a live saved discussion surface.
- Concept pages now expose page-level equation/math, code-witness, aggregate source, per-source review, source-note-span, claim, misconception, and demo-state anchors. They also extract the first bounded display-equation and fenced-code objects from MDX into exact section anchors. Source spans currently come from structured source notes; full claim-level source audit and line-level equation/code/source review remain open.
- The repo now generates a canonical static content-object manifest before account/database work. The manifest separates durable typed object keys from hrefs and covers concepts, concept routes, product routes, demos, equation spans, code witnesses, source cards, source-note spans, claim checks, central claims, and likely misconception objects.
- AI prompts are page-aware, section-aware, and source-id-aware down to individual source cards and source-note spans. Claim review is now visible as a workflow, and the content model now supports structured claim checks, but most concept pages are not yet backed by completed claim-level source review.
- Resumability is strong for the flagship paper-map -> graph -> attention-serving loop, and concept pages now persist selected research-room focus objects into the same browser-local route snapshot model.
- Concept-page demo reveals are now resumable route observations: selecting a prediction lens and revealing the check marks a demo checkpoint observed, focuses the visualization object, and carries the next grounded question forward.
- Research-room prompts now include the carried route observation when the current object matches, so the gradual AI surface can reason from the learner's latest demo reveal rather than from static page context alone.
- The saved demo observation is no longer only a generic lens when a demo emits state. It preserves a compact measured-state packet first, then the prediction check, which protects important post-reveal quantities from truncation.
- The gradual AI path remains correct: object-attached discussion first, useful non-AI research rooms second, source-aware prompts third, and richer assistant behavior only after the core atlas surfaces are grounded.

## Global Visual And Interaction Readiness

Every concept notebook now has a reusable visual-learning layer before the formal content stack. `ConceptMechanismStoryboard` adds animated mechanism paths, active stage nodes, concept-image atmosphere where registered, and a small prediction/reveal interaction that asks the learner to decide what kind of change or invariant to watch for. This does not replace concept-specific demos; it gives all pages a shared visual and interactive rhythm while the older demos are individually retrofitted.

Every concept notebook now also has an image-led inquiry layer. `ConceptVisualInquiryPanel` reuses each registered cover as an inspectable surface, adds animated scanning/focus/flow overlays, exposes cropped visual cue tiles, and asks the learner to commit to a lens and prediction before revealing the check. The reveal is saved into the browser-local learning-route snapshot as a concept-object observation, so the visual commitment can carry into the continuity banner and research room.

Registered concept-cover imagery now covers the published atlas. Each published concept page can use a concept image in the hero snapshot and as a muted anchor inside the mechanism storyboard; review/unpublished pages can still receive covers as they graduate.

Every concept notebook with a live demo also has a shared demo-shell prediction checkpoint. The checkpoint is intentionally compact: it makes the learner commit to whether a quantity should move, an invariant should hold, or an edge case should expose a boundary before revealing the check. This gives the whole atlas a baseline prediction-first rhythm while preserving the need for bespoke demo-state design inside older visualizations.

The shared demo checkpoint now saves its reveal as route state, not just page-local UI. This improves the "remembers the invariant" part of the learning contract: a revealed prediction can appear as the saved route's last observation and as the current visualization object for grounded discussion.

## Domain Summary

| Domain | Concepts | Published | Avg local score | Live demos | Prediction cues | Source cues |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| alignment | 5 | 5 | 7.0/7 | 5 | 5 | 5 |
| attention-transformers | 12 | 7 | 6.4/7 | 10 | 10 | 11 |
| calculus | 6 | 4 | 6.0/7 | 4 | 4 | 4 |
| efficiency | 5 | 5 | 7.0/7 | 5 | 5 | 5 |
| generative-models | 5 | 5 | 7.0/7 | 5 | 5 | 5 |
| information-theory | 1 | 1 | 7.0/7 | 1 | 1 | 1 |
| linear-algebra | 6 | 2 | 5.2/7 | 2 | 2 | 2 |
| llm-systems | 6 | 5 | 6.8/7 | 6 | 6 | 6 |
| optimization | 10 | 4 | 5.2/7 | 4 | 4 | 4 |
| probability | 6 | 6 | 7.0/7 | 6 | 6 | 6 |
| representation-learning | 2 | 2 | 7.0/7 | 2 | 2 | 2 |
| scaling | 6 | 5 | 6.8/7 | 6 | 6 | 6 |

## Highest-Risk Published Gaps

The specific no-live-demo published systems gap is now closed. The weakest remaining published concepts are no longer missing the whole interactive layer; their risk is mostly older demo framing, sparse graph edges, and shallow concept-page research discussion.

| Concept | Score | Missing |
| --- | ---: | --- |
| none below 5/7 by this evidence heuristic | - | - |

Interpretation: the atlas is no longer blocked by a published page that lacks an interactive demo. It is still blocked from north-star quality by older demos without prediction-first framing and by concept pages that do not yet have rich source-aware research rooms.

## Published Concept Matrix

Legend: `I M C D P L S` = Intuition, Math, Code, Demo, Prediction, Links, Sources.

| Concept | Importance | Score | I M C D P L S | Missing |
| --- | --- | ---: | --- | --- |
| `efficiency/pruning` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `llm-systems/moe-serving` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `attention-transformers/flash-attention` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `efficiency/knowledge-distillation` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `efficiency/quantization` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `generative-models/normalizing-flows` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `alignment/kto` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `attention-transformers/attention-transformers` | critical | 7/7 | Y Y Y Y Y Y Y | none |
| `attention-transformers/layer-normalization` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `attention-transformers/long-context` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `attention-transformers/rope` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `attention-transformers/tokenization-vocabulary` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `calculus/backpropagation` | critical | 7/7 | Y Y Y Y Y Y Y | none |
| `calculus/computation-graphs` | critical | 7/7 | Y Y Y Y Y Y Y | none |
| `calculus/derivatives` | critical | 7/7 | Y Y Y Y Y Y Y | none |
| `efficiency/efficiency` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `generative-models/vaes` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `linear-algebra/dot-product` | critical | 7/7 | Y Y Y Y Y Y Y | none |
| `linear-algebra/vector-spaces` | critical | 7/7 | Y Y Y Y Y Y Y | none |
| `llm-systems/decoding-sampling` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `llm-systems/llm-serving` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `llm-systems/speculative-decoding` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `optimization/adam` | critical | 7/7 | Y Y Y Y Y Y Y | none |
| `optimization/gradient-descent` | critical | 7/7 | Y Y Y Y Y Y Y | none |
| `optimization/learning-rate-schedules` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `probability/bayesian-inference` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `probability/cross-entropy` | critical | 7/7 | Y Y Y Y Y Y Y | none |
| `probability/distributions` | critical | 7/7 | Y Y Y Y Y Y Y | none |
| `representation-learning/representations` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `scaling/double-descent` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `alignment/process-reward-models` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `calculus/reverse-mode-autodiff` | critical | 7/7 | Y Y Y Y Y Y Y | none |
| `efficiency/mixture-of-experts` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `generative-models/diffusion` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `generative-models/flow-matching` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `optimization/loss-landscapes` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `probability/maximum-likelihood` | critical | 7/7 | Y Y Y Y Y Y Y | none |
| `probability/probability-basics` | critical | 7/7 | Y Y Y Y Y Y Y | none |
| `probability/random-variables` | critical | 7/7 | Y Y Y Y Y Y Y | none |
| `representation-learning/sparse-autoencoders` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `scaling/ntk` | advanced | 7/7 | Y Y Y Y Y Y Y | none |
| `scaling/scaling-laws` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `scaling/test-time-compute` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `alignment/dpo` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `alignment/reward-hacking` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `alignment/rlhf` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `attention-transformers/efficient-attention` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `generative-models/score-matching` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `information-theory/kl-divergence` | critical | 7/7 | Y Y Y Y Y Y Y | none |
| `llm-systems/structured-decoding` | important | 7/7 | Y Y Y Y Y Y Y | none |
| `scaling/tree-search-reasoning` | important | 7/7 | Y Y Y Y Y Y Y | none |

## Recommended Fix Queue

### Completed: Source Grounding Spine

The structured source/reference metadata pass is now complete for published concepts: 51/51 published concepts can identify canonical papers, notes, or primary references separately from prose. Future source work should shift from coverage to claim-level quality review: checking whether each source note supports the exact mechanism, equation, demo, or code witness on the page.

### Completed: Published Systems Demo Gap Sprint

All six published important no-demo targets now have small prediction-first demos: FlashAttention has an IO-aware tiling and online-softmax merge demo; Quantization has an outlier-scaling demo; Knowledge Distillation has a dark-knowledge demo; Pruning has a sparsity-vs-speed demo; Normalizing Flows has a change-of-variables demo; and MoE Serving has a routing-skew versus all-to-all serving bottleneck demo.

### P0: Prediction-First Demo Retrofit

For live demos that predate the demo-shell rollout, add explicit concept-specific "predict before reveal" states and compact demo-state emission. A global demo-shell checkpoint now gives every published live demo a baseline prediction prompt, so the remaining work should focus on deeper in-demo reveal states for critical prerequisites and flagship-adjacent pages.

Reverse-Mode Autodiff, Probability Basics, Random Variables, Variational Autoencoders, Tree Search Reasoning, Dot Product, Vector Spaces, Derivatives, Computation Graphs, Backpropagation, Scaled Dot-Product Attention Geometry, Self-Attention Value Mixing, Attention Backprop Gradient Credit, Transformer Architecture Residual Shape, and Structured Decoding Valid-Token Mask are now completed slices in this P0: cotangent accumulation, conditioning/posterior movement, pushforward/fiber formation, ELBO gap diagnosis, visible max-backup choice, signed projection direction, span-collapse classification, secant-to-hidden-tangent relation, reused-node sensitivity accumulation, hidden learning-signal routing, top-key attention selection, alpha_ij * V_j value-contribution selection, key-scale gradient-credit crossover, residual-stream shape preservation, and schema-mask valid-token renormalization are gated by local prediction reveals with measured-state handoff. This does not close the P0; older demos still need the same concept-specific treatment.

### Completed: Concept Object Research Room

Concept pages now use the richer `ResearchReadingRoom` pattern instead of the placeholder `DiscussionAnchorList`. Every filesystem concept page gets object-attached prompts for the concept, math/equation object, code witness, extracted display-equation spans, extracted fenced-code witnesses, source grounding when sources exist, per-source review objects, source-note-span objects, central claim, likely misconception, and live visualization state when a demo exists. The handoff remains gradual and static-export-safe: grounded prompts now, live gateway discussion later.

### Completed: Concept-Level Resume State

Concept notebooks now save the selected research-room object into the browser-local route snapshot model with `source=concept-notebook`, `currentObject`, `currentQuestion`, section readiness, source objects, next concept repair, and a last observation describing the focused object. Home and continuity banners can resume the exact concept object before accounts exist.

### Claim Review Panel

Concept notebooks now render a Claim Review panel for the central concept claim. It gathers source-note support candidates, extracted equation/code witnesses, and demo state when present, and labels the audit status as pending instead of implying that source support is already proven. The central claim reading-room object now links to this panel. This is a workflow surface for claim audit, not a completed per-page source review.

### Claim Check Metadata

The filesystem content model now accepts optional `claim_checks` metadata with bounded claim text, audit status, source ids, support notes, caveats, and local object refs. `validate-content` verifies the shape, checks that referenced source ids exist in the page's `sources`, and checks that source-span/equation/code/demo object refs point to objects the page can render. Double Descent, NTK, Sparse Autoencoders, Representations, Loss Landscapes, Learning Rate Schedules, Normalizing Flows, Flow Matching, Score Matching, Diffusion, Efficiency, Mixture of Experts, Pruning, Knowledge Distillation, Quantization, Layer Normalization & RMSNorm, Tree Search Reasoning, Test-Time Compute, Reward Hacking, Process Reward Models, KTO, DPO, RLHF, Scaling Laws, Tokenization & Vocabulary Design, Adam, Vector Spaces, Dot Product, Derivatives, Computation Graphs, Reverse-Mode Autodiff, Backpropagation, MoE Serving, FlashAttention, Speculative Decoding, Structured Decoding, LLM Serving, Decoding/Sampling, Scaled Dot-Product Attention, Efficient Attention, RoPE, Long Context, Gradient Descent, Maximum Likelihood, Cross-Entropy, Distributions, Probability Basics, Random Variables, Bayesian Inference, KL Divergence, and Variational Autoencoders now have initial claim checks with source-span and local object witnesses; most also include equation, code, and demo witnesses. These entries are source-linked review targets by default, not proof that the cited sources substantively support each claim.

### Per-Source Review Objects

Concept notebooks now create source-specific reading-room objects in addition to the aggregate source-grounding object. Selecting a single source carries only that source id, links to that source card, and asks whether that exact paper/reference supports the central mechanism claim and which local equation, code witness, or demo state should be checked against it. This is still a review handoff, not a completed claim-level audit.

### Source Note Span Objects

Concept source cards now expose stable note-span fragments such as `#source-span-shazeer-2017-sparsely-gated-moe`. The reading room creates matching source-span objects that carry one source id and ask which exact mechanism claim the structured source note supports, which equation/code/demo object should be checked, and what remains unverified. This is a first exact source-span layer based on curated source metadata, not a full paper-text or claim-level audit.

### Extracted Equation And Code Objects

Concept notebooks now extract bounded display-equation and fenced-code snippets from sanitized MDX at build time. Math and Code sections render compact object anchors such as `#math-object-1` and `#code-witness-1`; the reading room exposes matching equation and code-witness objects so AI handoff can target a concrete symbol block or runnable snippet rather than only the whole section. This is a first-pass span extractor, not full line-level review.

### Content Object Manifest

The repo now has a static object-key spine for future learner memory, notes, research threads, evidence refs, and AI runs. `npm run generate-object-manifest` writes `content/_generated/content-object-manifest.json`, and `npm run validate-content` fails when generated concept, route, demo, equation, code, source, source-span, claim, or misconception objects are stale, unexpected, missing, or dangling. Unsupported `claim_checks[].object_refs` also fail instead of being silently ignored. Current manifest size is 853 objects: 70 concepts, 73 routes, 56 demos, 137 equation spans, 70 code witnesses, 163 source objects, 93 source-span objects, 121 claim objects, and 70 misconception objects.

Discussion anchors and route snapshots can now carry `objectKey` while keeping `discussionAnchorId` as the UI/resume anchor. This is the right foundation for future Postgres `content_object_refs`; it is not yet a database, account system, permission model, or live collaborative thread surface.

### Local Object Action Journal

The research reading room now has a static/export-safe browser-local action journal keyed only by `ContentObjectKey`. A selected keyed object can hold one bounded draft note and one bounded next action in `localStorage`, reload it in the same browser, clear only that object's draft, and include the matching draft in the grounded AI handoff prompt. Unkeyed objects cannot save drafts. This is a local return loop for learners and reviewers; it is not synced memory, account memory, a research thread, or a collaboration system.

### Claim Check Object Handoff

Structured `claim_checks[]` entries now become exact, selectable claim objects in the concept Research Reading Room. Each valid claim check uses the manifest-aligned object key `claim:<domain>/<concept>#<claim-check-id>`, links to its exact `#claim-check-<id>` Claim Review card, carries source IDs, and sends full claim/support/caveat/object-ref context into the grounded AI handoff without treating the claim as proven. Claim-check witness refs remain safe in the UI: local fragments link to page objects, while content object keys render inertly instead of becoming raw URLs. Invalid claim-check IDs now fail validation instead of silently aliasing UI anchors away from object keys. This sharpens per-claim review and local action drafting; it still does not complete the atlas-wide source-quality audit.

### Claim Check Handoff Integrity Guard

`validate-content` now permanently verifies the claim-check handoff path that had previously been checked by a one-off all-concepts probe. For every structured `claim_checks[]` entry, the guard rebuilds the concept Research Reading Room objects and grounded AI prompt, then fails if the claim-check object is missing, mis-keyed, mis-anchored, pointed at `#claim-review` instead of its exact `#claim-check-<id>` card, missing ordered source IDs, missing support/caveat/object-ref prompt fields, or exceeding the accepted seed-prompt bound. The same pass also verifies the generated manifest claim object aligns with the exact href, discussion anchor, source IDs, and witness refs. This prevents future drift in the claim-review workflow; it is not a substantive source-support review.

### Claim Evidence Review Queue

Claim-check handoff integrity is now explicitly separated from substantive source-support review. Existing `claim_checks[]` render a conservative evidence-review state: source and witness attachment is visible, but learner-facing copy and Reading Room prompts say that attached sources and witness refs are review targets, not proof. `validate-content` now blocks overclaimed `substantive-reviewed` metadata unless a bounded reviewed date, reviewer, summary, support note, caveat, and at least one valid same-concept source ID are present; every substantive-review source ID must be a compact nonblank string whose trimmed value is listed in the concept's `sources`. `npm run generate-claim-evidence-review-queue` writes a deterministic review queue under `content/_generated/claim-evidence-review-queue.json` and a readable agent queue under `content/_agent/CLAIM_EVIDENCE_REVIEW_QUEUE.md`, and validation fails if either generated artifact is stale. Queue items include the claim text, status, evidence state, source IDs, witness refs, support note, caveat, risk signals, object key, and next review action so the next source-support audit can work from one ordered artifact.

Current queue metric:

- Structured claim checks: 51.
- Substantively reviewed claim checks: 47.
- Source-linked / review-pending claim checks: 4.
- Published review-pending claim checks: 4.

Double Descent is now substantively reviewed after Oracle/GPT Pro and GPT-5.3 Codex x-high review. Belkin et al. support the empirical interpolation-threshold double-descent curve, while Nakkiran et al. support model-wise, epoch-wise, and sample-count/non-monotonic deep double descent. The final reviewed object refs are source spans only: the synthetic demo, grokking tab, and minimum-norm linear math/code remain useful teaching context outside the reviewed empirical claim.

Backpropagation is now substantively reviewed after a narrow Oracle/GPT Pro source-support pass. Rumelhart/Hinton/Williams is treated as historical/neural-network learning support, while Baydin et al. carries the reverse-mode mechanism support for forward intermediate recording, backward adjoint propagation, local chain-rule accumulation, VJP framing, scalar-output seeding, and one-pass scalar-loss gradients. The Baydin source URL now points to the reviewed JMLR page, and the claim caveat explicitly keeps implementation-specific storage/checkpointing outside the reviewed scope.

Computation Graphs is now substantively reviewed after a narrow Oracle/GPT Pro source-support pass. Baydin et al. supports the executed AD trace framing, computational graphs of intermediate-variable dependencies, forward intermediate/dependency recording, reverse adjoint propagation, and reused-variable adjoint accumulation. The code witness now explicitly accumulates direct and sine-path cotangent contributions into `bar_a` before propagating to `bar_x` and `bar_y`.

Derivatives is now substantively reviewed after a narrow Oracle/GPT Pro source-support pass. Mathematics for Machine Learning 5.1 supports the one-variable difference-quotient, secant, tangent, and derivative-limit claim, while 7.1 supports the gradient-descent bridge through gradients as local steepest-ascent signals. The claim now says "one-variable real function" and the source URL points directly to the official MML PDF used for the review.

Reverse-Mode Autodiff is now substantively reviewed after a narrow Oracle/GPT Pro source-support pass. Baydin et al. supports the two-phase forward-record/reverse-adjoint mechanism, output cotangent seed 1, reused-variable cotangent accumulation, one reverse pass for both input derivatives in the worked example, and the full-gradient result for scalar-output many-input functions. The Baydin source URL now points to the reviewed JMLR page.

KL Divergence, Vector Spaces, Dot Product, Efficient Attention, FlashAttention, Layer Normalization & RMSNorm, Long Context, RoPE, Tokenization & Vocabulary, Decoding & Sampling, LLM Serving, MoE Serving, Speculative Decoding, Structured Decoding, Learning Rate Schedules, Loss Landscapes, and Bayesian Inference are now also marked substantively reviewed after narrow Oracle/GPT Pro source-support passes. Long Context keeps the reviewed scope deliberately small: RoFormer supports rotary relative-position mechanics, ALiBi supports train-short/test-long extrapolation as a position-representation issue, and PagedAttention supports KV-cache memory as a serving bottleneck. RoPE now makes its relative-position dot-product identity the exported second math witness instead of hiding it behind the two-equation cap. Tokenization & Vocabulary now makes its exported second math witness and first code witness cover both BPE merging and toy unigram segmentation, while the broader demo is only counted for its BPE/unigram portions. Decoding & Sampling now exports both the temperature-softmax equation and the combined top-p truncation/renormalization equation, while its demo copy is explicitly toy/local rather than production decoding advice. LLM Serving is reviewed only for Orca's multi-iteration scheduling/selective-batching mechanism and PagedAttention's KV-cache memory/batch-size/throughput constraint; its latency math, code, and demo remain toy serving witnesses. MoE Serving adds MegaScale-Infer as the serving-specific source and keeps the byte-count math, straggler proxy, code witness, and demo as toy witnesses rather than universal performance claims. Speculative Decoding is reviewed for Leviathan/Chen draft-prefix scoring, modified rejection/residual sampling, and target-distribution preservation; its interactive demo remains a toy speedup witness. Structured Decoding is reviewed for Willard/Louf FSM/parser-state token masking and Geng's separation of schema compliance from coverage, efficiency, and output quality. Learning Rate Schedules is reviewed for Smith's LR range tests and cyclical lower/upper-bound policies plus SGDR cosine annealing with warm restarts; warmup, inverse-sqrt, LLM practice, Adam warmup rationale, edge-of-stability, convergence, and universal-superiority material stays caveated as teaching context. Loss Landscapes is reviewed for Li's low-dimensional/filter-normalized slices, Keskar's perturbation-sensitivity sharpness discussion, and Foret's SAM neighborhood objective; the 2/eta stability code and Stage 2 edge-of-stability demo remain outside the reviewed claim scope. Bayesian Inference is reviewed for Deisenroth/MML's prior-likelihood-evidence-posterior Bayes-rule framing and Murphy's parameter-level posterior updating plus MLE contrast; the local code/demo witness is scoped to the beta-Bernoulli coin model, not approximate inference or universal prior-strength advice.

DPO is now substantively reviewed after a narrow Oracle/GPT Pro pass against Rafailov et al. 2023. The reviewed scope covers the KL-regularized optimum, the beta-scaled policy/reference reward representative up to the prompt-only partition term, and the Bradley-Terry/DPO hard-label logistic loss on beta-scaled winner-loser reference-relative log odds. The page's first math object, code witness, and interactive demo are accepted as local teaching witnesses; the second exported math object is intentionally excluded because it is only the autoregressive sequence log-probability equation.

RLHF is now substantively reviewed after a narrow Oracle/GPT Pro source-support review against Christiano et al. 2017 and Ouyang et al. 2022. Christiano supports learning a reward predictor from pairwise trajectory-segment preferences and optimizing a policy against predicted reward. Ouyang supports the InstructGPT pipeline of demonstrations to SFT, comparison/ranking data to a reward model, and PPO against that reward model with a per-token KL penalty to the SFT policy. The page now exports a compact first math witness for sigmoid preference modeling and a second math witness for the KL-regularized finite-action objective/optimum; code/demo remain toy witnesses for shift invariance, pi_ref*exp(r/beta), KL(policy||ref), and proxy-gap warnings. Reward as true human objective, exact PPO attainment, PPO-ptx details, reward-hacking prevention, and broad alignment guarantees remain outside scope.

Efficiency is now substantively reviewed after a narrow Oracle/GPT Pro source-support review against Sze et al. 2017, Hu et al. 2021, and Shazeer et al. 2017. Sze supports the system-level resource framing across compute, memory/data movement, energy, throughput, accuracy, and hardware/resource constraints. Hu supports frozen pretrained weights plus trainable low-rank A/B matrices for W0 + BA adaptation with reduced trainable parameters and adaptation memory/storage cost. Shazeer supports sparse MoE conditional computation with top-k sparse gating so selected experts are evaluated while capacity can grow without proportional compute. Distillation, quantization, task vectors, exact speedups, and serving-cost claims remain outside this reviewed scope.

Knowledge Distillation is now substantively reviewed after a narrow Oracle/GPT Pro source-support review against Hinton, Vinyals, and Dean 2015. Hinton et al. support high-temperature softened class probabilities, training the distilled model to match teacher soft targets at the same high temperature, incorrect-class probability ratios as rich similarity structure, and a weighted mix of soft-target cross-entropy plus correct-label cross-entropy with T^2 scaling. The page's teacher-student KL term is accepted as cross-entropy-equivalent for a fixed teacher distribution, and the code/demo remain toy finite-class witnesses for tau-softmax, tau^2 KL, non-label teacher pull, and hard/KD mixing. Sequence-level LLM distillation recipes, speculative-decoding correctness, teacher quality, capacity matching, data filtering, and universal compression claims remain outside scope.

Pruning is now substantively reviewed after a narrow Oracle/GPT Pro source-support review against Han, Mao, and Dally 2015 plus Li et al. 2016. Han supports thresholded unstructured connection pruning, masks over pruned connections, CSR/CSC sparse storage, and sparse matrix-vector benchmarking rather than ordinary dense kernels. Li supports the structured contrast: whole-filter/feature-map removal, avoiding irregular sparsity, and mapping to smaller dense BLAS operations. The code witness covers only the magnitude-mask side, while the demo carries the storage-vs-speed deployment distinction. Exact compression ratios, retraining schedules, modern sparse kernels, measured current-hardware speedups, and accuracy guarantees remain outside scope.

Quantization is now substantively reviewed after a narrow Oracle/GPT Pro source-support review against Dettmers et al. 2022 and Frantar et al. 2022. Dettmers supports Int8 scaling/dequantization, the single-shared-scale outlier precision failure mode, vector-wise constants, and mixed-precision outlier decomposition. Frantar supports low-bit GPT weight quantization as compression with layer-wise reconstruction-error control, approximate second-order/error-compensating updates, and reduced memory movement. The page's uniform/per-channel formulas, code RMSE witness, and outlier-scaling demo are accepted as finite teaching witnesses. Full GPTQ implementation, exact LLM.int8 routing, calibrated model accuracy, hardware speedups, activation quantization, and all low-bit methods remain outside scope.

KTO is now substantively reviewed after a two-pass Oracle/GPT Pro source-support review against Ethayarajh et al. 2024. The first pass blocked because the exported math refs only exposed policy/reference ratio equations; the page now exports a compact KTO objective block and a derivative-sign block as the first two math objects. The reviewed scope covers binary desirable/undesirable KTO, r_theta as policy/reference log-ratio, KL-derived z0, label-dependent logistic values, beta saturation, and stop-gradient update directions. Claims about KTO outperforming DPO, psychological validity, every z0 implementation, reward-hacking prevention, and broad alignment guarantees remain outside scope.

Process Reward Models is now substantively reviewed after a narrow Oracle/GPT Pro source-support review against Lightman et al. 2023. The reviewed scope covers PRMs as process-supervised reward models trained on step-level labels, contrasted with outcome reward models that supervise final results, and evaluated by best-of-N selection/ranking. The binary Bernoulli/BCE math is accepted only as a teaching reduction of Lightman's positive/negative/neutral token-likelihood setup, while the code/demo count only for outcome-vs-process selection and verifier-error/proxy failure. The KL-style RLHF bridge remains local teaching context outside the reviewed claim.

Reward Hacking is now substantively reviewed after a narrow Oracle/GPT Pro source-support review against Amodei et al. 2016 and Gao et al. 2022. Amodei supports reward hacking as a wrong-objective/gamed-reward problem; Gao supports RLHF reward-model overoptimization where stronger proxy optimization can improve learned reward while hindering gold reward. The page's finite-action selected-proxy-error math, code, and demo are accepted as toy teaching witnesses for the KL-softmax shift and local uncertainty braking. The uncertainty/LCB penalty remains page-local and is not sourced as a sufficient mitigation; direct human-utility access, universal phase laws, prevention claims, and broad alignment guarantees stay outside scope.

This makes the next trust work measurable and prevents the audit from confusing workflow maturity with evidence quality. The north-star source-quality gap remains open until enough claims are actually reviewed against their cited sources and local witnesses.

## Goal Status

The north-star goal is not achieved yet. The atlas has a strong notebook shell, every published concept now has a live demo, and many important concepts are strong, but the audit still shows three large missing requirements:

1. Source-panel metadata coverage is complete for published concepts, but claim-level source quality still needs per-page review before calling the whole atlas research-grade. Fifty-one published concepts now have initial claim metadata; forty-seven critical claims are marked substantively reviewed and four remain review pending.
2. Prediction-first checkpoints are now visible across the demo shell, but many older demos still need concept-specific reveal states and compact state emission before calling prediction-first interaction fully complete.
3. Research discussion and gradual AI are now object-attached and locally resumable on concept pages, and object keys now give future saved notes/threads/AI runs a durable attachment target. They are still not live, personalized across devices, or backed by a database/permissions layer.
