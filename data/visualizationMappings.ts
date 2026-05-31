// Pure data mapping from concept IDs to visualization component names
// Separated from React components to allow importing without loading component code

export const conceptVisualizationMap: Record<string, string[]> = {
  'maximum-likelihood': ['CrossEntropyViz'],
  'attention-transformers': ['AttentionGeometryViz', 'TransformerArchitectureViz', 'KVCacheViz', 'SlidingWindowViz', 'SelfAttentionViz', 'AttentionBackpropViz'],
  'adam': ['AdamOptimizerViz', 'NewtonSchulzViz'],
  'loss-landscapes': ['LossLandscapeViz', 'EdgeOfStabilityViz', 'LossLandscape3DViz'],
  'double-descent': ['DoubleDescentViz', 'GrokkingViz'],
  'ntk': ['NTKViz'],
  'vaes': ['VAEELBOViz'],
  'gans': ['GANsViz'],
  'diffusion': ['DiffusionScoreViz', 'FlowMatchingViz', 'DiffusionProcessViz'],
  'representations': ['LayerNormViz', 'TaskVectorViz', 'EquivarianceViz', 'ParallelTransportViz'],
  'superposition': ['SuperpositionViz'],
  'probing': ['LinearProbeViz'],
  'induction-heads': ['InductionHeadsViz'],
  'scaling-laws': ['ScalingLawsViz', 'NeuralScalingViz'],
  'pretraining-data-mixtures': ['PretrainingDataMixturesViz'],
  'rlhf': ['RLHFViz', 'DPOViz'],
  'efficiency': ['LoRAViz', 'MoERoutingViz', 'TaskVectorViz'],
  'theory': ['InfoBottleneckViz'],
  'rope': ['RoPEViz'],
  'efficient-attention': ['KVCacheDashboard', 'GQAViz', 'SwiGLUViz'],
  'grouped-query-attention': ['GQAViz'],
  'swiglu': ['SwiGLUViz'],
  'speculative-decoding': ['SpeculativeDecodingViz'],
  'llm-serving': ['ServingLatencyViz'],
  'mixture-of-experts': ['MoERoutingViz'],
  'dpo': ['DPOViz'],
  'kto': ['KTOViz'],
  'reward-hacking': ['RewardHackingViz'],
  'sparse-autoencoders': ['SparseAutoencoderViz'],
  'tokenization-vocabulary': ['TokenizationViz'],
  'ssm-hybrids': ['SSMViz', 'MambaViz'],
  'decoding-sampling': ['DecodingSamplingViz'],
  // Concepts added for full coverage
  'moe-serving': ['MoERoutingViz', 'ServingLatencyViz'],
  'circuit-discovery': ['InductionHeadsViz', 'SparseAutoencoderViz'],
  'activation-steering': ['SuperpositionViz', 'LinearProbeViz'],
  'long-context': ['SlidingWindowViz', 'RoPEViz', 'KVCacheDashboard'],
  'multimodal': ['TokenizationViz'],
}

// Extra visualizations for sequence modeling pillar
export const sequenceVisualizationMap: Record<string, string[]> = {
  'ssm': ['SSMViz', 'MambaViz'],
  'attention-variants': ['SlidingWindowViz', 'KVCacheViz', 'RoPEViz'],
}

// Extra visualizations for geometric DL pillar
export const geometricVisualizationMap: Record<string, string[]> = {
  'equivariance': ['EquivarianceViz'],
  'parallel-transport': ['ParallelTransportViz'],
}
