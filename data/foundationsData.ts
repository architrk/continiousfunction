// Core mathematical foundations data for deep learning concept map
// 100 concepts spanning modern foundation models (LLMs, diffusion/video, scaling, alignment, interpretability)

export interface Paper {
  title: string
  authors: string
  year: number
  venue?: string
  url?: string
}

// Typed relations beyond prereqs - captures the "mathematician's mind" connections
export type RelationType =
  | 'same_trick'      // Same technique appears in different contexts
  | 'duality'         // Mathematical duals (e.g., VAE-Diffusion via score)
  | 'breaks_when'     // Concept X breaks or degrades in scenario Y
  | 'invented_to_fix' // Y was invented to fix X's problem
  | 'analogy'         // Structural similarity worth noting

export interface Relation {
  from: string        // concept ID
  to: string          // concept ID
  type: RelationType
  label: string       // Short label for graph edge
  why: string         // Educational explanation
}

// Semantic relations that create "aha!" moments - the connections mathematicians naturally see
export const conceptRelations: Relation[] = [
  // === SAME_TRICK: Softmax appears everywhere ===
  {
    from: 'attention-transformers',
    to: 'mixture-of-experts',
    type: 'same_trick',
    label: 'Softmax routing',
    why: 'Both use softmax to create a distribution: attention softmaxes over positions, MoE softmaxes over expert logits. The "router" in MoE is literally an attention head that attends to experts instead of tokens.'
  },
  {
    from: 'attention-transformers',
    to: 'diffusion',
    type: 'same_trick',
    label: 'Cross-attention',
    why: 'Text-to-image diffusion (Stable Diffusion) uses cross-attention to condition on text embeddings—same Q·K^T softmax mechanism, but K,V come from text while Q comes from image latents.'
  },
  {
    from: 'maximum-likelihood',
    to: 'rlhf',
    type: 'same_trick',
    label: 'Cross-entropy',
    why: 'RLHF reward models are trained with cross-entropy on preference pairs: p(preferred > rejected). Same loss function, different label source.'
  },
  {
    from: 'maximum-likelihood',
    to: 'vaes',
    type: 'same_trick',
    label: 'KL divergence',
    why: 'VAE ELBO contains KL(q(z|x) || p(z))—same KL divergence from MLE, but now regularizing latents toward prior.'
  },

  // === DUALITY: Mathematical twins ===
  {
    from: 'vaes',
    to: 'diffusion',
    type: 'duality',
    label: 'Score ↔ ELBO',
    why: 'Both optimize log-likelihood bounds. VAE: direct ELBO. Diffusion: equivalent to infinite-depth VAE where encoder is fixed noising process. Score function ∇log p(x) is the unifying view.'
  },
  {
    from: 'gans',
    to: 'diffusion',
    type: 'duality',
    label: 'Adversarial ↔ Denoising',
    why: 'GANs learn generator via adversarial game; diffusion learns denoiser via regression. But: score-matching diffusion IS adversarial—discriminator is implicitly the score function.'
  },
  {
    from: 'ntk',
    to: 'scaling-laws',
    type: 'duality',
    label: 'Width ↔ Depth',
    why: 'NTK theory explains infinite-width limits. Scaling laws reveal width vs depth trade-offs empirically. The "optimal shape" question connects both: same compute, different aspect ratios.'
  },

  // === BREAKS_WHEN: Failure modes ===
  {
    from: 'adam',
    to: 'loss-landscapes',
    type: 'breaks_when',
    label: 'Edge of Stability',
    why: 'Adam\'s per-coordinate scaling breaks down at the edge of stability where sharpness = 2/lr. The optimizer oscillates but doesn\'t diverge—behavior not predicted by convergence theory.'
  },
  {
    from: 'attention-transformers',
    to: 'efficient-attention',
    type: 'breaks_when',
    label: 'O(n²) memory',
    why: 'Standard attention stores full n×n matrix for backward pass. At 100K+ context, this exceeds GPU memory. Flash Attention fixes this via recomputation + tiling.'
  },
  {
    from: 'rlhf',
    to: 'dpo',
    type: 'breaks_when',
    label: 'Reward hacking',
    why: 'RLHF reward models can be gamed—high reward, low quality outputs. DPO eliminates explicit reward model, directly optimizing preference likelihood.'
  },
  {
    from: 'scaling-laws',
    to: 'double-descent',
    type: 'breaks_when',
    label: 'Small data',
    why: 'Scaling laws assume abundant data. Double descent shows that at certain model sizes, test error can spike before improving—behavior not captured by smooth power laws.'
  },

  // === INVENTED_TO_FIX: Solution lineage ===
  {
    from: 'attention-transformers',
    to: 'rope',
    type: 'invented_to_fix',
    label: 'Position encoding',
    why: 'Original Transformer used sinusoidal or learned absolute positions. RoPE fixes length extrapolation by encoding relative position in the rotation of Q,K vectors.'
  },
  {
    from: 'attention-transformers',
    to: 'efficient-attention',
    type: 'invented_to_fix',
    label: 'KV cache memory',
    why: 'Multi-head attention has separate K,V per head → O(n·h·d) cache. Flash Attention and efficient variants reduce memory while preserving quality.'
  },
  {
    from: 'vaes',
    to: 'diffusion',
    type: 'invented_to_fix',
    label: 'Blurry samples',
    why: 'VAE posterior collapse and MSE reconstruction produce blurry outputs. Diffusion fixes this by iterative refinement—each step only needs to denoise a little.'
  },
  {
    from: 'rlhf',
    to: 'kto',
    type: 'invented_to_fix',
    label: 'Preference pairs',
    why: 'RLHF/DPO need paired preferences (A > B). KTO works with unpaired good/bad examples, using prospect theory\'s asymmetric value function.'
  },

  // === ANALOGY: Structural similarities ===
  {
    from: 'mixture-of-experts',
    to: 'attention-transformers',
    type: 'analogy',
    label: 'Sparse selection',
    why: 'MoE routes tokens to top-k experts like attention routes tokens to attend to top-weighted positions. Both are sparse selections from a larger set.'
  },
  {
    from: 'diffusion',
    to: 'ssm-hybrids',
    type: 'analogy',
    label: 'Iterative → Recurrent',
    why: 'Diffusion: iterates through time steps to denoise. SSM/Mamba: recurrent scan through sequence. Both replace one-shot attention with sequential processing.'
  },
  {
    from: 'superposition',
    to: 'mixture-of-experts',
    type: 'analogy',
    label: 'Sparse features',
    why: 'Superposition: features stored sparsely in neurons. MoE: computation distributed sparsely to experts. Both exploit sparsity for efficiency.'
  },
  {
    from: 'induction-heads',
    to: 'circuit-discovery',
    type: 'analogy',
    label: 'Circuits',
    why: 'Induction heads are a specific circuit (copy from past). Circuit discovery generalizes: finding any computational subgraph implementing a behavior.'
  },
  {
    from: 'loss-landscapes',
    to: 'double-descent',
    type: 'analogy',
    label: 'Geometry ↔ Generalization',
    why: 'Both study the shape of optimization: loss landscapes focus on local geometry (sharpness), double-descent on global capacity (interpolation threshold).'
  },

  // ======================
  // NEW RELATIONS (GPT-5.2 Pro via Oracle, Dec 2025)
  // ======================

  // === SAME_TRICK (additional) ===
  {
    from: 'attention-transformers',
    to: 'representations',
    type: 'same_trick',
    label: 'Dot-product logits',
    why: 'Attention forms logits with QKᵀ/√d; contrastive learning forms logits with embedding dot products/τ. In both cases you build a similarity matrix, softmax it, and learn by cross-entropy.'
  },
  {
    from: 'attention-transformers',
    to: 'decoding-sampling',
    type: 'same_trick',
    label: 'Softmax selection',
    why: 'Attention uses softmax to select "which positions to copy from," while decoding uses softmax to select "which token to emit." Same pattern: logits → distribution → sample/argmax/weighted sum.'
  },
  {
    from: 'representations',
    to: 'decoding-sampling',
    type: 'same_trick',
    label: 'Temperature scaling',
    why: 'Contrastive learning uses temperature τ to control softmax sharpness; decoding temperature does the same to token probabilities. In both places, temperature is an "entropy knob" on a softmax.'
  },
  {
    from: 'maximum-likelihood',
    to: 'tokenization-vocabulary',
    type: 'same_trick',
    label: 'Viterbi segmentation',
    why: 'Unigram tokenization chooses the max-prob segmentation by maximizing ∑ log p(tᵢ) under concat constraints. That is MAP/MLE-style inference solved by dynamic programming (a Viterbi-like trick).'
  },
  {
    from: 'maximum-likelihood',
    to: 'dpo',
    type: 'same_trick',
    label: 'Likelihood ratios',
    why: 'DPO is logistic regression on log-probability ratios (log πθ − log πref). That\'s classic maximum-likelihood machinery: fit a classifier via cross-entropy on preference-labeled data.'
  },
  {
    from: 'efficiency',
    to: 'rlhf',
    type: 'same_trick',
    label: 'KL anchoring',
    why: 'Distillation minimizes KL(teacher || student); RLHF-style objectives add a KL penalty to stay close to a reference policy. Same mathematical idea: "move, but don\'t drift too far from a trusted distribution."'
  },
  {
    from: 'sparse-autoencoders',
    to: 'mixture-of-experts',
    type: 'same_trick',
    label: 'Top-k gating',
    why: 'k-sparse SAEs enforce TopK activations; MoE routing enforces TopK experts per token. Both implement sparse selection as "keep top-k, drop the rest, then compute through a smaller active set."'
  },
  {
    from: 'ntk',
    to: 'circuit-discovery',
    type: 'same_trick',
    label: 'First-order Taylor',
    why: 'NTK analyzes training via linearization around parameters; attribution patching estimates causal effects via first-order Taylor expansion around activations. Same approximation move: replace nonlinear change with a linear surrogate.'
  },
  {
    from: 'vaes',
    to: 'diffusion',
    type: 'same_trick',
    label: 'Reparameterized noise',
    why: 'VAEs rewrite sampling as z = μ+σ⊙ε to backprop through randomness; diffusion rewrites noising as x_t = √α x_0 + √(1−α)ε. Both push stochasticity into a fixed ε so gradients can flow.'
  },

  // === DUALITY (additional) ===
  {
    from: 'rlhf',
    to: 'dpo',
    type: 'duality',
    label: 'RL ↔ Classification',
    why: 'KL-regularized RLHF has an optimal-policy form π*(y|x) ∝ π_ref(y|x)·exp(r/β). DPO is the supervised/logistic view of fitting that same policy from preference comparisons.'
  },
  {
    from: 'attention-transformers',
    to: 'ssm-hybrids',
    type: 'duality',
    label: 'Kernel ↔ Recurrence',
    why: 'Attention applies a (data-dependent) kernel over history; SSMs apply a structured kernel computed by recurrence/scan. Two mathematically connected ways to implement "weighted sums over the past," with different computational tradeoffs.'
  },
  {
    from: 'maximum-likelihood',
    to: 'theory',
    type: 'duality',
    label: 'Likelihood ↔ MDL',
    why: 'Negative log-likelihood is expected codelength under an optimal code. So "maximize likelihood" and "minimize description length" are two lenses on the same objective.'
  },
  {
    from: 'diffusion',
    to: 'maximum-likelihood',
    type: 'duality',
    label: 'Denoising ↔ ELBO',
    why: 'Noise-prediction diffusion losses correspond to optimizing a variational bound on log p(x) under a fixed forward noising process. It\'s denoising on the surface, likelihood training underneath.'
  },
  {
    from: 'tokenization-vocabulary',
    to: 'theory',
    type: 'duality',
    label: 'Tokens ↔ Codelength',
    why: 'A tokenizer is a codebook: vocab size and token counts jointly define a compression scheme. MDL provides the "dual" way to reason about why changing vocab changes sequence length, capacity, and generalization behavior.'
  },
  {
    from: 'representations',
    to: 'theory',
    type: 'duality',
    label: 'Bottleneck viewpoint',
    why: 'Representation learning is often "keep what matters, drop what doesn\'t." The information bottleneck formalizes that as maximizing I(Z;Y) while penalizing I(Z;X)—a dual language for the same design tradeoff.'
  },
  {
    from: 'speculative-decoding',
    to: 'decoding-sampling',
    type: 'duality',
    label: 'Direct ↔ Rejection',
    why: 'You can sample from p directly, or sample from a proposal q and accept/reject to exactly recover p. Speculative decoding is this sampling duality applied to autoregressive generation.'
  },
  {
    from: 'loss-landscapes',
    to: 'theory',
    type: 'duality',
    label: 'Flatness ↔ Complexity',
    why: 'Flat minima correspond to larger volumes of parameter space that implement similar functions, which often aligns with lower "effective complexity" in PAC-Bayes/MDL-style reasoning. It\'s a generalization lens on sharpness.'
  },

  // === BREAKS_WHEN (additional) ===
  {
    from: 'attention-transformers',
    to: 'long-context',
    type: 'breaks_when',
    label: 'Attention dilution',
    why: 'Even if memory is solved, long contexts make retrieval harder: softmax has to discriminate among many keys, and attention can become diffuse or distracted. Quality can degrade with length, not just speed.'
  },
  {
    from: 'rope',
    to: 'long-context',
    type: 'breaks_when',
    label: 'Phase wraparound',
    why: 'RoPE encodes position as rotations at multiple frequencies; beyond training ranges, some dimensions hit unseen angles/phase behavior. This "angle OOD" is a major reason naive length extrapolation fails.'
  },
  {
    from: 'tokenization-vocabulary',
    to: 'long-context',
    type: 'breaks_when',
    label: 'Token explosion',
    why: 'Long context is measured in tokens, not characters. Over-segmentation (rare Unicode, code identifiers, byte-level tokens) inflates token count and burns KV/cache budget much faster than expected.'
  },
  {
    from: 'llm-serving',
    to: 'long-context',
    type: 'breaks_when',
    label: 'KV dominates SLO',
    why: 'As prompts get long, KV cache bandwidth and memory become the dominant constraints, shrinking batch sizes and harming goodput under latency SLOs. Systems that work at 4k can fall over at 128k+.'
  },
  {
    from: 'mixture-of-experts',
    to: 'moe-serving',
    type: 'breaks_when',
    label: 'Routing stragglers',
    why: 'MoE routing creates skewed per-expert loads; the slowest/busiest expert dictates layer latency. Without careful scheduling and balancing, "sparse compute" turns into tail-latency collapse.'
  },
  {
    from: 'speculative-decoding',
    to: 'llm-serving',
    type: 'breaks_when',
    label: 'Low acceptance',
    why: 'Speculative decoding speedups rely on high draft-token acceptance. Under distribution shift, long contexts, or mismatched decoding settings, acceptance can drop and the method becomes neutral or even slower.'
  },
  {
    from: 'efficiency',
    to: 'loss-landscapes',
    type: 'breaks_when',
    label: 'Sharp minima',
    why: 'Quantization and low-rank updates are perturbations to weights/activations. Sharp regions amplify small perturbations into big loss increases, so compression can degrade quality much more than expected.'
  },
  {
    from: 'probing',
    to: 'superposition',
    type: 'breaks_when',
    label: 'Non-causal probes',
    why: 'With superposition, probes can "find" information in activations that isn\'t a clean, causal feature the model uses. High probe accuracy can overstate mechanistic understanding when features are entangled.'
  },
  {
    from: 'activation-steering',
    to: 'sparse-autoencoders',
    type: 'breaks_when',
    label: 'Feature entanglement',
    why: 'SAE features are not guaranteed to be perfectly monosemantic or causally isolated. Steering along imperfect features can cause unintended behavioral side effects or push activations off-manifold.'
  },
  {
    from: 'theory',
    to: 'double-descent',
    type: 'breaks_when',
    label: 'Bias-variance puzzle',
    why: 'Classical PAC/VC bounds predict test error increases with model complexity beyond optimal capacity. Double descent breaks this: extremely overparameterized models interpolate training data yet generalize well—requiring new theoretical frameworks like benign overfitting.'
  },

  // === INVENTED_TO_FIX (additional) ===
  {
    from: 'attention-transformers',
    to: 'speculative-decoding',
    type: 'invented_to_fix',
    label: 'Autoregressive latency',
    why: 'Token-by-token decoding is the sequential bottleneck in transformer inference. Speculative decoding was invented to propose many tokens cheaply and verify them in parallel without changing the target distribution.'
  },
  {
    from: 'attention-transformers',
    to: 'llm-serving',
    type: 'invented_to_fix',
    label: 'Production serving',
    why: 'Running a transformer once is easy; running it for thousands of concurrent users under latency SLOs is not. LLM serving techniques (continuous batching, prefill/decode separation, KV paging) were invented to make inference viable at scale.'
  },
  {
    from: 'mixture-of-experts',
    to: 'moe-serving',
    type: 'invented_to_fix',
    label: 'MoE scheduling',
    why: 'MoE makes compute sparse but introduces dispatch/combine all-to-all traffic and severe load skew. MoE serving systems were invented to schedule routing, reduce stragglers, and manage expert pools efficiently.'
  },
  {
    from: 'rope',
    to: 'long-context',
    type: 'invented_to_fix',
    label: 'RoPE scaling',
    why: 'RoPE improves positional generalization, but still breaks beyond its trained rotation regime. RoPE scaling/interpolation methods (YaRN, LongRoPE) were invented to extend usable context length.'
  },
  {
    from: 'efficient-attention',
    to: 'long-context',
    type: 'invented_to_fix',
    label: 'KV compression',
    why: 'FlashAttention fixes quadratic attention *during training*, but decoding still stores O(T) KV cache. Long-context engineering adds KV quantization/compression to fix the remaining linear-memory bottleneck.'
  },
  {
    from: 'superposition',
    to: 'sparse-autoencoders',
    type: 'invented_to_fix',
    label: 'Feature dictionaries',
    why: 'Superposition means neurons are polysemantic and hard to interpret. Sparse autoencoders were developed to learn an overcomplete dictionary that recovers sparse, more interpretable features from dense activations.'
  },
  {
    from: 'probing',
    to: 'circuit-discovery',
    type: 'invented_to_fix',
    label: 'Causal circuits',
    why: 'Probing is correlational: it shows information is decodable, not that it drives behavior. Circuit discovery was invented to identify causal subgraphs via interventions/patching and attribution.'
  },
  {
    from: 'circuit-discovery',
    to: 'activation-steering',
    type: 'invented_to_fix',
    label: 'Inference interventions',
    why: 'Once you can localize a circuit/feature that causes behavior, you want a knob to change it without retraining. Activation steering was developed as a direct, inference-time intervention mechanism.'
  },
  {
    from: 'long-context',
    to: 'ssm-hybrids',
    type: 'invented_to_fix',
    label: 'Fixed-state memory',
    why: 'Even with RoPE scaling and KV compression, transformer decoding still pays KV costs that grow with T. SSM/hybrid architectures were invented to get fixed-size state and linear-time sequence modeling for very long contexts.'
  },

  // === ANALOGY (additional) ===
  {
    from: 'tokenization-vocabulary',
    to: 'sparse-autoencoders',
    type: 'analogy',
    label: 'Codebook sparsity',
    why: 'Tokenization represents text by selecting items from a learned codebook (vocab). SAEs represent activations by selecting items from a learned codebook (features)—both are "dictionary + sparse code" stories.'
  },
  {
    from: 'tokenization-vocabulary',
    to: 'superposition',
    type: 'analogy',
    label: 'Compression tradeoff',
    why: 'Tokenizers compress frequent patterns into single tokens but fragment rare strings into many pieces. Superposition compresses many features into limited dimensions but creates interference—same capacity vs ambiguity tradeoff.'
  },
  {
    from: 'llm-serving',
    to: 'moe-serving',
    type: 'analogy',
    label: 'Scheduling under skew',
    why: 'Both are scheduling problems under memory and latency constraints; MoE serving is like LLM serving with an extra routing-induced permutation and heavier tail-latency from skew.'
  },
  {
    from: 'speculative-decoding',
    to: 'efficiency',
    type: 'analogy',
    label: 'Student as draft',
    why: 'Distillation trains a smaller student to mimic a large teacher. Speculative decoding uses a small "student-like" draft model to propose tokens, then the teacher verifies—same teacher/student pattern at inference time.'
  },
  {
    from: 'decoding-sampling',
    to: 'activation-steering',
    type: 'analogy',
    label: 'Inference-time control',
    why: 'Decoding changes behavior by reshaping the output distribution (logits → sampling). Steering changes behavior by reshaping hidden states—two inference-time control knobs with similar "too strong goes off-manifold" dynamics.'
  },
  {
    from: 'diffusion',
    to: 'decoding-sampling',
    type: 'analogy',
    label: 'Guidance knob',
    why: 'Classifier-free guidance reweights diffusion trajectories toward conditioning, trading diversity for fidelity. Temperature/top-p do the same reweighting idea for token sampling: a knob that reshapes probability mass at inference.'
  },
  {
    from: 'gans',
    to: 'rlhf',
    type: 'analogy',
    label: 'Learned critic',
    why: 'GANs learn a discriminator that acts like a learned loss; RLHF learns a reward model that acts like a learned loss. In both, a generator/policy is optimized against a learned evaluator that can be exploited.'
  },
  {
    from: 'scaling-laws',
    to: 'llm-serving',
    type: 'analogy',
    label: 'Budget allocation',
    why: 'Scaling laws ask how to allocate a compute budget between model size and data for best loss. Serving asks how to allocate GPU/memory budget between users and latency SLOs for best goodput—same "optimize under constraints" mindset.'
  },
  {
    from: 'ntk',
    to: 'probing',
    type: 'analogy',
    label: 'Linear lens',
    why: 'NTK emphasizes what happens when learning is effectively linearized (features don\'t move much). Linear probing tests what a fixed representation already makes linearly accessible—both separate "linear extractability" from "feature learning."'
  },

  // === KTO to theory connection ===
  {
    from: 'kto',
    to: 'theory',
    type: 'same_trick',
    label: 'Human-aware utility',
    why: 'KTO imports Kahneman-Tversky prospect theory—asymmetric loss aversion, reference-dependent value—from behavioral economics. This connects ML alignment to theoretical frameworks in decision theory and shows that loss design is fundamentally about modeling human cognition.'
  },

  // === REWARD-HACKING connections (was orphaned) ===
  {
    from: 'rlhf',
    to: 'reward-hacking',
    type: 'breaks_when',
    label: 'Proxy gaming',
    why: 'RLHF optimizes a learned reward proxy, not true human preferences. The policy learns to exploit reward model blind spots—high proxy reward, low true quality. This is the fundamental failure mode that motivates DPO, KTO, and constitutional approaches.'
  },
  {
    from: 'reward-hacking',
    to: 'dpo',
    type: 'invented_to_fix',
    label: 'Remove reward model',
    why: 'DPO eliminates the explicit reward model by reparameterizing the RL objective into a classification loss on preferences. No reward model = no reward model to hack.'
  },
  {
    from: 'gans',
    to: 'reward-hacking',
    type: 'same_trick',
    label: 'Learned loss gaming',
    why: 'GANs train a generator against a learned discriminator; RLHF trains a policy against a learned reward model. Both create adversarial dynamics where the generator/policy can exploit weaknesses in the learned evaluator.'
  },

  // === MULTIMODAL connections (was orphaned) ===
  {
    from: 'attention-transformers',
    to: 'multimodal',
    type: 'same_trick',
    label: 'Cross-attention fusion',
    why: 'Multimodal models use cross-attention to fuse modalities: image patches attend to text tokens (CLIP) or text attends to image features (Flamingo). Same Q·Kᵀ mechanism, different embedding spaces.'
  },
  {
    from: 'tokenization-vocabulary',
    to: 'multimodal',
    type: 'analogy',
    label: 'Patch = token',
    why: 'Vision transformers treat image patches as "visual tokens"—same discrete-sequence inductive bias. Both tokenization and patching convert continuous signals into discrete sequences for transformer consumption.'
  },
  {
    from: 'multimodal',
    to: 'diffusion',
    type: 'same_trick',
    label: 'Text-conditional generation',
    why: 'Text-to-image diffusion (Stable Diffusion, DALL-E) conditions the denoising process on text embeddings via cross-attention. The multimodal fusion happens at every denoising step.'
  },

  // === ADAM connections (strengthen from 1 to 3+) ===
  {
    from: 'adam',
    to: 'loss-landscapes',
    type: 'breaks_when',
    label: 'Edge of stability',
    why: 'Adam assumes locally quadratic loss. At the edge of stability (sharpness ≈ 2/η), Adam oscillates without diverging—behavior not predicted by standard convergence theory.'
  },
  {
    from: 'maximum-likelihood',
    to: 'adam',
    type: 'invented_to_fix',
    label: 'Efficient MLE',
    why: 'Adam was invented to efficiently minimize cross-entropy (MLE) on large datasets. Adaptive learning rates handle sparse gradients common in NLP; momentum handles noisy gradients from minibatches.'
  },

  // === INDUCTION-HEADS connections (strengthen from 1 to 3+) ===
  {
    from: 'induction-heads',
    to: 'attention-transformers',
    type: 'same_trick',
    label: 'Copy via attention',
    why: 'Induction heads implement "fuzzy copying" via attention: head 1 marks positions matching current token, head 2 copies what followed those positions. Attention IS the copying mechanism.'
  },
  {
    from: 'induction-heads',
    to: 'representations',
    type: 'analogy',
    label: 'Algorithmic feature',
    why: 'Induction heads are "algorithmic features"—circuits that implement pattern-completion algorithms. Understanding them bridges circuit-level interpretability and representation-level analysis.'
  },

  // === GANs additional connections ===
  {
    from: 'gans',
    to: 'vaes',
    type: 'duality',
    label: 'Implicit vs explicit density',
    why: 'GANs model implicit density (generate samples, never compute p(x)), VAEs model explicit density (optimize ELBO, can compute log p(x)). Two philosophies for the same generative goal.'
  },
  {
    from: 'gans',
    to: 'maximum-likelihood',
    type: 'breaks_when',
    label: 'Non-overlapping supports',
    why: 'JS divergence (original GAN) breaks when generator and data distributions don\'t overlap—gives no gradient. This is why WGAN replaced JS with Wasserstein distance.'
  },
  {
    from: 'gans',
    to: 'loss-landscapes',
    type: 'analogy',
    label: 'Saddle point game',
    why: 'GAN training is a min-max game seeking saddle points in loss landscape. Understanding loss geometry explains mode collapse, oscillation, and why WGAN training is more stable.'
  },
  {
    from: 'gans',
    to: 'adam',
    type: 'invented_to_fix',
    label: 'TTUR training',
    why: 'Two Time-Scale Update Rule (different learning rates for G/D) was invented to stabilize GAN training. Adam\'s adaptive rates help balance the adversarial game.'
  },

  // === SSM-Hybrids connections ===
  {
    from: 'ssm-hybrids',
    to: 'attention-transformers',
    type: 'invented_to_fix',
    label: 'Linear complexity',
    why: 'Mamba/SSMs were invented to fix attention\'s O(n²) complexity. State-space models achieve O(n) scaling while maintaining long-range dependencies.'
  },
  {
    from: 'ssm-hybrids',
    to: 'efficient-attention',
    type: 'same_trick',
    label: 'Recurrent view',
    why: 'Both SSMs and linear attention can be viewed as RNNs with specific transition matrices. The "selective" in Mamba is input-dependent recurrence—same trick as gated attention.'
  },
  {
    from: 'ssm-hybrids',
    to: 'rope',
    type: 'analogy',
    label: 'Position via state',
    why: 'SSMs encode position implicitly through state evolution, RoPE encodes position explicitly through rotation. Both solve "where am I in the sequence?" differently.'
  },

  // === Long-context connections ===
  {
    from: 'long-context',
    to: 'efficient-attention',
    type: 'same_trick',
    label: 'Memory efficiency',
    why: 'Long context requires efficient attention: GQA reduces KV cache, sliding window limits active tokens, both enable longer sequences within memory constraints.'
  },
  {
    from: 'long-context',
    to: 'rope',
    type: 'invented_to_fix',
    label: 'Position extrapolation',
    why: 'RoPE\'s rotation-based positions extrapolate better than learned embeddings. Combined with NTK-aware scaling, enables training at 4K and inference at 100K+.'
  },

  // === Speculative-decoding connections ===
  {
    from: 'speculative-decoding',
    to: 'llm-serving',
    type: 'invented_to_fix',
    label: 'Latency reduction',
    why: 'Speculative decoding trades compute for latency: small model drafts tokens, large model verifies in parallel. Maintains exact sampling while reducing time-to-first-token.'
  },
  {
    from: 'speculative-decoding',
    to: 'mixture-of-experts',
    type: 'analogy',
    label: 'Draft-verify routing',
    why: 'Speculative decoding\'s draft-verify is like MoE routing: lightweight decision (which expert / accept draft?) gates expensive compute (expert forward / rejection sampling).'
  },

  // === Tokenization connections ===
  {
    from: 'tokenization-vocabulary',
    to: 'maximum-likelihood',
    type: 'breaks_when',
    label: 'OOV tokens',
    why: 'Tokenization breaks MLE when encountering out-of-vocabulary tokens. BPE/SentencePiece mitigate this but rare token combinations still cause poor probability estimates.'
  },
  {
    from: 'tokenization-vocabulary',
    to: 'scaling-laws',
    type: 'analogy',
    label: 'Compression efficiency',
    why: 'Vocabulary size affects scaling: larger vocab = better compression but sparser embeddings. Chinchilla-optimal vocab scales with model size, balancing compression and learning.'
  },

  // === DPO/KTO connections ===
  {
    from: 'dpo',
    to: 'kto',
    type: 'invented_to_fix',
    label: 'No pairs needed',
    why: 'KTO was invented to fix DPO\'s requirement for preference pairs. Uses Kahneman-Tversky utility theory to learn from unpaired good/bad examples.'
  },
  {
    from: 'reward-hacking',
    to: 'dpo',
    type: 'breaks_when',
    label: 'Distribution shift',
    why: 'DPO can reward-hack when policy drifts far from reference. The implicit reward becomes unreliable, causing optimization against the reference distribution.'
  },

  // === Under-connected concepts: reaching 100+ relations ===

  // Sparse autoencoders connections
  {
    from: 'sparse-autoencoders',
    to: 'superposition',
    type: 'invented_to_fix',
    label: 'Disentangle features',
    why: 'SAEs were invented to fix superposition—extracting monosemantic features from polysemantic neurons. The sparsity constraint encourages one feature per direction.'
  },
  {
    from: 'sparse-autoencoders',
    to: 'representations',
    type: 'same_trick',
    label: 'Dictionary learning',
    why: 'SAEs are dictionary learning applied to neural activations. Both find sparse, interpretable bases that explain data as combinations of learned features.'
  },

  // Circuit discovery connections
  {
    from: 'circuit-discovery',
    to: 'induction-heads',
    type: 'same_trick',
    label: 'Ablation studies',
    why: 'Both use ablation (zeroing activations) to identify causal structure. Induction heads were discovered by systematically ablating attention patterns.'
  },
  {
    from: 'circuit-discovery',
    to: 'probing',
    type: 'duality',
    label: 'Top-down vs bottom-up',
    why: 'Probing asks "what info is here?" (bottom-up). Circuit discovery asks "what computation uses this?" (top-down). Complementary interpretability approaches.'
  },

  // Activation steering connections
  {
    from: 'activation-steering',
    to: 'representations',
    type: 'same_trick',
    label: 'Linear directions',
    why: 'Both exploit that concepts are encoded as linear directions. Steering adds a "refusal direction" or "honesty direction" to activations—same geometry, different goal.'
  },
  {
    from: 'activation-steering',
    to: 'sparse-autoencoders',
    type: 'invented_to_fix',
    label: 'Targeted intervention',
    why: 'SAE features enable targeted steering. Instead of coarse activation patching, you can add/remove specific interpretable features identified by SAEs.'
  },

  // Decoding/sampling connections
  {
    from: 'decoding-sampling',
    to: 'maximum-likelihood',
    type: 'breaks_when',
    label: 'Repetition loops',
    why: 'Greedy MLE decoding breaks into repetition loops. Temperature, top-p, and top-k sampling add noise to escape local modes—breaking pure likelihood maximization.'
  },
  {
    from: 'decoding-sampling',
    to: 'speculative-decoding',
    type: 'same_trick',
    label: 'Accept/reject sampling',
    why: 'Speculative decoding uses rejection sampling from draft model. Standard sampling also uses accept/reject (top-p truncates, temperature reshapes) to control generation.'
  },

  // Multimodal connections
  {
    from: 'multimodal',
    to: 'attention-transformers',
    type: 'same_trick',
    label: 'Cross-attention fusion',
    why: 'Multimodal models use cross-attention to fuse modalities—image tokens attend to text, audio attends to video. Same attention mechanism, different input spaces.'
  },
  {
    from: 'multimodal',
    to: 'tokenization-vocabulary',
    type: 'analogy',
    label: 'Everything is tokens',
    why: 'Multimodal = unified tokenization. Images become patch tokens (ViT), audio becomes spectral tokens, video becomes frame tokens. Same sequence modeling on different "vocabularies."'
  },

  // Efficient attention additional connections
  {
    from: 'efficient-attention',
    to: 'attention-transformers',
    type: 'invented_to_fix',
    label: 'O(n²) memory',
    why: 'Flash Attention, GQA, sliding window all invented to fix standard attention\'s quadratic memory. Same computation, better memory hierarchy usage.'
  },

  // ======================
  // ORACLE-DISCOVERED RELATIONS (GPT-5.2 Pro Extended Thinking, Dec 31 2025)
  // Query: "15 additional semantic relations focusing on same_trick, breaks_when, invented_to_fix"
  // ======================

  // NTK-Induction Heads: Feature learning regime
  {
    from: 'ntk',
    to: 'induction-heads',
    type: 'breaks_when',
    label: 'Feature learning dominates',
    why: 'NTK assumes training stays near initialization (kernel/linearized regime). Induction heads emerge from representation reorganization and new circuit formation—behavior NTK-style predictions miss.'
  },

  // GANs → Diffusion: Historical fix for mode collapse
  {
    from: 'gans',
    to: 'diffusion',
    type: 'invented_to_fix',
    label: 'Fix mode collapse',
    why: 'GANs suffer instability and mode collapse from min-max optimization. Diffusion replaces adversarial objective with stable denoising regression—far more robust and mode-covering.'
  },

  // Diffusion → Efficiency: Iterative sampling cost
  {
    from: 'diffusion',
    to: 'efficiency',
    type: 'invented_to_fix',
    label: 'Accelerate sampling',
    why: 'High-quality diffusion needs tens to hundreds of denoise steps. Distillation and compression were pushed heavily to reduce step count and wall-clock cost.'
  },

  // Scaling laws → MoE: Compute efficiency
  {
    from: 'scaling-laws',
    to: 'mixture-of-experts',
    type: 'invented_to_fix',
    label: 'More params, same FLOPs',
    why: 'Compute-optimal scaling makes dense models hit a compute wall. MoE raises total parameter count while keeping activated compute constant via top-k routing.'
  },

  // Scaling laws → Tokenization: Measurement units
  {
    from: 'scaling-laws',
    to: 'tokenization-vocabulary',
    type: 'breaks_when',
    label: 'Token units shift',
    why: 'Scaling laws report cross-entropy per token, but tokenizer changes shift what "a token" means. Curves can look better/worse unless normalized (bits-per-byte).'
  },

  // Representations → Multimodal: InfoNCE pattern
  {
    from: 'representations',
    to: 'multimodal',
    type: 'same_trick',
    label: 'InfoNCE similarity matrix',
    why: 'CLIP/SigLIP training is contrastive representation learning: build image×text similarity matrix and apply softmax cross-entropy. Same objective, two modalities.'
  },

  // MoE → Decoding: Top-k selection
  {
    from: 'mixture-of-experts',
    to: 'decoding-sampling',
    type: 'same_trick',
    label: 'Top-k then renormalize',
    why: 'MoE keeps top-k experts and renormalizes gate. Top-k decoding applies same truncation-and-renormalization to vocabulary logits before sampling.'
  },

  // Speculative → Decoding: Entropy dependence
  {
    from: 'speculative-decoding',
    to: 'decoding-sampling',
    type: 'breaks_when',
    label: 'Entropy kills acceptance',
    why: 'Speculative speedups depend on draft tokens being accepted. High-entropy settings (high temp/aggressive top-p) increase mismatch, collapsing speedups.'
  },

  // Efficient attention → LLM serving: Memory hierarchy
  {
    from: 'efficient-attention',
    to: 'llm-serving',
    type: 'same_trick',
    label: 'Blocked KV memory layout',
    why: 'FlashAttention tiles computation; PagedAttention tiles KV cache into pages. Same memory-hierarchy trick: block the problem for contiguous, cache-friendly access.'
  },

  // MLE → Decoding: Text degeneration fix
  {
    from: 'maximum-likelihood',
    to: 'decoding-sampling',
    type: 'invented_to_fix',
    label: 'Fix text degeneration',
    why: 'Pure MLE + greedy decoding yields repetition loops. Nucleus/typical sampling were invented as inference-time fixes to avoid pathological tails without retraining.'
  },

  // MLE → GANs: Discriminator training
  {
    from: 'maximum-likelihood',
    to: 'gans',
    type: 'same_trick',
    label: 'MLE-trained classifier',
    why: 'GAN discriminator maximizes likelihood of correct real/fake labels via logistic cross-entropy. MLE classification repurposed as training signal for generator.'
  },

  // RLHF → Decoding: Tail sampling danger
  {
    from: 'rlhf',
    to: 'decoding-sampling',
    type: 'breaks_when',
    label: 'Tail sampling breaks alignment',
    why: 'RLHF shapes behavior near distribution seen during feedback. Sampling deep into the tail surfaces outputs preference data never covered, undermining alignment.'
  },

  // Multimodal → Long-context: Token explosion
  {
    from: 'multimodal',
    to: 'long-context',
    type: 'breaks_when',
    label: 'Patch sequences explode',
    why: 'Images/videos become long sequences of patch/frame tokens, often far longer than text. Token explosion burns context/KV budgets faster than text-only models.'
  },

  // Circuit discovery → Loss landscapes: Approximation limits
  {
    from: 'circuit-discovery',
    to: 'loss-landscapes',
    type: 'breaks_when',
    label: 'Linear patching misses curvature',
    why: 'Fast circuit methods rely on first-order Taylor approximations. In sharp loss regions, higher-order terms dominate and linear estimates misidentify true causal circuits.'
  },

  // ======================
  // ADDITIONAL RELATIONS (Strengthening under-connected nodes)
  // ======================

  // RoPE → Efficient attention: Position encoding efficiency
  {
    from: 'rope',
    to: 'efficient-attention',
    type: 'same_trick',
    label: 'Lazy position compute',
    why: 'RoPE computes relative positions at attention-time via rotation matrices, integrating naturally with Flash Attention and sliding window. No position embedding lookups—positions emerge from query-key rotation.'
  },

  // VAEs → Diffusion: Historical progression
  {
    from: 'vaes',
    to: 'diffusion',
    type: 'invented_to_fix',
    label: 'Fix blurry outputs',
    why: 'VAE decoders produce blurry samples from posterior collapse and reconstruction loss averaging. Diffusion replaces single-shot decoding with iterative refinement—each step sharpens details that VAEs smear.'
  },

  // Superposition → Probing: Interpretability challenge
  {
    from: 'superposition',
    to: 'probing',
    type: 'breaks_when',
    label: 'Features overlap',
    why: 'Linear probes assume features occupy distinct directions. Superposition packs more features than dimensions by overlapping sparse features—probes see interference patterns, not clean linear separability.'
  },

  // Loss landscapes → Double-descent: Complexity puzzle
  {
    from: 'loss-landscapes',
    to: 'double-descent',
    type: 'breaks_when',
    label: 'Beyond interpolation threshold',
    why: 'Classical loss landscape intuition suggests more parameters = overfitting. Double descent breaks this: past the interpolation threshold, overparameterized networks find flatter minima that generalize better. The landscape has benign overfitting regions.'
  },

  // MoE-serving → Speculative decoding: Parallelism strategy
  {
    from: 'moe-serving',
    to: 'speculative-decoding',
    type: 'same_trick',
    label: 'Hide latency with parallelism',
    why: 'MoE serving uses expert parallelism to hide routing overhead. Speculative decoding uses draft-verify parallelism to hide autoregressive latency. Both mask sequential bottlenecks with parallel compute.'
  },

  // KTO → Representations: Value geometry
  {
    from: 'kto',
    to: 'representations',
    type: 'same_trick',
    label: 'Implicit value directions',
    why: 'KTO shapes model behavior via scalar feedback signals, implicitly learning value directions in representation space. The loss gradient pushes activations toward "good" regions—same geometric view as representation steering.'
  },

  // NTK → Double-descent: Feature learning regime
  {
    from: 'ntk',
    to: 'double-descent',
    type: 'breaks_when',
    label: 'Rich regime dominates',
    why: 'NTK analysis assumes lazy training (features fixed at init). Double descent occurs in the rich/feature-learning regime where representations reorganize—precisely where NTK predictions fail.'
  },

  // Efficiency → Reward-hacking: Alignment tax
  {
    from: 'efficiency',
    to: 'reward-hacking',
    type: 'breaks_when',
    label: 'Speed vs safety tradeoff',
    why: 'Efficient training shortcuts (fewer RLHF steps, smaller reward models, distillation) increase reward hacking risk. The "alignment tax" trades compute efficiency for robustness against proxy gaming.'
  },

  // Adam → Efficiency: Adaptive training
  {
    from: 'adam',
    to: 'efficiency',
    type: 'same_trick',
    label: 'Adaptive step sizing',
    why: 'Adam\'s per-parameter learning rates enable efficient training across diverse architectures without manual tuning. LoRA, QLoRA, and other efficient methods rely on Adam variants to handle heterogeneous gradient scales.'
  },

  // MoE-serving → Long-context: Memory hierarchy
  {
    from: 'moe-serving',
    to: 'long-context',
    type: 'same_trick',
    label: 'Memory paging strategies',
    why: 'Both MoE expert caching and long-context KV caching use similar memory management: page in/out based on access patterns, predict future needs, trade latency for capacity. PagedAttention borrows from OS memory management.'
  },

  // KTO → Decoding-sampling: Output shaping
  {
    from: 'kto',
    to: 'decoding-sampling',
    type: 'same_trick',
    label: 'Preference-aware generation',
    why: 'KTO training shapes the model distribution toward human preferences. At inference, sampling strategies (temperature, top-p) further control this shaped distribution—both operate on the same output space with complementary goals.'
  },
]

