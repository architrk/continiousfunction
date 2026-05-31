'use client'

import { useMemo, useState } from 'react'

type VerifierMode = 'clean' | 'noisy'

type Trace = {
  id: string
  label: string
  prior: number
  correct: boolean
  cleanScore: number
  noisyScore: number
  note: string
}

const TRACES: Trace[] = [
  {
    id: 'commonWrong',
    label: 'common wrong algebra',
    prior: 0.5,
    correct: false,
    cleanScore: -2,
    noisyScore: -2,
    note: 'The base model samples this often, but the verifier ranks it low.',
  },
  {
    id: 'plausibleSlip',
    label: 'plausible slip',
    prior: 0.25,
    correct: false,
    cleanScore: -0.3,
    noisyScore: -0.3,
    note: 'A wrong trace with a few locally plausible moves.',
  },
  {
    id: 'cleanCorrect',
    label: 'clean correct trace',
    prior: 0.18,
    correct: true,
    cleanScore: 1.8,
    noisyScore: 1.8,
    note: 'The only correct trace in this finite teaching toy.',
  },
  {
    id: 'rareExploit',
    label: 'rare verifier exploit',
    prior: 0.07,
    correct: false,
    cleanScore: 0.2,
    noisyScore: 2.6,
    note: 'Rare, wrong, and ranked too high by the noisy verifier.',
  },
]

const MAX_SAMPLES = 128
const CHART_WIDTH = 520
const CHART_HEIGHT = 190
const MARGIN = { top: 14, right: 16, bottom: 30, left: 38 }
const INNER_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right
const INNER_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom

function fmt(value: number) {
  const clean = Math.abs(value) < 0.0005 ? 0 : value
  return clean.toFixed(3)
}

function fmtPct(value: number) {
  return `${Math.round(value * 100)}%`
}

function scoreFor(trace: Trace, mode: VerifierMode) {
  return mode === 'clean' ? trace.cleanScore : trace.noisyScore
}

function selectedDistribution(traces: Trace[], samples: number, mode: VerifierMode) {
  const ranked = [...traces].sort((a, b) => scoreFor(a, mode) - scoreFor(b, mode))
  let cumulative = 0
  const selected = new Map<string, number>()

  for (const trace of ranked) {
    const nextCumulative = cumulative + trace.prior
    selected.set(trace.id, Math.pow(nextCumulative, samples) - Math.pow(cumulative, samples))
    cumulative = nextCumulative
  }

  return traces.map((trace) => selected.get(trace.id) ?? 0)
}

function expected(values: number[], weights: number[]) {
  return values.reduce((sum, value, index) => sum + value * weights[index], 0)
}

function selectedAccuracy(samples: number, mode: VerifierMode) {
  const selected = selectedDistribution(TRACES, samples, mode)
  return expected(
    TRACES.map((trace) => (trace.correct ? 1 : 0)),
    selected,
  )
}

function selectedScore(samples: number, mode: VerifierMode) {
  const selected = selectedDistribution(TRACES, samples, mode)
  return expected(
    TRACES.map((trace) => scoreFor(trace, mode)),
    selected,
  )
}

function coverage(samples: number) {
  const correctMass = TRACES.reduce((sum, trace) => sum + (trace.correct ? trace.prior : 0), 0)
  return 1 - Math.pow(1 - correctMass, samples)
}

