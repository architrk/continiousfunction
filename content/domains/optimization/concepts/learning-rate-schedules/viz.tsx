import { useEffect, useMemo, useState } from 'react'
import { emitDemoState } from '../../../../../lib/demoState'

type ScheduleKey = 'warmup_cosine' | 'warmup_linear' | 'sqrt' | 'constant'
type PredictionKey = 'twoPhase' | 'immediateDecay' | 'flat'

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  twoPhase: {
    label: 'Warmup then cool-down',
    response: 'The schedule first uses smaller early learning-rate values, then lowers the scalar step size later.',
  },
  immediateDecay: {
    label: 'Immediate decay',
    response: 'The schedule starts highest and shrinks immediately, so there is no warmup plateau to reveal.',
  },
  flat: {
    label: 'Constant pressure',
    response: 'The update scale stays fixed, so the start, average, and end learning rates coincide.',
  },
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function fmt(x: number): string {
  if (x === 0) return '0'
  const a = Math.abs(x)
  if (a >= 1e-2) return x.toFixed(4)
  return x.toExponential(2)
}

function scheduleLabel(schedule: ScheduleKey): string {
  if (schedule === 'warmup_cosine') return 'Warmup + Cosine'
  if (schedule === 'warmup_linear') return 'Warmup + Linear'
  if (schedule === 'sqrt') return '1/sqrt(t)'
  return 'Constant'
}

function scheduleBehavior(schedule: ScheduleKey): PredictionKey {
  if (schedule === 'constant') return 'flat'
  if (schedule === 'sqrt') return 'immediateDecay'
  return 'twoPhase'
}

