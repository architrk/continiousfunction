import { loadConceptMetas } from './contentLoader'

describe('content loader', () => {
  it('loads structured claim checks from concept metadata', () => {
    const moe = loadConceptMetas().find((concept) => concept.id === 'moe-serving')
    const flashAttention = loadConceptMetas().find((concept) => concept.id === 'flash-attention')
    const speculativeDecoding = loadConceptMetas().find((concept) => concept.id === 'speculative-decoding')
    const structuredDecoding = loadConceptMetas().find((concept) => concept.id === 'structured-decoding')
    const llmServing = loadConceptMetas().find((concept) => concept.id === 'llm-serving')
    const decodingSampling = loadConceptMetas().find((concept) => concept.id === 'decoding-sampling')
    const attentionTransformers = loadConceptMetas().find((concept) => concept.id === 'attention-transformers')
    const layerNormalization = loadConceptMetas().find((concept) => concept.id === 'layer-normalization')
    const tokenizationVocabulary = loadConceptMetas().find((concept) => concept.id === 'tokenization-vocabulary')
    const efficiencyOverview = loadConceptMetas().find((concept) => concept.id === 'efficiency')
    const efficientAttention = loadConceptMetas().find((concept) => concept.id === 'efficient-attention')
    const rope = loadConceptMetas().find((concept) => concept.id === 'rope')
    const longContext = loadConceptMetas().find((concept) => concept.id === 'long-context')
    const quantization = loadConceptMetas().find((concept) => concept.id === 'quantization')
    const knowledgeDistillation = loadConceptMetas().find((concept) => concept.id === 'knowledge-distillation')
    const pruning = loadConceptMetas().find((concept) => concept.id === 'pruning')
    const mixtureOfExperts = loadConceptMetas().find((concept) => concept.id === 'mixture-of-experts')
    const diffusion = loadConceptMetas().find((concept) => concept.id === 'diffusion')
    const scoreMatching = loadConceptMetas().find((concept) => concept.id === 'score-matching')
    const flowMatching = loadConceptMetas().find((concept) => concept.id === 'flow-matching')
    const normalizingFlows = loadConceptMetas().find((concept) => concept.id === 'normalizing-flows')
    const gradientDescent = loadConceptMetas().find((concept) => concept.id === 'gradient-descent')
    const maximumLikelihood = loadConceptMetas().find((concept) => concept.id === 'maximum-likelihood')
    const crossEntropy = loadConceptMetas().find((concept) => concept.id === 'cross-entropy')
    const distributions = loadConceptMetas().find((concept) => concept.id === 'distributions')
    const probabilityBasics = loadConceptMetas().find((concept) => concept.id === 'probability-basics')
    const randomVariables = loadConceptMetas().find((concept) => concept.id === 'random-variables')
    const bayesianInference = loadConceptMetas().find((concept) => concept.id === 'bayesian-inference')
    const klDivergence = loadConceptMetas().find((concept) => concept.id === 'kl-divergence')
    const vaes = loadConceptMetas().find((concept) => concept.id === 'vaes')
    const backpropagation = loadConceptMetas().find((concept) => concept.id === 'backpropagation')
    const reverseModeAutodiff = loadConceptMetas().find((concept) => concept.id === 'reverse-mode-autodiff')
    const computationGraphs = loadConceptMetas().find((concept) => concept.id === 'computation-graphs')
    const derivatives = loadConceptMetas().find((concept) => concept.id === 'derivatives')
    const dotProduct = loadConceptMetas().find((concept) => concept.id === 'dot-product')
    const vectorSpaces = loadConceptMetas().find((concept) => concept.id === 'vector-spaces')
    const adam = loadConceptMetas().find((concept) => concept.id === 'adam')
    const learningRateSchedules = loadConceptMetas().find((concept) => concept.id === 'learning-rate-schedules')
    const lossLandscapes = loadConceptMetas().find((concept) => concept.id === 'loss-landscapes')
    const representations = loadConceptMetas().find((concept) => concept.id === 'representations')
    const sparseAutoencoders = loadConceptMetas().find((concept) => concept.id === 'sparse-autoencoders')
    const ntk = loadConceptMetas().find((concept) => concept.id === 'ntk')
    const doubleDescent = loadConceptMetas().find((concept) => concept.id === 'double-descent')
    const scalingLaws = loadConceptMetas().find((concept) => concept.id === 'scaling-laws')
    const rlhf = loadConceptMetas().find((concept) => concept.id === 'rlhf')
    const dpo = loadConceptMetas().find((concept) => concept.id === 'dpo')
    const kto = loadConceptMetas().find((concept) => concept.id === 'kto')
    const processRewardModels = loadConceptMetas().find((concept) => concept.id === 'process-reward-models')
    const rewardHacking = loadConceptMetas().find((concept) => concept.id === 'reward-hacking')
    const testTimeCompute = loadConceptMetas().find((concept) => concept.id === 'test-time-compute')
    const treeSearchReasoning = loadConceptMetas().find((concept) => concept.id === 'tree-search-reasoning')

    expect(moe?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'sparse-routing-load-balance',
          status: 'source-checked',
          source_ids: ['shazeer-2017-sparsely-gated-moe', 'fedus-2021-switch-transformer', 'zhu-2025-megascale-infer'],
          object_refs: expect.arrayContaining(['#math-object-2', '#code-witness-1']),
        }),
      ])
    )
    expect(flashAttention?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'exact-io-aware-tiling',
          status: 'source-checked',
          source_ids: ['dao-2022-flashattention'],
          object_refs: expect.arrayContaining(['#source-span-dao-2022-flashattention', '#interactive-demo']),
        }),
      ])
    )
    expect(speculativeDecoding?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'draft-verify-lossless-distribution',
          status: 'source-checked',
          source_ids: ['leviathan-2022-speculative-decoding', 'chen-2023-speculative-sampling'],
          object_refs: expect.arrayContaining(['#source-span-leviathan-2022-speculative-decoding', '#code-witness-1']),
        }),
      ])
    )
    expect(structuredDecoding?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'schema-automaton-token-mask',
          status: 'source-checked',
          source_ids: ['willard-2023-guided-generation', 'geng-2025-jsonschemabench'],
          object_refs: expect.arrayContaining(['#source-span-willard-2023-guided-generation', '#interactive-demo']),
        }),
      ])
    )
    expect(llmServing?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'iteration-scheduling-kv-cache-memory',
          status: 'source-checked',
          source_ids: ['yu-2022-orca', 'kwon-2023-pagedattention'],
          object_refs: expect.arrayContaining(['#source-span-yu-2022-orca', '#code-witness-1']),
        }),
      ])
    )
    expect(decodingSampling?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'nucleus-sampling-distribution-control',
          status: 'source-checked',
          source_ids: ['holtzman-2019-nucleus'],
          object_refs: expect.arrayContaining(['#source-span-holtzman-2019-nucleus', '#interactive-demo']),
        }),
      ])
    )
    expect(attentionTransformers?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'scaled-dot-product-attention-value-mixing',
          status: 'source-checked',
          source_ids: ['vaswani-2017-attention'],
          object_refs: expect.arrayContaining(['#source-span-vaswani-2017-attention', '#math-object-2']),
        }),
      ])
    )
    expect(layerNormalization?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'per-token-centering-vs-rms-scaling',
          status: 'source-checked',
          source_ids: ['ba-2016-layer-normalization', 'zhang-2019-rmsnorm'],
          object_refs: expect.arrayContaining([
            '#source-span-ba-2016-layer-normalization',
            '#source-span-zhang-2019-rmsnorm',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(tokenizationVocabulary?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'subword-tokenization-segmentation-mechanics',
          status: 'source-checked',
          source_ids: ['sennrich-2015-bpe', 'kudo-2018-sentencepiece'],
          object_refs: expect.arrayContaining([
            '#source-span-sennrich-2015-bpe',
            '#source-span-kudo-2018-sentencepiece',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(efficiencyOverview?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'resource-levers-active-compute-trainable-params',
          status: 'source-checked',
          source_ids: ['sze-2017-efficient-dnn', 'hu-2021-lora', 'shazeer-2017-sparsely-gated-moe'],
          evidence_review: expect.objectContaining({
            state: 'substantive-reviewed',
            reviewer: 'codex+oracle',
          }),
          object_refs: expect.arrayContaining([
            '#source-span-sze-2017-efficient-dnn',
            '#source-span-hu-2021-lora',
            '#source-span-shazeer-2017-sparsely-gated-moe',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(efficientAttention?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'kv-cache-sharing-memory-bandwidth',
          status: 'source-checked',
          source_ids: ['shazeer-2019-mqa', 'ainslie-2023-gqa'],
          object_refs: expect.arrayContaining(['#source-span-shazeer-2019-mqa', '#interactive-demo']),
        }),
      ])
    )
    expect(rope?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'rotary-relative-position-dot-product',
          status: 'source-checked',
          source_ids: ['su-2021-roformer'],
          object_refs: expect.arrayContaining(['#source-span-su-2021-roformer', '#math-object-1']),
        }),
      ])
    )
    expect(longContext?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'position-extrapolation-plus-kv-memory',
          status: 'source-checked',
          source_ids: ['su-2021-roformer', 'press-2021-alibi', 'kwon-2023-pagedattention'],
          object_refs: expect.arrayContaining(['#source-span-press-2021-alibi', '#interactive-demo']),
        }),
      ])
    )
    expect(quantization?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'low-bit-scale-outlier-resolution',
          status: 'source-checked',
          source_ids: ['dettmers-2022-llm-int8', 'frantar-2022-gptq'],
          evidence_review: expect.objectContaining({
            state: 'substantive-reviewed',
            reviewer: 'codex+oracle',
          }),
          object_refs: expect.arrayContaining([
            '#source-span-dettmers-2022-llm-int8',
            '#source-span-frantar-2022-gptq',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(knowledgeDistillation?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'softened-teacher-kl-dark-knowledge',
          status: 'source-checked',
          source_ids: ['hinton-2015-distillation'],
          evidence_review: expect.objectContaining({
            state: 'substantive-reviewed',
            reviewer: 'codex+oracle',
          }),
          object_refs: expect.arrayContaining([
            '#source-span-hinton-2015-distillation',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(pruning?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'magnitude-mask-storage-vs-speed',
          status: 'source-checked',
          source_ids: ['han-2015-deep-compression', 'li-2016-pruning-filters'],
          evidence_review: expect.objectContaining({
            state: 'substantive-reviewed',
            reviewer: 'codex+oracle',
          }),
          object_refs: expect.arrayContaining([
            '#source-span-han-2015-deep-compression',
            '#source-span-li-2016-pruning-filters',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(mixtureOfExperts?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'top-k-routing-activated-compute-load-balance',
          status: 'source-checked',
          source_ids: ['shazeer-2017-sparsely-gated-moe', 'fedus-2021-switch-transformers'],
          object_refs: expect.arrayContaining([
            '#source-span-shazeer-2017-sparsely-gated-moe',
            '#source-span-fedus-2021-switch-transformers',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(diffusion?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'forward-noising-noise-prediction-score-bridge',
          status: 'source-checked',
          source_ids: ['sohl-dickstein-2015-nonequilibrium', 'ho-2020-ddpm', 'song-2020-score-sde'],
          object_refs: expect.arrayContaining([
            '#source-span-sohl-dickstein-2015-nonequilibrium',
            '#source-span-ho-2020-ddpm',
            '#source-span-song-2020-score-sde',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(scoreMatching?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'score-field-denoising-reverse-dynamics',
          status: 'source-checked',
          source_ids: ['hyvarinen-2005-score-matching', 'vincent-2011-denoising-score', 'song-2020-score-sde'],
          object_refs: expect.arrayContaining([
            '#source-span-hyvarinen-2005-score-matching',
            '#source-span-vincent-2011-denoising-score',
            '#source-span-song-2020-score-sde',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(flowMatching?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'velocity-regression-straight-path-target',
          status: 'source-checked',
          source_ids: ['lipman-2022-flow-matching', 'liu-2022-rectified-flow'],
          object_refs: expect.arrayContaining([
            '#source-span-lipman-2022-flow-matching',
            '#source-span-liu-2022-rectified-flow',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(normalizingFlows?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'invertible-change-of-variables-logdet',
          status: 'source-checked',
          source_ids: ['rezende-2015-normalizing-flows'],
          object_refs: expect.arrayContaining([
            '#source-span-rezende-2015-normalizing-flows',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(gradientDescent?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'negative-gradient-local-descent',
          status: 'source-checked',
          source_ids: ['boyd-2004-convex-optimization', 'goodfellow-2016-deep-learning'],
          object_refs: expect.arrayContaining(['#source-span-boyd-2004-convex-optimization', '#math-object-2']),
        }),
      ])
    )
    expect(maximumLikelihood?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'likelihood-loglikelihood-nll-objective',
          status: 'source-checked',
          source_ids: ['goodfellow-2016-deep-learning'],
          object_refs: expect.arrayContaining(['#source-span-goodfellow-2016-deep-learning', '#interactive-demo']),
        }),
      ])
    )
    expect(crossEntropy?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'target-weighted-surprise-nll',
          status: 'source-checked',
          source_ids: ['goodfellow-2016-deep-learning'],
          object_refs: expect.arrayContaining(['#source-span-goodfellow-2016-deep-learning', '#math-object-1']),
        }),
      ])
    )
    expect(distributions?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'random-variable-induced-law',
          status: 'source-checked',
          source_ids: ['deisenroth-2020-mml', 'goodfellow-2016-deep-learning'],
          object_refs: expect.arrayContaining(['#source-span-deisenroth-2020-mml', '#math-object-2']),
        }),
      ])
    )
    expect(probabilityBasics?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'event-axioms-conditioning-renormalization',
          status: 'source-checked',
          source_ids: ['deisenroth-2020-mml'],
          object_refs: expect.arrayContaining(['#source-span-deisenroth-2020-mml', '#math-object-1']),
        }),
      ])
    )
    expect(randomVariables?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'measurable-map-pushforward-expectation',
          status: 'source-checked',
          source_ids: ['deisenroth-2020-mml'],
          object_refs: expect.arrayContaining(['#source-span-deisenroth-2020-mml', '#math-object-2']),
        }),
      ])
    )
    expect(bayesianInference?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'prior-likelihood-evidence-posterior',
          status: 'source-checked',
          source_ids: ['deisenroth-2020-mml', 'murphy-2022-probabilistic-ml'],
          evidence_review: expect.objectContaining({
            state: 'substantive-reviewed',
            reviewer: 'codex+oracle',
          }),
          object_refs: expect.arrayContaining(['#source-span-murphy-2022-probabilistic-ml', '#math-object-1']),
        }),
      ])
    )
    expect(klDivergence?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'directional-log-ratio-expected-regret',
          status: 'source-checked',
          source_ids: ['goodfellow-2016-deep-learning'],
          object_refs: expect.arrayContaining(['#source-span-goodfellow-2016-deep-learning', '#math-object-2']),
        }),
      ])
    )
    expect(vaes?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'vae-elbo-reparameterized-inference',
          status: 'source-checked',
          source_ids: ['kingma-2013-auto-encoding-variational-bayes', 'rezende-2014-stochastic-backprop'],
          object_refs: expect.arrayContaining(['#source-span-kingma-2013-auto-encoding-variational-bayes', '#interactive-demo']),
        }),
      ])
    )
    expect(backpropagation?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'backpropagation-reverse-pass-gradients',
          status: 'source-checked',
          source_ids: ['rumelhart-1986-backprop', 'baydin-2018-ad-survey'],
          object_refs: expect.arrayContaining(['#source-span-rumelhart-1986-backprop', '#interactive-demo']),
        }),
      ])
    )
    expect(reverseModeAutodiff?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'reverse-mode-scalar-loss-gradient',
          status: 'source-checked',
          source_ids: ['baydin-2018-ad-survey'],
          object_refs: expect.arrayContaining(['#source-span-baydin-2018-ad-survey', '#interactive-demo']),
        }),
      ])
    )
    expect(computationGraphs?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'graph-bookkeeping-local-reverse-accumulation',
          status: 'source-checked',
          source_ids: ['baydin-2018-ad-survey'],
          object_refs: expect.arrayContaining(['#source-span-baydin-2018-ad-survey', '#interactive-demo']),
        }),
      ])
    )
    expect(derivatives?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'derivative-limit-secant-tangent',
          status: 'source-checked',
          source_ids: ['deisenroth-2020-mml'],
          object_refs: expect.arrayContaining(['#source-span-deisenroth-2020-mml', '#interactive-demo']),
        }),
      ])
    )
    expect(dotProduct?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dot-product-alignment-projection',
          status: 'source-checked',
          source_ids: ['deisenroth-2020-mml'],
          object_refs: expect.arrayContaining(['#math-object-2', '#interactive-demo']),
        }),
      ])
    )
    expect(vectorSpaces?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'vector-space-closure-linear-combinations',
          status: 'source-checked',
          source_ids: ['deisenroth-2020-mml'],
          object_refs: expect.arrayContaining([
            '#source-span-deisenroth-2020-mml',
            '#math-object-1',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(adam?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'adam-moment-bias-corrected-adaptive-step',
          status: 'source-checked',
          source_ids: ['kingma-2014-adam'],
          object_refs: expect.arrayContaining([
            '#source-span-kingma-2014-adam',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(learningRateSchedules?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'schedule-shape-controls-update-scale',
          status: 'source-checked',
          source_ids: ['smith-2015-cyclical-learning-rates', 'loshchilov-2016-sgdr'],
          object_refs: expect.arrayContaining([
            '#source-span-smith-2015-cyclical-learning-rates',
            '#source-span-loshchilov-2016-sgdr',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(lossLandscapes?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'sliced-landscape-sharpness-sam-neighborhood',
          status: 'source-checked',
          source_ids: ['li-2017-loss-landscape-visualization', 'keskar-2016-sharp-minima', 'foret-2020-sam'],
          object_refs: expect.arrayContaining([
            '#source-span-li-2017-loss-landscape-visualization',
            '#source-span-keskar-2016-sharp-minima',
            '#source-span-foret-2020-sam',
            '#math-object-1',
            '#math-object-2',
            '#interactive-demo',
          ]),
          evidence_review: expect.objectContaining({
            state: 'substantive-reviewed',
            reviewer: 'codex+oracle',
          }),
        }),
      ])
    )
    expect(lossLandscapes?.claim_checks?.[0]?.object_refs).not.toContain('#code-witness-1')
    expect(representations?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'representations-feature-contextual-elmo',
          status: 'source-checked',
          source_ids: ['bengio-2013-representation-learning', 'peters-2018-elmo'],
          object_refs: expect.arrayContaining([
            '#source-span-bengio-2013-representation-learning',
            '#source-span-peters-2018-elmo',
            '#math-object-1',
            '#code-witness-1',
          ]),
        }),
      ])
    )
    expect(sparseAutoencoders?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'sae-sparse-dictionary-reconstruction',
          status: 'source-checked',
          source_ids: ['bricken-2023-monosemanticity', 'gao-2024-scaling-sae'],
          object_refs: expect.arrayContaining([
            '#source-span-bricken-2023-monosemanticity',
            '#source-span-gao-2024-scaling-sae',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
          ]),
        }),
      ])
    )
    expect(sparseAutoencoders?.claim_checks?.[0]?.object_refs).not.toContain('#interactive-demo')
    expect(ntk?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'ntk-linearized-kernel-dynamics',
          status: 'source-checked',
          source_ids: ['jacot-2018-ntk', 'lee-2019-wide-networks-linear'],
          object_refs: expect.arrayContaining([
            '#source-span-jacot-2018-ntk',
            '#source-span-lee-2019-wide-networks-linear',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(doubleDescent?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'double-descent-interpolation-empirical-pattern',
          status: 'source-checked',
          source_ids: ['belkin-2018-bias-variance', 'nakkiran-2019-deep-double-descent'],
          evidence_review: expect.objectContaining({
            state: 'substantive-reviewed',
            reviewer: 'codex+oracle+codex-5.3',
          }),
          object_refs: expect.arrayContaining([
            '#source-span-belkin-2018-bias-variance',
            '#source-span-nakkiran-2019-deep-double-descent',
          ]),
        }),
      ])
    )
    expect(doubleDescent?.claim_checks?.[0]?.object_refs).not.toContain('#interactive-demo')
    expect(scalingLaws?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'power-law-compute-optimal-allocation',
          status: 'source-checked',
          source_ids: ['kaplan-2020-scaling-laws', 'hoffmann-2022-chinchilla'],
          object_refs: expect.arrayContaining([
            '#source-span-kaplan-2020-scaling-laws',
            '#source-span-hoffmann-2022-chinchilla',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(rlhf?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'preference-reward-model-kl-policy-optimization',
          status: 'source-checked',
          source_ids: ['christiano-2017-human-preferences', 'ouyang-2022-instructgpt'],
          evidence_review: expect.objectContaining({
            state: 'substantive-reviewed',
            reviewer: 'codex+oracle',
          }),
          object_refs: expect.arrayContaining([
            '#source-span-christiano-2017-human-preferences',
            '#source-span-ouyang-2022-instructgpt',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(dpo?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dpo-reference-relative-log-odds',
          status: 'source-checked',
          source_ids: ['rafailov-2023-dpo'],
          evidence_review: expect.objectContaining({
            state: 'substantive-reviewed',
            reviewer: 'codex+oracle',
          }),
          object_refs: expect.arrayContaining([
            '#source-span-rafailov-2023-dpo',
            '#math-object-1',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(kto?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'kto-binary-label-kl-reference-saturation',
          status: 'source-checked',
          source_ids: ['ethayarajh-2024-kto'],
          evidence_review: expect.objectContaining({
            state: 'substantive-reviewed',
            reviewer: 'codex+oracle',
          }),
          object_refs: expect.arrayContaining([
            '#source-span-ethayarajh-2024-kto',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(processRewardModels?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'process-step-verifier-proxy',
          status: 'source-checked',
          source_ids: ['lightman-2023-verify-step-by-step'],
          evidence_review: expect.objectContaining({
            state: 'substantive-reviewed',
            reviewer: 'codex+oracle',
          }),
          object_refs: expect.arrayContaining([
            '#source-span-lightman-2023-verify-step-by-step',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(rewardHacking?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'reward-hacking-selected-proxy-error',
          status: 'source-checked',
          source_ids: ['amodei-2016-concrete-safety', 'gao-2022-reward-overoptimization'],
          evidence_review: expect.objectContaining({
            state: 'substantive-reviewed',
            reviewer: 'codex+oracle',
          }),
          object_refs: expect.arrayContaining([
            '#source-span-amodei-2016-concrete-safety',
            '#source-span-gao-2022-reward-overoptimization',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(testTimeCompute?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'best-of-n-verifier-selection',
          status: 'source-checked',
          source_ids: [
            'wang-2022-self-consistency',
            'lightman-2023-verify-step-by-step',
            'snell-2024-test-time-compute',
          ],
          object_refs: expect.arrayContaining([
            '#source-span-wang-2022-self-consistency',
            '#source-span-lightman-2023-verify-step-by-step',
            '#source-span-snell-2024-test-time-compute',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
    expect(treeSearchReasoning?.claim_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'prefix-frontier-verifier-backup',
          status: 'source-checked',
          source_ids: ['yao-2023-tree-of-thoughts', 'lightman-2023-verify-step-by-step'],
          object_refs: expect.arrayContaining([
            '#source-span-yao-2023-tree-of-thoughts',
            '#source-span-lightman-2023-verify-step-by-step',
            '#math-object-1',
            '#math-object-2',
            '#code-witness-1',
            '#interactive-demo',
          ]),
        }),
      ])
    )
  })
})
