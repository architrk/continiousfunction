'use client'

import { useState, useMemo, useCallback } from 'react'
import ExplorableLayout, { useExplorable } from '../../components/ExplorableLayout'
import ExplorableSection from '../../components/ExplorableSection'
import KernelHeatmap from '../../components/KernelHeatmap'
import TimeSeriesPlot from '../../components/TimeSeriesPlot'
import { Matrix2D, TimeSeries, softmax } from '../../lib/mathObjects'

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

  if (activeSection === 'attention') {
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

  if (activeSection === 'ssm' || activeSection === 'mamba') {
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
    <ExplorableLayout
      title="Sequence Modeling"
      subtitle="From recurrence to attention to selective state spaces"
      visualPanel={<SequenceVisualPanel />}
      initialParams={{ temperature: 1.0, causal: true, selectivity: 0.5 }}
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
      />
      <span className="value">{selectivity.toFixed(2)}</span>
    </div>
  )
}
