'use client'

import { useMemo, Suspense, lazy } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import ExplorableLayout, { useExplorable } from '../../components/ExplorableLayout'
import ExplorableSection from '../../components/ExplorableSection'
import KernelHeatmap from '../../components/KernelHeatmap'
import TimeSeriesPlot from '../../components/TimeSeriesPlot'
import { Matrix2D, TimeSeries, softmax } from '../../lib/mathObjects'

// Explore in depth link component
function ExploreLink({ href, label = 'Explore in depth' }: { href: string; label?: string }) {
  return (
    <Link href={href} className="explore-link">
      {label} →
      <style jsx>{`
        .explore-link {
          display: inline-block;
          margin-top: 1rem;
          font-size: 0.85rem;
          color: var(--converge-teal);
          text-decoration: none;
          transition: color 0.2s;
        }
        .explore-link:hover {
          color: var(--accent);
        }
      `}</style>
    </Link>
  )
}

// Import visualization components from foundations (canonical source with gamification)
const AttentionMatrixViz = lazy(() => import('../../components/foundations/AttentionGeometryViz'))
const RoPERotationViz = lazy(() => import('../../components/foundations/RoPEViz'))
const KVCacheViz = lazy(() => import('../../components/foundations/KVCacheViz'))
const GQAMQAComparison = lazy(() => import('../../components/foundations/GQAViz'))
const SwiGLUActivation = lazy(() => import('../../components/foundations/SwiGLUViz'))
const MoERouting = lazy(() => import('../../components/foundations/MoERoutingViz'))
const SSMRecurrence = lazy(() => import('../../components/foundations/SSMViz'))
const MambaSelectivity = lazy(() => import('../../components/foundations/MambaViz'))
const AttentionIsAllYouNeed = lazy(() => import('../../components/foundations/TransformerArchitectureViz'))
const LayerNormRMSNorm = lazy(() => import('../../components/foundations/LayerNormViz'))
const SlidingWindowAttention = lazy(() => import('../../components/foundations/SlidingWindowViz'))

function LoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 360, color: '#b8b0a0' }}>
      Loading visualization...
    </div>
  )
}

