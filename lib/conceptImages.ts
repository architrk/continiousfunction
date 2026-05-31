export type ConceptImage = {
  src: string
  alt: string
}

const conceptImages: Record<string, ConceptImage> = {
  'dot-product': {
    src: '/images/concepts/linear-algebra/dot-product-cover.png',
    alt: 'Editorial mathematical illustration of two vectors, their angle, and a projection shadow.',
  },
  'vector-spaces': {
    src: '/images/concepts/linear-algebra/vector-spaces-cover.png',
    alt: 'Editorial mathematical illustration of basis vectors spanning a translucent vector-space sheet.',
  },
  'gradient-descent': {
    src: '/images/concepts/optimization/gradient-descent-cover.png',
    alt: 'Editorial mathematical illustration of gradient descent steps moving through contour lines toward a minimum.',
  },
  adam: {
    src: '/images/concepts/optimization/adam-cover.png',
    alt: 'Editorial optimization illustration of adaptive Adam steps using momentum and second-moment scaling across a loss surface.',
  },
  'learning-rate-schedules': {
    src: '/images/concepts/optimization/learning-rate-schedules-cover.png',
    alt: 'Editorial optimization illustration of warmup, decay, and cycling learning-rate curves over training steps.',
  },
  'loss-landscapes': {
    src: '/images/concepts/optimization/loss-landscapes-cover.png',
    alt: 'Editorial optimization illustration of contour loss basins, sharp and flat minima, and descent trajectories.',
  },
  derivatives: {
    src: '/images/concepts/calculus/derivatives-cover.png',
    alt: 'Editorial calculus illustration of a curve, secant line, tangent slope, and local rate-of-change marker.',
  },
  'computation-graphs': {
    src: '/images/concepts/calculus/computation-graphs-cover.png',
    alt: 'Editorial autodiff illustration of computation graph nodes with forward value flow and backward sensitivity arrows.',
  },
  'reverse-mode-autodiff': {
    src: '/images/concepts/calculus/reverse-mode-autodiff-cover.png',
    alt: 'Editorial autodiff illustration of a forward tape and reverse cotangent sweep through computation nodes.',
  },
  backpropagation: {
    src: '/images/concepts/calculus/backpropagation-cover.png',
    alt: 'Editorial neural-network illustration of activations flowing forward and error signals propagating backward through layers.',
  },
  'probability-basics': {
    src: '/images/concepts/probability/probability-basics-cover.png',
    alt: 'Editorial probability illustration of a sample space, overlapping event regions, probability mass, and conditional renormalization cues.',
  },
  'random-variables': {
    src: '/images/concepts/probability/random-variables-cover.png',
    alt: 'Editorial probability illustration of raw outcomes flowing through a measurement map into a discrete value distribution.',
  },
  distributions: {
    src: '/images/concepts/probability/distributions-cover.png',
    alt: 'Editorial probability illustration of probability mass pushed through a random variable into PMF bars and density curves.',
  },
  'maximum-likelihood': {
    src: '/images/concepts/probability/maximum-likelihood-cover.png',
    alt: 'Editorial probability illustration of Bernoulli observations, a likelihood curve, and a model parameter moving toward the empirical optimum.',
  },
  'bayesian-inference': {
    src: '/images/concepts/probability/bayesian-inference-cover.png',
    alt: 'Editorial probability illustration of prior and likelihood curves combining into a sharper posterior belief.',
  },
  'cross-entropy': {
    src: '/images/concepts/probability/cross-entropy-cover.png',
    alt: 'Editorial probability illustration comparing two categorical distributions with mismatch ribbons.',
  },
  'kl-divergence': {
    src: '/images/concepts/information-theory/kl-divergence-cover.png',
    alt: 'Editorial information-theory illustration of two probability distributions with asymmetric mismatch regions and local contribution bars.',
  },
  rlhf: {
    src: '/images/concepts/alignment/rlhf-cover.png',
    alt: 'Editorial alignment illustration of human preference feedback shaping a reward landscape and updating a policy distribution.',
  },
  dpo: {
    src: '/images/concepts/alignment/dpo-cover.png',
    alt: 'Editorial alignment illustration of a direct preference comparison tilting chosen and rejected probability paths.',
  },
  kto: {
    src: '/images/concepts/alignment/kto-cover.png',
    alt: 'Editorial alignment illustration of pointwise desirable and undesirable feedback shaped by an asymmetric value curve.',
  },
  'reward-hacking': {
    src: '/images/concepts/alignment/reward-hacking-cover.png',
    alt: 'Editorial alignment illustration of a proxy reward path climbing the wrong hill while missing the true intended goal.',
  },
  'process-reward-models': {
    src: '/images/concepts/alignment/process-reward-models-cover.png',
    alt: 'Editorial alignment illustration of a branching reasoning trace with step-level verifier scores and a fading invalid path.',
  },
  vaes: {
    src: '/images/concepts/generative-models/vaes-cover.png',
    alt: 'Editorial generative-model illustration of data encoded into a latent distribution and decoded back into reconstructed samples.',
  },
  diffusion: {
    src: '/images/concepts/generative-models/diffusion-cover.png',
    alt: 'Editorial generative-model illustration of noisy samples following a reverse denoising trajectory toward a structured data manifold.',
  },
  'normalizing-flows': {
    src: '/images/concepts/generative-models/normalizing-flows-cover.png',
    alt: 'Editorial generative-model illustration of an invertible grid warp with local volume-correction patches.',
  },
  'flow-matching': {
    src: '/images/concepts/generative-models/flow-matching-cover.png',
    alt: 'Editorial generative-model illustration of particles transported by a learned velocity field from noise into a target distribution.',
  },
  'score-matching': {
    src: '/images/concepts/generative-models/score-matching-cover.png',
    alt: 'Editorial generative-model illustration of noisy samples and score-vector fields pointing back toward high-density structure.',
  },
  representations: {
    src: '/images/concepts/representation-learning/representations-cover.png',
    alt: 'Editorial representation-learning illustration of embedding clusters, geometric neighborhoods, and feature directions.',
  },
  'sparse-autoencoders': {
    src: '/images/concepts/representation-learning/sparse-autoencoders-cover.png',
    alt: 'Editorial interpretability illustration of dense activations routed through sparse feature dictionary atoms and reconstructed outputs.',
  },
  efficiency: {
    src: '/images/concepts/efficiency/efficiency-cover.png',
    alt: 'Editorial efficiency illustration of model compression, memory bandwidth, sparse routing, and speed-quality tradeoff curves.',
  },
  'knowledge-distillation': {
    src: '/images/concepts/efficiency/knowledge-distillation-cover.png',
    alt: 'Editorial efficiency illustration of a larger teacher model transferring softened probability structure into a smaller student model.',
  },
  'mixture-of-experts': {
    src: '/images/concepts/efficiency/mixture-of-experts-cover.png',
    alt: 'Editorial efficiency illustration of tokens routed sparsely into expert blocks with load imbalance and routing paths.',
  },
  pruning: {
    src: '/images/concepts/efficiency/pruning-cover.png',
    alt: 'Editorial efficiency illustration of a dense weight grid being pruned into a smaller sparse structure.',
  },
  quantization: {
    src: '/images/concepts/efficiency/quantization-cover.png',
    alt: 'Editorial efficiency illustration of smooth weights snapped to discrete integer levels with quantization error cues.',
  },
  'attention-transformers': {
    src: '/images/concepts/attention-transformers/attention-transformers-cover.png',
    alt: 'Editorial transformer illustration of token rows, an attention score matrix, and routed attention paths.',
  },
  'efficient-attention': {
    src: '/images/concepts/attention-transformers/efficient-attention-cover.png',
    alt: 'Editorial transformer-systems illustration of KV-cache sharing, grouped query lanes, and reduced memory bandwidth.',
  },
  'layer-normalization': {
    src: '/images/concepts/attention-transformers/layer-normalization-cover.png',
    alt: 'Editorial transformer illustration of activation vectors being centered, scaled, and stabilized by normalization.',
  },
  'flash-attention': {
    src: '/images/concepts/attention-transformers/flash-attention-cover.png',
    alt: 'Editorial transformer-systems illustration of tiled attention streaming through a compact on-chip scratchpad without materializing the full matrix.',
  },
  rope: {
    src: '/images/concepts/attention-transformers/rope-cover.png',
    alt: 'Editorial transformer illustration of rotary position vectors, relative phase arcs, and query-key geometry.',
  },
  'long-context': {
    src: '/images/concepts/attention-transformers/long-context-cover.png',
    alt: 'Editorial long-context illustration of a stretched token scroll, rotary position arcs, and paged KV-cache blocks with selective long-range links.',
  },
  'tokenization-vocabulary': {
    src: '/images/concepts/attention-transformers/tokenization-vocabulary-cover.png',
    alt: 'Editorial tokenizer illustration of text fragments becoming token blocks, merge paths, and vocabulary entries.',
  },
  'ssm-hybrids': {
    src: '/images/concepts/attention-transformers/ssm-hybrids-cover.png',
    alt: 'Notebook-style concept illustration showing a growing ribbon of explicit cache memory alongside a compact recurrent state carried forward through time, with selective write-copy-forget gating and a small local attention region near the current step.',
  },
  'llm-serving': {
    src: '/images/concepts/llm-systems/llm-serving-cover.png',
    alt: 'Editorial systems illustration of prefill, KV cache shelves, continuous batching lanes, and decode token streams.',
  },
  'decoding-sampling': {
    src: '/images/concepts/llm-systems/decoding-sampling-cover.png',
    alt: 'Editorial LLM-systems illustration of logit distributions, top-p filtering, temperature shaping, and sampled token paths.',
  },
  'speculative-decoding': {
    src: '/images/concepts/llm-systems/speculative-decoding-cover.png',
    alt: 'Editorial systems illustration of draft tokens passing through verifier gates with accepted and rejected branches.',
  },
  'moe-serving': {
    src: '/images/concepts/llm-systems/moe-serving-cover.png',
    alt: 'Editorial systems illustration of sparse token routing across experts with all-to-all exchange and a straggler bottleneck.',
  },
  'structured-decoding': {
    src: '/images/concepts/llm-systems/structured-decoding-cover.png',
    alt: 'Editorial systems illustration of an automaton gating valid token paths.',
  },
  'test-time-compute': {
    src: '/images/concepts/scaling/test-time-compute-cover.png',
    alt: 'Editorial scaling illustration of branching candidate traces scored by verifier gauges and selected through a budgeted funnel.',
  },
  'double-descent': {
    src: '/images/concepts/scaling/double-descent-cover.png',
    alt: 'Editorial scaling illustration of a double-descent generalization curve with interpolation threshold and second descent.',
  },
  ntk: {
    src: '/images/concepts/scaling/ntk-cover.png',
    alt: 'Editorial scaling illustration of a neural tangent kernel matrix, infinite-width curve, and function-space dynamics.',
  },
  'scaling-laws': {
    src: '/images/concepts/scaling/scaling-laws-cover.png',
    alt: 'Editorial scaling-laws illustration of empirical power-law curves, compute contours, and a highlighted compute-optimal frontier point.',
  },
  'pretraining-data-mixtures': {
    src: '/images/concepts/scaling/pretraining-data-mixtures-cover.png',
    alt: 'Notebook-style concept illustration showing raw web, math, code, and multilingual source streams passing through filtering, deduplication, mixture-weight controls, and separate leakage diagnostics into an effective token distribution.',
  },
  'tree-search-reasoning': {
    src: '/images/concepts/scaling/tree-search-reasoning-cover.png',
    alt: 'Editorial reasoning illustration of selective tree expansion, verifier gauges, budget ticks, and value backup arrows.',
  },
}

export const getConceptImage = (conceptId: string): ConceptImage | null => conceptImages[conceptId] ?? null
