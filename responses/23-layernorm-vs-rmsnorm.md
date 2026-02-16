tsx
Copy code
'use client'

import React, { useMemo, useState, ChangeEvent } from 'react'

type ColorKind = 'input' | 'intermediate' | 'output'

interface VectorRowProps {
  label: string
  values: number[]
  color: ColorKind
}

interface NormResults {
  layerNorm: {
    mean: number
    std: number
    centered: number[]
    normalized: number[]
    output: number[]
  }
  rmsNorm: {
    rms: number
    normalized: number[]
    output: number[]
  }
  difference: number[]
  metrics: {
    l2: number
    l2PerDim: number
    maxDiff: number
    cosineSimilarity: number | null
  }
  ops: {
    n: number
    layerNorm: number
    rmsNorm: number
    ratio: number
  }
}

const EPS = 1e-5

const COLOR_TOKENS: Record<
  ColorKind,
  { bg: string; border: string; fg: string }
> = {
  input: {
    bg: 'rgba(55, 65, 81, 0.8)', // gray
    border: '#6b7280',
    fg: '#e5e7eb',
  },
  intermediate: {
    bg: 'rgba(20, 184, 166, 0.12)', // teal
    border: '#14b8a6',
    fg: '#99f6e4',
  },
  output: {
    bg: 'rgba(245, 158, 11, 0.12)', // orange
    border: '#f59e0b',
    fg: '#fed7aa',
  },
}

function parseActivations(text: string): number[] {
  const tokens = text.split(/[\s,]+/).filter(Boolean)
  const values = tokens
    .map((t) => Number.parseFloat(t))
    .filter((v) => Number.isFinite(v))

  return values.length > 0 ? values : [0]
}

function estimateLayerNormOps(n: number): number {
  // Rough scalar-FLOP count:
  // mean: (n - 1) adds + 1 div      ≈ n
  // subtract mean: n subs           ⇒ +n
  // variance: n mul + (n - 1) adds  ≈ +2n
  // variance + eps + sqrt           ⇒ +2
  // (x - mean)/std * gamma + beta: 4n
  // total ≈ 8n + 2
  return n > 0 ? 8 * n + 2 : 0
}

function estimateRmsNormOps(n: number): number {
  // mean square: n mul + (n - 1) adds + 1 div ≈ 2n + 1
  // + eps + sqrt                               +2
  // x / rms * gamma: 2n
  // total ≈ 4n + 3
  return n > 0 ? 4 * n + 3 : 0
}

function computeNorms(
  activations: number[],
  gamma: number,
  beta: number
): NormResults {
  const n = activations.length || 1

  // LayerNorm
  const mean =
    activations.reduce((sum, v) => sum + v, 0) / (n || 1)

  const centered = activations.map((v) => v - mean)

  const variance =
    centered.reduce((sum, v) => sum + v * v, 0) / (n || 1)

  const std = Math.sqrt(variance + EPS) || 1

  const lnNormalized = centered.map((v) => v / std)
  const lnOutput = lnNormalized.map((v) => gamma * v + beta)

  // RMSNorm
  const meanSquare =
    activations.reduce((sum, v) => sum + v * v, 0) / (n || 1)

  const rms = Math.sqrt(meanSquare + EPS) || 1

  const rmsNormalized = activations.map((v) => v / rms)
  const rmsOutput = rmsNormalized.map((v) => gamma * v)

  // Differences
  const difference = lnOutput.map(
    (v, i) => v - rmsOutput[i]
  )
  const l2 = Math.sqrt(
    difference.reduce((sum, v) => sum + v * v, 0)
  )
  const l2PerDim = l2 / (n || 1)
  const maxDiff = difference.reduce(
    (m, v) => Math.max(m, Math.abs(v)),
    0
  )

  const dot = lnOutput.reduce(
    (sum, v, i) => sum + v * rmsOutput[i],
    0
  )
  const lnNorm = Math.sqrt(
    lnOutput.reduce((sum, v) => sum + v * v, 0)
  )
  const rmsNormNorm = Math.sqrt(
    rmsOutput.reduce((sum, v) => sum + v * v, 0)
  )
  const cosineSimilarity =
    lnNorm > 0 && rmsNormNorm > 0
      ? dot / (lnNorm * rmsNormNorm)
      : null

  // Ops
  const layerNormOps = estimateLayerNormOps(n)
  const rmsNormOps = estimateRmsNormOps(n)
  const ratio =
    rmsNormOps > 0 ? layerNormOps / rmsNormOps : 1

  return {
    layerNorm: {
      mean,
      std,
      centered,
      normalized: lnNormalized,
      output: lnOutput,
    },
    rmsNorm: {
      rms,
      normalized: rmsNormalized,
      output: rmsOutput,
    },
    difference,
    metrics: {
      l2,
      l2PerDim,
      maxDiff,
      cosineSimilarity,
    },
    ops: {
      n,
      layerNorm: layerNormOps,
      rmsNorm: rmsNormOps,
      ratio,
    },
  }
}