export default function TestTimeComputeViz() {
  const [mode, setMode] = useState<VerifierMode>('clean')
  const [samples, setSamples] = useState(16)

  const data = useMemo(() => {
    const selected = selectedDistribution(TRACES, samples, mode)
    const rows = TRACES.map((trace, index) => ({
      ...trace,
      score: scoreFor(trace, mode),
      selected: selected[index],
    })).sort((a, b) => b.score - a.score)
    const accuracy = selectedAccuracy(samples, mode)
    const baseAccuracy = selectedAccuracy(1, mode)
    const previousAccuracy = selectedAccuracy(Math.max(1, samples - 1), mode)
    const marginalGain = samples === 1 ? 0 : accuracy - previousAccuracy
    const expectedScore = selectedScore(samples, mode)
    const selectedExploit = rows.find((row) => row.id === 'rareExploit')?.selected ?? 0
    const curve = Array.from({ length: MAX_SAMPLES }, (_, index) => {
      const n = index + 1
      return {
        samples: n,
        accuracy: selectedAccuracy(n, mode),
        coverage: coverage(n),
        exploit: selectedDistribution(TRACES, n, mode)[TRACES.findIndex((trace) => trace.id === 'rareExploit')],
      }
    })

    return {
      rows,
      curve,
      accuracy,
      baseAccuracy,
      coverage: coverage(samples),
      expectedScore,
      selectedExploit,
      marginalGain,
      warning: mode === 'noisy' && marginalGain < 0,
    }
  }, [mode, samples])

  const x = (n: number) => MARGIN.left + ((n - 1) / (MAX_SAMPLES - 1)) * INNER_WIDTH
  const y = (value: number) => MARGIN.top + (1 - value) * INNER_HEIGHT
  const path = (key: 'accuracy' | 'coverage' | 'exploit') =>
    data.curve.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.samples)} ${y(point[key])}`).join(' ')

  return (
    <div className="demo">
      <div className="controls" aria-label="Test-time compute controls">
        <label>
          <span>verifier mode</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as VerifierMode)}>
            <option value="clean">clean verifier</option>
            <option value="noisy">noisy verifier</option>
          </select>
        </label>
        <label>
          <span>sample budget N</span>
          <input type="range" min="1" max={MAX_SAMPLES} step="1" value={samples} onChange={(event) => setSamples(Number(event.target.value))} />
          <strong>{samples}</strong>
        </label>
      </div>

      <div className="layout">
        <section className="panel">
          <div className="sectionHead">
            <div>
              <h3>four complete traces</h3>
              <p>The selector only sees verifier scores. True correctness is shown here as an educational witness.</p>
            </div>
            <code>{mode === 'clean' ? 'clean verifier score' : 'noisy verifier score'}</code>
          </div>

          <div className="candidateGrid">
            {data.rows.map((row) => (
              <article key={row.id} className={`candidate ${row.correct ? 'correct' : 'wrong'}`}>
                <div className="candidateHead">
                  <strong>{row.label}</strong>
                  <span>{row.correct ? 'correct' : 'wrong'}</span>
                </div>
                <p>{row.note}</p>
                <Bar label="base p" value={row.prior} color="#8a98a8" />
                <Bar label="selected" value={row.selected} color={row.correct ? '#1f6f78' : '#b44b3b'} />
                <div className="scoreLine">
                  <span>score</span>
                  <code>{fmt(row.score)}</code>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3>coverage is not selection</h3>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="Coverage, selected correctness, and exploit selection as sample count rises">
            <line x1={MARGIN.left} x2={MARGIN.left + INNER_WIDTH} y1={MARGIN.top + INNER_HEIGHT} y2={MARGIN.top + INNER_HEIGHT} stroke="currentColor" opacity="0.35" />
            <line x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={MARGIN.top + INNER_HEIGHT} stroke="currentColor" opacity="0.35" />
            <path d={path('coverage')} fill="none" stroke="#8a98a8" strokeWidth="2" strokeDasharray="5 5" />
            <path d={path('accuracy')} fill="none" stroke="#1f6f78" strokeWidth="2.5" />
            {mode === 'noisy' && <path d={path('exploit')} fill="none" stroke="#b44b3b" strokeWidth="2.2" />}
            <line x1={x(samples)} x2={x(samples)} y1={MARGIN.top} y2={MARGIN.top + INNER_HEIGHT} stroke="currentColor" strokeDasharray="4 4" opacity="0.45" />
            <text x={MARGIN.left + 4} y={MARGIN.top + 14} fontSize="12" fill="#1f6f78">selected correct</text>
            <text x={MARGIN.left + 4} y={MARGIN.top + 31} fontSize="12" fill="#65717d">sampled correct</text>
            {mode === 'noisy' && <text x={MARGIN.left + 4} y={MARGIN.top + 48} fontSize="12" fill="#b44b3b">selected exploit</text>}
            <text x={MARGIN.left + INNER_WIDTH / 2} y={CHART_HEIGHT - 8} textAnchor="middle" fontSize="12" fill="currentColor">samples N</text>
          </svg>

          <div className="metrics">
            <Metric label="selected correctness" value={data.accuracy} />
            <Metric label="sampled correct" value={data.coverage} />
            <Metric label="N=1 baseline" value={data.baseAccuracy} />
            <Metric label="E selected score" value={data.expectedScore} />
            <Metric label="selected exploit" value={data.selectedExploit} />
            <Metric label="last-sample gain" value={data.marginalGain} />
          </div>

          <p className={data.warning ? 'warning' : 'claim'}>
            {data.warning
              ? 'The rare high-scoring wrong trace is now appearing often enough that more inference compute reduces true correctness, even as selected score rises.'
              : mode === 'noisy'
                ? 'Extra samples improve coverage and can improve selected correctness at small N, but the rare higher-scoring proxy error can eventually erase those gains.'
                : 'Extra samples improve coverage, and because the clean verifier ranks the correct trace highest, selected correctness rises toward coverage.'}
          </p>
        </section>
      </div>

      <style jsx>{`
        .demo {
          display: grid;
          gap: 0.8rem;
        }

        .controls,
        .panel {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 252, 246, 0.82);
        }

        .controls {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          padding: 0.75rem;
        }

        label {
          display: grid;
          min-width: 0;
          gap: 0.35rem;
          color: #536170;
          font-size: 0.75rem;
        }

        select,
        input[type='range'] {
          width: 100%;
        }

        select {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.16);
          border-radius: 7px;
          background: white;
          color: #17202a;
          padding: 0.42rem 0.5rem;
          font: inherit;
        }

        strong,
        code,
        .demo :global(.metric strong) {
          color: #17202a;
          font-family: var(--font-mono);
        }

        .layout {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 0.75rem;
        }

        .panel {
          padding: 0.75rem;
        }

        .sectionHead {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: flex-start;
          margin-bottom: 0.7rem;
        }

        h3,
        p {
          margin: 0;
        }

        h3 {
          color: #1b2430;
          font-size: 0.95rem;
        }

        .sectionHead p,
        .candidate p,
        .claim,
        .warning {
          color: #627080;
          font-size: 0.78rem;
          line-height: 1.45;
        }

        .candidateGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.6rem;
        }

        .candidate {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.58);
          padding: 0.65rem;
        }

        .candidateHead {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          align-items: center;
          color: #1b2430;
          font-size: 0.82rem;
          margin-bottom: 0.35rem;
        }

        .candidateHead span {
          border-radius: 999px;
          background: rgba(27, 36, 48, 0.08);
          color: #536170;
          padding: 0.12rem 0.42rem;
          font-size: 0.65rem;
          font-weight: 700;
        }

        .candidate.correct .candidateHead span {
          background: rgba(31, 111, 120, 0.12);
          color: #1f6f78;
        }

        .candidate.wrong .candidateHead span {
          background: rgba(180, 75, 59, 0.12);
          color: #8a3328;
        }

        .scoreLine {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          margin-top: 0.45rem;
          color: #65717d;
          font-size: 0.7rem;
        }

        svg {
          display: block;
          width: 100%;
          height: auto;
          color: #1b2430;
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.45rem;
          margin-top: 0.6rem;
        }

        .claim,
        .warning {
          margin-top: 0.7rem;
          border-left: 3px solid #1f6f78;
          background: rgba(31, 111, 120, 0.1);
          color: #214f58;
          padding: 0.6rem 0.7rem;
          border-radius: 0 8px 8px 0;
        }

        .warning {
          border-left-color: #b44b3b;
          background: rgba(180, 75, 59, 0.1);
          color: #662b22;
        }

        @media (max-width: 960px) {
          .layout,
          .candidateGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .controls,
          .metrics {
            grid-template-columns: 1fr;
          }

          .sectionHead {
            display: grid;
          }
        }
      `}</style>
    </div>
  )
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="barRow">
      <span>{label}</span>
      <div className="track" aria-label={`${label}: ${fmtPct(value)}`}>
        <div className="fill" style={{ width: `${Math.max(2, value * 100)}%`, background: color }} />
      </div>
      <code>{fmtPct(value)}</code>
      <style jsx>{`
        .barRow {
          display: grid;
          grid-template-columns: 4.2rem minmax(0, 1fr) 2.7rem;
          gap: 0.45rem;
          align-items: center;
          color: #65717d;
          font-size: 0.7rem;
          margin-top: 0.35rem;
        }

        .track {
          height: 0.55rem;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(27, 36, 48, 0.08);
        }

        .fill {
          height: 100%;
          border-radius: inherit;
        }

        code {
          color: #17202a;
          font-family: var(--font-mono);
        }
      `}</style>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{fmt(value)}</strong>
      <style jsx>{`
        .metric {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.58);
          padding: 0.45rem;
        }

        span {
          display: block;
          color: #65717d;
          font-size: 0.66rem;
        }

        strong {
          display: block;
          overflow-wrap: anywhere;
          color: #17202a;
          font-family: var(--font-mono);
          font-size: 0.82rem;
        }
      `}</style>
    </div>
  )
}
