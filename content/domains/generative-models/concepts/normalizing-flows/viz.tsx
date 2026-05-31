import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import VizShell from '@/components/viz/VizShell'
import VizStageAdapter from '@/components/viz/VizStageAdapter'
import { clearDemoState, emitDemoState } from '../../../../../lib/demoState'

type Prediction = 'increase' | 'decrease' | 'same'

type Transform = {
  id: string
  label: string
  matrix: [[number, number], [number, number]]
  shift: [number, number]
}

const transforms: Transform[] = [
  {
    id: 'stretch',
    label: 'wide stretch',
    matrix: [[1.7, 0.25], [0.15, 1.15]],
    shift: [0.45, -0.15],
  },
  {
    id: 'squeeze',
    label: 'narrow squeeze',
    matrix: [[0.72, -0.16], [0.08, 0.64]],
    shift: [-0.25, 0.28],
  },
  {
    id: 'shear',
    label: 'area-preserving shear',
    matrix: [[1, 0.75], [0, 1]],
    shift: [0.2, -0.2],
  },
]

const probeOptions: Array<{ label: string; x: [number, number] }> = [
  { label: 'near mode', x: [0.65, -0.1] },
  { label: 'right flank', x: [1.25, 0.35] },
  { label: 'upper tail', x: [-0.1, 1.1] },
]

const fmt = (value: number) => value.toFixed(Math.abs(value) >= 10 ? 1 : 3)
const det2 = (m: Transform['matrix']) => m[0][0] * m[1][1] - m[0][1] * m[1][0]
const inv2 = (m: Transform['matrix']): Transform['matrix'] => {
  const det = det2(m)
  return [
    [m[1][1] / det, -m[0][1] / det],
    [-m[1][0] / det, m[0][0] / det],
  ]
}
const matVec = (m: Transform['matrix'], v: [number, number]): [number, number] => [
  m[0][0] * v[0] + m[0][1] * v[1],
  m[1][0] * v[0] + m[1][1] * v[1],
]
const sub = (a: [number, number], b: [number, number]): [number, number] => [a[0] - b[0], a[1] - b[1]]
const add = (a: [number, number], b: [number, number]): [number, number] => [a[0] + b[0], a[1] + b[1]]
const logPz = (z: [number, number]) => -0.5 * (z[0] * z[0] + z[1] * z[1]) - Math.log(2 * Math.PI)
const densityColor = (logDensity: number) => Math.max(0.18, Math.min(0.92, Math.exp(logDensity + 1.9)))

function analyze(transform: Transform, x: [number, number]) {
  const det = det2(transform.matrix)
  const inverse = inv2(transform.matrix)
  const z = matVec(inverse, sub(x, transform.shift))
  const baseLog = logPz(z)
  const logInvDet = Math.log(Math.abs(1 / det))
  const logPx = baseLog + logInvDet
  const effect: Prediction = logInvDet > 0.04 ? 'increase' : logInvDet < -0.04 ? 'decrease' : 'same'
  const forwardUnitX = add(transform.shift, matVec(transform.matrix, [1, 0]))
  const forwardUnitY = add(transform.shift, matVec(transform.matrix, [0, 1]))

  return {
    det,
    inverse,
    z,
    baseLog,
    logInvDet,
    logPx,
    effect,
    forwardUnitX,
    forwardUnitY,
  }
}

function effectLabel(effect: Prediction) {
  if (effect === 'increase') return 'Density increases'
  if (effect === 'decrease') return 'Density decreases'
  return 'Density about unchanged'
}

function toSvg(point: [number, number]) {
  const scale = 62
  return {
    x: 150 + point[0] * scale,
    y: 150 - point[1] * scale,
  }
}