function VectorRow({
  label,
  values,
  color,
}: VectorRowProps) {
  const palette = COLOR_TOKENS[color]

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 12,
          color: '#9ca3af',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
        }}
      >
        {values.map((v, idx) => (
          <span
            key={idx}
            style={{
              padding: '2px 6px',
              borderRadius: 6,
              backgroundColor: palette.bg,
              border: `1px solid ${palette.border}`,
              color: palette.fg,
              fontSize: 12,
              fontFamily:
                'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            }}
          >
            {v.toFixed(3)}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function LayerNormVsRmsNorm() {
  const [inputText, setInputText] = useState(
    '1.0, 0.5, -0.2, 2.0, -1.2, 0.3, 0.7, 1.5'
  )
  const [gamma, setGamma] = useState(1.0)
  const [beta, setBeta] = useState(0.0)

  const activations = useMemo(
    () => parseActivations(inputText),
    [inputText]
  )

  const results = useMemo(
    () => computeNorms(activations, gamma, beta),
    [activations, gamma, beta]
  )

  const { layerNorm, rmsNorm, difference, metrics, ops } =
    results

  const handleGammaChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseFloat(e.target.value)
    if (!Number.isNaN(value)) setGamma(value)
  }

  const handleBetaChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseFloat(e.target.value)
    if (!Number.isNaN(value)) setBeta(value)
  }

  const barMax = ops.layerNorm
  const lnWidth =
    barMax > 0
      ? `${(ops.layerNorm / barMax) * 100}%`
      : '0%'
  const rmsWidth =
    barMax > 0
      ? `${(ops.rmsNorm / barMax) * 100}%`
      : '0%'

  return (
    <section
      style={{
        backgroundColor: '#0d1219',
        borderRadius: 16,
        border: '1px solid #111827',
        padding: 20,
        color: '#e5e7eb',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        boxShadow:
          '0 24px 60px rgba(0, 0, 0, 0.45)',
      }}
    >
      <header
        style={{
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          LayerNorm vs RMSNorm
        </h2>
        <p
          style={{
            fontSize: 13,
            color: '#9ca3af',
          }}
        >
          LayerNorm centers and scales activations; RMSNorm
          only scales by the root-mean-square. RMSNorm is
          simpler (fewer ops) but produces very similar
          normalized vectors—one reason modern LLMs like
          Llama often prefer it.
        </p>
      </header>

      {/* Controls + High-level summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'minmax(0, 1.1fr) minmax(0, 0.9fr)',
          gap: 20,
          alignItems: 'flex-start',
        }}
      >
        {/* Left: input & global metrics */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                marginBottom: 4,
                color: '#9ca3af',
              }}
            >
              Activations vector (editable)
            </label>
            <textarea
              value={inputText}
              onChange={(e) =>
                setInputText(e.target.value)
              }
              rows={3}
              style={{
                width: '100%',
                resize: 'vertical',
                padding: 8,
                borderRadius: 8,
                border: '1px solid #1f2937',
                backgroundColor: '#020617',
                color: '#e5e7eb',
                fontFamily:
                  'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 12,
              }}
              placeholder="e.g. 1.0, 0.5, -0.2, 2.0, -1.2, 0.3, 0.7, 1.5"
            />
            <p
              style={{
                marginTop: 4,
                fontSize: 11,
                color: '#6b7280',
              }}
            >
              Separate numbers with commas or spaces.
              Both norms operate over this single
              activation vector.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 12,
            }}
          >
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  marginBottom: 4,
                  color: '#9ca3af',
                }}
              >
                Scale γ (shared)
              </label>
              <input
                type="number"
                step="0.1"
                value={gamma}
                onChange={handleGammaChange}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 8,
                  border: '1px solid #1f2937',
                  backgroundColor: '#020617',
                  color: '#e5e7eb',
                  fontSize: 12,
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  marginBottom: 4,
                  color: '#9ca3af',
                }}
              >
                Shift β (LayerNorm only)
              </label>
              <input
                type="number"
                step="0.1"
                value={beta}
                onChange={handleBetaChange}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 8,
                  border: '1px solid #1f2937',
                  backgroundColor: '#020617',
                  color: '#e5e7eb',
                  fontSize: 12,
                }}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 10,
              background:
                'radial-gradient(circle at top left, rgba(34, 197, 235, 0.2), transparent 55%), radial-gradient(circle at bottom right, rgba(249, 115, 22, 0.2), transparent 55%)',
              border: '1px solid rgba(31, 41, 55, 1)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 6,
                fontSize: 12,
              }}
            >
              <span
                style={{
                  color: '#e5e7eb',
                  fontWeight: 500,
                }}
              >
                Output similarity
              </span>
              <span
                style={{
                  color: '#a5b4fc',
                  fontFamily:
                    'JetBrains Mono, ui-monospace',
                }}
              >
                dim = {ops.n}
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(3, minmax(0, 1fr))',
                gap: 8,
                fontSize: 11,
              }}
            >
              <div>
                <div
                  style={{
                    color: '#9ca3af',
                    marginBottom: 2,
                  }}
                >
                  Cosine sim
                </div>
                <div
                  style={{
                    color: '#f97316',
                    fontFamily:
                      'JetBrains Mono, ui-monospace',
                  }}
                >
                  {metrics.cosineSimilarity !== null
                    ? metrics.cosineSimilarity.toFixed(3)
                    : '—'}
                </div>
              </div>
              <div>
                <div
                  style={{
                    color: '#9ca3af',
                    marginBottom: 2,
                  }}
                >
                  L2 / dim
                </div>
                <div
                  style={{
                    color: '#14b8a6',
                    fontFamily:
                      'JetBrains Mono, ui-monospace',
                  }}
                >
                  {metrics.l2PerDim.toFixed(4)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    color: '#9ca3af',
                    marginBottom: 2,
                  }}
                >
                  max |Δ|
                </div>
                <div
                  style={{
                    color: '#e5e7eb',
                    fontFamily:
                      'JetBrains Mono, ui-monospace',
                  }}
                >
                  {metrics.maxDiff.toFixed(4)}
                </div>
              </div>
            </div>
            <p
              style={{
                marginTop: 6,
                fontSize: 11,
                color: '#9ca3af',
              }}
            >
              For typical LLM activations the two
              normalizations produce very similar
              directions, even though LayerNorm also
              subtracts the mean.
            </p>
          </div>
        </div>

        {/* Right: ops comparison */}
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: '1px solid #1f2937',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            Computational cost (per vector)
          </h3>
          <p
            style={{
              fontSize: 12,
              color: '#9ca3af',
              marginBottom: 10,
            }}
          >
            Approximate scalar operations for norm over{' '}
            <span
              style={{
                color: '#e5e7eb',
                fontFamily:
                  'JetBrains Mono, ui-monospace',
              }}
            >
              n = {ops.n}
            </span>{' '}
            activations:
          </p>
          <div
            style={{
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <span style={{ color: '#e5e7eb' }}>
                LayerNorm
              </span>
              <span
                style={{
                  color: '#f97316',
                  fontFamily:
                    'JetBrains Mono, ui-monospace',
                }}
              >
                ≈ 8n + 2 = {ops.layerNorm}
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 999,
                backgroundColor: '#020617',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: lnWidth,
                  height: '100%',
                  background:
                    'linear-gradient(90deg, #14b8a6, #f97316)',
                }}
              />
            </div>
          </div>

          <div
            style={{
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <span style={{ color: '#e5e7eb' }}>
                RMSNorm
              </span>
              <span
                style={{
                  color: '#22c55e',
                  fontFamily:
                    'JetBrains Mono, ui-monospace',
                }}
              >
                ≈ 4n + 3 = {ops.rmsNorm}
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 999,
                backgroundColor: '#020617',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: rmsWidth,
                  height: '100%',
                  background:
                    'linear-gradient(90deg, #22c55e, #4ade80)',
                }}
              />
            </div>
          </div>

          <p
            style={{
              marginTop: 6,
              fontSize: 11,
              color: '#9ca3af',
            }}
          >
            For this vector, RMSNorm uses roughly{' '}
            <span
              style={{
                color: '#22c55e',
                fontFamily:
                  'JetBrains Mono, ui-monospace',
              }}
            >
              {(
                (1 - 1 / ops.ratio) *
                100
              ).toFixed(1)}
              % fewer
            </span>{' '}
            scalar ops than LayerNorm.
          </p>
        </div>
      </div>

      {/* Step-by-step panels */}
      <div
        style={{
          marginTop: 20,
          display: 'grid',
          gridTemplateColumns:
            'repeat(2, minmax(0, 1fr))',
          gap: 16,
        }}
      >
        {/* LayerNorm */}
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: '1px solid #1f2937',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            LayerNorm
          </h3>
          <p
            style={{
              fontSize: 11,
              color: '#9ca3af',
              marginBottom: 10,
            }}
          >
            <span
              style={{
                color: '#e5e7eb',
                fontFamily:
                  'JetBrains Mono, ui-monospace',
              }}
            >
              y = γ · (x − μ) / σ + β
            </span>{' '}
            — centers activations then rescales & shifts.
          </p>

          <VectorRow
            label="1. Input x"
            values={activations}
            color="input"
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',
              gap: 8,
              fontSize: 11,
              marginBottom: 6,
            }}
          >
            <div>
              <span
                style={{ color: '#9ca3af' }}
              >
                Mean μ =
              </span>{' '}
              <span
                style={{
                  color: '#14b8a6',
                  fontFamily:
                    'JetBrains Mono, ui-monospace',
                }}
              >
                {layerNorm.mean.toFixed(4)}
              </span>
            </div>
            <div>
              <span
                style={{ color: '#9ca3af' }}
              >
                Std σ =
              </span>{' '}
              <span
                style={{
                  color: '#14b8a6',
                  fontFamily:
                    'JetBrains Mono, ui-monospace',
                }}
              >
                {layerNorm.std.toFixed(4)}
              </span>
            </div>
          </div>
          <VectorRow
            label="2. Subtract mean: x − μ"
            values={layerNorm.centered}
            color="intermediate"
          />
          <VectorRow
            label="3. Normalize: (x − μ) / σ"
            values={layerNorm.normalized}
            color="intermediate"
          />
          <VectorRow
            label="4. Output: γ · (x̂) + β"
            values={layerNorm.output}
            color="output"
          />
        </div>

        {/* RMSNorm */}
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: '1px solid #1f2937',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            RMSNorm
          </h3>
          <p
            style={{
              fontSize: 11,
              color: '#9ca3af',
              marginBottom: 10,
            }}
          >
            <span
              style={{
                color: '#e5e7eb',
                fontFamily:
                  'JetBrains Mono, ui-monospace',
              }}
            >
              y = γ · x / RMS(x)
            </span>{' '}
            — no centering step; just divide by the
            root-mean-square.
          </p>

          <VectorRow
            label="1. Input x"
            values={activations}
            color="input"
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',
              gap: 8,
              fontSize: 11,
              marginBottom: 6,
            }}
          >
            <div>
              <span
                style={{ color: '#9ca3af' }}
              >
                E[x²] =
              </span>{' '}
              <span
                style={{
                  color: '#14b8a6',
                  fontFamily:
                    'JetBrains Mono, ui-monospace',
                }}
              >
                {(
                  Math.pow(rmsNorm.rms, 2) - EPS
                ).toFixed(4)}
              </span>
            </div>
            <div>
              <span
                style={{ color: '#9ca3af' }}
              >
                RMS(x) =
              </span>{' '}
              <span
                style={{
                  color: '#14b8a6',
                  fontFamily:
                    'JetBrains Mono, ui-monospace',
                }}
              >
                {rmsNorm.rms.toFixed(4)}
              </span>
            </div>
          </div>
          <VectorRow
            label="2. Normalize: x / RMS(x)"
            values={rmsNorm.normalized}
            color="intermediate"
          />
          <VectorRow
            label="3. Output: γ · x̂"
            values={rmsNorm.output}
            color="output"
          />
        </div>
      </div>

      {/* Direct comparison of outputs */}
      <div
        style={{
          marginTop: 20,
          paddingTop: 12,
          borderTop: '1px solid #1f2937',
        }}
      >
        <h3
          style={{
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          Side-by-side outputs
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(3, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          <VectorRow
            label="LayerNorm output"
            values={layerNorm.output}
            color="output"
          />
          <VectorRow
            label="RMSNorm output"
            values={rmsNorm.output}
            color="output"
          />
          <VectorRow
            label="Difference: LayerNorm − RMSNorm"
            values={difference}
            color="intermediate"
          />
        </div>
        <p
          style={{
            marginTop: 8,
            fontSize: 11,
            color: '#9ca3af',
          }}
        >
          Try modifying the activations above. You&apos;ll
          see that while LayerNorm and RMSNorm follow
          slightly different math (centering vs. pure
          scaling), their outputs tend to be very close
          in practice—while RMSNorm is cheaper to compute,
          which is attractive at LLM scale.
        </p>
      </div>
    </section>
  )
}


attachments-bundle