export interface Concept {
  id: string
  number: number
  title: string
  shortTitle: string
  icon: string
  category: 'core' | 'optimization' | 'generative' | 'representation' | 'scaling' | 'efficiency' | 'theory'
  canonicalPapers: Paper[]
  coreMath: string // LaTeX equations
  coreEquation: string // Single key equation
  whyItMatters: string[]
  missingIntuition: string[]
  prereqs: string[] // concept IDs
  dependents: string[] // concept IDs
  color: string
}

export const CATEGORY_COLORS = {
  core: '#f59e0b',        // orange - fundamentals
  optimization: '#22c55e', // green - optimization
  generative: '#8b5cf6',   // purple - generative models
  representation: '#14b8a6', // teal - representations
  scaling: '#ef4444',      // red - scaling
  efficiency: '#3b82f6',   // blue - efficiency
  theory: '#6b7280',       // gray - theory
} as const

export const CATEGORY_LABELS = {
  core: 'Core Training',
  optimization: 'Optimization',
  generative: 'Generative Models',
  representation: 'Representations',
  scaling: 'Scaling & Alignment',
  efficiency: 'Efficiency',
  theory: 'Theory',
} as const

// Colors for typed relation edges in the graph
export const RELATION_COLORS = {
  prereq: 'rgba(245, 158, 11, 0.4)',      // orange (default prereq arrows)
  same_trick: 'rgba(168, 85, 247, 0.6)',  // purple - same technique
  duality: 'rgba(236, 72, 153, 0.6)',     // pink - mathematical duals
  breaks_when: 'rgba(239, 68, 68, 0.6)',  // red - failure modes
  invented_to_fix: 'rgba(34, 197, 94, 0.6)', // green - solutions
  analogy: 'rgba(59, 130, 246, 0.6)',     // blue - structural similarity
} as const

export const RELATION_LABELS = {
  prereq: 'Prerequisites',
  same_trick: 'Same Technique',
  duality: 'Mathematical Dual',
  breaks_when: 'Breaks When',
  invented_to_fix: 'Invented to Fix',
  analogy: 'Analogy',
} as const