export default function LearningRateSchedulesViz() {
  const [schedule, setSchedule] = useState<ScheduleKey>('warmup_cosine')
  const [totalSteps, setTotalSteps] = useState(100_000)
  const [warmupFrac, setWarmupFrac] = useState(0.02) // 2%

  // Use log sliders so small deep-learning learning rates are easy to inspect.
  const [lrMaxExp, setLrMaxExp] = useState(-3.5) // ~3e-4
  const [minRatio, setMinRatio] = useState(0.1) // lr_min = ratio * lr_max

  const lrMax = Math.pow(10, lrMaxExp)
  const lrMin = lrMax * clamp01(minRatio)
  const warmupSteps = Math.max(0, Math.min(totalSteps - 1, Math.round(totalSteps * clamp01(warmupFrac))))
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)

  const data = useMemo(() => {
    const N = 220
    const xs: number[] = []
    const ys: number[] = []
    const lrAt = (t: number): number => {
      if (schedule === 'constant') return lrMax
      if (schedule === 'sqrt') return lrMax / Math.sqrt(t + 1)
      if (t < warmupSteps) return lrMax * (t + 1) / Math.max(1, warmupSteps)

      const u = (t - warmupSteps) / Math.max(1, totalSteps - warmupSteps - 1)
      const frac = clamp01(u)
      if (schedule === 'warmup_linear') return lrMax + (lrMin - lrMax) * frac
      // warmup_cosine
      return lrMin + 0.5 * (lrMax - lrMin) * (1 + Math.cos(Math.PI * frac))
    }

    for (let i = 0; i < N; i++) {
      const t = Math.round((i / (N - 1)) * (totalSteps - 1))
      xs.push(t)
      ys.push(lrAt(t))
    }

    const yMin = Math.min(...ys)
    const yMax = Math.max(...ys)
    const avg = ys.reduce((a, b) => a + b, 0) / ys.length
    return { xs, ys, yMin, yMax, avg }
  }, [schedule, totalSteps, warmupSteps, lrMax, lrMin])

  const W = 720
  const H = 240
  const padL = 44
  const padR = 16
  const padT = 14
  const padB = 26

  const xToSvg = (t: number) => padL + (t / Math.max(1, totalSteps - 1)) * (W - padL - padR)
  const yToSvg = (lr: number) => {
    const denom = Math.max(1e-30, data.yMax - data.yMin)
    const u = (lr - data.yMin) / denom
    return padT + (1 - u) * (H - padT - padB)
  }

  const pathD = useMemo(() => {
    let d = ''
    for (let i = 0; i < data.xs.length; i++) {
      const x = xToSvg(data.xs[i])
      const y = yToSvg(data.ys[i])
      d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`
    }
    return d
  }, [data, totalSteps])

  const warmX = xToSvg(warmupSteps)
  const accent =
    schedule === 'warmup_cosine' ? 'rgba(99,102,241,0.9)' : schedule === 'warmup_linear' ? 'rgba(34,197,94,0.9)' : schedule === 'sqrt' ? 'rgba(245,158,11,0.9)' : 'rgba(148,163,184,0.9)'
  const isWarmupDecay = schedule === 'warmup_cosine' || schedule === 'warmup_linear'
  const endLr = data.ys[data.ys.length - 1] ?? lrMax
  const decaySteps = isWarmupDecay ? Math.max(0, totalSteps - warmupSteps) : 0
  const lrDropRatio = endLr > 0 ? lrMax / endLr : Infinity
  const scheduleShape = schedule === 'constant' ? 'flat' : schedule === 'sqrt' ? 'inverse-sqrt decay' : 'warmup then decay'
  const behavior = scheduleBehavior(schedule)
  const behaviorLabel = PREDICTIONS[behavior].label
  const predictionCorrect = prediction !== null && prediction === behavior

  const resetReveal = () => {
    setPrediction(null)
    setRevealed(false)
  }

  useEffect(() => {
    emitDemoState({
      conceptId: 'learning-rate-schedules',
      label: 'Prediction-first learning-rate schedule',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; ${scheduleLabel(schedule)} reveals ${behaviorLabel}. total steps ${totalSteps.toLocaleString()}; lr max ${fmt(lrMax)}, lr end ${fmt(endLr)}, avg lr ${fmt(data.avg)}.`
        : `Learner is predicting whether ${scheduleLabel(schedule)} will behave like warmup then cool-down, immediate decay, or constant pressure before the schedule curve is revealed.`,
      values: [
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `schedule: ${scheduleLabel(schedule)} (${schedule})`,
        `shape: ${revealed ? scheduleShape : 'hidden until reveal'}`,
        `schedule behavior: ${revealed ? behaviorLabel : 'hidden until reveal'}`,
        `total steps: ${totalSteps.toLocaleString()}`,
        `warmup fraction: ${Math.round(warmupFrac * 1000) / 10}%`,
        `warmup steps: ${isWarmupDecay ? warmupSteps.toLocaleString() : 'disabled'}`,
        `decay steps: ${isWarmupDecay ? decaySteps.toLocaleString() : 'not applicable'}`,
        `lr max: ${fmt(lrMax)}`,
        `lr min target: ${isWarmupDecay ? fmt(lrMin) : 'not applicable'}`,
        `lr at step 0: ${revealed ? fmt(data.ys[0] ?? lrMax) : 'hidden until reveal'}`,
        `lr at end: ${revealed ? fmt(endLr) : 'hidden until reveal'}`,
        `average sampled lr: ${revealed ? fmt(data.avg) : 'hidden until reveal'}`,
        `peak-to-end ratio: ${revealed ? (Number.isFinite(lrDropRatio) ? `${lrDropRatio.toFixed(2)}x` : 'infinite') : 'hidden until reveal'}`,
      ],
    })
  }, [
    behaviorLabel,
    data.avg,
    data.ys,
    decaySteps,
    endLr,
    isWarmupDecay,
    lrDropRatio,
    lrMax,
    lrMin,
    prediction,
    predictionCorrect,
    revealed,
    schedule,
    scheduleShape,
    totalSteps,
    warmupFrac,
    warmupSteps,
  ])

  return (
    <div className="wrap">
      <div className="controls">
        <label className="row">
          <span className="k">Schedule</span>
          <select
            value={schedule}
            onChange={(e) => {
              setSchedule(e.target.value as ScheduleKey)
              resetReveal()
            }}
          >
            <option value="warmup_cosine">Warmup + Cosine</option>
            <option value="warmup_linear">Warmup + Linear</option>
            <option value="sqrt">1/sqrt(t)</option>
            <option value="constant">Constant</option>
          </select>
        </label>

        <label className="row">
          <span className="k">Total steps</span>
          <input
            type="range"
            min={10_000}
            max={300_000}
            step={5_000}
            value={totalSteps}
            onChange={(e) => {
              setTotalSteps(parseInt(e.target.value, 10))
              resetReveal()
            }}
          />
          <span className="v">{totalSteps.toLocaleString()}</span>
        </label>

        <label className="row">
          <span className="k">Warmup</span>
          <input
            type="range"
            min={0}
            max={0.2}
            step={0.005}
            value={warmupFrac}
            onChange={(e) => {
              setWarmupFrac(parseFloat(e.target.value))
              resetReveal()
            }}
            disabled={schedule === 'sqrt' || schedule === 'constant'}
          />
          <span className="v">{Math.round(warmupFrac * 100)}% ({warmupSteps.toLocaleString()} steps)</span>
        </label>

        <label className="row">
          <span className="k">lr max</span>
          <input
            type="range"
            min={-5}
            max={-2}
            step={0.05}
            value={lrMaxExp}
            onChange={(e) => {
              setLrMaxExp(parseFloat(e.target.value))
              resetReveal()
            }}
          />
          <span className="v">{fmt(lrMax)}</span>
        </label>

        <label className="row">
          <span className="k">lr min ratio</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={minRatio}
            onChange={(e) => {
              setMinRatio(parseFloat(e.target.value))
              resetReveal()
            }}
            disabled={schedule === 'sqrt' || schedule === 'constant'}
          />
          <span className="v">{Math.round(minRatio * 100)}% ({fmt(lrMin)})</span>
        </label>
      </div>

      <section className="predictionPanel">
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>What behavior will the schedule curve reveal?</strong>
          <p>
            Pick the curve behavior before seeing the measured start, average, and end learning rates.
            This is the difference between naming a schedule and understanding its training role.
          </p>
        </div>
        <div className="choiceRow" role="group" aria-label="Learning-rate schedule behavior prediction">
          {(Object.keys(PREDICTIONS) as PredictionKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={prediction === key}
              className={prediction === key ? 'selected' : ''}
              onClick={() => {
                setPrediction(key)
                setRevealed(false)
              }}
            >
              {PREDICTIONS[key].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="reveal"
          disabled={prediction === null}
          onClick={() => setRevealed(true)}
        >
          Reveal curve
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `${behaviorLabel} is the schedule behavior.`}</h4>
            <p>
              {PREDICTIONS[behavior].response} Start lr is {fmt(data.ys[0] ?? lrMax)}, average lr is {fmt(data.avg)},
              and end lr is {fmt(endLr)}.
            </p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a behavior to unlock the schedule curve.' : 'Reveal the curve to test your schedule prediction.'}</p>
        )}
      </section>

      <div className="metrics">
        <div className="pill">
          <div className="k">lr(0)</div>
          <div className="v">{revealed ? fmt(data.ys[0]) : 'hidden'}</div>
        </div>
        <div className="pill">
          <div className="k">lr(end)</div>
          <div className="v">{revealed ? fmt(data.ys[data.ys.length - 1]) : 'hidden'}</div>
        </div>
        <div className="pill">
          <div className="k">avg lr</div>
          <div className="v">{revealed ? fmt(data.avg) : 'hidden'}</div>
        </div>
      </div>

      <div className="chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Learning rate schedule curve">
          <rect x="0" y="0" width={W} height={H} fill="rgba(8,12,20,0.22)" rx="14" />

          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="rgba(148,163,184,0.25)" />
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="rgba(148,163,184,0.25)" />

          {revealed && schedule !== 'sqrt' && schedule !== 'constant' && warmupSteps > 0 ? (
            <>
              <line x1={warmX} y1={padT} x2={warmX} y2={H - padB} stroke="rgba(148,163,184,0.22)" strokeDasharray="6 6" />
              <text x={warmX + 6} y={padT + 14} fontSize="11" fill="rgba(148,163,184,0.8)">
                warmup
              </text>
            </>
          ) : null}

          {revealed ? (
            <path className="schedulePath" d={pathD} fill="none" stroke={accent} strokeWidth={2.25} />
          ) : (
            <g className="curveGate">
              <rect x={W / 2 - 84} y={H / 2 - 24} width="168" height="48" rx="10" />
              <text x={W / 2} y={H / 2 + 4} textAnchor="middle">curve hidden</text>
            </g>
          )}

          <text x={padL} y={H - 8} fontSize="11" fill="rgba(148,163,184,0.75)">
            steps
          </text>
          <text x={6} y={padT + 10} fontSize="11" fill="rgba(148,163,184,0.75)">
            lr
          </text>
        </svg>
      </div>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .controls {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.5rem;
          padding: 0.75rem;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          background: rgba(8, 12, 20, 0.18);
        }

        .row {
          display: grid;
          grid-template-columns: 110px 1fr auto;
          gap: 0.6rem;
          align-items: center;
        }

        .k {
          color: var(--text-secondary);
          font-size: 0.85rem;
          letter-spacing: 0.01em;
        }

        .v {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
            monospace;
          color: var(--text-primary);
          font-size: 0.82rem;
          opacity: 0.9;
          white-space: nowrap;
        }

        select,
        input[type='range'] {
          width: 100%;
        }

        select {
          appearance: none;
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          padding: 0.45rem 0.55rem;
          background: rgba(8, 12, 20, 0.35);
          color: var(--text-primary);
        }

        .metrics {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .predictionPanel,
        .result {
          display: grid;
          gap: 0.72rem;
          min-width: 0;
          padding: 0.82rem;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          background: rgba(8, 12, 20, 0.18);
        }

        .predictionCopy {
          display: grid;
          gap: 0.32rem;
          min-width: 0;
        }

        .predictionCopy span {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
            monospace;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0;
          color: var(--text-secondary);
        }

        .predictionCopy strong,
        .result h4 {
          color: var(--text-primary);
          line-height: 1.28;
          overflow-wrap: anywhere;
        }

        .predictionCopy p,
        .result p {
          margin: 0;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .choiceRow {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.5rem;
          min-width: 0;
        }

        .choiceRow button,
        .reveal {
          min-height: 2.7rem;
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          background: rgba(8, 12, 20, 0.35);
          color: var(--text-primary);
          padding: 0.45rem 0.62rem;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }

        .choiceRow button.selected {
          border-color: rgba(99, 102, 241, 0.58);
          background: rgba(99, 102, 241, 0.18);
        }

        .reveal {
          justify-self: start;
          background: rgba(99, 102, 241, 0.88);
          border-color: rgba(99, 102, 241, 0.7);
          color: #fffaf2;
        }

        .reveal:disabled {
          opacity: 0.58;
          cursor: not-allowed;
        }

        .result {
          min-height: 5rem;
        }

        .result.shown {
          border-color: rgba(245, 158, 11, 0.28);
          background: rgba(245, 158, 11, 0.1);
        }

        .result h4 {
          margin: 0;
          font-size: 1rem;
        }

        .pill {
          border: 1px solid var(--border-subtle);
          border-radius: 999px;
          padding: 0.35rem 0.6rem;
          background: rgba(8, 12, 20, 0.25);
          display: flex;
          gap: 0.5rem;
          align-items: baseline;
        }

        .chart {
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 0.6rem;
          background: rgba(8, 12, 20, 0.18);
        }

        .schedulePath {
          stroke-dasharray: 860;
          animation: drawSchedule 1.15s ease-out both;
        }

        .curveGate rect {
          fill: rgba(8, 12, 20, 0.42);
          stroke: rgba(148, 163, 184, 0.24);
        }

        .curveGate text {
          fill: rgba(226, 232, 240, 0.82);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
            monospace;
          font-size: 12px;
        }

        @media (max-width: 560px) {
          .row {
            grid-template-columns: 1fr;
            gap: 0.25rem;
            align-items: stretch;
          }
          .v {
            justify-self: start;
          }
          .metrics {
            flex-direction: column;
          }

          .choiceRow {
            grid-template-columns: 1fr;
          }
        }

        @keyframes drawSchedule {
          from {
            stroke-dashoffset: 860;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .schedulePath {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
