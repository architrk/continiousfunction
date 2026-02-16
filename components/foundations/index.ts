// Foundations visualization components index
// Barrel exports for concept visualizations (used by /foundations/[id] and pillar pages)

export { default as CrossEntropyViz } from './CrossEntropyViz'
export { default as AttentionGeometryViz } from './AttentionGeometryViz'
export { default as AdamOptimizerViz } from './AdamOptimizerViz'
export { default as LossLandscapeViz } from './LossLandscapeViz'
export { default as DoubleDescentViz } from './DoubleDescentViz'
export { default as NTKViz } from './NTKViz'
export { default as VAEELBOViz } from './VAEELBOViz'
export { default as FlowMatchingViz } from './FlowMatchingViz'
export { default as DiffusionScoreViz } from './DiffusionScoreViz'
export { default as SuperpositionViz } from './SuperpositionViz'
export { default as LinearProbeViz } from './LinearProbeViz'
export { default as InductionHeadsViz } from './InductionHeadsViz'
export { default as ScalingLawsViz } from './ScalingLawsViz'
export { default as RLHFViz } from './RLHFViz'
export { default as LoRAViz } from './LoRAViz'
export { default as InfoBottleneckViz } from './InfoBottleneckViz'

// Additional specialized visualizations
export { default as MoERoutingViz } from './MoERoutingViz'
export { default as KVCacheViz } from './KVCacheViz'
export { default as RoPEViz } from './RoPEViz'
export { default as LayerNormViz } from './LayerNormViz'
export { default as EdgeOfStabilityViz } from './EdgeOfStabilityViz'
export { default as TransformerArchitectureViz } from './TransformerArchitectureViz'
export { default as SSMViz } from './SSMViz'
export { default as MambaViz } from './MambaViz'
export { default as EquivarianceViz } from './EquivarianceViz'
export { default as GrokkingViz } from './GrokkingViz'
export { default as DPOViz } from './DPOViz'
export { default as NeuralScalingViz } from './NeuralScalingViz'
export { default as NewtonSchulzViz } from './NewtonSchulzViz'
export { default as SlidingWindowViz } from './SlidingWindowViz'

// New additions: 3D, parallel transport, self-attention, task vectors, backprop, diffusion process
export { default as LossLandscape3DViz } from './LossLandscape3DViz'
export { default as ParallelTransportViz } from './ParallelTransportViz'
export { default as SelfAttentionViz } from './SelfAttentionViz'
export { default as TaskVectorViz } from './TaskVectorViz'
export { default as AttentionBackpropViz } from './AttentionBackpropViz'
export { default as DiffusionProcessViz } from './DiffusionProcessViz'
export { default as KVCacheDashboard } from './KVCacheDashboard'
export { default as SpeculativeDecodingViz } from './SpeculativeDecodingViz'
export { default as ServingLatencyViz } from './ServingLatencyViz'
export { default as KTOViz } from './KTOViz'
export { default as RewardHackingViz } from './RewardHackingViz'
export { default as SparseAutoencoderViz } from './SparseAutoencoderViz'
export { default as TokenizationViz } from './TokenizationViz'

// Re-export visualization mappings from pure data module
// (kept here for backwards compatibility)
export {
  conceptVisualizationMap,
  sequenceVisualizationMap,
  geometricVisualizationMap
} from '../../data/visualizationMappings'