function SequenceVisualPanel() {
  const { activeSection, params } = useExplorable()

  // Generate attention matrix based on params
  const attentionMatrix: Matrix2D = useMemo(() => {
    const seqLen = 8
    const tokens = ['The', 'cat', 'sat', 'on', 'the', 'mat', '.', '<end>']
    const data: number[][] = []

    const temperature = (params.temperature as number) || 1.0
    const causal = (params.causal as boolean) ?? true

    for (let i = 0; i < seqLen; i++) {
      const row: number[] = []
      for (let j = 0; j < seqLen; j++) {
        if (causal && j > i) {
          row.push(0)
        } else {
          // Simple attention pattern: nearby tokens get more weight
          const distance = Math.abs(i - j)
          const score = Math.exp(-distance / 2) / temperature
          row.push(score)
        }
      }
      // Normalize with softmax
      const masked = causal ? row.slice(0, i + 1) : row
      const normalized = softmax(masked)
      for (let j = 0; j < seqLen; j++) {
        if (causal && j > i) {
          row[j] = 0
        } else if (causal) {
          row[j] = normalized[j]
        } else {
          row[j] = normalized[j]
        }
      }
      data.push(row)
    }

    return { data, rowLabels: tokens, colLabels: tokens, label: 'Attention Weights' }
  }, [params.temperature, params.causal])

  // Generate SSM hidden state decay
  const ssmSeries: TimeSeries[] = useMemo(() => {
    const selectivity = (params.selectivity as number) || 0.5
    const decay = 0.9 - selectivity * 0.3

    const series: TimeSeries[] = []
    const steps = 50
    const inputSignal: { t: number; value: number }[] = []
    const hiddenState: { t: number; value: number }[] = []

    let h = 0
    for (let t = 0; t < steps; t++) {
      // Input signal with some structure
      const input = t === 10 ? 1 : t === 25 ? 0.8 : t === 40 ? -0.5 : 0
      inputSignal.push({ t, value: input })

      // SSM update: h = decay * h + input * selectivity
      h = decay * h + input * selectivity
      hiddenState.push({ t, value: h })
    }

    series.push({ data: inputSignal, label: 'Input', color: '#f59e0b' })
    series.push({ data: hiddenState, label: 'Hidden', color: '#14b8a6' })

    return series
  }, [params.selectivity])

  // Use the new advanced visualization components based on section
  if (activeSection === 'attention' || activeSection === 'attention-deep') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <AttentionMatrixViz />
      </Suspense>
    )
  }

  if (activeSection === 'rope') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <RoPERotationViz />
      </Suspense>
    )
  }

  if (activeSection === 'kvcache') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <KVCacheViz />
      </Suspense>
    )
  }

  if (activeSection === 'gqa' || activeSection === 'mqa') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <GQAMQAComparison />
      </Suspense>
    )
  }

  if (activeSection === 'swiglu' || activeSection === 'activation') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SwiGLUActivation />
      </Suspense>
    )
  }

  if (activeSection === 'moe') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <MoERouting />
      </Suspense>
    )
  }

  if (activeSection === 'ssm') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SSMRecurrence />
      </Suspense>
    )
  }

  if (activeSection === 'mamba') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <MambaSelectivity />
      </Suspense>
    )
  }

  if (activeSection === 'transformer') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <AttentionIsAllYouNeed />
      </Suspense>
    )
  }

  if (activeSection === 'layernorm' || activeSection === 'normalization') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LayerNormRMSNorm />
      </Suspense>
    )
  }

  if (activeSection === 'sliding' || activeSection === 'window') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SlidingWindowAttention />
      </Suspense>
    )
  }

  // Fallback to legacy visualization
  if (activeSection === 'attention-legacy') {
    return (
      <div>
        <KernelHeatmap
          matrix={attentionMatrix}
          width={360}
          height={360}
          colorScheme="attention"
          showValues={false}
          title="Self-Attention Pattern"
        />
        <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#7a7468', textAlign: 'center' }}>
          Each row shows where token i attends
        </p>
      </div>
    )
  }

  if (activeSection === 'ssm-legacy') {
    return (
      <div>
        <TimeSeriesPlot
          series={ssmSeries}
          width={360}
          height={250}
          xLabel="Time Step"
          yLabel="Activation"
          showLegend={true}
        />
        <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#7a7468', textAlign: 'center' }}>
          Hidden state integrates input over time
        </p>
      </div>
    )
  }

  // Default view
  return (
    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>∿</div>
      <p style={{ color: '#b8b0a0' }}>
        Scroll through sections to see<br />different visualizations
      </p>
    </div>
  )
}

