import dynamic from 'next/dynamic'
import { conceptVisualizationMap } from '../../data/visualizationMappings'

type Props = {
  conceptId: string
}

const CrossEntropyViz = dynamic(() => import('./CrossEntropyViz'), { ssr: false })
const AttentionGeometryViz = dynamic(() => import('./AttentionGeometryViz'), { ssr: false })
const AdamOptimizerViz = dynamic(() => import('./AdamOptimizerViz'), { ssr: false })
const LossLandscapeViz = dynamic(() => import('./LossLandscapeViz'), { ssr: false })
const DoubleDescentViz = dynamic(() => import('./DoubleDescentViz'), { ssr: false })
const NTKViz = dynamic(() => import('./NTKViz'), { ssr: false })
const VAEELBOViz = dynamic(() => import('./VAEELBOViz'), { ssr: false })
const DiffusionScoreViz = dynamic(() => import('./DiffusionScoreViz'), { ssr: false })
const FlowMatchingViz = dynamic(() => import('./FlowMatchingViz'), { ssr: false })
const SuperpositionViz = dynamic(() => import('./SuperpositionViz'), { ssr: false })
const LinearProbeViz = dynamic(() => import('./LinearProbeViz'), { ssr: false })
const InductionHeadsViz = dynamic(() => import('./InductionHeadsViz'), { ssr: false })
const ScalingLawsViz = dynamic(() => import('./ScalingLawsViz'), { ssr: false })
const RLHFViz = dynamic(() => import('./RLHFViz'), { ssr: false })
const LoRAViz = dynamic(() => import('./LoRAViz'), { ssr: false })
const InfoBottleneckViz = dynamic(() => import('./InfoBottleneckViz'), { ssr: false })
const TransformerArchitectureViz = dynamic(() => import('./TransformerArchitectureViz'), { ssr: false })
const KVCacheViz = dynamic(() => import('./KVCacheViz'), { ssr: false })
const RoPEViz = dynamic(() => import('./RoPEViz'), { ssr: false })
const SlidingWindowViz = dynamic(() => import('./SlidingWindowViz'), { ssr: false })
const NewtonSchulzViz = dynamic(() => import('./NewtonSchulzViz'), { ssr: false })
const EdgeOfStabilityViz = dynamic(() => import('./EdgeOfStabilityViz'), { ssr: false })
const GrokkingViz = dynamic(() => import('./GrokkingViz'), { ssr: false })
const LayerNormViz = dynamic(() => import('./LayerNormViz'), { ssr: false })
const NeuralScalingViz = dynamic(() => import('./NeuralScalingViz'), { ssr: false })
const DPOViz = dynamic(() => import('./DPOViz'), { ssr: false })
const MoERoutingViz = dynamic(() => import('./MoERoutingViz'), { ssr: false })
const LossLandscape3DViz = dynamic(() => import('./LossLandscape3DViz'), { ssr: false })
const ParallelTransportViz = dynamic(() => import('./ParallelTransportViz'), { ssr: false })
const SelfAttentionViz = dynamic(() => import('./SelfAttentionViz'), { ssr: false })
const TaskVectorViz = dynamic(() => import('./TaskVectorViz'), { ssr: false })
const AttentionBackpropViz = dynamic(() => import('./AttentionBackpropViz'), { ssr: false })
const DiffusionProcessViz = dynamic(() => import('./DiffusionProcessViz'), { ssr: false })
const KVCacheDashboard = dynamic(() => import('./KVCacheDashboard'), { ssr: false })
const SpeculativeDecodingViz = dynamic(() => import('./SpeculativeDecodingViz'), { ssr: false })
const ServingLatencyViz = dynamic(() => import('./ServingLatencyViz'), { ssr: false })
const KTOViz = dynamic(() => import('./KTOViz'), { ssr: false })
const RewardHackingViz = dynamic(() => import('./RewardHackingViz'), { ssr: false })
const SparseAutoencoderViz = dynamic(() => import('./SparseAutoencoderViz'), { ssr: false })
const TokenizationViz = dynamic(() => import('./TokenizationViz'), { ssr: false })
const SSMViz = dynamic(() => import('./SSMViz'), { ssr: false })
const MambaViz = dynamic(() => import('./MambaViz'), { ssr: false })
const DecodingSamplingViz = dynamic(() => import('./DecodingSamplingViz'), { ssr: false })
const EquivarianceViz = dynamic(() => import('./EquivarianceViz'), { ssr: false })
const GQAViz = dynamic(() => import('./GQAViz'), { ssr: false })
const SwiGLUViz = dynamic(() => import('./SwiGLUViz'), { ssr: false })
const GANsViz = dynamic(() => import('./GANsViz'), { ssr: false })
const PretrainingDataMixturesViz = dynamic(() => import('./PretrainingDataMixturesViz'), { ssr: false })

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Each visualization has unique props; union type would be impractical
const vizMap: Record<string, React.ComponentType<any>> = {
  CrossEntropyViz,
  AttentionGeometryViz,
  AdamOptimizerViz,
  LossLandscapeViz,
  DoubleDescentViz,
  NTKViz,
  VAEELBOViz,
  DiffusionScoreViz,
  FlowMatchingViz,
  SuperpositionViz,
  LinearProbeViz,
  InductionHeadsViz,
  ScalingLawsViz,
  RLHFViz,
  LoRAViz,
  InfoBottleneckViz,
  TransformerArchitectureViz,
  KVCacheViz,
  RoPEViz,
  SlidingWindowViz,
  NewtonSchulzViz,
  EdgeOfStabilityViz,
  GrokkingViz,
  LayerNormViz,
  NeuralScalingViz,
  DPOViz,
  MoERoutingViz,
  LossLandscape3DViz,
  ParallelTransportViz,
  SelfAttentionViz,
  TaskVectorViz,
  AttentionBackpropViz,
  DiffusionProcessViz,
  KVCacheDashboard,
  SpeculativeDecodingViz,
  ServingLatencyViz,
  KTOViz,
  RewardHackingViz,
  SparseAutoencoderViz,
  TokenizationViz,
  SSMViz,
  MambaViz,
  DecodingSamplingViz,
  EquivarianceViz,
  GQAViz,
  SwiGLUViz,
  GANsViz,
  PretrainingDataMixturesViz,
}

export default function FoundationsVizDeck({ conceptId }: Props) {
  const vizNames = conceptVisualizationMap[conceptId] || []
  const visualizations = vizNames.map((name) => vizMap[name]).filter(Boolean)

  if (visualizations.length === 0) {
    return (
      <div className="viz-placeholder" role="note">
        <p className="viz-placeholder-title">No interactive demo for this concept yet.</p>
        <p className="viz-placeholder-body">
          We will add one soon. For now, use the key equation, the connections, and the "Next Moves" panel
          to build intuition.
        </p>
      </div>
    )
  }

  return (
    <div className="visualizations">
      {visualizations.map((VizComponent, index) => (
        <div key={index} className="viz-container">
          <VizComponent />
        </div>
      ))}
    </div>
  )
}