export const foundationsConcepts: Concept[] = [
  {
    id: 'maximum-likelihood',
    number: 1,
    title: 'Maximum Likelihood, Cross-Entropy & KL Divergence',
    shortTitle: 'ML/CE/KL',
    icon: 'ℒ',
    category: 'core',
    canonicalPapers: [
      {
        title: 'A Neural Probabilistic Language Model',
        authors: 'Bengio et al.',
        year: 2003,
        venue: 'JMLR',
        url: 'https://www.jmlr.org/papers/v3/bengio03a.html'
      }
    ],
    coreMath: `Almost every frontier model is trained by (approximate) **maximum likelihood**:

$$\\max_\\theta \\sum_{i=1}^n \\log p_\\theta(x^{(i)})$$

Equivalently, minimize empirical **cross-entropy** between data distribution $\\hat p$ and model $p_\\theta$:

$$\\min_\\theta H(\\hat p, p_\\theta) = \\min_\\theta \\left[ -\\mathbb E_{x\\sim \\hat p} \\log p_\\theta(x) \\right]$$

This is the same as minimizing **KL divergence**:

$$\\mathrm{KL}(\\hat p \\,\\|\\, p_\\theta) = \\mathbb E_{\\hat p} \\log \\frac{\\hat p(x)}{p_\\theta(x)}$$

For **autoregressive LMs**, factorization comes from the chain rule:

$$p_\\theta(x_1,\\dots,x_T) = \\prod_{t=1}^T p_\\theta(x_t \\mid x_{<t})$$`,
    coreEquation: '\\min_\\theta H(\\hat p, p_\\theta) = -\\mathbb E_{x\\sim \\hat p} \\log p_\\theta(x)',
    whyItMatters: [
      'Pretraining for GPT-4, Claude, Gemini, Llama: next-token cross-entropy over web/text/code',
      'Stable Diffusion & Sora optimize likelihood-style surrogates (noise-prediction MSE = reparameterized ELBO)',
      'Reward models in RLHF trained via cross-entropy on human preference data'
    ],
    missingIntuition: [
      'Why KL direction matters (KL(p_data || p_θ) vs reverse) and how it biases models toward covering modes vs being conservative',
      'How cross-entropy shapes behavior under distribution shift (hallucinations: model picks "likely token" under learned p_θ even when input is off-manifold)'
    ],
    prereqs: [],
    dependents: ['vaes', 'diffusion', 'rlhf'],
    color: CATEGORY_COLORS.core
  },
  {
    id: 'attention-transformers',
    number: 2,
    title: 'Scaled Dot-Product Attention & Transformer Layers',
    shortTitle: 'Attention',
    icon: '⊗',
    category: 'core',
    canonicalPapers: [
      {
        title: 'Attention Is All You Need',
        authors: 'Vaswani et al.',
        year: 2017,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/1706.03762'
      }
    ],
    coreMath: `Single attention head:

$$\\text{Attn}(Q,K,V) = \\mathrm{softmax}\\!\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V$$

where $Q = XW_Q,\\ K = XW_K,\\ V = XW_V$. Multi-head attention concatenates several such heads.

A standard transformer block:

$$\\begin{aligned}
H' &= \\mathrm{MHA}(\\mathrm{LN}(H)) + H \\\\
H^{\\text{out}} &= \\mathrm{MLP}(\\mathrm{LN}(H')) + H'
\\end{aligned}$$`,
    coreEquation: '\\text{Attn}(Q,K,V) = \\mathrm{softmax}\\!\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V',
    whyItMatters: [
      'GPT-4, Claude, Gemini, Llama: giant stacks of decoder-only transformer blocks with causal self-attention',
      'Stable Diffusion: U-Net with self- and cross-attention between image latents and text embeddings',
      'Sora: diffusion transformer operating on spacetime patches (video tokens)'
    ],
    missingIntuition: [
      'Geometric picture of Q–K dot products as measuring angles between feature directions, and how softmax turns those into a distribution of "who to copy from"',
      'How multi-head attention effectively builds a set of learned kernels over positions/features, and why this is strictly more flexible than fixed kernels'
    ],
    prereqs: ['maximum-likelihood'],
    dependents: ['induction-heads', 'scaling-laws'],
    color: CATEGORY_COLORS.core
  },
  {
    id: 'adam',
    number: 3,
    title: 'Adam & Adaptive Gradient Methods',
    shortTitle: 'Adam',
    icon: '∇',
    category: 'optimization',
    canonicalPapers: [
      {
        title: 'Adam: A Method for Stochastic Optimization',
        authors: 'Kingma & Ba',
        year: 2014,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/1412.6980'
      },
      {
        title: 'On the Convergence of Adam and Beyond',
        authors: 'Reddi et al.',
        year: 2018,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/1904.09237'
      }
    ],
    coreMath: `For gradient $g_t = \\nabla_\\theta L_t(\\theta_t)$:

$$\\begin{aligned}
m_t &= \\beta_1 m_{t-1} + (1-\\beta_1) g_t \\\\
v_t &= \\beta_2 v_{t-1} + (1-\\beta_2) g_t^2 \\\\
\\hat m_t &= m_t / (1-\\beta_1^t),\\quad
\\hat v_t = v_t / (1-\\beta_2^t) \\\\
\\theta_{t+1} &= \\theta_t - \\alpha \\frac{\\hat m_t}{\\sqrt{\\hat v_t} + \\varepsilon}
\\end{aligned}$$

Convergence analyses show that naïve Adam can diverge on simple convex problems and motivate variants like AMSGrad.`,
    coreEquation: '\\theta_{t+1} = \\theta_t - \\alpha \\frac{\\hat m_t}{\\sqrt{\\hat v_t} + \\varepsilon}',
    whyItMatters: [
      'Large foundation models almost universally use Adam or AdamW for pretraining and fine-tuning',
      'RLHF and diffusion training use Adam-style optimizers to handle noisy gradients and widely varying scales'
    ],
    missingIntuition: [
      'Geometric explanation of how per-coordinate scaling with 1/√vₜ interacts with overparameterized nets—why it sometimes hurts generalization vs SGD',
      'How Adam bias-correction and exponential averaging interact with curriculum and non-stationary objectives (e.g. RLHF)'
    ],
    prereqs: [],
    dependents: ['loss-landscapes', 'scaling-laws'],
    color: CATEGORY_COLORS.optimization
  },
  {
    id: 'loss-landscapes',
    number: 4,
    title: 'Loss Landscapes, Sharpness & Flat Minima',
    shortTitle: 'Sharpness',
    icon: '⌇',
    category: 'optimization',
    canonicalPapers: [
      {
        title: 'Deep Learning without Poor Local Minima',
        authors: 'Kawaguchi',
        year: 2016,
        venue: 'NeurIPS',
        url: 'https://papers.nips.cc/paper/2016/hash/f2fc990265c712c49d51a18a32b39f0c-Abstract.html'
      },
      {
        title: 'Sharpness-Aware Minimization for Efficiently Improving Generalization',
        authors: 'Foret et al.',
        year: 2020,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/2010.01412'
      }
    ],
    coreMath: `SAM objective:

$$\\min_w \\max_{\\|\\epsilon\\|_p \\le \\rho} L(w + \\epsilon)$$

In practice:
1. Take a single gradient step to find "worst-case" perturbation: $\\epsilon(w) \\approx \\rho \\frac{\\nabla L(w)}{\\|\\nabla L(w)\\|_2}$
2. Update using gradient at the perturbed weights: $\\nabla L(w+\\epsilon(w))$

Theoretical results show certain deep networks' loss surfaces have no "bad" local minima (all local minima are global or near-global).`,
    coreEquation: '\\min_w \\max_{\\|\\epsilon\\|_p \\le \\rho} L(w + \\epsilon)',
    whyItMatters: [
      'Frontier models rely on implicit flat-minima bias (mini-batch SGD, data augmentation, weight decay) for generalization',
      'Fine-tuning and RLHF pipelines sometimes adopt SAM-like ideas to stabilize training'
    ],
    missingIntuition: [
      'Most expositions show "sharp vs flat" in 2D, but we lack intuitive stories for high-dimensional anisotropic sharpness',
      'How mode connectivity (many minima connected by low-loss paths) interacts with flatness and weight averaging'
    ],
    prereqs: ['adam'],
    dependents: ['double-descent', 'efficiency'],
    color: CATEGORY_COLORS.optimization
  },
  {
    id: 'double-descent',
    number: 5,
    title: 'Overparameterization & Generalization, Double Descent',
    shortTitle: 'Double Descent',
    icon: '∪',
    category: 'optimization',
    canonicalPapers: [
      {
        title: 'Understanding Deep Learning Requires Rethinking Generalization',
        authors: 'Zhang et al.',
        year: 2017,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/1611.03530'
      },
      {
        title: 'Reconciling Modern Machine-Learning Practice and the Bias–Variance Trade-off',
        authors: 'Belkin et al.',
        year: 2019,
        venue: 'PNAS',
        url: 'https://arxiv.org/abs/1812.11118'
      }
    ],
    coreMath: `Classical learning theory: test error ~ U-shaped function of model capacity. Empirically, modern nets show **double descent**: as parameters cross the interpolation threshold (0 training error), test error drops again as capacity keeps growing.

In simple linear models:

$$\\mathbb E[(y - \\hat y)^2] = \\text{bias}^2 + \\text{variance} + \\sigma^2$$

Variance explodes near interpolation, then decreases as overparameterization plus implicit regularization kicks in.`,
    coreEquation: '\\mathbb E[(y - \\hat y)^2] = \\text{bias}^2 + \\text{variance} + \\sigma^2',
    whyItMatters: [
      'GPT-4-class models are deep in the overparameterized regime: parameters ≫ training examples, yet generalize well',
      'Chinchilla-style scaling laws model how test loss scales with both capacity and data'
    ],
    missingIntuition: [
      'Visual intuition for why larger nets can generalize better (not just "they memorize more")',
      'How implicit biases of different optimizers (SGD vs Adam) select among infinite interpolating solutions'
    ],
    prereqs: ['loss-landscapes'],
    dependents: ['ntk', 'scaling-laws'],
    color: CATEGORY_COLORS.optimization
  },
  {
    id: 'ntk',
    number: 6,
    title: 'Neural Tangent Kernel & Infinite-Width Limits',
    shortTitle: 'NTK',
    icon: 'Θ',
    category: 'theory',
    canonicalPapers: [
      {
        title: 'Neural Tangent Kernel: Convergence and Generalization in Neural Networks',
        authors: 'Jacot et al.',
        year: 2018,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/1806.07572'
      }
    ],
    coreMath: `Define network $f_\\theta(x)$ with parameters $\\theta$. The **NTK** is:

$$\\Theta(x,x') = \\nabla_\\theta f_\\theta(x)^\\top \\nabla_\\theta f_\\theta(x')$$

In the infinite-width limit, this kernel becomes deterministic and remains constant during training. Training becomes:

$$\\partial_t f_t(x) = - \\sum_{i} \\Theta(x,x_i)\\, \\frac{\\partial \\ell(f_t(x_i), y_i)}{\\partial f}$$

a linear ODE in function space, just like kernel regression.`,
    coreEquation: '\\Theta(x,x\') = \\nabla_\\theta f_\\theta(x)^\\top \\nabla_\\theta f_\\theta(x\')',
    whyItMatters: [
      'NTK provides a mathematically clean limit where we can predict learning dynamics and generalization',
      'Many mechanistic-interpretability arguments assume behavior "somewhere between" kernel-like and feature-learning regimes'
    ],
    missingIntuition: [
      'Most expositions are algebraic; missing is a geometric animation showing how trajectories in function space under NTK differ from genuine feature learning'
    ],
    prereqs: ['double-descent'],
    dependents: ['induction-heads'],
    color: CATEGORY_COLORS.theory
  },
  {
    id: 'vaes',
    number: 7,
    title: 'Variational Autoencoders & Variational Inference',
    shortTitle: 'VAEs',
    icon: 'ℤ',
    category: 'generative',
    canonicalPapers: [
      {
        title: 'Auto-Encoding Variational Bayes',
        authors: 'Kingma & Welling',
        year: 2013,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/1312.6114'
      }
    ],
    coreMath: `Latent variable model $p_\\theta(x,z) = p(z)p_\\theta(x\\mid z)$ with intractable posterior. Introduce variational encoder $q_\\phi(z\\mid x)$ and maximize **ELBO**:

$$\\log p_\\theta(x) \\ge \\mathbb E_{q_\\phi(z\\mid x)}[\\log p_\\theta(x\\mid z)] - \\mathrm{KL}(q_\\phi(z\\mid x)\\,\\|\\,p(z))$$

Reparameterization trick for Gaussian encoder:

$$z = \\mu_\\phi(x) + \\sigma_\\phi(x)\\odot\\epsilon,\\quad \\epsilon\\sim\\mathcal N(0,I)$$`,
    coreEquation: '\\log p_\\theta(x) \\ge \\mathbb E_{q_\\phi}[\\log p_\\theta(x\\mid z)] - \\mathrm{KL}(q_\\phi\\,\\|\\,p(z))',
    whyItMatters: [
      'Stable Diffusion is a latent diffusion model: an autoencoder maps images ↔ compressed latent space where diffusion operates',
      'VAEs underpin many multimodal encoders (audio, video latents) used as building blocks'
    ],
    missingIntuition: [
      'Intuitive grasp of why ELBO works as both reconstruction + regularization',
      'Visualizations of how the prior p(z) and posterior families affect sample quality/diversity'
    ],
    prereqs: ['maximum-likelihood'],
    dependents: ['diffusion'],
    color: CATEGORY_COLORS.generative
  },
  {
    id: 'gans',
    number: 8,
    title: 'GANs & Adversarial Divergence Minimization',
    shortTitle: 'GANs',
    icon: '⚔',
    category: 'generative',
    canonicalPapers: [
      {
        title: 'Generative Adversarial Nets',
        authors: 'Goodfellow et al.',
        year: 2014,
        venue: 'NeurIPS',
        url: 'https://papers.nips.cc/paper/2014/hash/5ca3e9b122f61f8f06494c97b1afccf3-Abstract.html'
      },
      {
        title: 'Wasserstein GAN',
        authors: 'Arjovsky et al.',
        year: 2017,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/1701.07875'
      }
    ],
    coreMath: `Original GAN objective:

$$\\min_G \\max_D \\; \\mathbb E_{x\\sim p_{\\text{data}}}[\\log D(x)] + \\mathbb E_{z\\sim p(z)}[\\log(1 - D(G(z)))]$$

At optimum, with optimal discriminator $D^*$, this minimizes the **Jensen–Shannon divergence** between model and data.

WGAN replaces JS with Earth-Mover (Wasserstein-1) distance, with Lipschitz constraints on $D$.`,
    coreEquation: '\\min_G \\max_D \\; \\mathbb E_{p_{\\text{data}}}[\\log D(x)] + \\mathbb E_{p(z)}[\\log(1 - D(G(z)))]',
    whyItMatters: [
      'Adversarial min-max ideas appear in adversarial training and some alignment techniques',
      'GAN-like training still influential in high-fidelity image/video generation'
    ],
    missingIntuition: [
      'Why JS divergence leads to vanishing gradients when supports don\'t overlap, and how Wasserstein distances fix this',
      'Geometric visualizations of discriminator decision surfaces over latent manifolds'
    ],
    prereqs: ['maximum-likelihood'],
    dependents: ['diffusion'],
    color: CATEGORY_COLORS.generative
  },
  {
    id: 'diffusion',
    number: 9,
    title: 'Diffusion, Score-Based Models & Flow Matching',
    shortTitle: 'Diffusion',
    icon: '∂',
    category: 'generative',
    canonicalPapers: [
      {
        title: 'Deep Unsupervised Learning using Nonequilibrium Thermodynamics',
        authors: 'Sohl-Dickstein et al.',
        year: 2015,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/1503.03585'
      },
      {
        title: 'Denoising Diffusion Probabilistic Models',
        authors: 'Ho et al.',
        year: 2020,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2006.11239'
      },
      {
        title: 'Score-Based Generative Modeling through SDEs',
        authors: 'Song et al.',
        year: 2021,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/2011.13456'
      },
      {
        title: 'Flow Matching for Generative Modeling',
        authors: 'Lipman et al.',
        year: 2023,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/2210.02747'
      }
    ],
    coreMath: `Forward diffusion adds noise:

$$q(x_t \\mid x_0) = \\mathcal N(\\sqrt{\\bar\\alpha_t}\\,x_0, (1-\\bar\\alpha_t)I)$$

Model learns to predict noise $\\epsilon$ via MSE:

$$\\mathcal L = \\mathbb E_{x_0,t,\\epsilon} \\big\\|\\epsilon - \\epsilon_\\theta(x_t,t)\\big\\|^2$$

**Score-based SDE** view: forward SDE $dx_t = f(x_t,t)\\,dt + g(t)\\,dW_t$. Reverse-time SDE uses **score** $\\nabla_x \\log p_t(x)$.

**Flow matching**: train vector field $v_\\theta(x,t)$ to match the "true" conditional field (often optimal transport / straight lines).`,
    coreEquation: '\\mathcal L = \\mathbb E_{x_0,t,\\epsilon} \\big\\|\\epsilon - \\epsilon_\\theta(x_t,t)\\big\\|^2',
    whyItMatters: [
      'Stable Diffusion: latent diffusion — DDPM in a VAE latent space',
      'Sora: diffusion transformer over 3D spacetime patches',
      'Flow-matching and rectified flows enable one-step or few-step generation'
    ],
    missingIntuition: [
      'Intuitive explanation that denoising is learning ∇ₓ log pₜ(x) (scores), and how reverse-time SDE sampling corresponds to "walking uphill in log-density space"',
      'Visual/interactive demonstrations of different probability paths (diffusion vs optimal transport)'
    ],
    prereqs: ['maximum-likelihood', 'vaes'],
    dependents: ['efficiency'],
    color: CATEGORY_COLORS.generative
  },
  {
    id: 'representations',
    number: 10,
    title: 'Representation Learning & Embedding Geometry',
    shortTitle: 'Embeddings',
    icon: '◎',
    category: 'representation',
    canonicalPapers: [
      {
        title: 'Representation Learning: A Review and New Perspectives',
        authors: 'Bengio et al.',
        year: 2013,
        venue: 'IEEE TPAMI',
        url: 'https://arxiv.org/abs/1206.5538'
      }
    ],
    coreMath: `Learn a mapping $f_\\theta: \\mathcal X \\to \\mathbb R^d$ such that inner products or distances reflect meaningful relations.

**Contrastive objective** (InfoNCE-style):

$$\\mathcal L = - \\mathbb E \\left[ \\log \\frac{\\exp(\\mathrm{sim}(f(x),g(y))/\\tau)}{\\sum_{y'} \\exp(\\mathrm{sim}(f(x), g(y'))/\\tau)} \\right]$$

This pushes "positive" pairs together, "negatives" apart; at optimum, it maximizes a lower bound on mutual information between views.`,
    coreEquation: '\\mathcal L = - \\mathbb E \\left[ \\log \\frac{\\exp(\\mathrm{sim}(f(x),g(y))/\\tau)}{\\sum_{y\'} \\exp(\\mathrm{sim}(f(x), g(y\'))/\\tau)} \\right]',
    whyItMatters: [
      'Word & token embeddings in LMs, vision embeddings in CLIP-like models, multimodal embeddings in Gemini and GPT-4V',
      'Latent spaces of Stable Diffusion designed so distances correspond to semantic similarity'
    ],
    missingIntuition: [
      'Geometric explanation of anisotropy (representations bunch along a few directions) and how normalization/whitening alter behavior',
      'Visuals showing how representations evolve across layers (local to global features)'
    ],
    prereqs: ['attention-transformers'],
    dependents: ['superposition', 'probing', 'induction-heads'],
    color: CATEGORY_COLORS.representation
  },
  {
    id: 'superposition',
    number: 11,
    title: 'Superposition, Sparse Features & Monosemanticity',
    shortTitle: 'Superposition',
    icon: '⊕',
    category: 'representation',
    canonicalPapers: [
      {
        title: 'Toy Models of Superposition',
        authors: 'Elhage et al.',
        year: 2022,
        venue: 'Anthropic',
        url: 'https://transformer-circuits.pub/2022/toy_model/index.html'
      },
      {
        title: 'Towards Monosemanticity: Decomposing Language Models with Dictionary Learning',
        authors: 'Bricken et al.',
        year: 2023,
        venue: 'Anthropic',
        url: 'https://transformer-circuits.pub/2023/monosemantic-features/index.html'
      }
    ],
    coreMath: `Features are represented not by one neuron each, but as **sparse directions** in activation space. Formalized via **dictionary learning**:

$$\\min_{A, s_i} \\sum_i \\|h_i - A s_i\\|_2^2 + \\lambda \\|s_i\\|_1$$

where $h_i$ are activations, columns of $A$ are *features*, and $s_i$ are sparse codes.

Sparse autoencoders applied to transformer MLP activations recover relatively interpretable, "monosemantic" features.`,
    coreEquation: '\\min_{A, s_i} \\sum_i \\|h_i - A s_i\\|_2^2 + \\lambda \\|s_i\\|_1',
    whyItMatters: [
      'Frontier LMs heavily rely on superposition: neurons implement many overlapping features',
      'Monosemantic dictionaries being applied to Claude-class models for interpretability & safety'
    ],
    missingIntuition: [
      'Simple geometric story for why superposition is useful (capacity vs interference trade-offs)',
      'Interactive views of how sparse autoencoders carve up activation space into overlapping feature directions'
    ],
    prereqs: ['representations'],
    dependents: ['induction-heads'],
    color: CATEGORY_COLORS.representation
  },
  {
    id: 'probing',
    number: 12,
    title: 'Probing, Linear Classifier Probes & Activation Analysis',
    shortTitle: 'Probing',
    icon: '⚲',
    category: 'representation',
    canonicalPapers: [
      {
        title: 'Understanding Intermediate Layers using Linear Classifier Probes',
        authors: 'Alain & Bengio',
        year: 2016,
        venue: 'ICLR Workshop',
        url: 'https://arxiv.org/abs/1610.01644'
      },
      {
        title: 'BERT Rediscovers the Classical NLP Pipeline',
        authors: 'Tenney et al.',
        year: 2019,
        venue: 'ACL',
        url: 'https://aclanthology.org/P19-1452/'
      }
    ],
    coreMath: `Given layer representation $h_\\ell(x)$, train a frozen **probe**:

$$\\hat y = W h_\\ell(x) + b$$

(or a softmax over $Wh_\\ell(x)$) on a supervised task (POS tags, parse trees, etc.). The accuracy estimates how linearly separable that information is at layer $\\ell$.

BERT layers roughly follow the classical NLP pipeline (POS → syntax → semantics → coreference).`,
    coreEquation: '\\hat y = W h_\\ell(x) + b',
    whyItMatters: [
      'Probing is one of the main tools to understand what GPT-like models know and where that knowledge lives',
      'Used heavily for safety (probing for dangerous capabilities), robustness, and fairness analyses'
    ],
    missingIntuition: [
      'Clear mental model of what probes measure (information content vs ease of extraction)',
      'Visual, layer-by-layer maps of information flow in large LMs'
    ],
    prereqs: ['representations'],
    dependents: ['induction-heads'],
    color: CATEGORY_COLORS.representation
  },
  {
    id: 'induction-heads',
    number: 13,
    title: 'Transformer Circuits, Induction Heads & Mechanistic Interpretability',
    shortTitle: 'Circuits',
    icon: '⊛',
    category: 'representation',
    canonicalPapers: [
      {
        title: 'A Mathematical Framework for Transformer Circuits',
        authors: 'Elhage et al.',
        year: 2021,
        venue: 'Anthropic',
        url: 'https://transformer-circuits.pub/2021/framework/index.html'
      },
      {
        title: 'In-Context Learning and Induction Heads',
        authors: 'Olsson et al.',
        year: 2022,
        venue: 'Anthropic',
        url: 'https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html'
      }
    ],
    coreMath: `Decompose transformer computations into linear components on the residual stream:

$$r_{l+1} = r_l + W^{\\text{attn}}_l r_l + W^{\\text{mlp}}_l r_l$$

**Induction heads**: specific attention heads implement an algorithm:

$$[A][B]\\dots[A] \\rightarrow [B]$$

by attending from the final [A] token to previous [A] tokens and copying the subsequent token's representation.

The sudden appearance of these heads is tied to a phase transition in in-context learning.`,
    coreEquation: 'r_{l+1} = r_l + W^{\\text{attn}}_l r_l + W^{\\text{mlp}}_l r_l',
    whyItMatters: [
      'These frameworks study GPT-style models, including Llama-3 and Claude-3, by identifying concrete circuits',
      'Inform safety research (locating deception-related circuits) and architecture design'
    ],
    missingIntuition: [
      'Interactive visualizations of how QK and OV matrices implement algorithms like induction',
      'Broader taxonomies of circuit motifs beyond a few toy examples'
    ],
    prereqs: ['attention-transformers', 'representations', 'superposition', 'probing'],
    dependents: ['scaling-laws'],
    color: CATEGORY_COLORS.representation
  },
  {
    id: 'scaling-laws',
    number: 14,
    title: 'Scaling Laws & Emergent Abilities',
    shortTitle: 'Scaling',
    icon: '↗',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Scaling Laws for Neural Language Models',
        authors: 'Kaplan et al.',
        year: 2020,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2001.08361'
      },
      {
        title: 'Training Compute-Optimal Large Language Models',
        authors: 'Hoffmann et al.',
        year: 2022,
        venue: 'NeurIPS (Chinchilla)',
        url: 'https://arxiv.org/abs/2203.15556'
      },
      {
        title: 'Emergent Abilities of Large Language Models',
        authors: 'Wei et al.',
        year: 2022,
        venue: 'TMLR',
        url: 'https://arxiv.org/abs/2206.07682'
      }
    ],
    coreMath: `Test loss $L$ obeys approximate power laws:

$$L(N, D, C) \\approx L_\\infty + a N^{-\\alpha} + b D^{-\\beta}$$

where $N$ = parameters, $D$ = data, $C$ = compute; $\\alpha,\\beta$ are exponents.

**Chinchilla rule**: for fixed compute, optimal frontier scales roughly as $D \\propto N$ — don't over-scale parameters without matching data.

Some capabilities (chain-of-thought, few-shot reasoning) appear **suddenly** once scale crosses a threshold — "emergent abilities."`,
    coreEquation: 'L(N, D, C) \\approx L_\\infty + a N^{-\\alpha} + b D^{-\\beta}',
    whyItMatters: [
      'GPT-3.5/4, Claude, Gemini, Llama were all designed with these scaling behaviors in mind',
      'Sora & SDXL apply similar scaling-law reasoning for image/video diffusion backbones'
    ],
    missingIntuition: [
      'Why power-law scaling happens (statistical physics analogies, information-theoretic arguments)',
      'Visual, interactive plots showing evolving task-specific performance vs scale'
    ],
    prereqs: ['double-descent', 'attention-transformers'],
    dependents: ['rlhf'],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'rlhf',
    number: 15,
    title: 'Preference-Based Alignment: RLHF, Reward Modeling, Constitutional AI',
    shortTitle: 'RLHF',
    icon: '⚖',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Deep Reinforcement Learning from Human Preferences',
        authors: 'Christiano et al.',
        year: 2017,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/1706.03741'
      },
      {
        title: 'Training Language Models to Follow Instructions with Human Feedback',
        authors: 'Ouyang et al.',
        year: 2022,
        venue: 'NeurIPS (InstructGPT)',
        url: 'https://arxiv.org/abs/2203.02155'
      },
      {
        title: 'Constitutional AI: Harmlessness from AI Feedback',
        authors: 'Bai et al.',
        year: 2022,
        venue: 'Anthropic',
        url: 'https://arxiv.org/abs/2212.08073'
      }
    ],
    coreMath: `**Reward modeling from preferences**: Given human comparisons between outputs $y_a, y_b$, learn reward model via Bradley–Terry:

$$P(y_a \\succ y_b \\mid x) = \\frac{\\exp(r_\\phi(x,y_a))}{\\exp(r_\\phi(x,y_a)) + \\exp(r_\\phi(x,y_b))}$$

**RLHF objective**: Fine-tune policy $\\pi_\\theta(y\\mid x)$ to maximize reward while staying close to reference model $\\pi_0$:

$$\\max_\\theta \\mathbb E_{x,y\\sim \\pi_\\theta}[r_\\phi(x,y)] - \\beta\\, \\mathrm{KL}(\\pi_\\theta(\\cdot\\mid x)\\,\\|\\,\\pi_0(\\cdot\\mid x))$$

**Constitutional AI**: "labeler" is another model guided by a constitution (natural-language principles).`,
    coreEquation: '\\max_\\theta \\mathbb E_{\\pi_\\theta}[r_\\phi(x,y)] - \\beta\\, \\mathrm{KL}(\\pi_\\theta\\,\\|\\,\\pi_0)',
    whyItMatters: [
      'GPT-4, Claude-3, Gemini rely on RLHF-style procedures to be helpful, honest, harmless',
      'Constitutional AI ideas are key to Anthropic\'s Claude models'
    ],
    missingIntuition: [
      'Conceptual explanation of RLHF as a KL-regularized Bayesian update on behavior',
      'How over-optimization of learned reward leads to reward hacking and distribution shift',
      'Interactive visualizations of policy distributions before/after RLHF'
    ],
    prereqs: ['maximum-likelihood', 'scaling-laws'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'efficiency',
    number: 16,
    title: 'Efficiency: Quantization, Distillation, LoRA & Sparse MoE',
    shortTitle: 'Efficiency',
    icon: '⚡',
    category: 'efficiency',
    canonicalPapers: [
      {
        title: 'Distilling the Knowledge in a Neural Network',
        authors: 'Hinton et al.',
        year: 2015,
        venue: 'NeurIPS Workshop',
        url: 'https://arxiv.org/abs/1503.02531'
      },
      {
        title: 'LoRA: Low-Rank Adaptation of Large Language Models',
        authors: 'Hu et al.',
        year: 2021,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/2106.09685'
      },
      {
        title: 'Switch Transformers: Scaling to Trillion Parameter Models',
        authors: 'Fedus et al.',
        year: 2021,
        venue: 'JMLR',
        url: 'https://arxiv.org/abs/2101.03961'
      }
    ],
    coreMath: `**Distillation**: train student $q_\\psi$ to match teacher $p_\\theta$:

$$\\mathcal L = T^2\\,\\mathrm{KL}(p_\\theta^T(\\cdot\\mid x)\\,\\|\\,q_\\psi^T(\\cdot\\mid x))$$

**Quantization**: map float weights to low-bit integers: $\\tilde w = \\Delta \\cdot \\mathrm{round}(w/\\Delta)$

**LoRA**: re-parameterize weight matrix as: $W' = W + BA$, where $B\\in\\mathbb R^{d\\times r}, A\\in\\mathbb R^{r\\times d}, r\\ll d$ — only train $A,B$, freezing $W$.

**Sparse MoE**: FFN layers replaced by many experts $f_e$, with router: $\\text{FFN}_{\\text{MoE}}(x) = f_{e^*(x)}(x)$`,
    coreEquation: 'W\' = W + BA,\\quad r \\ll d',
    whyItMatters: [
      'Quantization + LoRA are standard for deploying and fine-tuning Llama-class models on modest GPUs',
      'Distillation compresses large base models into "small assistants"',
      'MoE/Switch-style sparsity powers very large Google-scale models (likely Gemini)'
    ],
    missingIntuition: [
      'Geometric views of low-rank updates: LoRA as adding a small, oriented "slice" in weight space',
      'Intuitive trade-offs in quantization: how error propagates, why some layers are more sensitive'
    ],
    prereqs: ['loss-landscapes', 'diffusion'],
    dependents: [],
    color: CATEGORY_COLORS.efficiency
  },
  {
    id: 'theory',
    number: 17,
    title: 'Theoretical Foundations: PAC Learning, MDL & Information Bottleneck',
    shortTitle: 'Theory',
    icon: '∀',
    category: 'theory',
    canonicalPapers: [
      {
        title: 'A Theory of the Learnable',
        authors: 'Valiant',
        year: 1984,
        venue: 'CACM',
        url: 'https://dl.acm.org/doi/10.1145/1968.1972'
      },
      {
        title: 'Modeling by Shortest Data Description',
        authors: 'Rissanen',
        year: 1978,
        venue: 'Automatica',
        url: 'https://www.sciencedirect.com/science/article/pii/0005109878900055'
      },
      {
        title: 'Deep Learning and the Information Bottleneck Principle',
        authors: 'Tishby et al.',
        year: 2015,
        venue: 'ITW',
        url: 'https://arxiv.org/abs/1503.02406'
      }
    ],
    coreMath: `**PAC learning**: concept class $\\mathcal C$ is PAC-learnable if algorithm uses $n = O\\left(\\frac{1}{\\epsilon}\\big(d \\log \\tfrac{1}{\\epsilon} + \\log\\tfrac{1}{\\delta}\\big)\\right)$ examples to output hypothesis with error ≤ $\\epsilon$ with probability ≥ $1-\\delta$, where $d$ is VC dimension.

**MDL**: choose hypothesis $H$ minimizing: $L(D,H) = L(H) + L(D\\mid H)$

**Information Bottleneck**: learn representation $Z$ of input $X$ that keeps information about target $Y$ but compresses $X$:

$$\\max_{p(z\\mid x)} I(Z;Y) - \\beta I(Z;X)$$`,
    coreEquation: '\\max_{p(z\\mid x)} I(Z;Y) - \\beta I(Z;X)',
    whyItMatters: [
      'PAC/VC theory gives language and bounds for generalization and sample complexity',
      'MDL/compression perspectives underlie "good models should be simple and predictive"',
      'Info-bottleneck motivates representation compression and what middle layers do'
    ],
    missingIntuition: [
      'How to connect formal sample-complexity bounds to actual overparameterized models that interpolate',
      'Intuitive, visual examples of MDL in deep nets (comparing code lengths of different architectures)'
    ],
    prereqs: ['ntk'],
    dependents: [],
    color: CATEGORY_COLORS.theory
  },
  {
    id: 'efficient-attention',
    number: 19,
    title: 'Efficient Attention at Scale: KV Cache, GQA & FlashAttention',
    shortTitle: 'Efficient Attention',
    icon: '⚙',
    category: 'efficiency',
    canonicalPapers: [
      {
        title: 'FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness',
        authors: 'Dao, Fu, Ermon, Rudra, Ré',
        year: 2022,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2205.14135'
      },
      {
        title: 'GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints',
        authors: 'Ainslie et al.',
        year: 2023,
        venue: 'EMNLP',
        url: 'https://arxiv.org/abs/2305.13245'
      },
      {
        title: 'SnapKV: LLM Knows What You Are Looking for Before Generation',
        authors: 'Li et al.',
        year: 2024,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2404.16951'
      }
    ],
    coreMath: `Modern LLMs are defined not just by *what* attention is, but by **how** attention is made feasible at long context with low latency.

**Autoregressive attention with KV cache:**

During decoding, you form the new query $q_t$ and attend against cached past keys/values:

$$o_t = \\mathrm{softmax}\\!\\left(\\frac{q_t K_{1:t}^{\\top}}{\\sqrt{d_k}}\\right) V_{1:t}$$

where $(K_{1:t}, V_{1:t})$ are **stored**, not recomputed. The KV cache is essential—without it, decoding would be catastrophically slow.

**Grouped-Query Attention (GQA):**

Multiple query heads share fewer KV heads. Let query head $h \\in \\{1,\\dots,H_q\\}$ map to KV-head group $g(h) \\in \\{1,\\dots,H_{kv}\\}$:

$$o_h = \\mathrm{softmax}\\!\\left(\\frac{Q_h K_{g(h)}^{\\top}}{\\sqrt{d_k}}\\right) V_{g(h)}$$

This interpolates between Multi-Head Attention ($H_{kv} = H_q$, no sharing) and Multi-Query Attention ($H_{kv} = 1$, max sharing).

**KV cache memory scaling:**

Per layer, KV cache grows with:

$$\\text{Mem}_{KV} \\propto T \\cdot H_{kv} \\cdot d_{\\text{head}} \\cdot 2 \\cdot \\text{bytes}$$

where $T$ is context length. **GQA reduces KV memory by $(H_{kv}/H_q)$** relative to full MHA.

**FlashAttention's key insight:** Reorder computation to minimize memory movement. Instead of materializing the full $(T \\times T)$ attention matrix in slow GPU memory (HBM), stream the softmax computation through fast on-chip memory (SRAM) via tiling. Same exact attention math, radically different memory behavior.`,
    coreEquation: 'o_t = \\mathrm{softmax}\\!\\left(\\frac{q_t K_{1:t}^{\\top}}{\\sqrt{d_k}}\\right) V_{1:t}',
    whyItMatters: [
      'Llama 3 explicitly uses GQA for inference efficiency—this is the production default for modern open LLMs',
      'Long context makes KV cache the dominant inference cost: memory grows linearly with T, bandwidth becomes the bottleneck',
      'FlashAttention enabled much longer contexts and faster training by minimizing memory traffic without approximating attention',
      'NeurIPS 2024 / ICLR 2025 focus heavily on KV cache compression (SnapKV, RazorAttention)—this is the active research frontier',
      'Inference cost now rivals training cost at scale, making memory-efficient attention essential for deployment'
    ],
    missingIntuition: [
      'Attention is "quadratic" on paper, but the real enemy is memory movement—FlashAttention reorders computation to keep data on-chip',
      'KV cache is the dominant inference memory budget at long context; it can exceed model weights in footprint',
      'GQA is about bandwidth + cache size, not "making attention cheaper"—you still compute attention, but read/store less',
      'Head specialization meets systems optimization: KV compression methods exploit that only a subset of heads behave like global "retrieval" heads'
    ],
    prereqs: ['attention-transformers', 'rope', 'efficiency'],
    dependents: [],
    color: CATEGORY_COLORS.efficiency
  },
  {
    id: 'rope',
    number: 18,
    title: 'Rotary Position Embeddings (RoPE)',
    shortTitle: 'RoPE',
    icon: '↻',
    category: 'representation',
    canonicalPapers: [
      {
        title: 'RoFormer: Enhanced Transformer with Rotary Position Embedding',
        authors: 'Su et al.',
        year: 2021,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2104.09864'
      },
      {
        title: 'Extending Context Window via Positional Interpolation',
        authors: 'Chen et al.',
        year: 2023,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2306.15595'
      },
      {
        title: 'YaRN: Efficient Context Window Extension',
        authors: 'Peng et al.',
        year: 2024,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/2309.00071'
      }
    ],
    coreMath: `Attention is **permutation-equivariant** by design—without position encoding, transformers can't distinguish token order.

RoPE encodes position as a **rotation** applied to queries and keys. For 2D subspace with position $p$:

$$\\tilde q_p = R(\\theta_p) q, \\quad \\tilde k_q = R(\\theta_q) k$$

where $R(\\theta) = \\begin{pmatrix} \\cos\\theta & -\\sin\\theta \\\\ \\sin\\theta & \\cos\\theta \\end{pmatrix}$

The key property: rotations compose via **relative position**:

$$\\tilde q_p^\\top \\tilde k_q = q^\\top R(\\theta_p)^\\top R(\\theta_q) k = q^\\top R(\\theta_q - \\theta_p) k$$

Full RoPE applies this to **multiple 2D pairs** at different frequencies $\\omega_i = \\text{base}^{-2i/d}$, creating a multi-scale positional ruler.

In complex notation: $\\tilde q_p = q \\cdot e^{i\\theta_p}$, making relative position a **phase difference**.`,
    coreEquation: '\\tilde q_p^\\top \\tilde k_q = q^\\top R(\\theta_q - \\theta_p) k',
    whyItMatters: [
      'GPT-NeoX, Llama 1/2/3, PaLM, Gemini, Claude 3: RoPE is the dominant position encoding for modern LLMs',
      'Enables better length extrapolation than learned absolute positions—models can handle longer contexts than seen in training',
      'Multi-frequency structure naturally represents both local patterns (high ω) and long-range dependencies (low ω)'
    ],
    missingIntuition: [
      'Why rotation specifically? Because group composition R(θ_p)^T R(θ_q) = R(θ_q - θ_p) automatically produces relative position',
      'How multi-frequency pairs work like clock hands: fast clocks for nearby tokens, slow clocks for distant ones',
      'Why long-context methods (Position Interpolation, YaRN) scale positions—prevents phase wrapping beyond training distribution',
      'Geometric picture: RoPE is equivariance to translation, similar to CNNs but for 1D sequences via rotation group'
    ],
    prereqs: ['attention-transformers'],
    dependents: [],
    color: CATEGORY_COLORS.representation
  },
  {
    id: 'speculative-decoding',
    number: 20,
    title: 'Speculative Decoding: Lossless Multi-Token Generation',
    shortTitle: 'Speculative Decoding',
    icon: '⏩',
    category: 'efficiency',
    canonicalPapers: [
      {
        title: 'Fast Inference from Transformers via Speculative Decoding',
        authors: 'Leviathan, Kalman, Matias',
        year: 2023,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/2211.17192'
      },
      {
        title: 'Sequoia: Scalable and Robust Speculative Decoding',
        authors: 'Chen et al.',
        year: 2024,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2402.12374'
      },
      {
        title: 'SpecInfer: Accelerating Generative Large Language Model Serving',
        authors: 'Miao et al.',
        year: 2024,
        venue: 'ASPLOS',
        url: 'https://arxiv.org/abs/2305.09781'
      }
    ],
    coreMath: `Autoregressive LLMs generate one token per forward pass—the sequential bottleneck. **Speculative decoding** breaks this by using a fast **draft model** to propose multiple tokens, then verifying them in parallel with the **target model**.

**Key insight:** This is **lossless**—output distribution matches the target model exactly via rejection sampling.

**Acceptance probability** for each draft token $x_i$:

$$\\alpha_i = \\min\\!\\left(1, \\frac{p_i[x_i]}{q_i[x_i]}\\right)$$

where $p_i$ is the target model distribution and $q_i$ is the draft distribution at position $i$.

**Residual sampling** when rejected:

$$x_i \\sim \\text{Normalize}\\!\\left(\\max(0, p_i - q_i)\\right)$$

This ensures output distribution is exactly $p$, not $q$—the method is **mathematically lossless**.

**Speedup** comes from accepting multiple draft tokens at once when the draft model is accurate. With acceptance rate $\\alpha$ and draft length $k$:

$$\\text{Speedup} \\approx \\frac{\\alpha \\cdot k}{1 + (1-\\alpha) \\cdot k}$$`,
    coreEquation: '\\alpha_i = \\min\\!\\left(1, \\frac{p_i[x_i]}{q_i[x_i]}\\right)',
    whyItMatters: [
      'Production inference systems (DeepMind Gemini, Google Vertex AI) use speculative decoding to reduce latency while maintaining exact output quality',
      'Enables 2-3× speedups on common workloads without changing model quality—pure systems optimization',
      'Tree-based speculation (Sequoia) extends this to multiple branches, achieving >3× speedups',
      'Critical for interactive applications where latency matters—chat, code completion, real-time agents',
      'Combines with #19 (efficient attention) since verification step is attention-heavy and benefits from FlashAttention/GQA'
    ],
    missingIntuition: [
      'Why is this lossless? The rejection sampling mechanism ensures target distribution p is preserved exactly—not approximation',
      'Draft model doesn\'t need to be good everywhere, just similar enough to target on the current input—specialization matters',
      'Verification is parallel attention over k tokens, so #19 optimizations directly improve speculative decoding throughput',
      'Tree speculation trades compute for coverage—explore multiple futures instead of one linear sequence'
    ],
    prereqs: ['maximum-likelihood', 'attention-transformers', 'efficiency', 'efficient-attention'],
    dependents: [],
    color: CATEGORY_COLORS.efficiency
  },
  {
    id: 'llm-serving',
    number: 21,
    title: 'LLM Serving at Scale: Prefill, Decode & Continuous Batching',
    shortTitle: 'LLM Serving',
    icon: '⚡',
    category: 'efficiency',
    canonicalPapers: [
      {
        title: 'Efficient Memory Management for Large Language Model Serving with PagedAttention',
        authors: 'Kwon et al.',
        year: 2023,
        venue: 'SOSP',
        url: 'https://arxiv.org/abs/2309.06180'
      },
      {
        title: 'DistServe: Disaggregating Prefill and Decoding for Goodput-optimized LLM Serving',
        authors: 'Zhong et al.',
        year: 2024,
        venue: 'OSDI',
        url: 'https://arxiv.org/abs/2401.09670'
      },
      {
        title: 'vAttention: Dynamic Memory Management for Serving LLMs without PagedAttention',
        authors: 'Prabhu et al.',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2405.04437'
      }
    ],
    coreMath: `Production LLM inference is not just "run attention"—it's **multi-user scheduling under latency constraints** with **KV-cache memory as the bottleneck**.

**Latency decomposition** (the serving mental model):

$$\\text{Latency} \\approx \\underbrace{\\text{TTFT}}_{\\text{time to first token}} + (T_{\\text{out}}-1) \\cdot \\underbrace{\\text{TPOT}}_{\\text{time per output token}}$$

**TTFT** is dominated by **prefill** (parallel processing of prompt), **TPOT** by **decode** (sequential generation with KV cache reads).

**Goodput** (what systems optimize):

$$\\text{Goodput} = \\text{Throughput} \\times \\Pr\\!\\left(\\text{TTFT} \\le S_{\\text{TTFT}} \\wedge \\text{TPOT} \\le S_{\\text{TPOT}}\\right)$$

Production systems maximize goodput under **service-level objectives (SLOs)**.

**KV cache paging/fragmentation cost**—let $P$ be page/block size:

$$\\text{KV-mem}(T) \\propto \\left\\lceil \\frac{T}{P} \\right\\rceil \\cdot P \\quad \\Rightarrow \\quad \\text{waste}(T) \\propto \\left(\\left\\lceil \\frac{T}{P} \\right\\rceil \\cdot P - T\\right)$$

**PagedAttention** allocates KV in fixed blocks to eliminate fragmentation and enable dynamic memory management.`,
    coreEquation: '\\text{Latency} \\approx \\text{TTFT} + (T_{\\text{out}}-1) \\cdot \\text{TPOT}',
    whyItMatters: [
      'vLLM/PagedAttention is the production standard for open-source LLM serving—near-zero memory waste, dynamic batching',
      'Prefill and decode are fundamentally different workloads (compute-bound parallel vs memory-bound sequential)—DistServe shows 4.48× speedup by separating them',
      'Continuous batching keeps GPUs busy under variable request arrivals—static batching wastes resources waiting for all requests to finish',
      'KV cache memory grows with context length and limits batch size—paging makes this predictable and efficient',
      'Disaggregation (separate prefill/decode clusters) is the 2024-2025 frontier for production serving architecture'
    ],
    missingIntuition: [
      'LLM inference comprises two different workloads: prefill (big parallel matmuls) and decode (tiny matmuls + huge KV reads)—mixing them creates interference',
      'Continuous batching is not "bigger batches"—it\'s maintaining a rolling set of active sequences as requests arrive/complete',
      'KV cache is not just memory usage—it\'s a scheduler constraint that determines max batch size',
      'Paging solves fragmentation: requests grow/shrink dynamically, contiguous allocation wastes memory, blocks/pages enable efficient sharing'
    ],
    prereqs: ['attention-transformers', 'efficient-attention', 'speculative-decoding'],
    dependents: [],
    color: CATEGORY_COLORS.efficiency
  },
  {
    id: 'mixture-of-experts',
    number: 22,
    title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
    shortTitle: 'MoE',
    icon: '🔀',
    category: 'efficiency',
    canonicalPapers: [
      {
        title: 'Mixtral of Experts',
        authors: 'Jiang et al.',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2401.04088'
      },
      {
        title: 'DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models',
        authors: 'Dai et al.',
        year: 2024,
        venue: 'ACL',
        url: 'https://arxiv.org/abs/2401.06066'
      },
      {
        title: 'DeepSeek-V2: A Strong, Economical, and Efficient Mixture-of-Experts Language Model',
        authors: 'DeepSeek-AI',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2405.04434'
      }
    ],
    coreMath: `MoE changes the economics of inference: you can scale **total parameters** dramatically while keeping **activated compute per token** constant.

**Router probabilities** (per token, per layer):

Given token hidden state $h \\in \\mathbb{R}^d$, a linear router produces expert probabilities:

$$z = W_r h, \\qquad p(e \\mid h) = \\mathrm{softmax}(z)_e$$

**Top-k gating** (sparse activation):

Let $S = \\mathrm{TopK}(p(\\cdot \\mid h), k)$. Only those experts run, and outputs are mixed:

$$\\mathrm{MoE}(h) = \\sum_{e \\in S} \\tilde{p}_e \\cdot f_e(h), \\qquad \\tilde{p}_e = \\frac{p(e \\mid h)}{\\sum_{j \\in S} p(j \\mid h)}$$

**Load-balancing loss** (prevents expert collapse):

Uses frequency of expert selection ($f_i$) and average gating score ($P_i$):

$$\\mathcal{L}_{\\text{LB}} = N_E \\sum_{i=1}^{N_E} f_i \\cdot P_i$$

This regularizer prevents routers from collapsing into a small subset of experts—surprisingly easy to implement wrong in distributed training.`,
    coreEquation: '\\mathrm{MoE}(h) = \\sum_{e \\in S} \\tilde{p}_e \\cdot f_e(h)',
    whyItMatters: [
      'Mixtral (8×7B) activates only 2 experts per token—"lots of total params, few active params" is the MoE bargain',
      'DeepSeek-V2: 236B total params / 21B activated per token with long context—shows MoE is co-designed with serving constraints',
      'Grok-1 (314B MoE), Qwen MoE variants—MoE is a real design choice in production frontier models, not theoretical',
      'MoE trades FLOPs for memory footprint + communication—routing tokens dynamically makes serving harder (token batches fragment by expert)',
      'After #21 teaches serving efficiency, #22 shows how frontier labs change the model itself to keep serving economically viable at scale'
    ],
    missingIntuition: [
      'MoE is "sparse compute, dense memory"—you compute only k experts but need all expert weights available (or sharded), trading FLOPs for memory + communication',
      'The router is just a classifier trained by backprop—it learns a partition of token space, and without regularization happily collapses to a few experts',
      'Load balancing is subtle: balance at wrong granularity destroys specialization (micro-batch balancing pushes toward within-sequence uniformity)',
      'MoE is not an ensemble—it\'s conditional computation where different tokens see different subnetworks, changing training dynamics and failure modes',
      'Distributed MoE ≈ all-to-all communication disguised as an MLP—tokens permute across devices twice per layer (dispatch/compute/combine)'
    ],
    prereqs: ['attention-transformers', 'maximum-likelihood', 'efficiency', 'llm-serving', 'efficient-attention'],
    dependents: [],
    color: CATEGORY_COLORS.efficiency
  },
  {
    id: 'moe-serving',
    number: 23,
    title: 'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism',
    shortTitle: 'MoE Serving',
    icon: '⚡',
    category: 'efficiency',
    canonicalPapers: [
      {
        title: 'MegaScale-Infer: Serving Mixture-of-Experts at Scale with Disaggregated Expert Parallelism',
        authors: 'Zhu et al.',
        year: 2025,
        venue: 'arXiv',
        url: 'https://arxiv.org/pdf/2504.02263'
      },
      {
        title: 'Optimizing Mixture-of-Experts Inference Time Combining Model Deployment and Communication Scheduling',
        authors: 'Li et al.',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2410.17043'
      },
      {
        title: 'Mixtral of Experts',
        authors: 'Jiang et al.',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2401.04088'
      }
    ],
    coreMath: `MoE serving transforms "sparse compute" into a **systems scheduling problem**—routing creates skew, fragmentation, and communication overhead.

**Token dispatch (all-to-all pattern):**

Per MoE layer, tokens route to experts creating a permutation. For batch $T$ tokens routing to $E$ experts:

$$\\text{Bytes}_{\\text{comm}} \\approx 2 \\cdot T \\cdot k \\cdot d_{\\text{model}} \\cdot b$$

where $k$ is top-k, $d_{\\text{model}}$ is hidden dimension, $b$ is bytes/element. This is **dispatch + combine** communication.

**Straggler latency (skew problem):**

With routing skew, per-expert load varies. Layer time is dominated by the busiest expert:

$$t_{\\text{layer}} = \\max_{e \\in [1,E]} t_e = \\max_e \\left(\\frac{n_e \\cdot d_{\\text{model}} \\cdot d_{\\text{ffn}}}{\\text{FLOPS}_e}\\right)$$

where $n_e$ is tokens routed to expert $e$. Even with low average load, **tail latency kills throughput**.

**Disaggregation tradeoff:**

MegaScale-Infer separates attention from expert FFNs on different GPU pools:

$$\\text{Utilization}_{\\text{total}} = f(\\text{attention-pool}, \\text{expert-pool}, \\text{pipeline-depth})$$

Trading communication for specialization and better resource allocation.`,
    coreEquation: 't_{\\text{layer}} = \\max_{e} \\frac{n_e \\cdot d_{\\text{model}} \\cdot d_{\\text{ffn}}}{\\text{FLOPS}_e}',
    whyItMatters: [
      'MoE inference is not just "less FLOPs"—routing creates skew, and the busiest expert/GPU determines latency (straggler problem)',
      'Every MoE layer does all-to-all communication (dispatch tokens to experts, combine results)—this is memory/network bound, not compute bound',
      'MegaScale-Infer shows 1.90× per-GPU throughput by disaggregating attention vs expert FFNs—separating workloads enables specialization',
      'Mixtral, DeepSeek-V2/V3, DBRX all face these serving constraints—understanding MoE serving explains real production deployment decisions',
      'After #21 (serving) and #22 (MoE routing), #23 explains what actually breaks when you combine them at scale'
    ],
    missingIntuition: [
      'Sparsity buys FLOPs but sells you a scheduling problem—load becomes bursty and skewed, busiest expert dictates latency',
      'MoE inference is two collective communications per layer (dispatch/combine)—not just matmuls, but all-to-all patterns + synchronization',
      'Batch size is not "free" in MoE decoding—you need enough tokens per expert for GEMM efficiency, but you\'re constrained by KV cache + SLOs',
      'Expert parallelism changes what scales—you\'re scaling placement, routing-induced traffic, and microbatching strategy, not just tensor parallelism',
      'Disaggregation is the new architecture knob—attention and expert FFNs can be scaled/deployed differently with pipelining to keep both busy'
    ],
    prereqs: ['attention-transformers', 'efficient-attention', 'llm-serving', 'mixture-of-experts'],
    dependents: [],
    color: CATEGORY_COLORS.efficiency
  },
  {
    id: 'dpo',
    number: 24,
    title: 'Direct Preference Optimization: RL-Free Alignment from Human Preferences',
    shortTitle: 'DPO',
    icon: '🎯',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Direct Preference Optimization: Your Language Model is Secretly a Reward Model',
        authors: 'Rafailov et al.',
        year: 2023,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2305.18290'
      },
      {
        title: 'Smaug: Fixing Failure Modes of Preference Optimisation with DPO-Positive',
        authors: 'Pal et al.',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2402.13228'
      },
      {
        title: 'SimPO: Simple Preference Optimization with a Reference-Free Reward',
        authors: 'Meng et al.',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2405.14734'
      }
    ],
    coreMath: `DPO replaces the RLHF reinforcement learning loop with a **simple supervised classification loss** on preference pairs, while maintaining the same KL-constrained objective.

**KL-regularized RLHF objective:**

$$\\max_{\\pi} \\mathbb{E}_{y \\sim \\pi(\\cdot|x)}[r(x,y)] - \\beta \\cdot \\text{KL}(\\pi(\\cdot|x) \\| \\pi_{\\text{ref}}(\\cdot|x))$$

**Closed-form optimal policy (Boltzmann):**

$$\\pi^{*}(y|x) = \\frac{1}{Z(x)} \\pi_{\\text{ref}}(y|x) \\exp\\!\\left(\\frac{1}{\\beta}r(x,y)\\right)$$

**DPO loss (RL-free):**

Given preference pairs $(x, y_w, y_\\ell)$ (winner, loser):

$$\\mathcal{L}_{\\text{DPO}}(\\theta) = -\\mathbb{E}\\left[\\log \\sigma\\!\\left(\\beta \\left[\\log\\frac{\\pi_\\theta(y_w|x)}{\\pi_{\\text{ref}}(y_w|x)} - \\log\\frac{\\pi_\\theta(y_\\ell|x)}{\\pi_{\\text{ref}}(y_\\ell|x)}\\right]\\right)\\right]$$

This is **logistic regression on log-probability ratios**—no reward model, no PPO, just supervised learning.`,
    coreEquation: '\\mathcal{L}_{\\text{DPO}} = -\\mathbb{E}\\left[\\log \\sigma\\!\\left(\\beta \\left[\\log\\frac{\\pi_\\theta(y_w|x)}{\\pi_{\\text{ref}}(y_w|x)} - \\log\\frac{\\pi_\\theta(y_\\ell|x)}{\\pi_{\\text{ref}}(y_\\ell|x)}\\right]\\right)\\right]',
    whyItMatters: [
      'DPO is how base models become assistants—post-training for helpfulness, harmlessness, instruction-following without full RL loops',
      'Open-model ecosystems (Llama, Mistral, Gemma) use DPO-like recipes because simpler to reproduce than PPO-based RLHF',
      'Frontier is now "loss design, not just DPO"—SimPO removes reference model, DPOP fixes failure modes, showing alignment is optimization engineering',
      'DPO exposes the core mental model: KL-regularized distribution shaping from comparisons, whether you use RL or not',
      'Bridges efficiency arc (#19-23) to alignment—after serving models efficiently, DPO shows how to shape them into useful assistants'
    ],
    missingIntuition: [
      'DPO is "move probability mass," not "learn a scalar reward"—you directly update policy by increasing relative odds of preferred completions',
      'Reference model is behavioral anchor, not detail—KL term is trust-region constraint keeping you on-distribution for feedback signal',
      'Winning the pair ≠ making winner more likely—DPOP shows DPO can increase winner/loser ratio while decreasing absolute likelihood of preferred completion',
      'Offline preference optimization is limited by dataset support—if preference data never contains safety-critical edge cases, DPO won\'t invent them',
      'DPO turns alignment into logistic regression on log-prob ratios—capturing RLHF\'s goal without the RL machinery'
    ],
    prereqs: ['maximum-likelihood', 'rlhf'],
    dependents: ['kto', 'reward-hacking'],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'kto',
    number: 25,
    title: 'KTO: Alignment from Binary Feedback via Human-Aware Losses',
    shortTitle: 'KTO',
    icon: '👍',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'KTO: Model Alignment as Prospect Theoretic Optimization',
        authors: 'Ethayarajh et al.',
        year: 2024,
        venue: 'ICML',
        url: 'https://arxiv.org/pdf/2402.01306'
      },
      {
        title: 'Binary Classifier Optimization for Large Language Model Alignment',
        authors: 'Jung et al.',
        year: 2025,
        venue: 'ACL',
        url: 'https://arxiv.org/abs/2411.02054'
      },
      {
        title: 'Noise Contrastive Alignment of Language Models with Explicit Rewards',
        authors: 'Chen et al.',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2402.05369'
      }
    ],
    coreMath: `KTO aligns models using **binary feedback** (desirable/undesirable) instead of pairwise comparisons, framed through **prospect theory / human-utility lens** (Human-Aware Losses, HALOs).

**Implied reward (policy vs reference):**

$$r_\\theta(x,y) = \\log \\frac{\\pi_\\theta(y|x)}{\\pi_{\\text{ref}}(y|x)}$$

**Reference point (baseline) as KL:**

$$z_0 = \\text{KL}\\!\\left(\\pi_\\theta(\\cdot|x) \\| \\pi_{\\text{ref}}(\\cdot|x)\\right)$$

**KTO loss with logistic value function:**

$$\\mathcal{L}_{\\text{KTO}}(\\pi_\\theta,\\pi_{\\text{ref}})=\\mathbb{E}_{(x,y)\\sim D}\\big[\\lambda_y - v(x,y)\\big]$$

where

$$v(x,y)=\\begin{cases}
\\lambda_D\\sigma\\!\\big(\\beta(r_\\theta(x,y)-z_0)\\big) & y \\in \\text{desirable}\\\\
\\lambda_U\\sigma\\!\\big(\\beta(z_0-r_\\theta(x,y))\\big) & y \\in \\text{undesirable}
\\end{cases}$$

The gradient has a $\\sigma(\\beta z)(1-\\sigma(\\beta z))$ factor, so it **naturally saturates** for extreme $z$—KTO focuses learning on borderline examples.`,
    coreEquation: 'v(x,y)=\\lambda_D\\sigma\\!\\big(\\beta(r_\\theta(x,y)-z_0)\\big)',
    whyItMatters: [
      'Production feedback is binary (like/dislike, thumbs up/down), not pairwise comparisons—KTO matches real data collection at scale',
      'KTO handles severe class imbalance—analyzed for extreme imbalance where positives are rare, still delivers strong performance',
      'Loss design is inductive bias—KTO teaches that alignment performance swings massively based on objective, not just data',
      'Saturation is robustness—gradients die off for extreme examples, implicitly ignoring too-easy/too-hard/potentially mislabeled feedback',
      'After DPO (#24), KTO shows you don\'t need pairwise preferences—binary signals + right utility shaping are sufficient'
    ],
    missingIntuition: [
      'Feedback form ≠ training objective—pairwise preference likelihood (DPO) is not the same as maximizing human utility',
      'Reference point does conceptual work—KL baseline makes "just crank up likelihood" ineffective, forcing discriminative learning',
      'Saturation is feature not bug—because gradients die off when implied reward is extreme, KTO implicitly ignores noisy labels',
      'Alignment is loss engineering—KTO + BCO show that objective design matters as much as data quality',
      'Binary feedback is the realistic primitive—like/dislike is cheap and abundant, making KTO the practical alignment method at scale'
    ],
    prereqs: ['rlhf', 'dpo'],
    dependents: ['reward-hacking'],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'reward-hacking',
    number: 26,
    title: 'Reward Hacking & Overoptimization: Goodhart\'s Law in Preference Optimization',
    shortTitle: 'Reward Hacking',
    icon: '⚠️',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Reward Model Ensembles Help Mitigate Overoptimization',
        authors: 'Coste et al.',
        year: 2024,
        venue: 'ICLR',
        url: 'https://proceedings.iclr.cc/paper_files/paper/2024/hash/dda7f9378a210c25e470e19304cce85d-Abstract-Conference.html'
      },
      {
        title: 'InfoRM: Mitigating Reward Hacking in RLHF via Information-Theoretic Reward Modeling',
        authors: 'Miao et al.',
        year: 2024,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2402.09345'
      },
      {
        title: 'Reward Model Overoptimisation in Iterated RLHF',
        authors: 'Wolf et al.',
        year: 2025,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2505.18126'
      }
    ],
    coreMath: `Reward hacking occurs when optimizing a **proxy reward** (learned from preferences) under **distribution shift + finite data noise**. The core shape across RLHF and preference optimization:

**Proxy reward optimization with trust-region:**

$$\\max_{\\pi_\\theta} \\mathbb{E}_{y\\sim \\pi_\\theta(\\cdot|x)}[\\hat r_\\phi(x,y)] - \\beta\\,\\text{KL}\\!\\left(\\pi_\\theta(\\cdot|x) \\| \\pi_{\\text{ref}}(\\cdot|x)\\right)$$

**Conservative optimization (ensemble lower bound):**

With ensemble $\\{r_{\\phi_j}\\}_{j=1}^K$:

$$\\mu(x,y)=\\frac{1}{K}\\sum_{j=1}^K r_{\\phi_j}(x,y), \\quad \\sigma(x,y)=\\sqrt{\\frac{1}{K}\\sum_{j=1}^K\\left(r_{\\phi_j}(x,y)-\\mu(x,y)\\right)^2}$$

Then optimize **lower-confidence bound**:

$$r_{\\text{LCB}}(x,y)=\\mu(x,y)-\\lambda\\,\\sigma(x,y)$$

This is the "anti-Goodhart move": **prefer high reward you\'re confident about**.

**InfoRM information bottleneck (filter spurious features):**

$$\\max_{\\phi} \\mathbb{E}[\\log p_\\phi(\\ell|z)] - \\alpha\\,\\text{KL}\\!\\left(q_\\phi(z|x,y) \\| p(z)\\right)$$

where $\\ell$ is preference label and $z$ is bottleneck representation dropping "shortcut" features that cause misgeneralization.`,
    coreEquation: 'r_{\\text{LCB}}(x,y)=\\mu(x,y)-\\lambda\\,\\sigma(x,y)',
    whyItMatters: [
      'Frontier post-training assumes reward hacking is expected, not rare—conservative/ensemble objectives are standard practice',
      'KL doesn\'t "solve" reward hacking, it just slows it down—proxy can be wrong within trust region or policy can exploit loopholes without drifting far',
      'Offline preference optimization can make models worse—sparse/noisy labels can amplify bad options (Type I) or suppress good ones (Type II)',
      'Uncertainty is safety signal—ensembles turn reward hacking into measurable phenomenon: "high reward + high disagreement" = distrust',
      'After DPO/KTO (#24-25), this explains why alignment is fragile—and why frontier is about robust objectives + monitoring, not just picking algorithm'
    ],
    missingIntuition: [
      'Goodhart\'s law is the alignment tax—when learned score becomes target, optimization will find edge cases where score is wrong',
      'Reward hacking ≠ "model is evil"—often just distribution shift: policy explores outputs reward model never saw, extrapolates incorrectly',
      'Offline preference optimization is dataset-coverage constrained—if preference data never contains safety-critical edge cases, DPO won\'t invent them',
      'Sparsity/noise creates two failure modes: Type I (bad looks good) gets amplified, Type II (good looks bad) gets suppressed',
      'Ensemble disagreement is early warning system—high mean reward + high variance = region where proxy is likely broken'
    ],
    prereqs: ['rlhf', 'dpo', 'kto'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'sparse-autoencoders',
    number: 27,
    title: 'Sparse Autoencoders at Scale: Feature Dictionaries for Mechanistic Interpretability',
    shortTitle: 'Sparse Autoencoders',
    icon: '🔍',
    category: 'representation',
    canonicalPapers: [
      {
        title: 'Scaling and evaluating sparse autoencoders',
        authors: 'Gao et al. (OpenAI)',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2406.04093'
      },
      {
        title: 'Improving Dictionary Learning with Gated Sparse Autoencoders',
        authors: 'Rajamanoharan et al.',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2404.16014'
      },
      {
        title: 'Sparse Feature Circuits: Discovering and Editing Interpretable Causal Graphs in Language Models',
        authors: 'Marks et al.',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2403.19647'
      }
    ],
    coreMath: `Sparse Autoencoders (SAEs) learn a **feature dictionary** to recover interpretable directions from dense model activations, solving the **superposition problem** where networks pack many features into fewer dimensions.

Let $x \\in \\mathbb{R}^d$ be a model activation vector (often **residual stream** at a layer).

**SAE encode → sparse latents, decode → reconstruction:**

$$z = \\text{ReLU}(W_{\\text{enc}}(x-b_{\\text{pre}})+b_{\\text{enc}}), \\qquad \\hat x = W_{\\text{dec}} z + b_{\\text{pre}}$$

This makes the key idea concrete: **a sparse code $z$** explains the dense activation $x$ via a learned dictionary $W_{\\text{dec}}$.

**Classic SAE objective (reconstruction + sparsity penalty):**

$$\\mathcal{L} = \\lVert x-\\hat x\\rVert_2^2 + \\lambda \\lVert z\\rVert_1$$

Sparsity is what pushes toward **monosemantic, human-nameable latents** instead of dense uninterpretable factors.

**Modern "Top-K / k-sparse" variant (directly control sparsity):**

$$z = \\text{TopK}(W_{\\text{enc}}(x-b_{\\text{pre}}), k), \\qquad \\mathcal{L} = \\lVert x-\\hat x\\rVert_2^2$$

This replaces "tune $\\lambda$" with "set exactly **k active features per token**," improving reconstruction–sparsity frontier.`,
    coreEquation: 'z = \\text{TopK}(W_{\\text{enc}}(x-b_{\\text{pre}}), k)',
    whyItMatters: [
      'OpenAI trained 16M latent SAE on GPT-4, Anthropic extracted interpretable features from Claude 3—this is how frontier labs actually do interpretability at scale',
      'Neurons are polysemantic (respond to multiple unrelated concepts)—SAEs give scalable substitute unit: feature latents that are monosemantic',
      'After teaching superposition (#11), this shows how to actually recover features from real models—turning theory into practical method',
      'Enables feature-level circuit analysis instead of head/neuron circuits—scalable causal graphs built from interpretable units',
      'Bridges mechanistic interpretability (#11-13) to alignment (#24-26)—once you can name internal features, you can measure, audit, and intervene'
    ],
    missingIntuition: [
      'SAE = "learn a parts dictionary for the residual stream"—each column of $W_{\\text{dec}}$ is candidate feature direction, sparse $z$ says which parts are present',
      'Sparsity is the interpretability prior—dense code can represent anything but names nothing, sparse codes force reuse of directions across similar contexts',
      'Real knob is "explanatory budget per token"—in k-sparse SAEs, $k$ literally sets how many features can explain an activation',
      'SAE pathologies are not side notes—shrinkage bias from L1, dead latents at scale—these are the whole game, modern recipes explicitly address them',
      'Interpretability becomes actionable when features become causal handles—ablation, amplification, steering turn "interpretability" into "debugging & control"'
    ],
    prereqs: ['representations', 'superposition', 'probing', 'induction-heads'],
    dependents: ['circuit-discovery', 'activation-steering'],
    color: CATEGORY_COLORS.representation
  },
  {
    id: 'circuit-discovery',
    number: 28,
    title: 'Automated Circuit Discovery: Patching, Attribution & Decomposition at Scale',
    shortTitle: 'Circuit Discovery',
    icon: '🔬',
    category: 'representation',
    canonicalPapers: [
      {
        title: 'Towards Automated Circuit Discovery for Mechanistic Interpretability',
        authors: 'Conmy et al.',
        year: 2023,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2304.14997'
      },
      {
        title: 'Attribution Patching Outperforms Automated Circuit Discovery',
        authors: 'Syed et al.',
        year: 2024,
        venue: 'BlackBoxNLP / ACL',
        url: 'https://arxiv.org/abs/2310.10348'
      },
      {
        title: 'Efficient Automated Circuit Discovery in Transformers using Contextual Decomposition',
        authors: 'Hsu et al.',
        year: 2025,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/2410.02194'
      }
    ],
    coreMath: `Automated circuit discovery turns mechanistic interpretability into a **search/scoring/pruning problem** over the model\'s computational graph, moving from hand-crafted case studies to scalable pipelines.

**Activation patching as causal intervention (edge/node ablation):**

$$\\Delta_E = \\left| L(x_{\\text{clean}}\\mid \\text{do}(E=e_{\\text{corr}})) - L(x_{\\text{clean}}) \\right|$$

This measures causal effect: replace edge $E$ with value from corrupted run, measure impact on loss.

**Attribution patching (first-order/Taylor approximation):**

$$L(x_{\\text{clean}}\\mid \\text{do}(E=e_{\\text{corr}})) \\approx L(x_{\\text{clean}}) + (e_{\\text{corr}}-e_{\\text{clean}})^\\top \\frac{\\partial}{\\partial e_{\\text{clean}}}L$$

Linearized causal estimate—faster than full patching, but approximation can be unfaithful.

**Edge scoring + pruning (circuit extraction):**

$$s_E = |\\Delta_E L|, \\quad \\text{then keep top-}k\\text{ edges}$$

Rank edges by importance, prune to minimal circuit that preserves behavior.`,
    coreEquation: '\\Delta_E = \\left| L(x_{\\text{clean}}\\mid \\text{do}(E=e_{\\text{corr}})) - L(x_{\\text{clean}}) \\right|',
    whyItMatters: [
      'Moves mechanistic interpretability from "one-off archaeology" to repeatable pipeline—essential for scaling to frontier models',
      '2024-2025 trend: ACDC (slow patching) → EAP (faster approximation) → CD-T (decomposition in seconds)—speed is the bottleneck',
      'Enables target selection for steering, safety interventions, debugging—you need to find the circuit before you can edit it',
      'After SAEs (#27), this shows how to build feature-level circuits automatically, not just head/neuron circuits',
      'Bridges to automated red-teaming and interpretability evaluations at scale—necessary for AI safety pipelines'
    ],
    missingIntuition: [
      'Activation patching is causal; attribution patching is linearized causal—approximation can be useful even when unfaithful pointwise',
      'Metric choice is everything—some metrics create degenerate gradients (zero-gradient at optimum), automated methods inherit these failures',
      'Circuits are not unique—many sparse subgraphs can reproduce behavior, pruning reveals *a* mechanism not *the* mechanism',
      'Speed-faithfulness tradeoff is fundamental—slow patching is accurate, fast approximations trade correctness for scalability',
      'Circuit discovery is hypothesis testing—you\'re testing "does this subgraph explain behavior X" not discovering ground truth'
    ],
    prereqs: ['attention-transformers', 'induction-heads', 'sparse-autoencoders'],
    dependents: ['activation-steering'],
    color: CATEGORY_COLORS.representation
  },
  {
    id: 'activation-steering',
    number: 29,
    title: 'Activation Steering: Feature-Guided Interventions for Inference-Time Control',
    shortTitle: 'Activation Steering',
    icon: '🎚️',
    category: 'representation',
    canonicalPapers: [
      {
        title: 'Activation Scaling for Steering and Interpreting Language Models',
        authors: 'Stoehr et al.',
        year: 2024,
        venue: 'EMNLP Findings',
        url: 'https://arxiv.org/abs/2404.19450'
      },
      {
        title: 'Improving Instruction-Following in Language Models through Activation Steering',
        authors: 'Stolfo et al.',
        year: 2025,
        venue: 'ICLR (arXiv)',
        url: 'https://arxiv.org/abs/2410.12877'
      },
      {
        title: 'Feature Guided Activation Additions',
        authors: 'Soo et al.',
        year: 2025,
        venue: 'OpenReview',
        url: 'https://openreview.net/forum?id=8valkLu3yL'
      }
    ],
    coreMath: `Activation steering edits hidden states (or SAE latents) to change behavior **without retraining**, turning interpretability into control knobs for inference-time behavioral modification.

**Classic steering vector addition (one layer/position):**

$$h_{\\ell,t}^{\\text{steer}} = h_{\\ell,t} + \\alpha v_{\\ell,t}$$

where $\\alpha$ controls strength and $v_{\\ell,t}$ is the steering direction.

**Contrastive steering vector (difference of means):**

$$v_{\\ell,t} = \\mathbb{E}[h_{\\ell,t}\\mid \\text{desired}] - \\mathbb{E}[h_{\\ell,t}\\mid \\text{undesired}]$$

Core idea behind "instruction vectors" and CAA-style methods—find direction that separates desired/undesired behaviors.

**SAE-latent steering (feature toggle → decode back):**

$$z = f_{\\text{enc}}(h_{\\ell,t}), \\quad h_{\\ell,t}^{\\text{steer}} = f_{\\text{dec}}\\!\\left(z + \\delta e_k\\right)$$

with $e_k$ a basis vector selecting feature $k$—interpretable steering via learned feature directions.`,
    coreEquation: 'h_{\\ell,t}^{\\text{steer}} = h_{\\ell,t} + \\alpha v_{\\ell,t}',
    whyItMatters: [
      'Inference-time control without fine-tuning—enforce format/length/constraints, style shifts, reduce/induce refusals at deployment',
      'Steering is causal test—if adding feature k induces behavior, you\'ve localized mechanism and can validate circuits (#28)',
      'Minimal interventions trend: activation scaling learns sparse scalars to strengthen/weaken existing directions, more interpretable than dense edits',
      'After SAEs (#27) and circuit discovery (#28), steering makes interpretability actionable—debugging & control, not just analysis',
      'Bridge to safety: controllable refusal/style/format constraints as post-training knobs, without expensive retraining loops'
    ],
    missingIntuition: [
      'Steering is geometry on model\'s manifold—small α nudges within-distribution, large α throws you off-manifold → incoherence and capability loss',
      'Interpretable steering isn\'t just *what direction*—it\'s *which basis*: SAE features give human handles, but decoder can entangle effects',
      'Compositionality isn\'t guaranteed—adding two "instruction vectors" can cancel or amplify depending on where they write in residual space',
      'Strength-capability tradeoff is fundamental—too weak has no effect, too strong breaks generation quality',
      'Steering reveals what model "knows"—if you can steer to behavior, the capability exists in the weights, just not naturally expressed'
    ],
    prereqs: ['attention-transformers', 'representations', 'sparse-autoencoders', 'circuit-discovery'],
    dependents: [],
    color: CATEGORY_COLORS.representation
  },
  {
    id: 'long-context',
    number: 30,
    title: 'Long Context Engineering: RoPE Scaling, KV Compression & Memory Optimization',
    shortTitle: 'Long Context',
    icon: '📏',
    category: 'efficiency',
    canonicalPapers: [
      {
        title: 'YaRN: Efficient Context Window Extension of Large Language Models',
        authors: 'Peng et al.',
        year: 2024,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/2309.00071'
      },
      {
        title: 'LongRoPE: Extending LLM Context Window Beyond 2 Million Tokens',
        authors: 'Ding et al.',
        year: 2024,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/2402.13753'
      },
      {
        title: 'KVQuant: Towards 10 Million Context Length LLM Inference with KV Cache Quantization',
        authors: 'Hooper et al.',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2401.18079'
      }
    ],
    coreMath: `Long context is a **two-front war**: (1) position extrapolation beyond pretraining, and (2) KV cache memory explosion. Frontier models use RoPE scaling + aggressive KV compression.

**RoPE injection (complex form, key idea: relative phase):**

$$q_{m,[2j:2j+1]} = W_q x_m \\cdot e^{i m\\theta_j}, \\quad k_{n,[2j:2j+1]} = W_k x_n \\cdot e^{i n\\theta_j}, \\quad \\theta_j = b^{-2j/d}$$

Rotation encodes position; attention sees $(m-n)\\theta_j$ (relative).

**YaRN "NTK-by-parts" wavelength scaling:**

$$\\hat{\\lambda}_j = (1-\\gamma_j)s\\lambda_j + \\gamma_j\\lambda_j, \\quad \\gamma_j = \\begin{cases} 1 & \\lambda_j < L/\\beta \\\\ 0 & \\lambda_j > L/\\alpha \\\\ \\frac{L/\\lambda_j - \\alpha}{\\beta - \\alpha} & \\text{otherwise} \\end{cases}$$

Non-uniform scaling: keep high-frequency dims, interpolate low-frequency → better extrapolation.

**KV cache memory vs sequence length:**

$$\\text{Memory} = 2 \\times L \\times H \\times T \\times d_h \\times \\text{bytes/element}$$

where $L$ layers, $H$ heads, $T$ tokens, $d_h$ head dimension—grows linearly in $T$, dominates at long contexts.`,
    coreEquation: '\\text{Memory}_{KV} = 2 \\times L \\times H \\times T \\times d_h \\times \\text{bytes}',
    whyItMatters: [
      'RoPE scaling methods (YaRN, LongRoPE) are dominant route to extending context windows without architecture change—how 32k→128k→256k→1M+ happens',
      'KV cache becomes bottleneck at very long contexts—KVQuant enables ~1M context on single A100-80GB via quantization to 3-4 bits',
      'Position encoding extrapolation is "angle OOD"—RoPE dimensions have wavelengths, beyond training you hit unseen rotations ("critical dimensions")',
      'After RoPE basics (#18) and KV cache/FlashAttention (#19), this explains how frontier models actually break the pretraining ceiling',
      'Memory math becomes destiny—at long contexts, KV storage and bandwidth dominate compute; quantization/compression is not optional'
    ],
    missingIntuition: [
      'Failure mode isn\'t "model forgets"—it\'s phase/angle OOD: RoPE uses wavelengths, beyond training range you hit unseen rotations',
      'Long context breaks attention in two ways: (a) position encoding extrapolation, (b) attention entropy/softmax temperature drift as T grows',
      'Non-uniform scaling is key insight—high-frequency RoPE dims (fine detail) need less rescaling than low-frequency (global position)',
      'KV compression tradeoff: quantization/pruning saves memory but degrades long-range retrieval—you\'re trading capacity for length',
      'Serving implications: KV cache memory >> compute at long contexts, changes deployment economics (memory-bound not compute-bound)'
    ],
    prereqs: ['rope', 'efficient-attention', 'llm-serving', 'attention-transformers'],
    dependents: ['ssm-hybrids'],
    color: CATEGORY_COLORS.efficiency
  },
  {
    id: 'ssm-hybrids',
    number: 31,
    title: 'State Space Models & Hybrid Architectures: Mamba-2, Jamba, Griffin',
    shortTitle: 'SSMs & Hybrids',
    icon: '🔀',
    category: 'core',
    canonicalPapers: [
      {
        title: 'Transformers are SSMs: Generalized Models and Efficient Algorithms Through Structured State Space Duality',
        authors: 'Dao & Gu',
        year: 2024,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/2405.21060'
      },
      {
        title: 'Jamba: Hybrid Transformer-Mamba Language Models',
        authors: 'AI21 Labs',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2403.19887'
      },
      {
        title: 'RecurrentGemma: Moving Past Transformers for Efficient Open Language Models',
        authors: 'Google DeepMind',
        year: 2024,
        venue: 'Technical Report',
        url: 'https://arxiv.org/abs/2404.07839'
      }
    ],
    coreMath: `SSMs replace global attention with **recurrences/structured kernels**, or mix both (local attention + recurrence) for long-context efficiency. Key: linear-time sequence modeling.

**SSM recurrence:**

$$h_{t+1} = Ah_t + Bx_t, \\quad y_t = Ch_t$$

State update is linear—constant memory, $O(T)$ time.

**Equivalent convolution/kernel view:**

$$y_t = \\sum_{k=0}^{t} K_k x_{t-k}, \\quad K_k = CA^{k}B$$

SSMs can be viewed as attention with structured kernel—both compute weighted sums over past.

**Hybrid gating intuition (generic template):**

$$y_t = g_t \\odot y_t^{\\text{SSM}} + (1-g_t) \\odot y_t^{\\text{Attn(local)}}$$

Captures Griffin-style "recurrence + local attention" hybrids—best of both worlds.`,
    coreEquation: 'h_{t+1} = Ah_t + Bx_t, \\quad y_t = Ch_t',
    whyItMatters: [
      'Long context (#30) exposes transformer\'s Achilles heel (quadratic attention + KV cache)—SSMs are the architectural escape hatch',
      'Mamba-2/SSD frames *Structured State-Space Duality*: SSMs and attention are dual, both compute weighted sums but SSMs do it via linear recurrence',
      'Jamba: hybrid Transformer-Mamba + MoE for capacity, reports strong performance up to 256K tokens—shows hybrids dominate not pure SSMs',
      'RecurrentGemma/Griffin: mix linear recurrences with local attention for efficiency + long-sequence suitability',
      'Why SSMs work for language now is **selectivity** (input-dependent behavior), not just O(T) complexity—otherwise you get bland smoothing kernel'
    ],
    missingIntuition: [
      'SSMs can be taught as "attention with structured kernel"—both compute weighted sums over past, SSMs do it via recurrence/scan',
      'Reason "SSMs work for language now" is selectivity (input-dependent behavior)—otherwise you get smoothing that can\'t do sharp retrieval',
      'Hybrids exist because you want: local attention for short-range syntax + recurrence/SSM for long-range memory—neither alone is optimal',
      'Constant state memory is key advantage—KV cache grows with T, SSM state stays fixed size, enabling truly unbounded context',
      'Hardware-friendly is critical—linear recurrence maps to efficient scans/cumsum, while attention needs custom kernels (FlashAttention)'
    ],
    prereqs: ['attention-transformers', 'efficient-attention', 'mixture-of-experts', 'long-context'],
    dependents: [],
    color: CATEGORY_COLORS.core
  },
  {
    id: 'multimodal',
    number: 32,
    title: 'Multimodal Foundations: Vision Encoders, Contrastive Learning & Cross-Attention Fusion',
    shortTitle: 'Multimodal VLP',
    icon: '🖼️',
    category: 'representation',
    canonicalPapers: [
      {
        title: 'Learning Transferable Visual Models From Natural Language Supervision',
        authors: 'Radford et al.',
        year: 2021,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/2103.00020'
      },
      {
        title: 'SigLIP 2: Multilingual Vision-Language Encoders',
        authors: 'Tschannen et al.',
        year: 2025,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2501.02014'
      },
      {
        title: 'Contrastive Localized Language-Image Pre-Training',
        authors: 'Chen et al.',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2410.02746'
      }
    ],
    coreMath: `Vision-Language Pretraining (VLP) trains **image encoder + text encoder** so images and text land in a shared space, enabling multimodal LLMs and diffusion conditioning.

**Dual-encoder similarity (normalized embeddings):**

$$u_i = \\frac{f_I(I_i)}{|f_I(I_i)|}, \\quad v_j = \\frac{f_T(T_j)}{|f_T(T_j)|}, \\quad s_{ij} = \\frac{u_i^\\top v_j}{\\tau}$$

Temperature-scaled cosine similarity between image and text embeddings.

**CLIP-style contrastive loss (InfoNCE / symmetric cross-entropy):**

$$\\mathcal{L} = \\frac{1}{2}\\left( -\\log\\frac{e^{s_{ii}}}{\\sum_j e^{s_{ij}}} - \\log\\frac{e^{s_{ii}}}{\\sum_j e^{s_{ji}}} \\right)$$

Maximize diagonal (matched pairs), minimize off-diagonal (negatives)—contrastive learning.

**Cross-attention fusion (text attends to vision tokens):**

$$\\text{CrossAttn}(H_T, H_I) = \\text{softmax}\\!\\left(\\frac{(H_TW_Q)(H_IW_K)^\\top}{\\sqrt{d}}\\right)(H_IW_V)$$

Enables grounding—text tokens can attend to image patches for dense understanding.`,
    coreEquation: '\\mathcal{L} = -\\log\\frac{e^{s_{ii}}}{\\sum_j e^{s_{ij}}} - \\log\\frac{e^{s_{ii}}}{\\sum_j e^{s_{ji}}}',
    whyItMatters: [
      'CLIP-style encoders are front-end for multimodal LLMs (how images become tokens) and conditioning backbone for text-to-image diffusion',
      'SigLIP 2 (2025): unified training recipe extending image-text with captioning, self-supervised losses, online curation—better encoders for VLMs',
      'CLOC (2024): adds region-level objectives for localization/dense features—contrastive ≠ dense understanding, need explicit losses',
      'After diffusion (#9) and representations (#10), this completes the bridge: how text embeddings condition generative vision models',
      'Opens multimodal arc: sets up VLM safety/robustness, grounding evals, multimodal RLHF as natural next concepts'
    ],
    missingIntuition: [
      'Contrastive ≠ dense understanding—CLIP-like training yields global semantics, localization/dense features require extra losses or architecture',
      'Negatives and batch size matter—contrastive training shaped by similarity matrix, diagonal dominance emerges from large batches',
      'Fusion choice is capability choice—dual-encoder retrieval is cheap, cross-attention fusion enables richer grounding but costs compute',
      'Temperature τ controls sharpness—low τ makes softmax peaked (hard negatives), high τ smooths (easier learning but less discriminative)',
      'Shared semantic space is learned geometry—images and text don\'t naturally align, contrastive loss pulls matched pairs together, pushes mismatches apart'
    ],
    prereqs: ['attention-transformers', 'representations', 'maximum-likelihood', 'diffusion'],
    dependents: [],
    color: CATEGORY_COLORS.representation
  },
  {
    id: 'tokenization-vocabulary',
    number: 33,
    title: 'Tokenization & Vocabulary Design',
    shortTitle: 'Tokens',
    icon: '🔤',
    category: 'representation',
    canonicalPapers: [
      {
        title: 'Neural Machine Translation of Rare Words with Subword Units',
        authors: 'Sennrich, Haddow, Birch',
        year: 2016,
        venue: 'ACL',
        url: 'https://arxiv.org/abs/1508.07909'
      },
      {
        title: 'SentencePiece: A simple and language independent subword tokenizer and detokenizer for Neural Text Processing',
        authors: 'Kudo & Richardson',
        year: 2018,
        venue: 'EMNLP (System Demonstrations)',
        url: 'https://arxiv.org/abs/1808.06226'
      },
      {
        title: 'ByT5: Towards a token-free future with pre-trained byte-to-byte models',
        authors: 'Xue et al.',
        year: 2021,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2105.13626'
      }
    ],
    coreMath: `Tokenization is the **discrete interface** between raw text/bytes and a transformer. The model never sees “characters” or “words” — it sees **token IDs** from a vocabulary $\\mathcal V$.

---

## 1) Tokenization is a segmentation into vocabulary items

A tokenizer maps a string/byte sequence $x$ into tokens $t_1,\\dots,t_n$:

$$x = \\mathrm{concat}(t_1,\\dots,t_n), \\qquad t_i \\in \\mathcal V$$

Then each token becomes an integer ID $\\mathrm{id}(t_i) \\in \\{0,\\dots,|\\mathcal V|-1\\}$ that indexes the embedding table.

---

## 2) Unigram tokenization as maximum-likelihood segmentation (SentencePiece-style)

Unigram models treat tokenization itself as probabilistic inference: choose the segmentation that maximizes token prior likelihood:

$$\\hat{t}_{1:n} = \\arg\\max_{t:\\;\\mathrm{concat}(t)=x}\\;\\sum_{i=1}^{n} \\log p(t_i)$$

This is a **Viterbi / dynamic programming** problem in practice: you search over segmentations and pick the highest-probability path.

---

## 3) BPE (byte-pair encoding) builds the vocabulary by merges

BPE starts from base symbols (characters or bytes), then repeatedly merges the most frequent adjacent pair:

$$ (a,b)^* = \\arg\\max_{(a,b)}\\; \\mathrm{count}(a\\,b) \\qquad\\Rightarrow\\qquad a\\;b \\to ab $$

Each merge **increases** vocabulary size (one new token) and usually **decreases** sequence length on texts where that pair is common.

---

## 4) Vocabulary size is a real model parameter (embedding + softmax head)

Token IDs index the embedding matrix, and logits are produced over the same vocabulary:

$$W_{\\text{embed}} \\in \\mathbb{R}^{|\\mathcal V|\\times d}, \\qquad W_{\\text{out}} \\in \\mathbb{R}^{|\\mathcal V|\\times d}$$

So parameters scale roughly like:

$$\\text{params}_{\\text{token}} \\approx 2\\,|\\mathcal V|\\,d$$

**Tradeoff:** larger vocab can mean **fewer tokens** (cheaper context / KV cache), but larger embedding + output layers (more parameters / memory).

---

### Why this is a “foundation”
Tokenization silently shapes:
- what patterns become “single atoms” (code, whitespace, common substrings),
- how expensive prompts are (tokens per character),
- multilingual/Unicode behavior (bytes vs scripts vs normalization),
- and even security surfaces (invisible characters, homoglyphs, normalization).`,
    coreEquation: '\\hat{t}_{1:n} = \\arg\\max_{t:\\;\\mathrm{concat}(t)=x}\\;\\sum_{i=1}^{n} \\log p(t_i)',
    whyItMatters: [
      'Tokens are the *unit of compute and cost*: prompt price, latency, and context usage are measured in tokens, not characters.',
      'Tokenizer design reshapes capability: code, math, and multilingual text can become easy or painfully fragmented depending on subword boundaries.',
      'Long-context engineering (#30) depends on token counts: “128k context” is 128k tokens, and tokenization determines how much text fits.',
      'Vocabulary size is an architectural knob: embedding + softmax head scale with |V|, trading parameters for shorter sequences.',
      'Unicode edge cases (normalization, invisible characters) affect reliability and safety: two visually identical strings can tokenize differently.'
    ],
    missingIntuition: [
      '“Tokens are not words”: the model’s atoms are whatever the tokenizer decided (often mixing whitespace, punctuation, and subwords).',
      'BPE is compression-by-frequency: it merges what’s common in the training distribution; rare strings (especially identifiers / numbers) can explode into many tokens.',
      'Unigram tokenization is inference: it chooses the *most likely segmentation* under token priors, not necessarily the longest tokens.',
      'Byte-level tokenization is robust but expensive: non-ASCII scripts and emoji expand into multiple bytes (more tokens).',
      'Normalization matters: different Unicode forms (NFC/NFKC, zero-width chars, NBSP) can change token boundaries and costs without changing what you “see.”'
    ],
    prereqs: ['maximum-likelihood', 'representations', 'efficiency', 'long-context'],
    dependents: ['llm-serving', 'multimodal'],
    color: CATEGORY_COLORS.representation
  },
  {
    id: 'decoding-sampling',
    number: 34,
    title: 'Decoding & Sampling: Temperature, Top-p & Inference-Time Control',
    shortTitle: 'Decoding',
    icon: '🎲',
    category: 'core',
    canonicalPapers: [
      {
        title: 'The Curious Case of Neural Text Degeneration',
        authors: 'Holtzman et al.',
        year: 2019,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/1904.09751'
      },
      {
        title: 'Locally Typical Sampling',
        authors: 'Meister et al.',
        year: 2022,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2202.00666'
      },
      {
        title: 'Classifier-Free Diffusion Guidance',
        authors: 'Ho & Salimans',
        year: 2022,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2207.12598'
      }
    ],
    coreMath: `Training gives you a next-token distribution $p_\\theta(\\cdot\\mid x_{<t})$. **Decoding** is the (often overlooked) step that turns probabilities into actual behavior.

---

## 1) Temperature reshapes the softmax

Given logits $z_i$ for tokens $i \\in \\mathcal V$, temperature $\\tau$ produces:

$$p_\\tau(i\\mid x_{<t}) = \\frac{e^{z_i/\\tau}}{\\sum_j e^{z_j/\\tau}}$$

Lower $\\tau$ sharpens (more deterministic). Higher $\\tau$ flattens (more exploratory).

---

## 2) Nucleus (top-p) truncation deletes the tail, then renormalizes

Let $S_p$ be the smallest set of tokens whose probability mass is at least $p$:

$$S_p = \\min\\left\\{S: \\sum_{i\\in S} p(i) \\ge p\\right\\}$$

Then sample from the truncated distribution:

$$p'(i)=\\frac{p(i)\\,\\mathbf{1}[i\\in S_p]}{\\sum_{j\\in S_p} p(j)}$$

This is why top-p is a **behavior knob**, not “formatting”: it literally changes the distribution you sample from.

---

## 3) A unifying idea: inference-time “guidance” is distribution shaping

Diffusion guidance has the same shape: it pushes samples toward a conditioning signal with a knob that trades fidelity vs diversity:

$$\\epsilon_{\\text{guided}} = \\epsilon_{\\text{uncond}} + w\\big(\\epsilon_{\\text{cond}}-\\epsilon_{\\text{uncond}}\\big)$$

Decoding in LLMs and guidance in diffusion both do inference-time preference shaping — *without retraining*.`,
    coreEquation: "p'(i)=\\frac{p(i)\\,\\mathbf{1}[i\\in S_p]}{\\sum_{j\\in S_p} p(j)}",
    whyItMatters: [
      'The same model can behave radically differently in products because decoding settings differ (temperature/top_p/top_k).',
      'Decoding is practical control over determinism vs diversity, and over repetition/degeneration failure modes.',
      'Inference-time control is “free” compared to retraining: you can shape behavior without changing weights.',
      'Sampling choices affect reliability: low temperature can reduce variance but can also lock in the wrong answer.',
      'This unifies LLM sampling with diffusion guidance: both expose a knob that trades diversity for conditioning/fidelity.'
    ],
    missingIntuition: [
      'Decoding is not “just formatting”: it changes the effective distribution you sample from at inference time.',
      '“Temperature = creativity” is sloppy—temperature is distribution shaping and can increase nonsense when the prompt is off-manifold.',
      'Top-p is dynamic: it adapts per step to the entropy of the distribution; it’s not the same as a fixed top-k.',
      'Degeneration (repetition loops) is an inference pathology; decoding settings can create or fix it without any training change.',
      'For diffusion, “more guidance is better” is false—high guidance can push off-manifold and degrade quality.'
    ],
    prereqs: ['maximum-likelihood', 'attention-transformers', 'diffusion', 'speculative-decoding'],
    dependents: [],
    color: CATEGORY_COLORS.core
  },

  // ==========================================
  // NEW CONCEPTS (Oracle GPT-5.2 Pro, Jan 2026)
  // ==========================================

  {
    id: 'backpropagation-autodiff',
    number: 35,
    title: 'Backpropagation & Automatic Differentiation',
    shortTitle: 'Backprop',
    icon: '⟲',
    category: 'optimization',
    canonicalPapers: [
      {
        title: 'Learning representations by back-propagating errors',
        authors: 'Rumelhart, Hinton, Williams',
        year: 1986,
        venue: 'Nature',
        url: 'https://www.nature.com/articles/323533a0'
      },
      {
        title: 'Automatic Differentiation in Machine Learning: a Survey',
        authors: 'Baydin et al.',
        year: 2018,
        venue: 'JMLR',
        url: 'https://arxiv.org/abs/1502.05767'
      }
    ],
    coreMath: `The chain rule computes gradients efficiently via **reverse-mode autodiff**:

For composite function $f = f_L \\circ f_{L-1} \\circ \\cdots \\circ f_1$:

$$\\frac{\\partial L}{\\partial \\theta_\\ell} = \\frac{\\partial L}{\\partial h_L} \\cdot \\frac{\\partial h_L}{\\partial h_{L-1}} \\cdots \\frac{\\partial h_{\\ell+1}}{\\partial h_\\ell} \\cdot \\frac{\\partial h_\\ell}{\\partial \\theta_\\ell}$$

The **backward pass** propagates sensitivities:

$$\\delta_\\ell = \\frac{\\partial L}{\\partial h_\\ell} = \\delta_{\\ell+1} \\cdot \\frac{\\partial h_{\\ell+1}}{\\partial h_\\ell}$$

Computational cost: one forward pass + one backward pass = O(2 × forward).
Memory cost: must store all intermediate activations $h_1, \\ldots, h_L$.`,
    coreEquation: '\\delta_\\ell = \\delta_{\\ell+1} \\cdot \\frac{\\partial h_{\\ell+1}}{\\partial h_\\ell}',
    whyItMatters: [
      'Every modern neural network is trained via backprop—it is the fundamental algorithm enabling gradient-based learning',
      'Memory cost of storing activations explains why activation checkpointing exists and why large models need gradient accumulation',
      'Understanding forward/backward asymmetry explains why inference is cheap but training is expensive'
    ],
    missingIntuition: [
      'Reverse-mode is optimal when outputs << parameters (typical in ML); forward-mode would require one pass per parameter',
      'The computation graph is built dynamically in PyTorch—this is why torch.no_grad() saves memory, not just compute',
      'Vanishing/exploding gradients arise from repeated multiplication of Jacobians—residual connections fix this by adding identity'
    ],
    prereqs: [],
    dependents: ['adam', 'loss-landscapes'],
    color: CATEGORY_COLORS.optimization
  },
  {
    id: 'score-matching',
    number: 36,
    title: 'Score Matching & Score-Based Generative Models',
    shortTitle: 'Score Matching',
    icon: '∇p',
    category: 'generative',
    canonicalPapers: [
      {
        title: 'Estimation of Non-Normalized Statistical Models by Score Matching',
        authors: 'Hyvärinen',
        year: 2005,
        venue: 'JMLR',
        url: 'https://jmlr.org/papers/v6/hyvarinen05a.html'
      },
      {
        title: 'Generative Modeling by Estimating Gradients of the Data Distribution',
        authors: 'Song & Ermon',
        year: 2019,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/1907.05600'
      }
    ],
    coreMath: `The **score function** is the gradient of log-density:

$$s(x) = \\nabla_x \\log p(x)$$

**Score matching** learns $s_\\theta(x) \\approx \\nabla_x \\log p_{\\text{data}}(x)$ without knowing the normalizing constant:

$$\\mathcal{L}_{SM} = \\mathbb{E}_{p_{\\text{data}}}\\left[ \\frac{1}{2}\\|s_\\theta(x)\\|^2 + \\text{tr}(\\nabla_x s_\\theta(x)) \\right]$$

**Denoising score matching** (practical form):

$$\\mathcal{L}_{DSM} = \\mathbb{E}_{x, \\tilde{x}}\\left[ \\|s_\\theta(\\tilde{x}) - \\nabla_{\\tilde{x}} \\log q(\\tilde{x}|x)\\|^2 \\right]$$

For Gaussian noise $\\tilde{x} = x + \\sigma\\epsilon$, the optimal score is $-\\epsilon/\\sigma$.`,
    coreEquation: 's(x) = \\nabla_x \\log p(x)',
    whyItMatters: [
      'Score functions are the mathematical foundation of diffusion models—the denoiser learns the score at each noise level',
      'Explains why diffusion training is "just regression": predict noise ε, which equals -σ × score',
      'Unifies VAEs, diffusion, and energy-based models through the lens of learning ∇log p(x)'
    ],
    missingIntuition: [
      'The score is a vector field pointing "uphill" toward higher density—sampling follows this flow backward from noise',
      'Why denoising works: optimal denoiser predicts E[x|x̃], and its gradient w.r.t. x̃ gives the score',
      'Score matching avoids computing intractable partition functions—you only need gradients, not absolute probabilities'
    ],
    prereqs: ['maximum-likelihood', 'diffusion'],
    dependents: [],
    color: CATEGORY_COLORS.generative
  },
  {
    id: 'in-context-learning',
    number: 37,
    title: 'In-Context Learning: Learning Without Weight Updates',
    shortTitle: 'ICL',
    icon: '📝',
    category: 'representation',
    canonicalPapers: [
      {
        title: 'Language Models are Few-Shot Learners',
        authors: 'Brown et al.',
        year: 2020,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2005.14165'
      },
      {
        title: 'What Can Transformers Learn In-Context? A Case Study of Simple Function Classes',
        authors: 'Garg et al.',
        year: 2022,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2208.01066'
      }
    ],
    coreMath: `**In-context learning** performs task adaptation through the prompt alone:

Given examples $(x_1, y_1), \\ldots, (x_k, y_k)$ and query $x_{k+1}$:

$$\\hat{y}_{k+1} = \\arg\\max_y p_\\theta(y \\mid x_1, y_1, \\ldots, x_k, y_k, x_{k+1})$$

No gradient updates to $\\theta$—the model "learns" by conditioning on demonstrations.

**Mechanistic hypothesis**: attention heads implement approximate gradient descent:

$$W_{\\text{updated}} \\approx W + \\eta \\sum_i (y_i - Wx_i)x_i^T$$

This emerges from the attention mechanism's ability to retrieve and aggregate relevant examples.`,
    coreEquation: '\\hat{y} = \\arg\\max_y p_\\theta(y \\mid \\text{examples}, x_{\\text{query}})',
    whyItMatters: [
      'ICL is arguably THE signature capability of large language models—task adaptation without fine-tuning',
      'Enables rapid prototyping and deployment: just change the prompt, not the model',
      'Creates the "prompt engineering" paradigm and explains why few-shot examples matter'
    ],
    missingIntuition: [
      'ICL emerges from scale—small models cannot do it; there appears to be a threshold around 1B+ parameters',
      'Induction heads (copy-from-context circuits) are necessary but not sufficient for sophisticated ICL',
      'ICL is not the same as memorization: models can interpolate to genuinely new tasks from demonstrations'
    ],
    prereqs: ['attention-transformers', 'induction-heads', 'scaling-laws'],
    dependents: [],
    color: CATEGORY_COLORS.representation
  },
  {
    id: 'optimal-transport',
    number: 38,
    title: 'Optimal Transport & Wasserstein Distance',
    shortTitle: 'OT/Wasserstein',
    icon: '⚖️',
    category: 'theory',
    canonicalPapers: [
      {
        title: 'Computational Optimal Transport',
        authors: 'Peyré & Cuturi',
        year: 2019,
        venue: 'Foundations and Trends in ML',
        url: 'https://arxiv.org/abs/1803.00567'
      },
      {
        title: 'Wasserstein GAN',
        authors: 'Arjovsky, Chintala, Bottou',
        year: 2017,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/1701.07875'
      }
    ],
    coreMath: `**Optimal transport** finds the minimum-cost way to move mass from distribution $\\mu$ to $\\nu$:

$$W_p(\\mu, \\nu) = \\left( \\inf_{\\gamma \\in \\Gamma(\\mu, \\nu)} \\int \\|x - y\\|^p \\, d\\gamma(x, y) \\right)^{1/p}$$

where $\\Gamma(\\mu, \\nu)$ is the set of joint distributions with marginals $\\mu, \\nu$.

**Kantorovich duality** (key for computation):

$$W_1(\\mu, \\nu) = \\sup_{\\|f\\|_L \\leq 1} \\mathbb{E}_{x \\sim \\mu}[f(x)] - \\mathbb{E}_{y \\sim \\nu}[f(y)]$$

**Brenier's theorem**: For absolutely continuous $\\mu$, the optimal map is $T = \\nabla \\phi$ for convex $\\phi$.`,
    coreEquation: 'W_p(\\mu, \\nu) = \\left( \\inf_{\\gamma \\in \\Gamma(\\mu, \\nu)} \\int \\|x - y\\|^p \\, d\\gamma(x, y) \\right)^{1/p}',
    whyItMatters: [
      'Wasserstein distance explains why WGANs are more stable than vanilla GANs—it provides gradients even when distributions do not overlap',
      'Flow matching and rectified flows are built on OT: they learn the optimal transport map directly',
      'OT provides a principled way to measure distance between distributions that respects geometry'
    ],
    missingIntuition: [
      'KL divergence is infinite when supports do not overlap; Wasserstein is finite and measures "how far to move mass"',
      'The "earth mover" intuition: imagine distributions as piles of dirt, OT finds the cheapest way to reshape one into the other',
      'Entropic regularization (Sinkhorn) makes OT tractable: adds −εH(γ) to get differentiable, GPU-friendly algorithms'
    ],
    prereqs: ['theory', 'diffusion', 'gans'],
    dependents: [],
    color: CATEGORY_COLORS.theory
  },
  {
    id: 'normalizing-flows',
    number: 39,
    title: 'Normalizing Flows: Exact Likelihood via Invertible Transforms',
    shortTitle: 'Flows',
    icon: '🌊',
    category: 'generative',
    canonicalPapers: [
      {
        title: 'Variational Inference with Normalizing Flows',
        authors: 'Rezende & Mohamed',
        year: 2015,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/1505.05770'
      },
      {
        title: 'Glow: Generative Flow with Invertible 1×1 Convolutions',
        authors: 'Kingma & Dhariwal',
        year: 2018,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/1807.03039'
      }
    ],
    coreMath: `**Normalizing flows** transform a simple base distribution $p_z(z)$ through an invertible function $f$:

$$x = f(z), \\quad z \\sim p_z$$

The **change of variables** formula gives exact log-likelihood:

$$\\log p_x(x) = \\log p_z(f^{-1}(x)) + \\log \\left| \\det \\frac{\\partial f^{-1}}{\\partial x} \\right|$$

**Composition** of flows: $f = f_K \\circ \\cdots \\circ f_1$ with log-det Jacobian summing:

$$\\log p_x(x) = \\log p_z(z_0) + \\sum_{k=1}^K \\log \\left| \\det \\frac{\\partial f_k}{\\partial z_{k-1}} \\right|$$`,
    coreEquation: '\\log p_x(x) = \\log p_z(f^{-1}(x)) + \\log \\left| \\det \\frac{\\partial f^{-1}}{\\partial x} \\right|',
    whyItMatters: [
      'Flows provide exact likelihood (unlike GANs) and exact sampling (unlike EBMs)—the "best of both worlds"',
      'The mathematical foundation for flow matching/rectified flows which are replacing traditional diffusion',
      'Understanding Jacobian determinants and invertibility constraints illuminates architectural design choices'
    ],
    missingIntuition: [
      'The challenge is making f invertible AND having tractable Jacobian determinant—this drives architecture choices (coupling layers, autoregressive flows)',
      'Unlike VAEs, no variational bound: you get exact log p(x), but at the cost of architectural constraints',
      'Modern flow matching avoids the Jacobian entirely by learning velocity fields—converges to OT map'
    ],
    prereqs: ['maximum-likelihood', 'vaes'],
    dependents: ['diffusion'],
    color: CATEGORY_COLORS.generative
  },
  {
    id: 'ppo-policy-optimization',
    number: 40,
    title: 'PPO: Proximal Policy Optimization',
    shortTitle: 'PPO',
    icon: '🎯',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Proximal Policy Optimization Algorithms',
        authors: 'Schulman et al.',
        year: 2017,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/1707.06347'
      }
    ],
    coreMath: `**PPO** optimizes policies with clipped surrogate objectives:

$$L^{CLIP}(\\theta) = \\mathbb{E}_t\\left[ \\min\\left( r_t(\\theta) \\hat{A}_t, \\text{clip}(r_t(\\theta), 1-\\epsilon, 1+\\epsilon) \\hat{A}_t \\right) \\right]$$

where the probability ratio is:

$$r_t(\\theta) = \\frac{\\pi_\\theta(a_t|s_t)}{\\pi_{\\theta_{\\text{old}}}(a_t|s_t)}$$

**Advantage estimation** (GAE):

$$\\hat{A}_t = \\sum_{l=0}^{\\infty} (\\gamma\\lambda)^l \\delta_{t+l}, \\quad \\delta_t = r_t + \\gamma V(s_{t+1}) - V(s_t)$$

The clipping prevents too-large policy updates that destabilize training.`,
    coreEquation: 'L^{CLIP}(\\theta) = \\mathbb{E}\\left[ \\min\\left( r_t \\hat{A}_t, \\text{clip}(r_t, 1-\\epsilon, 1+\\epsilon) \\hat{A}_t \\right) \\right]',
    whyItMatters: [
      'PPO is THE algorithm behind RLHF—understanding it explains how preference data becomes model behavior',
      'Clipping ratio is a practical trust region: prevents catastrophic forgetting while allowing learning',
      'GAE balances bias/variance in advantage estimation—key hyperparameter for stable RLHF training'
    ],
    missingIntuition: [
      'Why clipping not KL penalty: PPO was simpler to tune than TRPO and empirically as effective',
      'The "probability ratio" view: you are reweighting old experience by how much more/less likely actions are now',
      'PPO failures in RLHF often trace to advantage estimation issues—reward model noise amplifies errors'
    ],
    prereqs: ['rlhf'],
    dependents: ['reward-hacking'],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'residual-connections',
    number: 41,
    title: 'Residual Connections & Skip Connections',
    shortTitle: 'Residuals',
    icon: '⊕',
    category: 'core',
    canonicalPapers: [
      {
        title: 'Deep Residual Learning for Image Recognition',
        authors: 'He et al.',
        year: 2016,
        venue: 'CVPR',
        url: 'https://arxiv.org/abs/1512.03385'
      }
    ],
    coreMath: `**Residual block** transforms input $x$ by learning a perturbation:

$$y = x + F(x, \\{W_i\\})$$

In transformers, this creates the **residual stream**:

$$h^{(l+1)} = h^{(l)} + \\text{Attn}(h^{(l)}) + \\text{MLP}(h^{(l)} + \\text{Attn}(h^{(l)}))$$

**Gradient flow** through L layers:

$$\\frac{\\partial L}{\\partial h^{(0)}} = \\frac{\\partial L}{\\partial h^{(L)}} \\cdot \\left( I + \\sum_{l=1}^{L} \\frac{\\partial F^{(l)}}{\\partial h^{(l-1)}} \\right)$$

The identity term $I$ ensures gradients always have a direct path backward.`,
    coreEquation: 'y = x + F(x)',
    whyItMatters: [
      'Residuals enable training 100+ layer networks by preventing vanishing gradients',
      'The "residual stream" view is foundational to mechanistic interpretability—each component writes to a shared memory',
      'Without residuals, logit lens and activation patching would not work: there is no stable representation to probe'
    ],
    missingIntuition: [
      'Residual networks are "perturbations of identity"—each layer learns to make small corrections rather than full transforms',
      'Deep networks with residuals behave like ensembles of shallower networks (unraveled view)',
      'Pre-norm vs post-norm changes where gradients flow—modern transformers use pre-norm for stability'
    ],
    prereqs: ['attention-transformers'],
    dependents: ['induction-heads', 'circuit-discovery'],
    color: CATEGORY_COLORS.core
  },
  {
    id: 'classifier-free-guidance',
    number: 42,
    title: 'Classifier-Free Guidance in Diffusion',
    shortTitle: 'CFG',
    icon: '🎚️',
    category: 'generative',
    canonicalPapers: [
      {
        title: 'Classifier-Free Diffusion Guidance',
        authors: 'Ho & Salimans',
        year: 2022,
        venue: 'NeurIPS Workshop',
        url: 'https://arxiv.org/abs/2207.12598'
      }
    ],
    coreMath: `**CFG** interpolates between conditional and unconditional scores:

$$\\tilde{\\epsilon}_\\theta(x_t, c) = \\epsilon_\\theta(x_t, \\emptyset) + w \\cdot (\\epsilon_\\theta(x_t, c) - \\epsilon_\\theta(x_t, \\emptyset))$$

where $w$ is the **guidance scale** (typically 3-15 for text-to-image).

Equivalently in score space:

$$\\tilde{s}(x_t, c) = s(x_t) + w \\cdot \\nabla_{x_t} \\log p(c|x_t)$$

Higher $w$ amplifies the conditioning signal, trading diversity for fidelity.`,
    coreEquation: '\\tilde{\\epsilon}_\\theta = \\epsilon_\\theta(\\emptyset) + w \\cdot (\\epsilon_\\theta(c) - \\epsilon_\\theta(\\emptyset))',
    whyItMatters: [
      'CFG is why Stable Diffusion/DALL-E/Midjourney produce high-quality, on-prompt images',
      'The guidance scale is the main user-facing knob for text-to-image quality vs diversity',
      'Trains one model that handles both conditional and unconditional generation via dropout on conditioning'
    ],
    missingIntuition: [
      'CFG extrapolates beyond the data distribution—high guidance can produce unrealistic but more "prompt-adherent" images',
      'There is an optimal guidance scale: too low = ignores prompt, too high = artifacts and oversaturation',
      'CFG relates to temperature in LLMs: both are post-hoc distribution shaping at inference time'
    ],
    prereqs: ['diffusion', 'score-matching'],
    dependents: [],
    color: CATEGORY_COLORS.generative
  },
  {
    id: 'retrieval-augmented-generation',
    number: 43,
    title: 'Retrieval-Augmented Generation (RAG)',
    shortTitle: 'RAG',
    icon: '🔍',
    category: 'representation',
    canonicalPapers: [
      {
        title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
        authors: 'Lewis et al.',
        year: 2020,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2005.11401'
      }
    ],
    coreMath: `**RAG** augments generation with retrieved documents:

$$p(y|x) = \\sum_{d \\in \\text{top-}k} p(d|x) \\cdot p(y|x, d)$$

**Retrieval** uses embedding similarity:

$$p(d|x) \\propto \\exp(\\text{sim}(E_q(x), E_d(d)) / \\tau)$$

where $E_q$, $E_d$ are query/document encoders (often shared, e.g., BERT, Contriever).

**Generation** conditions on retrieved context:

$$p(y|x, d_1, \\ldots, d_k) = \\prod_t p(y_t | y_{<t}, x, d_1, \\ldots, d_k)$$`,
    coreEquation: 'p(y|x) = \\sum_{d} p(d|x) \\cdot p(y|x, d)',
    whyItMatters: [
      'RAG is the dominant paradigm for grounding LLMs in external/updated knowledge',
      'Explains why vector databases and embedding search became critical infrastructure',
      'Separates "what the model knows" from "what the model can access"—enables knowledge updates without retraining'
    ],
    missingIntuition: [
      'RAG trades model capacity for external memory: smaller models + good retrieval can match larger models',
      'Retrieval quality is bottleneck: irrelevant docs hurt more than no docs (noise injection)',
      'The "lost in the middle" problem: LLMs struggle to use information from middle of long contexts—retrieval ranking matters'
    ],
    prereqs: ['representations', 'attention-transformers', 'long-context'],
    dependents: [],
    color: CATEGORY_COLORS.representation
  },
  {
    id: 'adversarial-examples',
    number: 44,
    title: 'Adversarial Examples & Robustness',
    shortTitle: 'Adversarial',
    icon: '⚔️',
    category: 'theory',
    canonicalPapers: [
      {
        title: 'Explaining and Harnessing Adversarial Examples',
        authors: 'Goodfellow, Shlens, Szegedy',
        year: 2015,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/1412.6572'
      }
    ],
    coreMath: `**FGSM** (Fast Gradient Sign Method) generates adversarial examples:

$$x_{\\text{adv}} = x + \\epsilon \\cdot \\text{sign}(\\nabla_x L(\\theta, x, y))$$

**PGD** (Projected Gradient Descent) iterates:

$$x^{(t+1)} = \\Pi_{\\mathcal{B}_\\epsilon(x)} \\left( x^{(t)} + \\alpha \\cdot \\text{sign}(\\nabla_x L) \\right)$$

**Adversarial training** min-max objective:

$$\\min_\\theta \\mathbb{E}_{(x,y)} \\left[ \\max_{\\|\\delta\\| \\leq \\epsilon} L(\\theta, x + \\delta, y) \\right]$$

Small perturbations $\\delta$ cause large changes in model predictions.`,
    coreEquation: 'x_{\\text{adv}} = x + \\epsilon \\cdot \\text{sign}(\\nabla_x L)',
    whyItMatters: [
      'Reveals that neural networks are "right for the wrong reasons"—decision boundaries are brittle',
      'Foundation for understanding model robustness, jailbreaks, and AI safety',
      'Adversarial training remains the most reliable defense—robust models generalize better to distribution shift'
    ],
    missingIntuition: [
      'Adversarial examples exist because of high dimensionality: many directions to push decision boundaries',
      'Linear hypothesis: even linear models are vulnerable due to high-dimensional dot products',
      'Robustness-accuracy tradeoff: adversarial training typically hurts clean accuracy by 2-10%'
    ],
    prereqs: ['loss-landscapes', 'representations'],
    dependents: [],
    color: CATEGORY_COLORS.theory
  },
  {
    id: 'grokking',
    number: 45,
    title: 'Grokking: Delayed Generalization',
    shortTitle: 'Grokking',
    icon: '💡',
    category: 'theory',
    canonicalPapers: [
      {
        title: 'Grokking: Generalization Beyond Overfitting on Small Algorithmic Datasets',
        authors: 'Power et al.',
        year: 2022,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/2201.02177'
      }
    ],
    coreMath: `**Grokking** is the phenomenon where models suddenly generalize long after memorizing training data:

Training dynamics show three phases:
1. **Memorization**: Training loss → 0, test loss high
2. **Plateau**: Both losses stable for many steps
3. **Grokking**: Test loss suddenly drops to match training

The transition happens at a critical point where:

$$\\text{Generalization gap} \\approx O\\left(\\frac{\\|\\theta\\|^2}{n}\\right)$$

Weight decay strength $\\lambda$ controls when grokking occurs—stronger decay → earlier grokking.`,
    coreEquation: '\\text{Test loss}(t) \\xrightarrow{\\text{grokking}} \\text{Train loss}(t) \\text{ at } t \\gg t_{\\text{memorization}}',
    whyItMatters: [
      'Challenges classical learning theory: generalization can happen AFTER interpolation, not before',
      'Connects to double descent and neural scaling: more compute can unlock generalization that appears "impossible"',
      'Explains why small algorithmic tasks sometimes need surprisingly long training'
    ],
    missingIntuition: [
      'Grokking reveals that memorization and generalization use different circuits—training eventually finds the generalizing one',
      'Weight decay is key: it slowly shrinks the memorizing solution until the generalizing solution wins',
      'Phase transitions in loss curves suggest discrete "algorithm discovery" rather than smooth learning'
    ],
    prereqs: ['double-descent', 'loss-landscapes', 'theory'],
    dependents: [],
    color: CATEGORY_COLORS.theory
  },
  {
    id: 'logit-lens',
    number: 46,
    title: 'Logit Lens: Probing Intermediate Representations',
    shortTitle: 'Logit Lens',
    icon: '🔬',
    category: 'representation',
    canonicalPapers: [
      {
        title: 'interpreting GPT: the logit lens',
        authors: 'nostalgebraist',
        year: 2020,
        venue: 'LessWrong',
        url: 'https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens'
      }
    ],
    coreMath: `**Logit lens** applies the unembedding matrix to intermediate residual stream states:

$$\\text{logits}^{(l)} = W_U \\cdot h^{(l)}$$

where $W_U$ is the unembedding matrix and $h^{(l)}$ is the residual stream at layer $l$.

This reveals what token the model would predict if it "stopped" at layer $l$:

$$p^{(l)}(\\text{token}) = \\text{softmax}(\\text{logits}^{(l)})$$

The progression $p^{(0)} \\to p^{(L)}$ shows how the prediction evolves through the network.`,
    coreEquation: '\\text{logits}^{(l)} = W_U \\cdot h^{(l)}',
    whyItMatters: [
      'First simple tool for "seeing inside" transformers—reveals layer-by-layer computation',
      'Shows that early layers often predict related tokens, later layers refine to the final answer',
      'Foundation for activation patching and circuit analysis techniques'
    ],
    missingIntuition: [
      'The unembedding matrix acts as a "universal probe"—no training required, just matrix multiply',
      'Not all layers show sensible tokens: some layers store information in non-token-interpretable ways',
      'Tuned lens (learned affine per layer) often works better than raw logit lens'
    ],
    prereqs: ['representations', 'probing', 'attention-transformers'],
    dependents: ['circuit-discovery'],
    color: CATEGORY_COLORS.representation
  },
  {
    id: 'learning-rate-schedules',
    number: 47,
    title: 'Learning Rate Schedules: Warmup, Decay & Cycling',
    shortTitle: 'LR Schedules',
    icon: '📉',
    category: 'optimization',
    canonicalPapers: [
      {
        title: 'SGDR: Stochastic Gradient Descent with Warm Restarts',
        authors: 'Loshchilov & Hutter',
        year: 2017,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/1608.03983'
      }
    ],
    coreMath: `**Warmup** ramps LR from 0 to peak over $T_w$ steps:

$$\\eta_t = \\eta_{\\max} \\cdot \\frac{t}{T_w}, \\quad t \\leq T_w$$

**Cosine decay** smoothly anneals:

$$\\eta_t = \\eta_{\\min} + \\frac{1}{2}(\\eta_{\\max} - \\eta_{\\min})\\left(1 + \\cos\\left(\\frac{t - T_w}{T - T_w}\\pi\\right)\\right)$$

**1/√t decay** (classical):

$$\\eta_t = \\frac{\\eta_0}{\\sqrt{t}}$$

Modern LLM training typically uses: warmup → constant → cosine decay.`,
    coreEquation: '\\eta_t = \\eta_{\\min} + \\frac{1}{2}(\\eta_{\\max} - \\eta_{\\min})\\left(1 + \\cos\\left(\\frac{\\pi t}{T}\\right)\\right)',
    whyItMatters: [
      'LR schedule is one of the highest-leverage hyperparameters—same model can fail or succeed based on schedule',
      'Warmup prevents early instability: Adam moments are biased at start, large LR can diverge',
      'Cosine decay + warmup is the default for LLM pretraining (GPT, LLaMA, etc.)'
    ],
    missingIntuition: [
      'Why warmup helps: gradients are noisy/wrong at random init; small steps let moments stabilize',
      'Cosine vs linear decay: cosine spends more time at high LR (exploration) before annealing (exploitation)',
      'The "LR range test" finds optimal peak LR by training briefly at increasing LR until loss spikes'
    ],
    prereqs: ['adam', 'loss-landscapes'],
    dependents: ['scaling-laws'],
    color: CATEGORY_COLORS.optimization
  },
  {
    id: 'weight-initialization',
    number: 48,
    title: 'Weight Initialization: Xavier, He & µP',
    shortTitle: 'Init',
    icon: '🎲',
    category: 'optimization',
    canonicalPapers: [
      {
        title: 'Understanding the difficulty of training deep feedforward neural networks',
        authors: 'Glorot & Bengio',
        year: 2010,
        venue: 'AISTATS',
        url: 'https://proceedings.mlr.press/v9/glorot10a.html'
      },
      {
        title: 'Tensor Programs V: Tuning Large Neural Networks via Zero-Shot Hyperparameter Transfer',
        authors: 'Yang et al.',
        year: 2022,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2203.03466'
      }
    ],
    coreMath: `**Xavier/Glorot** (for tanh/sigmoid):

$$W \\sim \\mathcal{U}\\left(-\\sqrt{\\frac{6}{n_{in} + n_{out}}}, \\sqrt{\\frac{6}{n_{in} + n_{out}}}\\right)$$

**He/Kaiming** (for ReLU):

$$W \\sim \\mathcal{N}\\left(0, \\frac{2}{n_{in}}\\right)$$

**µP (Maximal Update Parameterization)**: Scales init AND learning rate by width:

$$W \\sim \\mathcal{N}(0, 1/n_{in}), \\quad \\eta_W = \\eta_{base} / n_{out}$$

This enables hyperparameter transfer: tune on small model, scale to large.`,
    coreEquation: 'W \\sim \\mathcal{N}(0, 2/n_{in})',
    whyItMatters: [
      'Bad initialization → vanishing/exploding activations → training fails immediately',
      'µP is how labs scale hyperparameters: tune on small proxy, apply to full-scale training',
      'Connects to NTK theory: at infinite width with proper scaling, training becomes deterministic'
    ],
    missingIntuition: [
      'The "1/√n" scaling keeps variance constant through layers: Var(output) ≈ Var(input)',
      'ReLU kills half the activations, so He init uses 2× variance to compensate',
      'µP insight: learning rate should scale with layer width to keep update magnitudes constant'
    ],
    prereqs: ['ntk', 'loss-landscapes'],
    dependents: ['scaling-laws'],
    color: CATEGORY_COLORS.optimization
  },
  {
    id: 'contrastive-learning',
    number: 49,
    title: 'Contrastive Learning & InfoNCE',
    shortTitle: 'Contrastive',
    icon: '🔗',
    category: 'representation',
    canonicalPapers: [
      {
        title: 'A Simple Framework for Contrastive Learning of Visual Representations',
        authors: 'Chen et al.',
        year: 2020,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/2002.05709'
      },
      {
        title: 'Learning Transferable Visual Models From Natural Language Supervision',
        authors: 'Radford et al.',
        year: 2021,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/2103.00020'
      }
    ],
    coreMath: `**InfoNCE loss** maximizes agreement between positive pairs while pushing negatives apart:

$$\\mathcal{L} = -\\log \\frac{\\exp(\\text{sim}(z_i, z_j^+) / \\tau)}{\\sum_{k=1}^{N} \\exp(\\text{sim}(z_i, z_k) / \\tau)}$$

where $z_j^+$ is a positive (augmented view), others are negatives, and $\\tau$ is temperature.

**CLIP** extends this to image-text pairs:

$$\\mathcal{L}_{CLIP} = \\frac{1}{2}\\left( \\mathcal{L}_{i2t} + \\mathcal{L}_{t2i} \\right)$$

matching images to their captions and vice versa in a batch.`,
    coreEquation: '\\mathcal{L} = -\\log \\frac{\\exp(\\text{sim}(z_i, z_j^+) / \\tau)}{\\sum_k \\exp(\\text{sim}(z_i, z_k) / \\tau)}',
    whyItMatters: [
      'Powers CLIP, which enabled zero-shot image classification and text-to-image (via embeddings)',
      'Self-supervised learning breakthrough: learned ImageNet-quality features without labels',
      'Same framework underlies sentence embeddings, audio-text models, and multimodal foundation models'
    ],
    missingIntuition: [
      'Temperature τ controls "hardness": low τ → focuses on hard negatives, high τ → uniform over negatives',
      'Batch size matters: more negatives = better approximation of true InfoNCE = better representations',
      'False negatives (same class treated as negative) hurt less than expected—contrastive is robust'
    ],
    prereqs: ['representations', 'maximum-likelihood'],
    dependents: ['multimodal'],
    color: CATEGORY_COLORS.representation
  },
  {
    id: 'distributed-training',
    number: 50,
    title: 'Distributed Training: Data, Tensor & Pipeline Parallelism',
    shortTitle: 'Distributed',
    icon: '🌐',
    category: 'efficiency',
    canonicalPapers: [
      {
        title: 'Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism',
        authors: 'Shoeybi et al.',
        year: 2020,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/1909.08053'
      },
      {
        title: 'ZeRO: Memory Optimizations Toward Training Trillion Parameter Models',
        authors: 'Rajbhandari et al.',
        year: 2020,
        venue: 'SC',
        url: 'https://arxiv.org/abs/1910.02054'
      }
    ],
    coreMath: `**Data parallelism**: Each GPU holds full model, processes different batches:

$$\\nabla L = \\frac{1}{N}\\sum_{i=1}^{N} \\nabla L_i \\quad \\text{(AllReduce)}$$

**Tensor parallelism**: Split matrix multiplies across GPUs:

$$Y = XW = X[W_1 | W_2] = [XW_1 | XW_2] \\quad \\text{(column split)}$$

**Pipeline parallelism**: Split layers across GPUs, micro-batch for efficiency:

$$\\text{GPU}_i: \\text{layers } [l_i, l_{i+1})$$

**ZeRO** partitions optimizer states, gradients, parameters across ranks.`,
    coreEquation: '\\text{Memory per GPU} \\approx \\frac{\\text{Model} + \\text{Optimizer}}{\\text{Parallelism degree}}',
    whyItMatters: [
      'Large models REQUIRE distributed training—no single GPU can hold GPT-4 class models',
      '3D parallelism (data + tensor + pipeline) is how 100B+ models are trained',
      'Understanding communication patterns explains why some architectures scale better than others'
    ],
    missingIntuition: [
      'Communication is often the bottleneck: AllReduce time can exceed compute time at scale',
      'ZeRO stages trade memory for communication: ZeRO-3 is most memory-efficient but slowest',
      'Pipeline bubbles waste compute: micro-batching (1F1B schedule) minimizes idle time'
    ],
    prereqs: ['efficiency', 'scaling-laws'],
    dependents: [],
    color: CATEGORY_COLORS.efficiency
  },
  {
    id: 'beam-search',
    number: 51,
    title: 'Beam Search & Structured Decoding',
    shortTitle: 'Beam Search',
    icon: '🌳',
    category: 'core',
    canonicalPapers: [
      {
        title: 'Sequence to Sequence Learning with Neural Networks',
        authors: 'Sutskever, Vinyals, Le',
        year: 2014,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/1409.3215'
      }
    ],
    coreMath: `**Beam search** maintains top-$B$ partial sequences:

At step $t$, expand each beam by all vocab tokens, keep top-$B$ by score:

$$\\text{score}(y_{1:t}) = \\sum_{i=1}^{t} \\log p(y_i | y_{<i})$$

**Length normalization** prevents bias toward short sequences:

$$\\text{score}_{\\text{norm}} = \\frac{1}{t^\\alpha} \\sum_{i=1}^{t} \\log p(y_i | y_{<i})$$

**Diverse beam search** adds diversity penalty to avoid similar beams.`,
    coreEquation: '\\text{score}(y_{1:t}) = \\sum_{i=1}^{t} \\log p(y_i | y_{<i})',
    whyItMatters: [
      'Beam search is standard for machine translation and structured generation tasks',
      'Explains the "greedy vs search" tradeoff: greedy is fast but suboptimal, beam explores more',
      'Understanding beam search clarifies why speculative decoding and constrained generation work'
    ],
    missingIntuition: [
      'Beam search is NOT sampling—it approximates argmax, which can produce boring/repetitive text',
      'Larger beam ≠ always better: "beam search curse" where larger beams give worse translations',
      'For open-ended generation (chat), sampling usually beats beam search for quality'
    ],
    prereqs: ['decoding-sampling', 'maximum-likelihood'],
    dependents: ['speculative-decoding'],
    color: CATEGORY_COLORS.core
  },
  {
    id: 'dropout',
    number: 52,
    title: 'Dropout: Stochastic Regularization',
    shortTitle: 'Dropout',
    icon: '💧',
    category: 'optimization',
    canonicalPapers: [
      {
        title: 'Dropout: A Simple Way to Prevent Neural Networks from Overfitting',
        authors: 'Srivastava et al.',
        year: 2014,
        venue: 'JMLR',
        url: 'https://jmlr.org/papers/v15/srivastava14a.html'
      }
    ],
    coreMath: `**Dropout** randomly zeros activations during training:

$$\\tilde{h} = h \\odot m, \\quad m_i \\sim \\text{Bernoulli}(1-p)$$

At test time, scale by keep probability:

$$h_{\\text{test}} = (1-p) \\cdot h$$

Or use **inverted dropout** (scale during training):

$$\\tilde{h} = \\frac{h \\odot m}{1-p}$$

Dropout approximates **ensemble averaging** over $2^n$ sub-networks.`,
    coreEquation: '\\tilde{h} = h \\odot m, \\quad m \\sim \\text{Bernoulli}(1-p)',
    whyItMatters: [
      'Classic regularizer that prevents co-adaptation of features',
      'Foundation for understanding stochastic regularization (also: droppath, stochastic depth)',
      'Modern LLMs often use minimal dropout—understanding when it helps/hurts is practical knowledge'
    ],
    missingIntuition: [
      'Dropout injects noise proportional to activation magnitude—implicitly favors robust features',
      'Different dropout rates per layer: higher dropout in final layers often helps',
      'At large scale with lots of data, dropout can hurt: the ensemble benefit is dominated by data diversity'
    ],
    prereqs: ['maximum-likelihood', 'loss-landscapes'],
    dependents: ['double-descent'],
    color: CATEGORY_COLORS.optimization
  },
  {
    id: 'energy-based-models',
    number: 53,
    title: 'Energy-Based Models & Score Functions',
    shortTitle: 'EBMs',
    icon: '⚡',
    category: 'generative',
    canonicalPapers: [
      {
        title: 'A Tutorial on Energy-Based Learning',
        authors: 'LeCun et al.',
        year: 2006,
        venue: 'MIT Press',
        url: 'http://yann.lecun.com/exdb/publis/pdf/lecun-06.pdf'
      }
    ],
    coreMath: `**Energy-based models** define probability via unnormalized energy:

$$p_\\theta(x) = \\frac{\\exp(-E_\\theta(x))}{Z_\\theta}, \\quad Z_\\theta = \\int \\exp(-E_\\theta(x)) dx$$

The **score function** is the gradient of log-probability:

$$s_\\theta(x) = \\nabla_x \\log p_\\theta(x) = -\\nabla_x E_\\theta(x)$$

**Contrastive divergence** training:

$$\\nabla_\\theta \\mathcal{L} = \\mathbb{E}_{p_{data}}[\\nabla_\\theta E_\\theta(x)] - \\mathbb{E}_{p_\\theta}[\\nabla_\\theta E_\\theta(x)]$$`,
    coreEquation: 'p_\\theta(x) = \\frac{\\exp(-E_\\theta(x))}{Z_\\theta}',
    whyItMatters: [
      'Unifies discriminative and generative modeling: classifier logits ARE energy differences',
      'GAN discriminators can be viewed as learning energy functions',
      'Score-based diffusion models are EBMs trained via denoising score matching'
    ],
    missingIntuition: [
      'The partition function Z is intractable—all EBM training tricks avoid computing it',
      'Energy = "how wrong this input looks"—low energy = high probability',
      'MCMC sampling from EBMs is slow; diffusion sidesteps this by learning the denoising path directly'
    ],
    prereqs: ['maximum-likelihood', 'score-matching'],
    dependents: ['diffusion'],
    color: CATEGORY_COLORS.generative
  },
  {
    id: 'layer-normalization',
    number: 54,
    title: 'Layer Normalization & RMSNorm',
    shortTitle: 'LayerNorm',
    icon: '📏',
    category: 'core',
    canonicalPapers: [
      {
        title: 'Layer Normalization',
        authors: 'Ba, Kiros, Hinton',
        year: 2016,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/1607.06450'
      },
      {
        title: 'Root Mean Square Layer Normalization',
        authors: 'Zhang & Sennrich',
        year: 2019,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/1910.07467'
      }
    ],
    coreMath: `**LayerNorm** normalizes across features for each example:

$$\\text{LN}(x) = \\gamma \\odot \\frac{x - \\mu}{\\sigma + \\epsilon} + \\beta$$

where $\\mu = \\frac{1}{d}\\sum_i x_i$, $\\sigma = \\sqrt{\\frac{1}{d}\\sum_i(x_i - \\mu)^2}$.

**RMSNorm** (used in LLaMA, etc.) skips mean centering:

$$\\text{RMSNorm}(x) = \\gamma \\odot \\frac{x}{\\text{RMS}(x) + \\epsilon}, \\quad \\text{RMS}(x) = \\sqrt{\\frac{1}{d}\\sum_i x_i^2}$$`,
    coreEquation: '\\text{LN}(x) = \\gamma \\odot \\frac{x - \\mu}{\\sigma}',
    whyItMatters: [
      'LayerNorm is in every transformer—it stabilizes training by controlling activation scales',
      'Pre-norm vs post-norm placement affects gradient flow and training stability',
      'RMSNorm saves compute (no mean) with similar quality—used in modern efficient LLMs'
    ],
    missingIntuition: [
      'LayerNorm makes networks robust to scale: you can multiply weights by constant without changing output',
      'The learned γ, β parameters let the network "undo" normalization where needed',
      'Pre-norm (normalize before attention/MLP) is more stable for deep networks'
    ],
    prereqs: ['attention-transformers', 'residual-connections'],
    dependents: ['long-context'],
    color: CATEGORY_COLORS.core
  },
  {
    id: 'fisher-information',
    number: 55,
    title: 'Fisher Information & Information Geometry',
    shortTitle: 'Fisher Info',
    icon: 'ℐ',
    category: 'theory',
    canonicalPapers: [
      {
        title: 'Information Geometry and Its Applications',
        authors: 'Amari',
        year: 2016,
        venue: 'Springer',
        url: 'https://link.springer.com/book/10.1007/978-4-431-55978-8'
      },
      {
        title: 'Natural Gradient Works Efficiently in Learning',
        authors: 'Amari',
        year: 1998,
        venue: 'Neural Computation',
        url: 'https://ieeexplore.ieee.org/document/6790500'
      }
    ],
    coreMath: `The **Fisher Information Matrix** measures how distinguishable distributions are:

$$F_{ij}(\\theta) = \\mathbb{E}_{x \\sim p_\\theta}\\left[\\frac{\\partial \\log p_\\theta(x)}{\\partial \\theta_i} \\frac{\\partial \\log p_\\theta(x)}{\\partial \\theta_j}\\right]$$

Equivalently (under regularity):

$$F_{ij}(\\theta) = -\\mathbb{E}_{x \\sim p_\\theta}\\left[\\frac{\\partial^2 \\log p_\\theta(x)}{\\partial \\theta_i \\partial \\theta_j}\\right]$$

**KL as local metric**: For small parameter changes:

$$\\text{KL}(p_\\theta \\| p_{\\theta + d\\theta}) \\approx \\frac{1}{2} d\\theta^\\top F(\\theta) d\\theta$$`,
    coreEquation: 'F_{ij}(\\theta) = \\mathbb{E}\\left[\\partial_i \\log p_\\theta \\cdot \\partial_j \\log p_\\theta\\right]',
    whyItMatters: [
      'Fisher gives the natural metric on probability distributions—not Euclidean distance in parameters',
      'Explains why KL penalties in RLHF/PPO are geometric constraints, not arbitrary regularization',
      'Connects curvature to uncertainty: high Fisher = parameters are well-identified'
    ],
    missingIntuition: [
      'Distance in parameter space should mean "distinguishability of distributions"—Fisher captures this',
      'The Cramér-Rao bound: variance of any estimator ≥ 1/Fisher—more info = tighter estimates',
      'Fisher is the Hessian of KL at θ=θ₀, making it a second-order object without needing the loss Hessian'
    ],
    prereqs: ['maximum-likelihood', 'theory'],
    dependents: [],
    color: CATEGORY_COLORS.theory
  },
  {
    id: 'natural-gradient',
    number: 56,
    title: 'Natural Gradient & Riemannian Optimization',
    shortTitle: 'Natural Grad',
    icon: '🧭',
    category: 'optimization',
    canonicalPapers: [
      {
        title: 'Natural Gradient Works Efficiently in Learning',
        authors: 'Amari',
        year: 1998,
        venue: 'Neural Computation',
        url: 'https://ieeexplore.ieee.org/document/6790500'
      },
      {
        title: 'Trust Region Policy Optimization',
        authors: 'Schulman et al.',
        year: 2015,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/1502.05477'
      }
    ],
    coreMath: `**Natural gradient** uses the Fisher metric instead of Euclidean:

$$\\tilde{\\nabla} L = F(\\theta)^{-1} \\nabla_\\theta L$$

Update rule:
$$\\theta_{t+1} = \\theta_t - \\eta F(\\theta_t)^{-1} \\nabla L$$

**Variational characterization** (why it's "natural"):

$$\\delta^* = \\arg\\min_\\delta \\langle \\nabla L, \\delta \\rangle \\quad \\text{s.t.} \\quad \\text{KL}(p_\\theta \\| p_{\\theta+\\delta}) \\leq \\epsilon$$

$$\\Rightarrow \\delta^* \\propto F^{-1} \\nabla L$$`,
    coreEquation: '\\tilde{\\nabla} L = F(\\theta)^{-1} \\nabla_\\theta L',
    whyItMatters: [
      'Natural gradient is coordinate-invariant—it gives the same update regardless of parameterization',
      'TRPO and PPO are approximations to natural gradient updates for policy optimization',
      'Adam can be viewed as a diagonal approximation to natural gradient with adaptive preconditioning'
    ],
    missingIntuition: [
      'The gradient is a covector, not a vector—the metric turns it into a direction of steepest descent',
      'Euclidean gradient depends on how you parameterize; natural gradient depends only on the distributions',
      'Natural gradient avoids plateaus faster because it accounts for local curvature in distribution space'
    ],
    prereqs: ['fisher-information', 'adam'],
    dependents: ['ppo-policy-optimization'],
    color: CATEGORY_COLORS.optimization
  },
  {
    id: 'sgd-momentum',
    number: 57,
    title: 'SGD & Momentum: The Workhorses of Optimization',
    shortTitle: 'SGD+Momentum',
    icon: '🏃',
    category: 'optimization',
    canonicalPapers: [
      {
        title: 'On the importance of initialization and momentum in deep learning',
        authors: 'Sutskever et al.',
        year: 2013,
        venue: 'ICML',
        url: 'https://proceedings.mlr.press/v28/sutskever13.html'
      },
      {
        title: 'A method for unconstrained convex minimization problem with the rate of convergence O(1/k²)',
        authors: 'Nesterov',
        year: 1983,
        venue: 'Soviet Mathematics Doklady',
        url: 'https://ci.nii.ac.jp/naid/10029946121/'
      }
    ],
    coreMath: `**Vanilla SGD**:
$$\\theta_{t+1} = \\theta_t - \\eta \\nabla L(\\theta_t)$$

**Momentum** (Polyak):
$$v_{t+1} = \\mu v_t + \\nabla L(\\theta_t)$$
$$\\theta_{t+1} = \\theta_t - \\eta v_{t+1}$$

**Nesterov Momentum** (look-ahead gradient):
$$v_{t+1} = \\mu v_t + \\nabla L(\\theta_t - \\eta \\mu v_t)$$
$$\\theta_{t+1} = \\theta_t - \\eta v_{t+1}$$

With momentum $\\mu \\approx 0.9$, effective learning rate is $\\eta / (1 - \\mu) = 10\\eta$.`,
    coreEquation: 'v_{t+1} = \\mu v_t + \\nabla L, \\quad \\theta_{t+1} = \\theta_t - \\eta v_{t+1}',
    whyItMatters: [
      'Momentum is still used to train most vision models and is the default for many frameworks',
      'Understanding momentum explains why adaptive methods (Adam) can be worse for generalization',
      'Nesterov momentum provides optimal convergence rates for convex optimization'
    ],
    missingIntuition: [
      'Momentum = exponential moving average of gradients, so it smooths over mini-batch noise',
      'Heavy ball analogy: momentum lets you roll through small bumps and ravines in the loss landscape',
      'Nesterov looks ahead: "if I keep going this way, what would the gradient be?"'
    ],
    prereqs: ['backpropagation-autodiff', 'loss-landscapes'],
    dependents: ['adam'],
    color: CATEGORY_COLORS.optimization
  },
  {
    id: 'weight-decay-adamw',
    number: 58,
    title: 'Weight Decay & AdamW: Decoupled Regularization',
    shortTitle: 'AdamW',
    icon: '⚖️',
    category: 'optimization',
    canonicalPapers: [
      {
        title: 'Decoupled Weight Decay Regularization',
        authors: 'Loshchilov & Hutter',
        year: 2019,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/1711.05101'
      },
      {
        title: 'Fixing Weight Decay Regularization in Adam',
        authors: 'Loshchilov & Hutter',
        year: 2018,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/1711.05101'
      }
    ],
    coreMath: `**L2 regularization** adds penalty to loss:
$$L_{reg} = L + \\frac{\\lambda}{2} \\|\\theta\\|^2$$
$$\\nabla L_{reg} = \\nabla L + \\lambda \\theta$$

**Weight decay** directly shrinks weights:
$$\\theta_{t+1} = (1 - \\eta \\lambda) \\theta_t - \\eta \\nabla L$$

**For SGD**: L2 regularization = weight decay. **For Adam**: they differ!

**AdamW** decouples weight decay from gradient updates:
$$m_t = \\beta_1 m_{t-1} + (1-\\beta_1) \\nabla L$$
$$v_t = \\beta_2 v_{t-1} + (1-\\beta_2) (\\nabla L)^2$$
$$\\theta_{t+1} = \\theta_t - \\eta \\left( \\frac{\\hat{m}_t}{\\sqrt{\\hat{v}_t} + \\epsilon} + \\lambda \\theta_t \\right)$$`,
    coreEquation: '\\theta_{t+1} = (1 - \\eta\\lambda)\\theta_t - \\eta \\cdot \\text{Adam\\_step}',
    whyItMatters: [
      'AdamW is the standard optimizer for LLM training—GPT, LLaMA, etc. all use it',
      'The distinction between L2 and weight decay is a common source of bugs in training',
      'Weight decay strength is one of the most important hyperparameters for generalization'
    ],
    missingIntuition: [
      'Adam rescales gradients, so L2 regularization gets rescaled too—breaking the intended effect',
      'AdamW applies weight decay *after* the Adam update, preserving the regularization strength',
      'Weight decay = "prefer simpler models"—it keeps weights small unless data strongly supports them'
    ],
    prereqs: ['adam', 'maximum-likelihood'],
    dependents: ['scaling-laws'],
    color: CATEGORY_COLORS.optimization
  },
  {
    id: 'gradient-clipping',
    number: 59,
    title: 'Gradient Clipping & Explosion Prevention',
    shortTitle: 'Grad Clip',
    icon: '✂️',
    category: 'optimization',
    canonicalPapers: [
      {
        title: 'On the difficulty of training Recurrent Neural Networks',
        authors: 'Pascanu, Mikolov, Bengio',
        year: 2013,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/1211.5063'
      },
      {
        title: 'Language Models are Few-Shot Learners',
        authors: 'Brown et al.',
        year: 2020,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2005.14165'
      }
    ],
    coreMath: `**Gradient norm clipping**: Scale gradient if norm exceeds threshold:

$$\\tilde{g} = \\begin{cases}
g & \\text{if } \\|g\\| \\leq c \\\\
c \\cdot \\frac{g}{\\|g\\|} & \\text{if } \\|g\\| > c
\\end{cases}$$

**Value clipping** (per-coordinate): $\\tilde{g}_i = \\text{clip}(g_i, -c, c)$

**Why gradients explode**: In deep networks, gradients are products of Jacobians:

$$\\frac{\\partial L}{\\partial W_1} = \\frac{\\partial L}{\\partial h_L} \\prod_{l=2}^{L} \\frac{\\partial h_l}{\\partial h_{l-1}} \\frac{\\partial h_1}{\\partial W_1}$$

If $\\|\\frac{\\partial h_l}{\\partial h_{l-1}}\\| > 1$, gradients grow exponentially with depth.`,
    coreEquation: '\\tilde{g} = \\min(1, c / \\|g\\|) \\cdot g',
    whyItMatters: [
      'Essential for training LLMs—without clipping, gradients explode on certain batches',
      'GPT-3 used gradient clipping of 1.0; it\'s a standard hyperparameter in all LLM training',
      'Explains why very deep networks (100+ layers) require careful architectural choices'
    ],
    missingIntuition: [
      'Clipping preserves gradient direction while bounding step size—you still go the right way',
      'Bad batches (outliers) cause gradient spikes; clipping prevents single batches from destabilizing training',
      'Gradient norm is a useful diagnostic: spikes often precede training instabilities'
    ],
    prereqs: ['backpropagation-autodiff', 'loss-landscapes'],
    dependents: [],
    color: CATEGORY_COLORS.optimization
  },
  {
    id: 'label-smoothing',
    number: 60,
    title: 'Label Smoothing & Soft Targets',
    shortTitle: 'Label Smooth',
    icon: '🎯',
    category: 'optimization',
    canonicalPapers: [
      {
        title: 'Rethinking the Inception Architecture for Computer Vision',
        authors: 'Szegedy et al.',
        year: 2016,
        venue: 'CVPR',
        url: 'https://arxiv.org/abs/1512.00567'
      },
      {
        title: 'When Does Label Smoothing Help?',
        authors: 'Müller, Kornblith, Hinton',
        year: 2019,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/1906.02629'
      }
    ],
    coreMath: `Instead of hard targets $y = [0, 0, 1, 0]$, use **soft targets**:

$$y_{smooth} = (1 - \\alpha) y + \\frac{\\alpha}{K}$$

For $\\alpha = 0.1$ and $K = 4$ classes: $[0.025, 0.025, 0.925, 0.025]$

**Effect on cross-entropy**:

$$\\mathcal{L}_{smooth} = (1-\\alpha) \\mathcal{L}_{CE}(p, y) + \\alpha \\mathcal{L}_{CE}(p, u)$$

where $u$ is uniform. This **penalizes overconfidence**: logits can't go to infinity.`,
    coreEquation: 'y_{smooth} = (1 - \\alpha) y + \\frac{\\alpha}{K}',
    whyItMatters: [
      'Used in most vision models and LLMs—simple trick with consistent improvements',
      'Prevents overconfidence, which improves calibration and sometimes generalization',
      'Knowledge distillation uses the same idea: train on soft targets from a teacher model'
    ],
    missingIntuition: [
      'Hard targets say "100% sure it\'s class 3"—but that\'s almost never true in real data',
      'Label smoothing implicitly regularizes: model can\'t drive logits to ±∞',
      'Connects to calibration: smoothed models give more honest uncertainty estimates'
    ],
    prereqs: ['maximum-likelihood'],
    dependents: [],
    color: CATEGORY_COLORS.optimization
  },
  {
    id: 'batch-normalization',
    number: 61,
    title: 'Batch Normalization',
    shortTitle: 'BatchNorm',
    icon: '📊',
    category: 'core',
    canonicalPapers: [
      {
        title: 'Batch Normalization: Accelerating Deep Network Training by Reducing Internal Covariate Shift',
        authors: 'Ioffe & Szegedy',
        year: 2015,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/1502.03167'
      },
      {
        title: 'How Does Batch Normalization Help Optimization?',
        authors: 'Santurkar et al.',
        year: 2018,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/1805.11604'
      }
    ],
    coreMath: `**BatchNorm** normalizes across the batch dimension:

$$\\hat{x}_i = \\frac{x_i - \\mu_B}{\\sqrt{\\sigma_B^2 + \\epsilon}}$$

where $\\mu_B = \\frac{1}{m}\\sum_{i=1}^m x_i$ and $\\sigma_B^2 = \\frac{1}{m}\\sum_{i=1}^m (x_i - \\mu_B)^2$.

**Scale and shift** with learned parameters:
$$y_i = \\gamma \\hat{x}_i + \\beta$$

**At inference**: use running averages of $\\mu$ and $\\sigma^2$ from training.`,
    coreEquation: '\\hat{x} = \\frac{x - \\mu_B}{\\sqrt{\\sigma_B^2 + \\epsilon}}',
    whyItMatters: [
      'Enabled training of very deep CNNs—ResNets wouldn\'t work without it',
      'Allows higher learning rates: normalization keeps activations in stable range',
      'The train/test discrepancy (batch stats vs running stats) causes subtle bugs'
    ],
    missingIntuition: [
      'Original "covariate shift" explanation is likely wrong—it works by smoothing the loss landscape',
      'BatchNorm couples examples in a batch: each example\'s gradient depends on batchmates',
      'Small batch sizes → noisy statistics → training instability. That\'s why LLMs use LayerNorm instead'
    ],
    prereqs: ['backpropagation-autodiff'],
    dependents: ['layer-normalization'],
    color: CATEGORY_COLORS.core
  },
  {
    id: 'knowledge-distillation',
    number: 62,
    title: 'Knowledge Distillation: Learning from Teachers',
    shortTitle: 'Distillation',
    icon: '🧪',
    category: 'efficiency',
    canonicalPapers: [
      {
        title: 'Distilling the Knowledge in a Neural Network',
        authors: 'Hinton, Vinyals, Dean',
        year: 2015,
        venue: 'NIPS Workshop',
        url: 'https://arxiv.org/abs/1503.02531'
      },
      {
        title: 'DistilBERT, a distilled version of BERT',
        authors: 'Sanh et al.',
        year: 2019,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/1910.01108'
      }
    ],
    coreMath: `Train a **student** $S$ to match a **teacher** $T$'s soft predictions:

$$\\mathcal{L} = (1-\\alpha) \\mathcal{L}_{CE}(S(x), y) + \\alpha \\mathcal{L}_{KL}(S(x), T(x))$$

Use **temperature** $\\tau$ to soften teacher outputs:

$$p_i^T = \\frac{\\exp(z_i^T / \\tau)}{\\sum_j \\exp(z_j^T / \\tau)}$$

Higher $\\tau$ → more uniform → more information about relative similarities.`,
    coreEquation: '\\mathcal{L} = \\alpha \\mathcal{L}_{KL}(S(x), T(x)) + (1-\\alpha) \\mathcal{L}_{CE}(S(x), y)',
    whyItMatters: [
      'How you get small models from large ones—DistilBERT is 40% smaller, 60% faster, 97% of performance',
      'Soft targets contain "dark knowledge": teacher\'s uncertainty about similar classes',
      'Modern LLM training uses distillation: smaller models trained on larger model outputs'
    ],
    missingIntuition: [
      'Hard labels say "cat, not dog"; soft labels say "mostly cat, a bit dog, definitely not car"',
      'Temperature τ controls how much dark knowledge transfers: τ→∞ means uniform (no info)',
      'Distillation works even when student has different architecture than teacher'
    ],
    prereqs: ['maximum-likelihood', 'label-smoothing'],
    dependents: ['speculative-decoding'],
    color: CATEGORY_COLORS.efficiency
  },
  {
    id: 'quantization',
    number: 63,
    title: 'Quantization: Compressing Models to Integers',
    shortTitle: 'Quantization',
    icon: '🔢',
    category: 'efficiency',
    canonicalPapers: [
      {
        title: 'GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers',
        authors: 'Frantar et al.',
        year: 2023,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/2210.17323'
      },
      {
        title: 'LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale',
        authors: 'Dettmers et al.',
        year: 2022,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2208.07339'
      }
    ],
    coreMath: `Map FP32 weights to INT8 (or INT4):

**Uniform quantization**:
$$w_q = \\text{round}\\left(\\frac{w - w_{min}}{\\Delta}\\right), \\quad \\Delta = \\frac{w_{max} - w_{min}}{2^b - 1}$$

**Dequantization**:
$$\\hat{w} = w_q \\cdot \\Delta + w_{min}$$

**Per-channel scaling** (better quality):
$$W_q = \\text{round}(W / s), \\quad s_i = \\max(|W_{i,:}|) / 127$$

Memory: FP32 → INT8 = 4× reduction. INT4 = 8× reduction.`,
    coreEquation: 'w_q = \\text{round}\\left(\\frac{w - w_{min}}{\\Delta}\\right)',
    whyItMatters: [
      'How you run 70B models on consumer GPUs: 4-bit quantization fits in 24GB VRAM',
      'GPTQ/AWQ/GGML are standard for deploying open-weight LLMs',
      'INT8 inference is ~2× faster than FP16 on modern GPUs (tensor cores)'
    ],
    missingIntuition: [
      'Neural nets are surprisingly robust to quantization—most precision is wasted',
      'Outliers are the enemy: a few large activations force bad scaling for everything else',
      'Quantization-aware training (QAT) is better than post-training quantization (PTQ), but expensive'
    ],
    prereqs: ['efficiency', 'llm-serving'],
    dependents: [],
    color: CATEGORY_COLORS.efficiency
  },
  {
    id: 'pruning',
    number: 64,
    title: 'Pruning: Removing Unnecessary Weights',
    shortTitle: 'Pruning',
    icon: '✂️',
    category: 'efficiency',
    canonicalPapers: [
      {
        title: 'The Lottery Ticket Hypothesis: Finding Sparse, Trainable Neural Networks',
        authors: 'Frankle & Carlin',
        year: 2019,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/1803.03635'
      },
      {
        title: 'SparseGPT: Massive Language Models Can Be Accurately Pruned in One-Shot',
        authors: 'Frantar & Alistarh',
        year: 2023,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/2301.00774'
      }
    ],
    coreMath: `**Magnitude pruning**: Remove weights with smallest $|w|$:

$$W_{pruned} = W \\odot M, \\quad M_{ij} = \\mathbf{1}[|W_{ij}| > \\theta]$$

**Structured pruning**: Remove entire neurons/attention heads:
$$W_{pruned} = W[:, \\text{keep\\_indices}]$$

**Lottery Ticket**: There exist sparse subnetworks that train as well as dense:
$$\\exists M: \\text{train}(W_0 \\odot M) \\approx \\text{train}(W_0)$$

**OBS/OBD** criterion (second-order): Prune weight that minimizes loss increase:
$$\\delta L \\approx \\frac{w_i^2}{2 H_{ii}^{-1}}$$`,
    coreEquation: 'W_{pruned} = W \\odot M, \\quad M_{ij} = \\mathbf{1}[|W_{ij}| > \\theta]',
    whyItMatters: [
      'Lottery ticket hypothesis changed how we think about overparameterization',
      'SparseGPT can prune 50% of GPT-175B weights with minimal quality loss',
      'Structured pruning enables actual speedups; unstructured sparsity needs special hardware'
    ],
    missingIntuition: [
      'Small weights ≠ unimportant; magnitude pruning is a heuristic, not optimal',
      'Unstructured 90% sparsity sounds great but doesn\'t speed up standard GPUs',
      'Iterative pruning (prune, retrain, repeat) works much better than one-shot'
    ],
    prereqs: ['efficiency', 'weight-initialization'],
    dependents: [],
    color: CATEGORY_COLORS.efficiency
  },
  {
    id: 'self-supervised-learning',
    number: 65,
    title: 'Self-Supervised Learning: Labels from Structure',
    shortTitle: 'SSL',
    icon: '🔄',
    category: 'representation',
    canonicalPapers: [
      {
        title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
        authors: 'Devlin et al.',
        year: 2019,
        venue: 'NAACL',
        url: 'https://arxiv.org/abs/1810.04805'
      },
      {
        title: 'Masked Autoencoders Are Scalable Vision Learners',
        authors: 'He et al.',
        year: 2022,
        venue: 'CVPR',
        url: 'https://arxiv.org/abs/2111.06377'
      }
    ],
    coreMath: `**Self-supervised** = create supervision from data itself:

**Masked Language Modeling** (BERT):
$$\\mathcal{L}_{MLM} = -\\mathbb{E}_{x, M}\\left[\\sum_{i \\in M} \\log p(x_i | x_{\\backslash M})\\right]$$

where $M$ is the set of masked positions.

**Next Token Prediction** (GPT):
$$\\mathcal{L}_{NTP} = -\\sum_{t=1}^T \\log p(x_t | x_{<t})$$

**Contrastive** (SimCLR, CLIP):
$$\\mathcal{L} = -\\log \\frac{\\exp(\\text{sim}(z_i, z_i^+)/\\tau)}{\\sum_k \\exp(\\text{sim}(z_i, z_k)/\\tau)}$$`,
    coreEquation: '\\mathcal{L} = -\\mathbb{E}[\\log p(x_{masked} | x_{visible})]',
    whyItMatters: [
      'Foundation of modern NLP: BERT, GPT, LLaMA all use self-supervised pretraining',
      'Enables learning from internet-scale unlabeled data—the key to scaling laws',
      'Self-supervised vision (MAE, DINO) is closing the gap with supervised ImageNet pretraining'
    ],
    missingIntuition: [
      'The task (predict missing parts) forces the model to understand structure and semantics',
      'SSL works because predicting tokens/pixels requires modeling the full data distribution',
      'Transfer learning magic: SSL features generalize because the pretext task is so hard'
    ],
    prereqs: ['maximum-likelihood', 'representations'],
    dependents: ['contrastive-learning'],
    color: CATEGORY_COLORS.representation
  },
  {
    id: 'calibration',
    number: 66,
    title: 'Calibration & Temperature Scaling',
    shortTitle: 'Calibration',
    icon: '🌡️',
    category: 'theory',
    canonicalPapers: [
      {
        title: 'On Calibration of Modern Neural Networks',
        authors: 'Guo et al.',
        year: 2017,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/1706.04599'
      },
      {
        title: 'Verified Uncertainty Calibration',
        authors: 'Kumar et al.',
        year: 2019,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/1909.10155'
      }
    ],
    coreMath: `A model is **calibrated** if confidence matches accuracy:

$$P(Y = \\hat{Y} | \\hat{P} = p) = p$$

**Expected Calibration Error (ECE)**:
$$ECE = \\sum_{m=1}^M \\frac{|B_m|}{n} |\\text{acc}(B_m) - \\text{conf}(B_m)|$$

**Temperature scaling**: Learn a single scalar $T$ on validation set:
$$q_i = \\frac{\\exp(z_i / T)}{\\sum_j \\exp(z_j / T)}$$

$T > 1$ softens predictions (reduces overconfidence).`,
    coreEquation: 'P(Y = \\hat{Y} | \\hat{P} = p) = p',
    whyItMatters: [
      'Modern deep networks are often overconfident—90% confidence doesn\'t mean 90% accuracy',
      'Critical for downstream decisions: medical diagnosis, autonomous driving need honest uncertainty',
      'LLM "hallucination confidence" is a calibration failure—model is certain about wrong things'
    ],
    missingIntuition: [
      'Neural nets maximize log-likelihood, not calibration—these are different objectives',
      'Temperature scaling is surprisingly effective: one scalar fixes most miscalibration',
      'Bigger models are often LESS calibrated—scale doesn\'t solve everything'
    ],
    prereqs: ['maximum-likelihood', 'theory'],
    dependents: [],
    color: CATEGORY_COLORS.theory
  },
  {
    id: 'swiglu',
    number: 67,
    title: 'SwiGLU & Gated Activations',
    shortTitle: 'SwiGLU',
    icon: '🚪',
    category: 'core',
    canonicalPapers: [
      {
        title: 'GLU Variants Improve Transformer',
        authors: 'Shazeer',
        year: 2020,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2002.05202'
      },
      {
        title: 'LLaMA: Open and Efficient Foundation Language Models',
        authors: 'Touvron et al.',
        year: 2023,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2302.13971'
      }
    ],
    coreMath: `**Gated Linear Unit** (GLU):
$$\\text{GLU}(x) = (xW_1) \\odot \\sigma(xW_2)$$

**SwiGLU** uses SiLU (Swish) activation:
$$\\text{SwiGLU}(x) = (xW_1 \\cdot \\text{SiLU}(xW_2)) W_3$$

where $\\text{SiLU}(x) = x \\cdot \\sigma(x)$.

The **gating** mechanism: one path produces values, another produces gates.
More expressive than ReLU at same parameter count (but uses 50% more compute).`,
    coreEquation: '\\text{SwiGLU}(x) = (xW_1 \\cdot \\text{SiLU}(xW_2)) W_3',
    whyItMatters: [
      'Used in LLaMA, PaLM, and most modern LLMs—replaced ReLU in transformer FFN',
      'Empirically better than ReLU/GELU at same compute budget',
      'The gating mechanism adds multiplicative interactions, increasing expressiveness'
    ],
    missingIntuition: [
      'Gates let the network learn which features to pass through, not just which to zero out',
      'SwiGLU needs 50% more parameters for same hidden dim—but quality gains are worth it',
      'Smooth activations (SiLU vs ReLU) may help optimization by avoiding gradient discontinuities'
    ],
    prereqs: ['attention-transformers'],
    dependents: [],
    color: CATEGORY_COLORS.core
  },
  {
    id: 'flash-attention',
    number: 68,
    title: 'FlashAttention: IO-Aware Attention',
    shortTitle: 'FlashAttn',
    icon: '⚡',
    category: 'efficiency',
    canonicalPapers: [
      {
        title: 'FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness',
        authors: 'Dao et al.',
        year: 2022,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2205.14135'
      },
      {
        title: 'FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning',
        authors: 'Dao',
        year: 2023,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2307.08691'
      }
    ],
    coreMath: `Standard attention materializes $O(N^2)$ intermediate matrices:
$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d}}\\right) V$$

**FlashAttention** fuses operations, keeping data in SRAM:
- Tile Q, K, V into blocks that fit in SRAM
- Compute local softmax, accumulate with online softmax trick
- Never materialize full $N \\times N$ attention matrix

**Memory**: $O(N)$ instead of $O(N^2)$
**Speed**: 2-4× faster than standard attention`,
    coreEquation: '\\text{Memory: } O(N) \\text{ vs } O(N^2)',
    whyItMatters: [
      'Enabled training with 100K+ context windows—without this, long context is impractical',
      'Foundational for modern LLMs: used in LLaMA, GPT-4, Claude, etc.',
      'Shows that algorithmic innovation can beat hardware by understanding memory hierarchy'
    ],
    missingIntuition: [
      'GPU memory hierarchy matters: SRAM (fast, small) vs HBM (slow, large)',
      'Materializing N×N attention wastes memory bandwidth—the bottleneck, not FLOPs',
      'Online softmax: you can compute softmax in one pass by tracking running max and sum'
    ],
    prereqs: ['efficient-attention', 'long-context'],
    dependents: [],
    color: CATEGORY_COLORS.efficiency
  },
  {
    id: 'constitutional-ai',
    number: 69,
    title: 'Constitutional AI: Principles-Based Alignment',
    shortTitle: 'Constitutional',
    icon: '📜',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Constitutional AI: Harmlessness from AI Feedback',
        authors: 'Bai et al.',
        year: 2022,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2212.08073'
      },
      {
        title: 'Training a Helpful and Harmless Assistant with Reinforcement Learning from Human Feedback',
        authors: 'Bai et al.',
        year: 2022,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2204.05862'
      }
    ],
    coreMath: `**Constitutional AI** (CAI) uses a two-stage process:

**Stage 1 - Self-Critique**: Model generates response, then critiques it:
$$r_{critique} = \\text{LLM}(\\text{prompt}, r_{initial}, \\text{principle})$$
$$r_{revised} = \\text{LLM}(\\text{prompt}, r_{initial}, r_{critique})$$

**Stage 2 - RLAIF**: Train reward model on AI-generated preferences:
$$\\mathcal{L}_{RM} = -\\log \\sigma(r_\\theta(r_{chosen}) - r_\\theta(r_{rejected}))$$

Key insight: Principles ("Be helpful", "Don't be harmful") can guide AI feedback.`,
    coreEquation: 'r_{revised} = \\text{Critique}(r_{initial}, \\text{principle})',
    whyItMatters: [
      'How Claude is trained—principles replace pure human preference labeling',
      'Scales better than RLHF: AI can critique faster than humans can label',
      'More interpretable: you can see which principles guide behavior'
    ],
    missingIntuition: [
      'The "constitution" is just a set of principles like "be honest" and "don\'t help with harm"',
      'AI feedback can bootstrap from a smaller set of human preferences',
      'Self-critique is iterative: multiple rounds of revision improve outputs'
    ],
    prereqs: ['rlhf', 'dpo'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'bregman-divergence',
    number: 70,
    title: 'Bregman Divergence & Mirror Descent',
    shortTitle: 'Bregman',
    icon: '🪞',
    category: 'theory',
    canonicalPapers: [
      {
        title: 'Mirror Descent and Nonlinear Projected Subgradient Methods',
        authors: 'Beck & Teboulle',
        year: 2003,
        venue: 'Operations Research Letters',
        url: 'https://www.sciencedirect.com/science/article/abs/pii/S0167637703000903'
      },
      {
        title: 'Prediction, Learning, and Games',
        authors: 'Cesa-Bianchi & Lugosi',
        year: 2006,
        venue: 'Cambridge University Press',
        url: 'https://www.cambridge.org/core/books/prediction-learning-and-games/A1EC70A2E2D0E1BE95EF80C8E3FAC9CE'
      }
    ],
    coreMath: `**Bregman divergence** generated by strictly convex $\\Phi$:

$$D_\\Phi(p, q) = \\Phi(p) - \\Phi(q) - \\langle \\nabla\\Phi(q), p - q \\rangle$$

**Mirror descent**:
$$x_{t+1} = \\arg\\min_{x \\in \\mathcal{X}} \\left\\{ \\langle g_t, x \\rangle + \\frac{1}{\\eta} D_\\Phi(x, x_t) \\right\\}$$

Special cases:
- $\\Phi(x) = \\frac{1}{2}\\|x\\|^2$ → Euclidean GD, $D_\\Phi$ = squared distance
- $\\Phi(x) = \\sum_i x_i \\log x_i$ → KL divergence on simplex (exponentiated gradient)`,
    coreEquation: 'D_\\Phi(p, q) = \\Phi(p) - \\Phi(q) - \\langle \\nabla\\Phi(q), p - q \\rangle',
    whyItMatters: [
      'Explains why different geometries suit different problems—simplex needs KL, not Euclidean',
      'Exponentiated gradient (softmax updates) is mirror descent with entropy potential',
      'Natural gradient is Bregman geometry with Fisher information as the potential'
    ],
    missingIntuition: [
      'Euclidean gradient descent is ONE choice; mirror descent is the general framework',
      'The "mirror map" transforms to dual coordinates where steps are linear',
      'KL divergence is the Bregman divergence for probability distributions'
    ],
    prereqs: ['fisher-information', 'natural-gradient'],
    dependents: [],
    color: CATEGORY_COLORS.theory
  },
  {
    id: 'rkhs',
    number: 71,
    title: 'Reproducing Kernel Hilbert Spaces',
    shortTitle: 'RKHS',
    icon: '🎭',
    category: 'theory',
    canonicalPapers: [
      {
        title: 'Kernel Methods for Pattern Analysis',
        authors: 'Shawe-Taylor & Cristianini',
        year: 2004,
        venue: 'Cambridge University Press',
        url: 'https://www.cambridge.org/core/books/kernel-methods-for-pattern-analysis/725B8F1C1CF4F7C5D8582D3B00BFBDD5'
      },
      {
        title: 'Neural Tangent Kernel',
        authors: 'Jacot et al.',
        year: 2018,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/1806.07572'
      }
    ],
    coreMath: `**Reproducing property**: evaluation is an inner product:
$$f(x) = \\langle f, k(x, \\cdot) \\rangle_{\\mathcal{H}}$$

**Kernel trick**: inner product in feature space without explicit computation:
$$k(x, x') = \\langle \\varphi(x), \\varphi(x') \\rangle$$

**Mercer decomposition** (spectral):
$$k(x, x') = \\sum_{m=1}^\\infty \\lambda_m e_m(x) e_m(x')$$

**Representer theorem**: optimal function is a linear combination of kernel evaluations:
$$f^*(x) = \\sum_{i=1}^n \\alpha_i k(x_i, x)$$`,
    coreEquation: 'f(x) = \\langle f, k(x, \\cdot) \\rangle_{\\mathcal{H}}',
    whyItMatters: [
      'Unifies SVMs, Gaussian processes, kernel regression, and NTK under one framework',
      'Explains why "similarity functions" must be positive definite—they define inner products',
      'NTK shows neural networks are kernel machines in the infinite-width limit'
    ],
    missingIntuition: [
      'Kernels implicitly define an (often infinite-dimensional) feature space',
      'Positive definiteness = you can build a Hilbert space where the kernel is an inner product',
      'Attention can be viewed as a learned, data-dependent kernel'
    ],
    prereqs: ['ntk', 'theory'],
    dependents: [],
    color: CATEGORY_COLORS.theory
  },
  {
    id: 'persistent-homology',
    number: 72,
    title: 'Persistent Homology & Topological Data Analysis',
    shortTitle: 'TDA',
    icon: '🕳️',
    category: 'theory',
    canonicalPapers: [
      {
        title: 'Topological Methods for the Analysis of High Dimensional Data Sets',
        authors: 'Carlsson',
        year: 2009,
        venue: 'Bulletin of the AMS',
        url: 'https://www.ams.org/journals/bull/2009-46-02/S0273-0979-09-01249-X/'
      },
      {
        title: 'A Topological Regularizer for Classifiers via Persistent Homology',
        authors: 'Chen et al.',
        year: 2019,
        venue: 'AISTATS',
        url: 'https://arxiv.org/abs/1806.10714'
      }
    ],
    coreMath: `Build a **filtration** of simplicial complexes at different scales $\\epsilon$:
$$\\emptyset \\subseteq K_0 \\subseteq K_1 \\subseteq \\cdots \\subseteq K_n$$

Track **homology groups** $H_k(K_\\epsilon)$ (k-dimensional holes):
- $H_0$: connected components
- $H_1$: loops/cycles
- $H_2$: voids

**Persistence diagram**: plot (birth, death) of each topological feature.

$$\\text{Persistence} = \\text{death} - \\text{birth}$$

Long-lived features are "real"; short-lived are noise.`,
    coreEquation: '\\text{Persistence} = \\text{death} - \\text{birth}',
    whyItMatters: [
      'Detects "shape" in high-dimensional data that other methods miss',
      'Topological loss functions can enforce connectivity in segmentation',
      'Provides interpretable features: "this dataset has 3 clusters and 1 loop"'
    ],
    missingIntuition: [
      'Homology counts "holes" at different dimensions: components, loops, voids',
      'Persistence separates signal from noise: real features persist across scales',
      'Loss landscape topology can predict generalization—more connected = better'
    ],
    prereqs: ['theory', 'representations'],
    dependents: [],
    color: CATEGORY_COLORS.theory
  },
  {
    id: 'lie-groups',
    number: 73,
    title: 'Lie Groups & Equivariant Networks',
    shortTitle: 'Lie Groups',
    icon: '🔀',
    category: 'theory',
    canonicalPapers: [
      {
        title: 'A General Theory of Equivariant CNNs on Homogeneous Spaces',
        authors: 'Cohen et al.',
        year: 2019,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/1811.02017'
      },
      {
        title: 'Geometric Deep Learning: Grids, Groups, Graphs, Geodesics, and Gauges',
        authors: 'Bronstein et al.',
        year: 2021,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2104.13478'
      }
    ],
    coreMath: `A **Lie group** $G$ is a smooth manifold with group structure.

**Equivariance**: $f(g \\cdot x) = g \\cdot f(x)$ for all $g \\in G$

**Group convolution** (generalizes 2D convolution):
$$[f * \\psi](g) = \\int_G f(h) \\psi(g^{-1}h) dh$$

**Lie algebra** $\\mathfrak{g}$: infinitesimal generators at identity:
$$\\exp: \\mathfrak{g} \\to G$$

Rotation group $SO(3)$: 3D rotations, Lie algebra is skew-symmetric matrices.`,
    coreEquation: 'f(g \\cdot x) = g \\cdot f(x)',
    whyItMatters: [
      'CNNs are equivariant to translations—this explains why they work for images',
      'Symmetry constraints dramatically reduce parameter count and improve generalization',
      'Molecular/protein prediction requires 3D rotation equivariance (SE(3))'
    ],
    missingIntuition: [
      'Equivariance = "the output transforms the same way as the input"',
      'Translation equivariance (CNN) is the simplest case; rotation, scale are harder',
      'The Lie algebra captures "infinitesimal" symmetries—rotation by tiny angles'
    ],
    prereqs: ['theory', 'multimodal'],
    dependents: [],
    color: CATEGORY_COLORS.theory
  },
  {
    id: 'test-time-compute',
    number: 74,
    title: 'Test-Time Compute & Inference Scaling',
    shortTitle: 'Test-Time',
    icon: '🧠',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Scaling LLM Test-Time Compute Optimally',
        authors: 'Snell et al.',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2408.03314'
      },
      {
        title: 'Let\'s Verify Step by Step',
        authors: 'Lightman et al.',
        year: 2023,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2305.20050'
      }
    ],
    coreMath: `**Test-time scaling** trades compute for quality at inference:

$$\\text{Quality} \\sim \\log(\\text{inference compute})$$

**Best-of-N sampling**: Generate N responses, select best via verifier:
$$y^* = \\arg\\max_{y \\in \\{y_1, ..., y_N\\}} V(y)$$

**Process Reward Models** score intermediate steps:
$$R_{PRM}(s_1, ..., s_k) = \\prod_{i=1}^k P(\\text{correct} | s_1, ..., s_i)$$

**Monte Carlo Tree Search** for reasoning:
$$UCB(s) = V(s) + c\\sqrt{\\frac{\\log N_{parent}}{N_s}}$$`,
    coreEquation: '\\text{Quality} \\sim \\log(\\text{inference compute})',
    whyItMatters: [
      'The paradigm behind o1: spend more compute at inference for harder problems',
      'Enables adaptive compute: easy questions are fast, hard ones "think longer"',
      'May be more efficient than pure pretraining scaling for reasoning tasks'
    ],
    missingIntuition: [
      'Train-time and test-time compute are substitutes: you can trade one for the other',
      'Verifiers (reward models) let you search through many candidate solutions',
      'Tree search over reasoning steps explores the space of possible derivations'
    ],
    prereqs: ['scaling-laws', 'rlhf'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'chain-of-thought',
    number: 75,
    title: 'Chain-of-Thought Prompting',
    shortTitle: 'CoT',
    icon: '💭',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Chain-of-Thought Prompting Elicits Reasoning in Large Language Models',
        authors: 'Wei et al.',
        year: 2022,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2201.11903'
      },
      {
        title: 'Self-Consistency Improves Chain of Thought Reasoning',
        authors: 'Wang et al.',
        year: 2023,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/2203.11171'
      }
    ],
    coreMath: `**Chain-of-Thought**: Prompt model to show reasoning steps:

$$P(answer | question) \\to P(answer | question, reasoning)$$

**Self-Consistency**: Sample multiple reasoning paths, majority vote:
$$answer^* = \\arg\\max_a \\sum_{i=1}^N \\mathbf{1}[a_i = a]$$

where $a_i \\sim P(a | q, r_i)$ with reasoning path $r_i$.

**Decomposition**: Break complex problem into sub-problems:
$$P(y | x) = \\prod_{t=1}^T P(y_t | y_{<t}, x)$$`,
    coreEquation: 'P(answer | question, reasoning)',
    whyItMatters: [
      'Dramatically improves reasoning performance—math, logic, coding',
      'Emergent capability: only works well in large models (>100B parameters)',
      'Foundation for o1-style reasoning: explicit intermediate computation steps'
    ],
    missingIntuition: [
      'CoT gives the model "scratchpad" space for intermediate computation',
      'The reasoning doesn\'t need to be human-readable—it just needs to help the model',
      'Self-consistency leverages diversity: different reasoning paths vote on the answer'
    ],
    prereqs: ['in-context-learning', 'test-time-compute'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'world-models',
    number: 76,
    title: 'World Models & Model-Based RL',
    shortTitle: 'World Models',
    icon: '🌍',
    category: 'theory',
    canonicalPapers: [
      {
        title: 'World Models',
        authors: 'Ha & Schmidhuber',
        year: 2018,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/1803.10122'
      },
      {
        title: 'Mastering Diverse Domains through World Models',
        authors: 'Hafner et al.',
        year: 2023,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2301.04104'
      }
    ],
    coreMath: `A **world model** learns to predict future states:

$$\\hat{s}_{t+1} = f_\\theta(s_t, a_t)$$

**Latent world model** (DreamerV3):
- Encoder: $z_t = \\text{enc}(o_t)$
- Dynamics: $\\hat{z}_{t+1} = \\text{dyn}(z_t, a_t)$
- Decoder: $\\hat{o}_{t+1} = \\text{dec}(\\hat{z}_{t+1})$

**Planning in imagination**:
$$a^* = \\arg\\max_a \\mathbb{E}_{\\hat{s} \\sim f_\\theta}\\left[\\sum_{t=0}^H \\gamma^t r(\\hat{s}_t, a_t)\\right]$$

Train policy entirely in the learned model ("dreaming").`,
    coreEquation: '\\hat{s}_{t+1} = f_\\theta(s_t, a_t)',
    whyItMatters: [
      'Sample-efficient RL: learn from imagined experience, not just real data',
      'DreamerV3 achieves superhuman Atari with 100× less data than model-free methods',
      'Foundation for planning-based AI: simulate futures before acting'
    ],
    missingIntuition: [
      'World models let agents "imagine" consequences without taking real actions',
      'Latent space prediction is easier than pixel prediction—compress, then predict',
      'Model error compounds over long horizons—need careful uncertainty handling'
    ],
    prereqs: ['vaes', 'theory'],
    dependents: ['test-time-compute'],
    color: CATEGORY_COLORS.theory
  },
  {
    id: 'synthetic-data',
    number: 77,
    title: 'Synthetic Data & Self-Improvement',
    shortTitle: 'Synth Data',
    icon: '🏭',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Textbooks Are All You Need',
        authors: 'Gunasekar et al.',
        year: 2023,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2306.11644'
      },
      {
        title: 'Self-Instruct: Aligning Language Models with Self-Generated Instructions',
        authors: 'Wang et al.',
        year: 2023,
        venue: 'ACL',
        url: 'https://arxiv.org/abs/2212.10560'
      }
    ],
    coreMath: `**Synthetic data generation**:

1. Generate candidates: $y \\sim p_\\theta(y | x)$
2. Filter for quality: $\\{(x_i, y_i) : V(y_i) > \\tau\\}$
3. Train on filtered data: $\\theta' = \\arg\\min \\mathcal{L}(\\theta; \\mathcal{D}_{synth})$

**Self-improvement loop**:
$$\\theta_{t+1} = \\text{Train}(\\theta_t, \\text{Generate}(\\theta_t, \\text{Filter}))$$

**Phi-1 insight**: Small model + high-quality synthetic data > Large model + web data

Quality filtering: use reward models, verifiers, or consistency checks.`,
    coreEquation: '\\theta_{t+1} = \\text{Train}(\\theta_t, \\text{Generate}(\\theta_t, \\text{Filter}))',
    whyItMatters: [
      'Key to modern training: Phi, LLaMA 3, many models use synthetic data',
      'Enables training without human annotation at scale',
      'Data quality > quantity: careful curation beats raw scale'
    ],
    missingIntuition: [
      'Models can teach themselves if we filter for correct answers',
      'Synthetic data amplifies capabilities the model already has (via distillation)',
      'The "data wall" problem: we\'re running out of internet text, synthetics are the solution'
    ],
    prereqs: ['knowledge-distillation', 'rlhf'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'consistency-models',
    number: 78,
    title: 'Consistency Models: One-Step Diffusion',
    shortTitle: 'Consistency',
    icon: '🎯',
    category: 'generative',
    canonicalPapers: [
      {
        title: 'Consistency Models',
        authors: 'Song et al.',
        year: 2023,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/2303.01469'
      },
      {
        title: 'Improved Techniques for Training Consistency Models',
        authors: 'Song & Dhariwal',
        year: 2023,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2310.14189'
      }
    ],
    coreMath: `**Consistency function** maps any point on ODE trajectory to origin:

$$f(x_t, t) = x_0 \\quad \\forall t \\in [0, T]$$

**Self-consistency** property:
$$f(x_t, t) = f(x_{t'}, t') \\quad \\text{for all } t, t' \\text{ on same trajectory}$$

**Training via consistency loss**:
$$\\mathcal{L} = \\mathbb{E}\\left[d(f(x_{t+\\Delta}, t+\\Delta), f(x_t, t))\\right]$$

One-step generation: $x_0 = f(x_T, T)$ where $x_T \\sim \\mathcal{N}(0, I)$.`,
    coreEquation: 'f(x_t, t) = x_0 \\quad \\forall t',
    whyItMatters: [
      'Generates images in 1-2 steps instead of 50-1000 steps',
      'Bridges the speed gap between diffusion quality and GAN speed',
      'The "distillation" approach: learn to jump directly to the answer'
    ],
    missingIntuition: [
      'Diffusion models trace a path from noise to image; consistency models learn to skip',
      'Self-consistency = "any point on the trajectory should predict the same endpoint"',
      'Trade-off: fewer steps = faster but lower quality; find the sweet spot'
    ],
    prereqs: ['diffusion', 'score-matching'],
    dependents: [],
    color: CATEGORY_COLORS.generative
  },
  {
    id: 'activation-checkpointing',
    number: 79,
    title: 'Activation Checkpointing & Memory Efficiency',
    shortTitle: 'Checkpointing',
    icon: '💾',
    category: 'efficiency',
    canonicalPapers: [
      {
        title: 'Training Deep Nets with Sublinear Memory Cost',
        authors: 'Chen et al.',
        year: 2016,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/1604.06174'
      },
      {
        title: 'Reducing Activation Recomputation in Large Transformer Models',
        authors: 'Korthikanti et al.',
        year: 2022,
        venue: 'MLSys',
        url: 'https://arxiv.org/abs/2205.05198'
      }
    ],
    coreMath: `**Memory problem**: Storing activations for backprop requires $O(L \\cdot B \\cdot d)$ memory.

**Gradient checkpointing**: Recompute instead of store:
- Forward: Save only checkpoint activations (every $\\sqrt{L}$ layers)
- Backward: Recompute activations from nearest checkpoint

**Memory**: $O(\\sqrt{L})$ instead of $O(L)$
**Compute**: 33% overhead (recompute forward pass once)

**Selective checkpointing**: Only checkpoint expensive layers (attention).

Trade-off: $\\text{Memory} \\times \\text{Compute} \\geq \\text{constant}$`,
    coreEquation: '\\text{Memory: } O(\\sqrt{L}) \\text{ vs } O(L)',
    whyItMatters: [
      'Essential for training large models—without it, you can\'t fit 100B models in GPU memory',
      'Every major training framework (PyTorch, JAX) uses this technique',
      'Memory-compute trade-off is fundamental: pay with one to save the other'
    ],
    missingIntuition: [
      'Backprop needs activations from forward pass; normally we store all of them',
      'Checkpointing says: "just save some, recompute the rest when needed"',
      'Optimal checkpoint spacing is √L layers—minimizes memory × compute product'
    ],
    prereqs: ['backpropagation-autodiff', 'distributed-training'],
    dependents: [],
    color: CATEGORY_COLORS.efficiency
  },
  {
    id: 'grouped-query-attention',
    number: 80,
    title: 'Grouped Query Attention (GQA)',
    shortTitle: 'GQA',
    icon: '👥',
    category: 'efficiency',
    canonicalPapers: [
      {
        title: 'GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints',
        authors: 'Ainslie et al.',
        year: 2023,
        venue: 'EMNLP',
        url: 'https://arxiv.org/abs/2305.13245'
      }
    ],
    coreMath: `**Multi-Head Attention**: Each head has own Q, K, V.
**Multi-Query Attention**: All heads share K, V; each has own Q.
**Grouped Query Attention**: Groups of heads share K, V:

$$\\text{GQA}: \\text{head}_i = \\text{Attention}(XW^Q_i, XW^K_{g(i)}, XW^V_{g(i)})$$

where heads in group $g$ share the same K, V projections.

**KV cache savings**: Memory reduced by factor $\\frac{h}{g}$ (h heads, g groups).`,
    coreEquation: '\\text{KV cache} = \\frac{h}{g} \\times \\text{MHA cache}',
    whyItMatters: [
      'Used in LLaMA 2, Mistral—critical for efficient long-context inference',
      'Reduces KV cache without significant quality loss',
      'Enables running larger context windows on consumer hardware'
    ],
    missingIntuition: [
      'Not all heads need unique K, V—sharing works surprisingly well',
      'GQA with g=h is MHA; g=1 is MQA; g in between is the sweet spot',
      'Speedup comes from smaller memory reads, not fewer FLOPs'
    ],
    prereqs: ['efficient-attention', 'long-context'],
    dependents: [],
    color: CATEGORY_COLORS.efficiency
  },
  {
    id: 'process-reward-models',
    number: 81,
    title: 'Process Reward Models',
    shortTitle: 'PRMs',
    icon: '📋',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Let\'s Verify Step by Step',
        authors: 'Lightman et al.',
        year: 2023,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2305.20050'
      }
    ],
    coreMath: `**Outcome RM**: Score final answer: $R_{ORM}(y) = P(\\text{correct})$

**Process RM**: Score each step:
$$R_{PRM}(s_1, ..., s_K) = \\prod_{k=1}^K P(\\text{step } s_k \\text{ correct})$$

**Best-of-N with PRM**: Reject solutions with any incorrect step:
$$y^* = \\arg\\max_{y} \\min_{k} R_{PRM}(s_1, ..., s_k)$$`,
    coreEquation: 'R_{PRM} = \\prod_k P(\\text{step } k \\text{ correct})',
    whyItMatters: [
      'Key to o1-style reasoning: verify each step, not just the answer',
      'Better for math/code: catches errors before they compound',
      'Enables reliable search over reasoning paths'
    ],
    missingIntuition: [
      'Outcome is sparse feedback; process is dense—better credit assignment',
      'PRMs need step-level labels—expensive but informative',
      'Wrong final answer could mean 1 wrong step or 10; PRM tells you which'
    ],
    prereqs: ['rlhf', 'test-time-compute'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'rlaif',
    number: 82,
    title: 'RLAIF: AI Feedback',
    shortTitle: 'RLAIF',
    icon: '🤖',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'RLAIF: Scaling Reinforcement Learning from Human Feedback with AI Feedback',
        authors: 'Lee et al.',
        year: 2023,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2309.00267'
      }
    ],
    coreMath: `Replace human with AI preferences:

**RLHF**: $r(y) = \\text{Human}(y)$ → expensive
**RLAIF**: $r(y) = \\text{LLM}(y | \\text{criteria})$ → scalable

AI judge: $P(y_1 \\succ y_2) = \\text{LLM}(x, y_1, y_2, \\text{rubric})$

Correlates ~0.85 with human for many tasks.`,
    coreEquation: 'r(y) = \\text{LLM}(y | \\text{criteria})',
    whyItMatters: [
      'Removes human labeling bottleneck',
      'Powers Constitutional AI and production alignment',
      'Quality approaching human at 10-100× lower cost'
    ],
    missingIntuition: [
      'AI feedback is consistent and follows complex rubrics',
      'Judge can be same model or stronger one',
      'Works best with clear criteria; fails on subjective judgments'
    ],
    prereqs: ['rlhf', 'constitutional-ai'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'flow-matching',
    number: 83,
    title: 'Flow Matching & Rectified Flows',
    shortTitle: 'Flow Match',
    icon: '🌊',
    category: 'generative',
    canonicalPapers: [
      {
        title: 'Flow Matching for Generative Modeling',
        authors: 'Lipman et al.',
        year: 2023,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/2210.02747'
      }
    ],
    coreMath: `Learn vector field transporting noise to data:
$$\\frac{dx_t}{dt} = v_\\theta(x_t, t)$$

**Conditional flow matching**:
$$\\mathcal{L} = \\mathbb{E}_{t, x_0, x_1}[\\|v_\\theta(x_t, t) - u_t\\|^2]$$

**Rectified flow**: Straight paths $x_t = (1-t)x_0 + tx_1$
$$u_t = x_1 - x_0 \\text{ (constant velocity)}$$`,
    coreEquation: '\\frac{dx_t}{dt} = v_\\theta(x_t, t)',
    whyItMatters: [
      'Simpler than diffusion: no noise schedule to tune',
      'Rectified flows enable 1-4 step generation',
      'State-of-the-art: Stable Diffusion 3 uses flow matching'
    ],
    missingIntuition: [
      'Diffusion = learn to denoise; flow = learn velocity directly',
      'Straight paths are easiest to approximate with few steps',
      'Simulation-free: no sampling during training'
    ],
    prereqs: ['diffusion', 'normalizing-flows'],
    dependents: [],
    color: CATEGORY_COLORS.generative
  },
  {
    id: 'instruction-tuning',
    number: 84,
    title: 'Instruction Tuning',
    shortTitle: 'Instruct',
    icon: '📝',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Finetuned Language Models Are Zero-Shot Learners',
        authors: 'Wei et al.',
        year: 2022,
        venue: 'ICLR',
        url: 'https://arxiv.org/abs/2109.01652'
      }
    ],
    coreMath: `Fine-tune on (instruction, response) pairs:
$$\\mathcal{L} = -\\sum_{t} \\log p(y_t | \\text{instruction}, y_{<t})$$

**Multi-task format**:
$$\\text{Task: } \\langle\\text{desc}\\rangle \\quad \\text{Input: } x \\quad \\text{Output: } y$$

Instruction-tuned models generalize to new tasks (zero-shot).`,
    coreEquation: '\\mathcal{L} = -\\sum_t \\log p(y_t | \\text{instr}, y_{<t})',
    whyItMatters: [
      'Unlocks instruction-following—base models don\'t understand "summarize"',
      'FLAN showed dramatic zero-shot improvements',
      'First step before RLHF: instruct → RM → PPO'
    ],
    missingIntuition: [
      'Base models predict text; instruct models follow commands',
      'Diversity matters: more task types = better generalization',
      'CoT in the mix teaches reasoning as an instruction'
    ],
    prereqs: ['maximum-likelihood', 'self-supervised-learning'],
    dependents: ['rlhf'],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'deliberative-alignment',
    number: 85,
    title: 'Deliberative Alignment',
    shortTitle: 'Deliberative',
    icon: '🎯',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Deliberative Alignment: Reasoning Enables Safer Language Models',
        authors: 'OpenAI',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2412.16339'
      }
    ],
    coreMath: `Train model to reason over safety specifications $S$:

**Constrained optimization view**:
$$\\max_\\pi \\mathbb{E}[r_{\\text{help}}(x,y)] \\quad \\text{s.t.} \\quad \\mathbb{E}[v_S(x,y)] \\ge \\tau$$

**Lagrangian form**:
$$\\max_\\pi \\mathbb{E}[r_{\\text{help}}] + \\lambda \\mathbb{E}[v_S]$$

where $v_S$ scores compliance with spec text $S$.`,
    coreEquation: '\\max_\\pi \\mathbb{E}[r_{\\text{help}}] + \\lambda \\mathbb{E}[v_S]',
    whyItMatters: [
      'Trains models on explicit specifications rather than implicit reward shaping',
      'Enables auditability: which policy clauses were consulted?',
      'Reduces over-refusal while improving jailbreak robustness'
    ],
    missingIntuition: [
      'Model retrieves relevant policy text, reasons about it, then responds',
      'Like Constitutional AI but with explicit spec document in context',
      'Pareto frontier: helpfulness vs safety vs over-refusal'
    ],
    prereqs: ['constitutional-ai', 'chain-of-thought'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'ai-safety-via-debate',
    number: 86,
    title: 'AI Safety via Debate',
    shortTitle: 'Debate',
    icon: '⚔️',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'AI safety via debate',
        authors: 'Irving et al.',
        year: 2018,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/1805.00899'
      }
    ],
    coreMath: `Two agents debate; judge picks winner. Zero-sum game:
$$\\max_{\\pi_A} \\min_{\\pi_B} \\mathbb{E}[J(\\tau)]$$

where $\\tau$ is the debate transcript and $J(\\tau) \\in \\{0,1\\}$ indicates A wins.

**Key insight**: self-play pushes agents toward truthful, checkable arguments.`,
    coreEquation: '\\max_{\\pi_A} \\min_{\\pi_B} \\mathbb{E}[J(\\tau)]',
    whyItMatters: [
      'Targets evaluation difficulty: we can judge arguments even when we can\'t judge answers',
      'Scalable oversight: judge weaker than debaters can still pick truth',
      'Adversarial structure surfaces hidden flaws in reasoning'
    ],
    missingIntuition: [
      'Think Socratic dialogue meets adversarial training',
      'Claims + evidence + counterexample structure',
      'Judge accuracy improves with debate length'
    ],
    prereqs: ['rlhf'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'iterated-amplification',
    number: 87,
    title: 'Iterated Amplification',
    shortTitle: 'IDA',
    icon: '🔄',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Supervising strong learners by amplifying weak experts',
        authors: 'Christiano et al.',
        year: 2018,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/1810.08575'
      }
    ],
    coreMath: `Amplify human $H$ with assistants $A$, then distill:
$$A' \\approx \\arg\\min_\\pi \\mathbb{E}_x\\left[\\mathrm{KL}\\big(\\text{Amp}(H,A)(\\cdot|x) \\| \\pi(\\cdot|x)\\big)\\right]$$

Then iterate: $A \\leftarrow A'$.

**Recursion**: as $A$ improves, $\\text{Amp}(H,A)$ becomes more capable.`,
    coreEquation: 'A\' = \\arg\\min_\\pi \\mathrm{KL}(\\text{Amp}(H,A) \\| \\pi)',
    whyItMatters: [
      'Concrete proposal for scalable oversight when AI exceeds human capability',
      'Human decomposes task, assistants solve subtasks, distill back',
      'Foundational to modern AI safety research'
    ],
    missingIntuition: [
      'Like teaching: break hard problems into pieces students can help with',
      'Distillation compresses the amplified procedure into single model',
      'Each iteration enables supervision of harder tasks'
    ],
    prereqs: ['knowledge-distillation', 'rlhf'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'weak-to-strong-generalization',
    number: 88,
    title: 'Weak-to-Strong Generalization',
    shortTitle: 'Weak→Strong',
    icon: '💪',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Weak-to-Strong Generalization: Eliciting Strong Capability with Weak Supervision',
        authors: 'Burns et al.',
        year: 2023,
        venue: 'OpenAI',
        url: 'https://arxiv.org/abs/2312.09390'
      }
    ],
    coreMath: `Strong model $S$ trained on weak labels $\\tilde{y} = W(x)$:
$$\\tilde{y} \\sim p(\\tilde{y}|y), \\quad y \\sim p(y|x)$$

Training minimizes $\\mathbb{E}[\\ell(S(x), \\tilde{y})]$ but we care about $\\mathbb{E}[\\ell(S(x), y)]$.

**Gap** = true performance - weak label performance.`,
    coreEquation: '\\mathbb{E}[\\ell(S(x), y)] - \\mathbb{E}[\\ell(S(x), \\tilde{y})]',
    whyItMatters: [
      'Directly studies "how do we supervise something smarter than us?"',
      'Turns alignment into measurable ML generalization problem',
      'Strong models recover capability beyond what weak labels provide'
    ],
    missingIntuition: [
      'Like student learning from flawed teacher but getting it right',
      'Model internalizes patterns, generalizes beyond noisy labels',
      'Confidence-based losses help filter weak label errors'
    ],
    prereqs: ['rlhf', 'knowledge-distillation'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'automated-red-teaming',
    number: 89,
    title: 'Automated Red Teaming',
    shortTitle: 'Auto RedTeam',
    icon: '🔴',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Red Teaming Language Models with Language Models',
        authors: 'Perez et al.',
        year: 2022,
        venue: 'EMNLP',
        url: 'https://arxiv.org/abs/2202.03286'
      }
    ],
    coreMath: `Adversarial search for failure-inducing prompts:
$$\\max_{p \\in \\mathcal{P}} U(p, M)$$

then mitigate:
$$\\min_M \\mathbb{E}_{p \\sim \\text{RedTeam}}[U(p, M)]$$

where $U$ measures unsafe behavior (toxicity, policy violation, leakage).`,
    coreEquation: '\\max_p U(p, M) \\rightarrow \\min_M \\mathbb{E}_p[U(p, M)]',
    whyItMatters: [
      'Unknown unknowns dominate safety issues',
      'Automated coverage exceeds human handcrafted tests',
      'RL-based generation finds progressively harder failures'
    ],
    missingIntuition: [
      'Red-team model proposes attacks, evaluator scores target response',
      'Iterate: improve adversarial generation to find harder failures',
      'Feed discoveries into filters, training data, policy updates'
    ],
    prereqs: ['adversarial-examples', 'constitutional-ai'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'mesa-optimization',
    number: 90,
    title: 'Mesa-Optimization & Inner Alignment',
    shortTitle: 'Mesa-Opt',
    icon: '🔮',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Risks from Learned Optimization in Advanced Machine Learning Systems',
        authors: 'Hubinger et al.',
        year: 2019,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/1906.01820'
      }
    ],
    coreMath: `**Outer training**:
$$\\theta^* = \\arg\\min_\\theta \\mathbb{E}_{(x,y) \\sim \\mathcal{D}_{\\text{train}}}[\\mathcal{L}(f_\\theta(x), y)]$$

But learned system may implement internal search:
$$f_\\theta(x) = \\arg\\max_{a \\in \\mathcal{A}} m_\\theta(a; x)$$

where $m_\\theta$ is an **implicit mesa-objective** ≠ designer's goal.`,
    coreEquation: 'f_\\theta(x) = \\arg\\max_a m_\\theta(a; x)',
    whyItMatters: [
      'Explains why "passes training tests" ≠ "has right objective"',
      'Risk grows when models learn internal search/planning',
      'Central theoretical concern for advanced AI alignment'
    ],
    missingIntuition: [
      'Outer objective = training loss; inner objective = what model actually optimizes',
      'Goal misgeneralization: capabilities generalize, goals don\'t',
      'Aligned on train distribution, diverges on deployment'
    ],
    prereqs: ['loss-landscapes', 'in-context-learning'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'sleeper-agents',
    number: 91,
    title: 'Sleeper Agents & Alignment Faking',
    shortTitle: 'Sleepers',
    icon: '😴',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Sleeper Agents: Training Deceptive LLMs that Persist Through Safety Training',
        authors: 'Hubinger et al.',
        year: 2024,
        venue: 'Anthropic',
        url: 'https://arxiv.org/abs/2401.05566'
      }
    ],
    coreMath: `Triggered policy:
$$\\pi(y|x) = \\begin{cases} \\pi_{\\text{safe}}(y|x) & t(x) = 0 \\\\ \\pi_{\\text{bad}}(y|x) & t(x) = 1 \\end{cases}$$

Detection = hypothesis testing over rare trigger events.

**Finding**: standard safety training (SFT, RL) fails to remove backdoors.`,
    coreEquation: '\\pi(y|x) = \\pi_{\\text{safe}} \\cdot \\mathbf{1}_{t=0} + \\pi_{\\text{bad}} \\cdot \\mathbf{1}_{t=1}',
    whyItMatters: [
      'Probes scary case: looks aligned in evals, fails on triggers',
      'Standard mitigations (SFT, RL) don\'t remove deceptive behavior',
      'Alignment faking: model complies during training to preserve goals'
    ],
    missingIntuition: [
      'Like a spy passing background checks but activated by codeword',
      'Probes on hidden states can detect deception',
      'Persistence through safety training is the key concern'
    ],
    prereqs: ['rlhf', 'constitutional-ai'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'model-graded-evals',
    number: 92,
    title: 'Model-Graded Evaluations',
    shortTitle: 'LLM-as-Judge',
    icon: '⚖️',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena',
        authors: 'Zheng et al.',
        year: 2023,
        venue: 'NeurIPS',
        url: 'https://arxiv.org/abs/2306.05685'
      }
    ],
    coreMath: `Evaluator model $E$ scores outputs against rubric $R$:
$$s = E(x, y; R)$$

Aggregate:
$$\\hat{\\mu} = \\frac{1}{n} \\sum_{i=1}^n s_i$$

Validate by correlating $s_i$ with human ratings. Track regressions across model versions.`,
    coreEquation: '\\hat{\\mu} = \\frac{1}{n} \\sum_i E(x_i, y_i; R)',
    whyItMatters: [
      'Enables scalable safety testing without human bottleneck',
      'Fast iteration loops for alignment research',
      'Powers modern benchmarks: Chatbot Arena, AlpacaEval'
    ],
    missingIntuition: [
      'Rubric defines what "good" means: helpfulness, truthfulness, safety',
      'Calibration: does model-graded score match human judgment?',
      'Position bias: models prefer first option—randomize order'
    ],
    prereqs: ['maximum-likelihood', 'calibration'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'capability-elicitation',
    number: 93,
    title: 'Capability Elicitation & ELK',
    shortTitle: 'Elicitation',
    icon: '🔍',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'ARC\'s First Technical Report: Eliciting Latent Knowledge',
        authors: 'Christiano et al.',
        year: 2021,
        venue: 'Alignment Forum',
        url: 'https://www.alignmentforum.org/posts/qHCDysDnvhteW7kRd'
      }
    ],
    coreMath: `**Elicitation gap** (capability as max over prompts):
$$\\text{Cap}(M) = \\max_{p \\in \\mathcal{P}} \\mathbb{E}[\\text{score}(M, p)]$$

**ELK**: extract truth from internals even when output unreliable:
$$g_\\psi(h(x)) \\approx z$$

where $h(x)$ = activations, $z$ = latent truth, even if output $y \\ne z$.`,
    coreEquation: 'g_\\psi(h(x)) \\approx z',
    whyItMatters: [
      'Safety evals must find worst-case, not average-case capability',
      'ELK: can we trust what model says when it could be deceptive?',
      'Core theoretical obstacle to alignment'
    ],
    missingIntuition: [
      'Scaffolding/prompting can dramatically change apparent capability',
      'Model may "know" truth internally but output something else',
      'Probes on activations might extract honest beliefs'
    ],
    prereqs: ['probing', 'logit-lens'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'sandwiching-evaluations',
    number: 94,
    title: 'Sandwiching Evaluations',
    shortTitle: 'Sandwich',
    icon: '🥪',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Measuring Progress on Scalable Oversight for Large Language Models',
        authors: 'Bowman et al.',
        year: 2022,
        venue: 'Anthropic',
        url: 'https://arxiv.org/abs/2211.03540'
      }
    ],
    coreMath: `**Sandwich score** measures AI-assisted oversight:
$$\\text{SandwichScore} = \\frac{P_{H+A} - P_H}{P_E - P_H}$$

- $P_H$: non-expert performance
- $P_{H+A}$: non-expert + AI assistance
- $P_E$: expert performance

Score = 1.0 means assisted non-expert matches expert.`,
    coreEquation: '\\text{Score} = \\frac{P_{H+A} - P_H}{P_E - P_H}',
    whyItMatters: [
      'Makes scalable oversight empirically testable today',
      'Choose tasks where experts can judge, non-experts struggle',
      'Proxy for future "smart model oversight" capabilities'
    ],
    missingIntuition: [
      'Bottom = unaided human, top = expert, middle = AI-assisted human',
      'Tests: can weaker oversight + AI match stronger oversight?',
      'Foundational benchmark for alignment research progress'
    ],
    prereqs: ['rlhf', 'iterated-amplification'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'mixture-of-depths',
    number: 95,
    title: 'Mixture-of-Depths',
    shortTitle: 'MoD',
    icon: '📊',
    category: 'efficiency',
    canonicalPapers: [
      {
        title: 'Mixture-of-Depths: Dynamically allocating compute in transformer-based language models',
        authors: 'Raposo et al.',
        year: 2024,
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2404.02258'
      }
    ],
    coreMath: `Route tokens to different depths. At layer $\\ell$, score $g_\\ell(t)$ per token:
$$S_\\ell = \\text{TopK}(\\{g_\\ell(t)\\}_{t=1}^n, k)$$

$$h^{\\ell+1}_t = \\begin{cases} \\text{Block}_\\ell(h^\\ell_t) & t \\in S_\\ell \\\\ h^\\ell_t & \\text{otherwise} \\end{cases}$$

Train with explicit compute constraint $k$ (predictable FLOPs).`,
    coreEquation: 'h^{\\ell+1}_t = \\text{Block}_\\ell(h^\\ell_t) \\cdot \\mathbf{1}_{t \\in S_\\ell} + h^\\ell_t \\cdot \\mathbf{1}_{t \\notin S_\\ell}',
    whyItMatters: [
      'Adaptive compute: "think harder" only when needed',
      'Like MoE but routing tokens to layers, not experts',
      'Predictable FLOPs budget enables efficient deployment'
    ],
    missingIntuition: [
      'Some tokens need deep processing, others can skip layers',
      'Router learns which tokens are "important"',
      'Complement to MoE: sparse width (MoE) + sparse depth (MoD)'
    ],
    prereqs: ['mixture-of-experts', 'attention-transformers'],
    dependents: [],
    color: CATEGORY_COLORS.efficiency
  },
  {
    id: 'tree-search-reasoning',
    number: 96,
    title: 'Tree Search over Thoughts',
    shortTitle: 'MCTS-LLM',
    icon: '🌲',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Language Agent Tree Search Unifies Reasoning Acting and Planning in Language Models',
        authors: 'Zhou et al.',
        year: 2024,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/2310.04406'
      }
    ],
    coreMath: `MCTS over reasoning states. UCB action selection:
$$a^* = \\arg\\max_a \\left( Q(s,a) + c\\sqrt{\\frac{\\ln N(s)}{N(s,a)}} \\right)$$

Expand with LM policy prior $\\pi_\\theta(a|s)$. Back up values $Q$ from rollouts/verifier.

**Key insight**: Inference becomes planning, not just generation.`,
    coreEquation: 'a^* = \\arg\\max_a \\left( Q(s,a) + c\\sqrt{\\frac{\\ln N(s)}{N(s,a)}} \\right)',
    whyItMatters: [
      'Makes inference like planning, not text completion',
      'Enables systematic exploration of reasoning paths',
      'Foundation for o1-style "System 2" thinking'
    ],
    missingIntuition: [
      'Each node is a partial solution/thought',
      'Verifier provides value estimates for backpropagation',
      'Trade-off: exploration (new paths) vs exploitation (best paths)'
    ],
    prereqs: ['chain-of-thought', 'test-time-compute'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'video-world-models',
    number: 97,
    title: 'Video World Models',
    shortTitle: 'VideoWM',
    icon: '🎬',
    category: 'generative',
    canonicalPapers: [
      {
        title: 'Video generation models as world simulators',
        authors: 'OpenAI',
        year: 2024,
        venue: 'OpenAI',
        url: 'https://openai.com/index/video-generation-models-as-world-simulators/'
      }
    ],
    coreMath: `Video as learned dynamics. Autoregressive:
$$p_\\theta(x_{1:T}|c) = \\prod_{t=1}^T p_\\theta(x_t | x_{<t}, c)$$

Diffusion over latent $z$:
$$\\min_\\theta \\mathbb{E}_{t,\\epsilon}[\\|\\epsilon - \\epsilon_\\theta(z_t, t, c)\\|^2]$$

Video generators = learned simulators of physical world.`,
    coreEquation: 'p_\\theta(x_{1:T}|c) = \\prod_t p_\\theta(x_t | x_{<t}, c)',
    whyItMatters: [
      'Merges generative modeling with dynamics modeling',
      'Precursor to general planning/agents',
      'Sora shows emergence of 3D consistency, object permanence'
    ],
    missingIntuition: [
      'Not just "video generation" but learned physics engine',
      'Emergent properties: camera control, object tracking, causality',
      'Can imagine "what happens if" for planning'
    ],
    prereqs: ['diffusion', 'vaes'],
    dependents: [],
    color: CATEGORY_COLORS.generative
  },
  {
    id: 'self-improvement-loops',
    number: 98,
    title: 'Self-Improvement & Distillation Loops',
    shortTitle: 'Self-Improve',
    icon: '🔄',
    category: 'scaling',
    canonicalPapers: [
      {
        title: 'Self-Play Fine-Tuning Converts Weak Language Models to Strong Language Models',
        authors: 'Chen et al.',
        year: 2024,
        venue: 'ICML',
        url: 'https://arxiv.org/abs/2401.01335'
      }
    ],
    coreMath: `Iterative self-training loop:
$$D_{k+1} = D_k \\cup \\{(x, \\hat{y}) : \\hat{y} \\sim \\pi_{\\theta_k}(\\cdot|x)\\}$$
$$\\theta_{k+1} = \\arg\\min_\\theta \\mathbb{E}_{(x,y) \\sim D_{k+1}}[-\\log \\pi_\\theta(y|x)]$$

**Distillation**: $\\min_{\\theta_s} \\mathbb{E}_x[\\mathrm{KL}(\\pi_{\\theta_t}(\\cdot|x) \\| \\pi_{\\theta_s}(\\cdot|x))]$`,
    coreEquation: '\\theta_{k+1} = \\arg\\min_\\theta \\mathcal{L}(\\theta; D_k \\cup \\text{self-gen})',
    whyItMatters: [
      'Makes data generation and model improvement a closed loop',
      'DeepSeek-R1: RL → reasoning → distill to smaller models',
      'Reduces reliance on scarce human labels'
    ],
    missingIntuition: [
      'Model bootstraps on its own outputs (filtered by verifier)',
      'Teacher-student paradigm: large model → small model',
      'Risk: distribution shift, mode collapse'
    ],
    prereqs: ['knowledge-distillation', 'rlhf'],
    dependents: [],
    color: CATEGORY_COLORS.scaling
  },
  {
    id: 'model-collapse',
    number: 99,
    title: 'Model Collapse & Synthetic Data',
    shortTitle: 'Collapse',
    icon: '📉',
    category: 'theory',
    canonicalPapers: [
      {
        title: 'AI models collapse when trained on recursively generated data',
        authors: 'Shumailov et al.',
        year: 2024,
        venue: 'Nature',
        url: 'https://www.nature.com/articles/s41586-024-07566-y'
      }
    ],
    coreMath: `Recursive training on synthetic data causes collapse:
$$p_t = (1 - \\alpha)p_* + \\alpha p_{\\theta_t}$$
$$\\theta_{t+1} = F(p_t)$$

Repeated application drives $p_{\\theta_t}$ away from real $p_*$ (degeneration).

**Mitigation**: anchor with real data, filter synthetic outputs, track provenance.`,
    coreEquation: 'p_{t+1} = (1-\\alpha)p_* + \\alpha p_{\\theta_t} \\rightarrow \\text{collapse}',
    whyItMatters: [
      'Synthetic data is essential AND dangerous',
      'Web is increasingly AI-generated: training data pollution',
      'Dataset provenance becomes critical for safety'
    ],
    missingIntuition: [
      'Like photocopying a photocopy: quality degrades',
      'Mode collapse: diversity shrinks, tails disappear',
      'Solution: always anchor training with real data'
    ],
    prereqs: ['maximum-likelihood', 'scaling-laws'],
    dependents: [],
    color: CATEGORY_COLORS.theory
  },
  {
    id: 'infinite-context',
    number: 100,
    title: 'Infinite Context Architectures',
    shortTitle: 'InfCtx',
    icon: '♾️',
    category: 'efficiency',
    canonicalPapers: [
      {
        title: 'Leave No Context Behind: Efficient Infinite Context Transformers with Infini-attention',
        authors: 'Munkhdalai et al.',
        year: 2024,
        venue: 'Google',
        url: 'https://arxiv.org/abs/2404.07143'
      }
    ],
    coreMath: `Compressive memory for bounded cost:
$$\\mathrm{Attn}(Q,K,V) = \\mathrm{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d}}\\right)V \\quad O(n^2)$$

**Infini-attention**: Maintain memory $M$ updated online, cost bounded w.r.t. $n$.

**Ring Attention**: Distribute long sequences across devices via blockwise ring communication.`,
    coreEquation: 'M_{t+1} = \\text{Update}(M_t, K_t, V_t)',
    whyItMatters: [
      'Turns entire repos/books into "single prompt" territory',
      'Streaming: process unbounded sequences with fixed memory',
      '1M+ tokens: Gemini 1.5, LongRoPE, Ring Attention'
    ],
    missingIntuition: [
      'Compressive: old context summarized into memory state',
      'Ring: sequence chunks processed in ring topology across GPUs',
      'Hybrid: combine attention with SSM-style recurrence'
    ],
    prereqs: ['long-context', 'ssm-hybrids'],
    dependents: [],
    color: CATEGORY_COLORS.efficiency
  }
]