export default function SequenceModelingPillar() {
  return (
    <>
      <Head>
        <title>Sequence Modeling — Continuous Function</title>
      </Head>
      <ExplorableLayout
        title="Sequence Modeling"
        subtitle="From recurrence to attention to selective state spaces"
        visualPanel={<SequenceVisualPanel />}
        initialParams={{ temperature: 1.0, causal: true, selectivity: 0.5 }}
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Pillars', href: '/pillars' },
          { label: 'Sequence Modeling' }
        ]}
    >
      <ExplorableSection id="intro">
        <h2>The Challenge of Sequences</h2>
        <p>
          Sequential data is everywhere: language, audio, time series, code. The fundamental
          challenge is how to process variable-length inputs while maintaining computational
          efficiency and capturing long-range dependencies.
        </p>
        <p>
          Three paradigms have emerged, each with distinct tradeoffs between expressiveness,
          parallelism, and memory complexity.
        </p>
      </ExplorableSection>

      <ExplorableSection id="attention">
        <h2>Self-Attention</h2>
        <p>
          The Transformer's key innovation: every token can directly attend to every other token.
          No recurrence needed. The attention weight from token <em>i</em> to token <em>j</em> is:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Attention Mechanism</div>
          <p>
            α<sub>ij</sub> = softmax(Q<sub>i</sub> · K<sub>j</sub><sup>T</sup> / √d)
          </p>
        </div>
        <p>
          This enables parallel training but comes with O(n²) memory complexity in sequence length.
          For long sequences, this becomes prohibitive.
        </p>
        <TemperatureControl />
        <ExploreLink href="/foundations/attention-transformers/" />
      </ExplorableSection>

      <ExplorableSection id="rope">
        <h2>RoPE: Rotary Position Embeddings</h2>
        <p>
          How do transformers know token order? RoPE encodes position by rotating query and key
          vectors in 2D subspaces. Each position gets a unique rotation angle:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Rotary Embedding</div>
          <p>
            R(θ<sub>m</sub>) = [cos(mθ), -sin(mθ); sin(mθ), cos(mθ)]
          </p>
        </div>
        <p>
          The key insight: relative positions are encoded in the angle between rotated vectors,
          enabling length generalization beyond training context.
        </p>
        <ExploreLink href="/foundations/rope/" />
      </ExplorableSection>

      <ExplorableSection id="kvcache">
        <h2>KV Cache</h2>
        <p>
          During autoregressive generation, we only need to compute attention for the new token.
          The KV cache stores previously computed key and value vectors:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Incremental Decoding</div>
          <p>
            At step t: K<sub>cache</sub> = [K<sub>1</sub>, ..., K<sub>t-1</sub>]
            <br />
            Only compute Q<sub>t</sub>, K<sub>t</sub>, V<sub>t</sub> for new token
          </p>
        </div>
        <p>
          This reduces per-token compute from O(n²) to O(n), but requires O(n·d) memory per layer.
          For long contexts, this memory cost dominates.
        </p>
        <ExploreLink href="/foundations/efficient-attention/" />
      </ExplorableSection>

      <ExplorableSection id="gqa">
        <h2>Grouped Query Attention</h2>
        <p>
          Multi-Head Attention (MHA) uses separate K, V heads per query head. GQA shares K, V
          across groups of query heads, reducing KV cache size:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">GQA Memory Savings</div>
          <p>
            MHA: n<sub>heads</sub> × d<sub>head</sub> for K and V each
            <br />
            GQA: n<sub>groups</sub> × d<sub>head</sub> (where groups &lt; heads)
          </p>
        </div>
        <p>
          MQA (Multi-Query Attention) is the extreme case: all query heads share a single K, V pair.
          GQA balances memory efficiency with model quality.
        </p>
        <ExploreLink href="/foundations/efficient-attention/" />
      </ExplorableSection>

      <ExplorableSection id="swiglu">
        <h2>SwiGLU Activation</h2>
        <p>
          The feed-forward network in each transformer block uses gated activations. SwiGLU
          combines Swish activation with a gating mechanism:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">SwiGLU</div>
          <p>
            SwiGLU(x) = Swish(xW<sub>1</sub>) ⊙ (xW<sub>2</sub>)
            <br />
            where Swish(x) = x · σ(x)
          </p>
        </div>
        <p>
          The gating allows the network to selectively pass or block information, improving
          training stability and final performance over ReLU.
        </p>
      </ExplorableSection>

      <ExplorableSection id="moe">
        <h2>Mixture of Experts</h2>
        <p>
          Scale model capacity without scaling compute. MoE replaces the FFN with multiple
          "expert" networks, routing each token to a subset:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Expert Routing</div>
          <p>
            y = Σ G(x)<sub>i</sub> · Expert<sub>i</sub>(x)
            <br />
            where G(x) = TopK(softmax(x · W<sub>gate</sub>))
          </p>
        </div>
        <p>
          Typically only 1-2 experts are active per token (sparse routing), achieving massive
          parameter counts while keeping inference cost manageable.
        </p>
      </ExplorableSection>

      <ExplorableSection id="transformer">
        <h2>The Full Transformer</h2>
        <p>
          Putting it all together: each transformer block consists of:
        </p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ padding: '0.5rem 0' }}>
            <span style={{ color: '#f59e0b' }}>1.</span> Multi-Head Self-Attention (with RoPE)
          </li>
          <li style={{ padding: '0.5rem 0' }}>
            <span style={{ color: '#f59e0b' }}>2.</span> Residual Connection + Layer Norm
          </li>
          <li style={{ padding: '0.5rem 0' }}>
            <span style={{ color: '#f59e0b' }}>3.</span> Feed-Forward Network (SwiGLU)
          </li>
          <li style={{ padding: '0.5rem 0' }}>
            <span style={{ color: '#f59e0b' }}>4.</span> Residual Connection + Layer Norm
          </li>
        </ul>
        <p>
          Stack N of these blocks, add embeddings at input and unembedding at output,
          and you have a modern large language model.
        </p>
      </ExplorableSection>

      <ExplorableSection id="normalization">
        <h2>LayerNorm vs RMSNorm</h2>
        <p>
          Normalization is critical for training stability. LayerNorm normalizes across features:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Normalization</div>
          <p>
            LayerNorm: (x - μ) / σ · γ + β
            <br />
            RMSNorm: x / RMS(x) · γ (no mean centering)
          </p>
        </div>
        <p>
          RMSNorm is simpler (no mean computation) and often works as well, making it popular
          in modern architectures like LLaMA.
        </p>
      </ExplorableSection>

      <ExplorableSection id="sliding">
        <h2>Sliding Window Attention</h2>
        <p>
          For very long sequences, even O(n²) with KV cache is too expensive. Sliding window
          attention limits each token to attending only within a local window:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Local Attention</div>
          <p>
            Token i attends to [i-w, i] where w = window size
            <br />
            Memory: O(w) per token instead of O(n)
          </p>
        </div>
        <p>
          Information propagates across layers: with L layers and window w, effective context
          is L × w tokens. Used in Mistral and other efficient models.
        </p>
      </ExplorableSection>

      <ExplorableSection id="ssm">
        <h2>State Space Models</h2>
        <p>
          SSMs model sequences as linear dynamical systems. At each step, a hidden state
          is updated based on the input and a learned transition matrix:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">SSM Recurrence</div>
          <p>
            h<sub>t</sub> = Ah<sub>t-1</sub> + Bx<sub>t</sub>
            <br />
            y<sub>t</sub> = Ch<sub>t</sub> + Dx<sub>t</sub>
          </p>
        </div>
        <p>
          The beauty is that these can be computed as a convolution during training (O(n log n))
          while maintaining O(1) memory per step during inference.
        </p>
        <SelectivityControl />
        <ExploreLink href="/foundations/ssm-hybrids/" />
      </ExplorableSection>

      <ExplorableSection id="mamba">
        <h2>Mamba: Selective State Spaces</h2>
        <p>
          Mamba's key insight: make the SSM parameters <em>input-dependent</em>. The matrices
          A, B, C become functions of the current input, enabling the model to selectively
          remember or forget information.
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Selective SSM</div>
          <p>
            B<sub>t</sub> = Linear(x<sub>t</sub>)
            <br />
            Δ<sub>t</sub> = softplus(Linear(x<sub>t</sub>))
          </p>
        </div>
        <p>
          This breaks the convolution structure but enables hardware-efficient selective scanning
          that achieves linear scaling with sequence length.
        </p>
        <ExploreLink href="/foundations/ssm-hybrids/" />
      </ExplorableSection>

      <ExplorableSection id="comparison">
        <h2>Tradeoffs</h2>
        <table style={{ width: '100%', marginTop: '1rem' }}>
          <thead>
            <tr>
              <th>Method</th>
              <th>Training</th>
              <th>Inference</th>
              <th>Long-range</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Transformer</td>
              <td>O(n²)</td>
              <td>O(n²)</td>
              <td>Direct</td>
            </tr>
            <tr>
              <td>Linear SSM</td>
              <td>O(n log n)</td>
              <td>O(1)/step</td>
              <td>Decay</td>
            </tr>
            <tr>
              <td>Mamba</td>
              <td>O(n)</td>
              <td>O(1)/step</td>
              <td>Selective</td>
            </tr>
          </tbody>
        </table>
      </ExplorableSection>
    </ExplorableLayout>
    </>
  )
}

function TemperatureControl() {
  const { params, setParam } = useExplorable()
  const temperature = (params.temperature as number) || 1.0

  return (
    <div className="param-control" style={{ display: 'flex', marginTop: '1rem' }}>
      <span>Temperature:</span>
      <input
        type="range"
        min="0.1"
        max="3"
        step="0.1"
        value={temperature}
        onChange={(e) => setParam('temperature', parseFloat(e.target.value))}
        aria-label="Temperature"
        aria-valuetext={temperature.toFixed(1)}
      />
      <span className="value">{temperature.toFixed(1)}</span>
    </div>
  )
}

function SelectivityControl() {
  const { params, setParam } = useExplorable()
  const selectivity = (params.selectivity as number) || 0.5

  return (
    <div className="param-control" style={{ display: 'flex', marginTop: '1rem' }}>
      <span>Selectivity:</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={selectivity}
        onChange={(e) => setParam('selectivity', parseFloat(e.target.value))}
        aria-label="Selectivity"
        aria-valuetext={selectivity.toFixed(2)}
      />
      <span className="value">{selectivity.toFixed(2)}</span>
    </div>
  )
}