export default function NormalizingFlowsConceptViz() {
  const [transformId, setTransformId] = useState(transforms[0].id)
  const [probeLabel, setProbeLabel] = useState(probeOptions[0].label)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [revealed, setRevealed] = useState(false)

  const transform = transforms.find((item) => item.id === transformId) ?? transforms[0]
  const probe = probeOptions.find((item) => item.label === probeLabel) ?? probeOptions[0]
  const stats = useMemo(() => analyze(transform, probe.x), [probe.x, transform])
  const predictionCorrect = prediction === stats.effect

  useEffect(() => {
    emitDemoState({
      conceptId: 'normalizing-flows',
      label: 'Normalizing flow change-of-variables demo',
      summary: revealed
        ? `${transform.label} has det(A)=${fmt(stats.det)} and log|det A^-1|=${fmt(stats.logInvDet)}, so the Jacobian term says: ${effectLabel(stats.effect)}.`
        : `Learner is predicting whether ${transform.label} raises or lowers density through the Jacobian term before reveal.`,
      values: revealed
        ? [
            `transform: ${transform.label}`,
            `probe: ${probe.label}`,
            `prediction: ${prediction ?? 'none'}`,
            `actual: ${stats.effect}`,
            `correct: ${predictionCorrect ? 'yes' : 'no'}`,
            `det(A): ${fmt(stats.det)}`,
            `log p_z(z): ${fmt(stats.baseLog)}`,
            `log |det A^-1|: ${fmt(stats.logInvDet)}`,
            `log p_x(x): ${fmt(stats.logPx)}`,
          ]
        : [
            `transform: ${transform.label}`,
            `probe: ${probe.label}`,
            `prediction: ${prediction ?? 'none'}`,
            `revealed: no`,
          ],
    })
  }, [
    prediction,
    predictionCorrect,
    probe.label,
    revealed,
    stats.baseLog,
    stats.det,
    stats.effect,
    stats.logInvDet,
    stats.logPx,
    transform.label,
  ])

  useEffect(() => {
    return () => clearDemoState('normalizing-flows')
  }, [])

  const resetReveal = () => setRevealed(false)
  const origin = toSvg(transform.shift)
  const unitX = toSvg(stats.forwardUnitX)
  const unitY = toSvg(stats.forwardUnitY)
  const probeSvg = toSvg(probe.x)
  const inverseSvg = toSvg(stats.z)

  return (
    <VizShell
      eyebrow="Interactive demo"
      title="Normalizing flows: predict the Jacobian density correction"
      subtitle="Choose an invertible warp and a data-space probe, then predict whether the volume term raises, lowers, or preserves density."
      metrics={['x = A z + b', 'z = A^-1(x-b)', 'det A', 'log p_x = log p_z - log|det A|']}
      challenge={
        <p>
          Before reveal, commit to the sign of the Jacobian correction. Stretching
          space spreads probability mass out; squeezing space concentrates it.
        </p>
      }
      notes={
        <p>
          This is a two-dimensional linear flow so the determinant is visible.
          Real normalizing flows compose many invertible layers engineered so the
          inverse and log-determinant remain tractable.
        </p>
      }
    >
      <VizStageAdapter padding="normal">
        <div className="flow-demo">
          <div className="controls" aria-label="Normalizing flow demo controls">
            <div className="control-group">
              <span>Invertible transform</span>
              <div className="segmented">
                {transforms.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={transform.id === option.id ? 'active' : ''}
                    onClick={() => {
                      setTransformId(option.id)
                      resetReveal()
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <span>Probe point x</span>
              <div className="segmented">
                {probeOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={probe.label === option.label ? 'active' : ''}
                    onClick={() => {
                      setProbeLabel(option.label)
                      resetReveal()
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <section className="prediction-panel">
            <h4>Predict the Jacobian term</h4>
            <div className="choice-row" role="group" aria-label="Flow density correction prediction">
              {[
                ['increase', 'density increases'],
                ['decrease', 'density decreases'],
                ['same', 'about unchanged'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={prediction === value ? 'selected' : ''}
                  onClick={() => {
                    setPrediction(value as Prediction)
                    resetReveal()
                  }}
                  aria-pressed={prediction === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <div className="stage-grid">
            <section className="map-panel">
              <div className="panel-head">
                <h4>Data-space warp</h4>
                <span>{revealed ? `det A ${fmt(stats.det)}` : 'det hidden'}</span>
              </div>
              <svg viewBox="0 0 300 300" role="img" aria-label="Invertible linear flow map">
                <defs>
                  <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(24,34,45,0.08)" strokeWidth="1" />
                  </pattern>
                  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#1b7180" />
                  </marker>
                </defs>
                <rect x="0" y="0" width="300" height="300" fill="url(#grid)" />
                <line x1="20" y1="150" x2="280" y2="150" stroke="rgba(24,34,45,0.18)" />
                <line x1="150" y1="280" x2="150" y2="20" stroke="rgba(24,34,45,0.18)" />
                <polygon
                  points={`150,150 ${unitX.x},${unitX.y} ${toSvg(add(stats.forwardUnitX, sub(stats.forwardUnitY, transform.shift))).x},${toSvg(add(stats.forwardUnitX, sub(stats.forwardUnitY, transform.shift))).y} ${unitY.x},${unitY.y}`}
                  fill="rgba(27,113,128,0.14)"
                  stroke="#1b7180"
                  strokeWidth="2"
                />
                <line x1={origin.x} y1={origin.y} x2={unitX.x} y2={unitX.y} stroke="#1b7180" strokeWidth="3" markerEnd="url(#arrow)" />
                <line x1={origin.x} y1={origin.y} x2={unitY.x} y2={unitY.y} stroke="#8f3d2b" strokeWidth="3" markerEnd="url(#arrow)" />
                <circle cx={probeSvg.x} cy={probeSvg.y} r="7" fill="#24313d" />
                <text x={probeSvg.x + 9} y={probeSvg.y - 8}>x</text>
              </svg>
              <p>The parallelogram area is |det A|. It is hidden conceptually until reveal.</p>
            </section>

            <section className="density-panel">
              <div className="panel-head">
                <h4>Inverse lookup</h4>
                <span>{revealed ? `z=(${fmt(stats.z[0])}, ${fmt(stats.z[1])})` : 'z hidden'}</span>
              </div>
              <svg viewBox="0 0 300 300" role="img" aria-label="Base Gaussian inverse point">
                <rect x="0" y="0" width="300" height="300" fill="#fffaf0" />
                {[2.2, 1.6, 1.0, 0.45].map((radius) => (
                  <circle
                    key={radius}
                    cx="150"
                    cy="150"
                    r={radius * 52}
                    fill="none"
                    stroke="rgba(27,113,128,0.14)"
                    strokeWidth="2"
                  />
                ))}
                <line x1="20" y1="150" x2="280" y2="150" stroke="rgba(24,34,45,0.16)" />
                <line x1="150" y1="280" x2="150" y2="20" stroke="rgba(24,34,45,0.16)" />
                <circle
                  cx={revealed ? inverseSvg.x : 150}
                  cy={revealed ? inverseSvg.y : 150}
                  r="8"
                  fill={`rgba(143,61,43,${revealed ? densityColor(stats.baseLog) : 0.35})`}
                  stroke="#8f3d2b"
                  strokeWidth="2"
                />
                <text x={(revealed ? inverseSvg.x : 150) + 10} y={(revealed ? inverseSvg.y : 150) - 9}>z</text>
              </svg>
              <p>The inverse maps x back to the base Gaussian before applying the volume correction.</p>
            </section>

            <section className="reveal-panel">
              <h4>Reveal</h4>
              <dl>
                <div>
                  <dt>log p_z(z)</dt>
                  <dd>{revealed ? fmt(stats.baseLog) : 'Hidden'}</dd>
                </div>
                <div>
                  <dt>log |det A^-1|</dt>
                  <dd>{revealed ? fmt(stats.logInvDet) : 'Hidden'}</dd>
                </div>
                <div>
                  <dt>log p_x(x)</dt>
                  <dd>{revealed ? fmt(stats.logPx) : 'Hidden'}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="reveal"
                disabled={!prediction}
                onClick={() => setRevealed(true)}
              >
                Reveal likelihood
              </button>
              {!prediction ? <p className="hint">Choose a density prediction to unlock the reveal.</p> : null}
            </section>
          </div>

          <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
            {revealed ? (
              <>
                <div className="result-copy">
                  <h4>{predictionCorrect ? 'Prediction matches.' : 'The change-of-variables invariant is visible.'}</h4>
                  <p>
                    {effectLabel(stats.effect)} because log |det A^-1| is {fmt(stats.logInvDet)}.
                    The exact likelihood is not just "how Gaussian is z"; it also
                    pays for how the inverse map changes volume around x.
                  </p>
                </div>
                <div className="equation-table" role="table" aria-label="Normalizing flow likelihood terms">
                  <div className="table-row head" role="row">
                    <span>term</span>
                    <span>value</span>
                    <span>meaning</span>
                  </div>
                  <div className="table-row" role="row">
                    <span>base</span>
                    <span>{fmt(stats.baseLog)}</span>
                    <span>Gaussian score at z</span>
                  </div>
                  <div className="table-row best" role="row">
                    <span>Jacobian</span>
                    <span>{fmt(stats.logInvDet)}</span>
                    <span>volume correction</span>
                  </div>
                  <div className="table-row" role="row">
                    <span>total</span>
                    <span>{fmt(stats.logPx)}</span>
                    <span>exact log likelihood</span>
                  </div>
                </div>
              </>
            ) : (
              <p>
                The determinant and inverse point are hidden until you commit.
                The reveal separates base-density fit from the invertible map's
                local volume change.
              </p>
            )}
          </section>
        </div>

        <style jsx>{`
          .flow-demo {
            display: grid;
            gap: 1rem;
            color: #18222d;
          }

          .controls,
          .stage-grid {
            display: grid;
            gap: 0.75rem;
          }

          .controls {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .stage-grid {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(220px, 0.8fr);
          }

          .control-group,
          .prediction-panel,
          .map-panel,
          .density-panel,
          .reveal-panel,
          .result {
            border: 1px solid rgba(24, 34, 45, 0.1);
            background: rgba(255, 253, 248, 0.8);
            border-radius: 14px;
            padding: 0.85rem;
            min-width: 0;
          }

          h4,
          .control-group > span,
          .panel-head {
            color: #30404f;
            font-size: 0.82rem;
          }

          h4,
          .control-group > span {
            display: block;
            margin: 0 0 0.55rem;
            font-weight: 800;
          }

          .segmented,
          .choice-row {
            display: flex;
            flex-wrap: wrap;
            gap: 0.45rem;
          }

          button {
            min-height: 34px;
            border: 1px solid rgba(24, 34, 45, 0.14);
            border-radius: 999px;
            background: #fffaf0;
            color: #293947;
            font: inherit;
            font-size: 0.78rem;
            font-weight: 700;
            padding: 0.45rem 0.7rem;
            cursor: pointer;
          }

          button:hover,
          button:focus-visible {
            border-color: #1b7180;
            outline: none;
          }

          button.active,
          button.selected {
            background: #1b7180;
            border-color: #1b7180;
            color: #ffffff;
          }

          button:disabled {
            cursor: not-allowed;
            opacity: 0.52;
          }

          .panel-head {
            display: flex;
            justify-content: space-between;
            gap: 0.6rem;
            align-items: baseline;
            margin-bottom: 0.7rem;
          }

          .panel-head h4 {
            margin: 0;
          }

          .panel-head span {
            color: #66727d;
            font-family: var(--font-mono);
            font-size: 0.72rem;
          }

          svg {
            display: block;
            width: 100%;
            height: auto;
            border-radius: 12px;
            border: 1px solid rgba(24, 34, 45, 0.08);
            background: #fffaf0;
          }

          text {
            fill: #24313d;
            font-family: var(--font-mono);
            font-size: 13px;
            font-weight: 800;
          }

          .map-panel p,
          .density-panel p,
          .hint,
          .result p {
            margin: 0.7rem 0 0;
            color: #52606c;
            font-size: 0.86rem;
            line-height: 1.55;
          }

          dl {
            display: grid;
            gap: 0.55rem;
            margin: 0 0 0.8rem;
          }

          dl div {
            display: flex;
            justify-content: space-between;
            gap: 0.65rem;
            border-bottom: 1px solid rgba(24, 34, 45, 0.08);
            padding-bottom: 0.45rem;
          }

          dt {
            color: #66727d;
            font-size: 0.78rem;
          }

          dd {
            margin: 0;
            color: #24313d;
            font-family: var(--font-mono);
            font-size: 0.78rem;
            text-align: right;
          }

          .reveal {
            width: 100%;
            border-radius: 10px;
            background: #24313d;
            border-color: #24313d;
            color: #ffffff;
          }

          .result {
            background: rgba(245, 248, 246, 0.92);
          }

          .result.shown {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr);
            gap: 0.85rem;
          }

          .result h4 {
            margin: 0;
            color: #1d5f68;
          }

          .equation-table {
            display: grid;
            gap: 0.25rem;
            align-content: start;
            min-width: 0;
          }

          .table-row {
            display: grid;
            grid-template-columns: 0.75fr 0.55fr 1.2fr;
            gap: 0.45rem;
            padding: 0.5rem 0.55rem;
            border-radius: 9px;
            background: rgba(255, 255, 255, 0.74);
            color: #344654;
            font-family: var(--font-mono);
            font-size: 0.72rem;
          }

          .table-row.head {
            background: transparent;
            color: #66727d;
            font-weight: 800;
          }

          .table-row.best {
            background: #e6f2f1;
            color: #155d68;
            font-weight: 800;
          }

          @media (max-width: 900px) {
            .controls,
            .stage-grid,
            .result.shown {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 520px) {
            .equation-table {
              overflow-x: auto;
            }

            .table-row {
              min-width: 430px;
            }
          }
        `}</style>
      </VizStageAdapter>
    </VizShell>
  )
}