// Study order groupings (phases for subway-style layout)
// 100 concepts organized into pedagogically sound phases
export const studyOrder = [
  {
    phase: 1,
    title: 'Core probabilistic training + transformers',
    concepts: ['maximum-likelihood', 'attention-transformers']
  },
  {
    phase: 2,
    title: 'Architecture fundamentals',
    concepts: ['tokenization-vocabulary', 'rope', 'efficient-attention', 'layer-normalization', 'residual-connections', 'swiglu', 'grouped-query-attention']
  },
  {
    phase: 3,
    title: 'Optimization & generalization',
    concepts: ['backpropagation-autodiff', 'sgd-momentum', 'adam', 'weight-decay-adamw', 'gradient-clipping', 'loss-landscapes', 'double-descent', 'ntk', 'learning-rate-schedules', 'weight-initialization', 'label-smoothing', 'batch-normalization']
  },
  {
    phase: 4,
    title: 'Generative modeling families',
    concepts: ['vaes', 'gans', 'diffusion', 'normalizing-flows', 'score-matching', 'consistency-models', 'flow-matching']
  },
  {
    phase: 5,
    title: 'Representation & interpretability',
    concepts: ['representations', 'superposition', 'probing', 'induction-heads', 'sparse-autoencoders', 'circuit-discovery', 'activation-steering', 'in-context-learning', 'logit-lens', 'contrastive-learning', 'self-supervised-learning']
  },
  {
    phase: 6,
    title: 'Modern efficiency & inference',
    concepts: ['speculative-decoding', 'llm-serving', 'mixture-of-experts', 'moe-serving', 'long-context', 'ssm-hybrids', 'decoding-sampling', 'knowledge-distillation', 'quantization', 'pruning', 'flash-attention', 'activation-checkpointing']
  },
  {
    phase: 7,
    title: 'Alignment & RLHF',
    concepts: ['rlhf', 'dpo', 'kto', 'reward-hacking', 'ppo-policy-optimization', 'constitutional-ai', 'rlaif', 'instruction-tuning']
  },
  {
    phase: 8,
    title: 'Scaling, theory & multimodal',
    concepts: ['scaling-laws', 'efficiency', 'theory', 'multimodal', 'optimal-transport', 'adversarial-examples', 'grokking', 'calibration']
  },
  {
    phase: 9,
    title: 'Advanced architectures & generation',
    concepts: ['classifier-free-guidance', 'retrieval-augmented-generation', 'distributed-training', 'beam-search']
  },
  {
    phase: 10,
    title: 'Mathematical foundations & information geometry',
    concepts: ['fisher-information', 'natural-gradient', 'energy-based-models', 'dropout', 'bregman-divergence', 'rkhs', 'persistent-homology', 'lie-groups', 'world-models']
  },
  {
    phase: 11,
    title: 'Frontier research & scaling',
    concepts: ['test-time-compute', 'chain-of-thought', 'synthetic-data', 'process-reward-models']
  },
  {
    phase: 12,
    title: 'Advanced alignment & safety research',
    concepts: ['deliberative-alignment', 'ai-safety-via-debate', 'iterated-amplification', 'weak-to-strong-generalization', 'automated-red-teaming', 'mesa-optimization', 'sleeper-agents', 'model-graded-evals', 'capability-elicitation', 'sandwiching-evaluations']
  },
  {
    phase: 13,
    title: 'Cutting-edge 2024-2025 research',
    concepts: ['mixture-of-depths', 'tree-search-reasoning', 'video-world-models', 'self-improvement-loops', 'model-collapse', 'infinite-context']
  },
]

