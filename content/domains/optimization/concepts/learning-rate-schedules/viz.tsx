import { useMemo, useState } from 'react'

type ScheduleKey = 'warmup_cosine' | 'warmup_linear' | 'sqrt' | 'constant'

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function fmt(x: number): string {
  if (x === 0) return '0'
  const a = Math.abs(x)
  if (a >= 1e-2) return x.toFixed(4)
  return x.toExponential(2)
}

export default function LearningRateSchedulesViz() {
  const [schedule, setSchedule] = useState<ScheduleKey>('warmup_cosine')
  const [totalSteps, setTotalSteps] = useState(100_000)
  const [warmupFrac, setWarmupFrac] = useState(0.02) // 2%

  // Use log sliders so the interesting region for LLMs is easy to hit.
  const [lrMaxExp, setLrMaxExp] = useState(-3.5) // ~3e-4
  const [minRatio, setMinRatio] = useState(0.1) // lr_min = ratio * lr_max

  const lrMax = Math.pow(10, lrMaxExp)
  const lrMin = lrMax * clamp01(minRatio)
  const warmupSteps = Math.max(0, Math.min(totalSteps - 1, Math.round(totalSteps * clamp01(warmupFrac))))

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

  return (
    <div className="wrap">
      <div className="controls">
        <label className="row">
          <span className="k">Schedule</span>
          <select value={schedule} onChange={(e) => setSchedule(e.target.value as ScheduleKey)}>
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
            onChange={(e) => setTotalSteps(parseInt(e.target.value, 10))}
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
            onChange={(e) => setWarmupFrac(parseFloat(e.target.value))}
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
            onChange={(e) => setLrMaxExp(parseFloat(e.target.value))}
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
            onChange={(e) => setMinRatio(parseFloat(e.target.value))}
            disabled={schedule === 'sqrt' || schedule === 'constant'}
          />
          <span className="v">{Math.round(minRatio * 100)}% ({fmt(lrMin)})</span>
        </label>
      </div>

      <div className="metrics">
        <div className="pill">
          <div className="k">lr(0)</div>
          <div className="v">{fmt(data.ys[0])}</div>
        </div>
        <div className="pill">
          <div className="k">lr(end)</div>
          <div className="v">{fmt(data.ys[data.ys.length - 1])}</div>
        </div>
        <div className="pill">
          <div className="k">avg lr</div>
          <div className="v">{fmt(data.avg)}</div>
        </div>
      </div>

      <div className="chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Learning rate schedule curve">
          <rect x="0" y="0" width={W} height={H} fill="rgba(8,12,20,0.22)" rx="14" />

          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="rgba(148,163,184,0.25)" />
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="rgba(148,163,184,0.25)" />

          {schedule !== 'sqrt' && schedule !== 'constant' && warmupSteps > 0 ? (
            <>
              <line x1={warmX} y1={padT} x2={warmX} y2={H - padB} stroke="rgba(148,163,184,0.22)" strokeDasharray="6 6" />
              <text x={warmX + 6} y={padT + 14} fontSize="11" fill="rgba(148,163,184,0.8)">
                warmup
              </text>
            </>
          ) : null}

          <path d={pathD} fill="none" stroke={accent} strokeWidth={2.25} />

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
        }
      `}</style>
    </div>
  )
}