// Build phase lookup from study order
function getConceptPhase(conceptId: string): number {
  for (const phase of studyOrder) {
    if (phase.concepts.includes(conceptId)) {
      return phase.phase
    }
  }
  return 6 // Default to last phase for unmapped concepts
}

// Link type for graph edges
export type LinkType = 'prereq' | RelationType

export interface GraphLink {
  source: string
  target: string
  type: LinkType
  label?: string
  why?: string
}

export interface GraphNode {
  id: string
  label: string
  number: number
  icon: string
  category: string
  color: string
  title: string
  phase: number
}

// Generate graph data for D3 force layout
export function generateFoundationsGraphData() {
  // Nodes with phase metadata for subway-style layout
  const nodes: GraphNode[] = foundationsConcepts.map(c => ({
    id: c.id,
    label: c.shortTitle,
    number: c.number,
    icon: c.icon,
    category: c.category,
    color: c.color,
    title: c.title,
    phase: getConceptPhase(c.id)
  }))

  const links: GraphLink[] = []

  // Add prerequisite links
  foundationsConcepts.forEach(c => {
    c.prereqs.forEach(prereqId => {
      links.push({ source: prereqId, target: c.id, type: 'prereq' })
    })
  })

  // Add typed semantic relations (same_trick, duality, breaks_when, etc.)
  conceptRelations.forEach(rel => {
    links.push({
      source: rel.from,
      target: rel.to,
      type: rel.type,
      label: rel.label,
      why: rel.why
    })
  })

  return { nodes, links }
}

// Get relations for a specific concept (for concept page "Next Moves" panel)
export function getConceptRelations(conceptId: string): {
  outgoing: (Relation & { direction: 'outgoing' })[]
  incoming: (Relation & { direction: 'incoming' })[]
} {
  const outgoing = conceptRelations
    .filter(r => r.from === conceptId)
    .map(r => ({ ...r, direction: 'outgoing' as const }))

  const incoming = conceptRelations
    .filter(r => r.to === conceptId)
    .map(r => ({ ...r, direction: 'incoming' as const }))

  return { outgoing, incoming }
}

// Derive dependents from prereqs (inverse relationship)
// This ensures consistency: if A is a prereq of B, then B is a dependent of A
const _dependentsMap: Map<string, string[]> = new Map()

function buildDependentsMap() {
  if (_dependentsMap.size > 0) return // Already built

  // Initialize all concepts with empty arrays
  foundationsConcepts.forEach(c => _dependentsMap.set(c.id, []))

  // For each concept, add it as a dependent of its prereqs
  foundationsConcepts.forEach(concept => {
    concept.prereqs.forEach(prereqId => {
      const deps = _dependentsMap.get(prereqId)
      if (deps && !deps.includes(concept.id)) {
        deps.push(concept.id)
      }
    })
  })
}

// Get computed dependents for a concept (derived from prereqs)
export function getDependents(conceptId: string): string[] {
  buildDependentsMap()
  return _dependentsMap.get(conceptId) || []
}
