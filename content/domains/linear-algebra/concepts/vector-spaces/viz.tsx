import { useEffect, useMemo, useRef, useState } from 'react'
import { clearDemoState, emitDemoState } from '../../../../../lib/demoState'
import type { Point2D } from '../../../../../lib/mathObjects'
import { clamp, MATH_COLORS } from '../../../../../lib/mathObjects'

type DragTarget = 'u' | 'v'
export type SpanPrediction = 'plane' | 'near' | 'collapsed'

type SpanClassification = {
  outcome: SpanPrediction
  determinant: number
  area: number
  normalizedArea: number
  dimension: 0 | 1 | 2
}

const VIEW_W = 560
const VIEW_H = 420

const SCALE = 50 // pixels per unit
const ORIGIN: Point2D = [VIEW_W / 2, VIEW_H / 2]
const ZERO_NORM_EPS = 0.025
const COLLINEAR_AREA_EPS = 1e-6
const NEAR_AREA_THRESHOLD = 0.18

const PREDICTION_COPY: Record<SpanPrediction, { label: string; detail: string; status: string }> = {
  plane: {
    label: 'Sweeps a 2D plane',
    detail: 'The two generators point in genuinely different directions.',
    status: 'plane span',
  },
  near: {
    label: 'Nearly collapsed',
    detail: 'The generators almost align, so combinations form a thin strip.',
    status: 'nearly collapsed',
  },
  collapsed: {
    label: 'Collapsed to line/point',
    detail: 'The generators are scalar multiples, or one/both are effectively zero.',
    status: 'line or point span',
  },
}

const toSvg = ([x, y]: Point2D): Point2D => {
  return [ORIGIN[0] + x * SCALE, ORIGIN[1] - y * SCALE]
}

const fromSvg = ([sx, sy]: Point2D): Point2D => {
  return [(sx - ORIGIN[0]) / SCALE, -(sy - ORIGIN[1]) / SCALE]
}

const fmt = (n: number): string => {
  const r = Math.round(n * 100) / 100
  return (Math.abs(r) < 0.005 ? 0 : r).toFixed(2)
}

export function classifySpan(u: Point2D, v: Point2D): SpanClassification {
  const determinant = u[0] * v[1] - u[1] * v[0]
  const area = Math.abs(determinant)
  const uNorm = Math.hypot(u[0], u[1])
  const vNorm = Math.hypot(v[0], v[1])
  const normalizedArea = uNorm > ZERO_NORM_EPS && vNorm > ZERO_NORM_EPS ? area / (uNorm * vNorm) : 0

  if (uNorm <= ZERO_NORM_EPS && vNorm <= ZERO_NORM_EPS) {
    return { outcome: 'collapsed', determinant, area, normalizedArea, dimension: 0 }
  }

  if (uNorm <= ZERO_NORM_EPS || vNorm <= ZERO_NORM_EPS || normalizedArea <= COLLINEAR_AREA_EPS) {
    return { outcome: 'collapsed', determinant, area, normalizedArea, dimension: 1 }
  }

  if (normalizedArea < NEAR_AREA_THRESHOLD) {
    return { outcome: 'near', determinant, area, normalizedArea, dimension: 2 }
  }

  return { outcome: 'plane', determinant, area, normalizedArea, dimension: 2 }
}

export default function VectorSpacesViz() {
  const svgRef = useRef<SVGSVGElement | null>(null)

  const [u, setU] = useState<Point2D>([2.2, 1.4])
  const [v, setV] = useState<Point2D>([-1.2, 2.1])
  const [a, setA] = useState(1)
  const [b, setB] = useState(1)
  const [showParallelogram, setShowParallelogram] = useState(true)
  const [prediction, setPrediction] = useState<SpanPrediction | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [drag, setDrag] = useState<{ target: DragTarget; pointerId: number } | null>(null)

  const au = useMemo<Point2D>(() => [a * u[0], a * u[1]], [a, u])
  const bv = useMemo<Point2D>(() => [b * v[0], b * v[1]], [b, v])
  const w = useMemo<Point2D>(() => [au[0] + bv[0], au[1] + bv[1]], [au, bv])
  const span = useMemo(() => classifySpan(u, v), [u, v])
  const actualCopy = PREDICTION_COPY[span.outcome]
  const predictionCorrect = prediction === span.outcome

  const uSvg = useMemo(() => toSvg(u), [u])
  const vSvg = useMemo(() => toSvg(v), [v])
  const auSvg = useMemo(() => toSvg(au), [au])
  const bvSvg = useMemo(() => toSvg(bv), [bv])
  const wSvg = useMemo(() => toSvg(w), [w])
  const wMagnitude = Math.hypot(w[0], w[1])

  const grid = useMemo(() => {
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; bold: boolean }> = []
    const max = 5

    for (let i = -max; i <= max; i++) {
      const x = ORIGIN[0] + i * SCALE
      const y = ORIGIN[1] - i * SCALE
      const bold = i === 0

      // vertical
      lines.push({ x1: x, y1: 0, x2: x, y2: VIEW_H, bold })
      // horizontal
      lines.push({ x1: 0, y1: y, x2: VIEW_W, y2: y, bold })
    }

    return lines
  }, [])

  const resetSpanReveal = () => {
    setPrediction(null)
    setRevealed(false)
    clearDemoState('vector-spaces')
  }

  const setByTarget = (target: DragTarget, next: Point2D) => {
    const clamped: Point2D = [clamp(next[0], -5, 5), clamp(next[1], -5, 5)]
    resetSpanReveal()
    if (target === 'u') setU(clamped)
    else setV(clamped)
  }

  const pointerToSvgPoint = (clientX: number, clientY: number): Point2D | null => {
    const el = svgRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null

    const x = ((clientX - rect.left) / rect.width) * VIEW_W
    const y = ((clientY - rect.top) / rect.height) * VIEW_H
    return [x, y]
  }

  const onHandleDown = (target: DragTarget) => (e: React.PointerEvent<SVGCircleElement>) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // non-fatal
    }

    setDrag({ target, pointerId: e.pointerId })
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return
    if (e.pointerId !== drag.pointerId) return

    const p = pointerToSvgPoint(e.clientX, e.clientY)
    if (!p) return

    setByTarget(drag.target, fromSvg(p))
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return
    if (e.pointerId !== drag.pointerId) return
    setDrag(null)
  }

  const setBasisPair = () => {
    resetSpanReveal()
    setU([2.2, 1.4])
    setV([-1.2, 2.1])
    setA(1)
    setB(1)
    setShowParallelogram(true)
  }

  const setLineSpan = () => {
    resetSpanReveal()
    setU([2, 1])
    setV([4, 2])
    setA(1)
    setB(0.5)
    setShowParallelogram(true)
  }

  const setNearSpan = () => {
    resetSpanReveal()
    setU([2, 1])
    setV([4, 2.4])
    setA(0.8)
    setB(0.7)
    setShowParallelogram(true)
  }

  const choosePrediction = (next: SpanPrediction) => {
    setPrediction(next)
    setRevealed(false)
    clearDemoState('vector-spaces')
  }

  useEffect(() => {
    clearDemoState('vector-spaces')
    return () => clearDemoState('vector-spaces')
  }, [])

  useEffect(() => {
    if (!revealed || !prediction) {
      clearDemoState('vector-spaces')
      return
    }

    emitDemoState({
      conceptId: 'vector-spaces',
      label: 'Vector-space span-collapse witness',
      summary: `Predicted ${PREDICTION_COPY[prediction].status}; actual ${actualCopy.status}. u=(${fmt(u[0])}, ${fmt(u[1])}), v=(${fmt(v[0])}, ${fmt(v[1])}); det[u v]=${fmt(span.determinant)}, area=${fmt(span.area)}, normalized area=${fmt(span.normalizedArea)}; w=a u + b v=(${fmt(w[0])}, ${fmt(w[1])}) from a=${fmt(a)}, b=${fmt(b)}. Closure holds in R^2.`,
      values: [
        `prediction phase: revealed`,
        `learner prediction: ${PREDICTION_COPY[prediction].status}`,
        `actual span outcome: ${actualCopy.status}`,
        `prediction correct: ${predictionCorrect ? 'yes' : 'no'}`,
        `u: (${fmt(u[0])}, ${fmt(u[1])})`,
        `v: (${fmt(v[0])}, ${fmt(v[1])})`,
        `a: ${fmt(a)}`,
        `b: ${fmt(b)}`,
        `a u: (${fmt(au[0])}, ${fmt(au[1])})`,
        `b v: (${fmt(bv[0])}, ${fmt(bv[1])})`,
        `w=a u + b v: (${fmt(w[0])}, ${fmt(w[1])})`,
        `det[u v]: ${fmt(span.determinant)}`,
        `parallelogram area: ${fmt(span.area)}`,
        `normalized area |det|/(|u||v|): ${fmt(span.normalizedArea)}`,
        `span dimension: ${span.dimension}`,
        `|w|: ${fmt(wMagnitude)}`,
        `parallelogram visible: ${showParallelogram ? 'yes' : 'no'}`,
      ],
    })
  }, [a, actualCopy.status, au, b, bv, prediction, predictionCorrect, revealed, showParallelogram, span, u, v, w, wMagnitude])

  return (
    <div className="wrap">
      <div className="controls">
        <div className="row">
          <label className="lbl">
            <span className="lblTop">a (scale u)</span>
            <span className="lblVal">{fmt(a)}</span>
          </label>
          <input
            aria-label="a (scale u)"
            type="range"
            min={-2}
            max={2}
            step={0.01}
            value={a}
            onChange={(e) => setA(Number(e.target.value))}
          />
        </div>

        <div className="row">
          <label className="lbl">
            <span className="lblTop">b (scale v)</span>
            <span className="lblVal">{fmt(b)}</span>
          </label>
          <input
            aria-label="b (scale v)"
            type="range"
            min={-2}
            max={2}
            step={0.01}
            value={b}
            onChange={(e) => setB(Number(e.target.value))}
          />
        </div>

        <div className="row toggles">
          <button type="button" className="btn" onClick={setBasisPair}>
            Pair A
          </button>
          <button type="button" className="btn" onClick={setLineSpan}>
            Pair B
          </button>
          <button type="button" className="btn" onClick={setNearSpan}>
            Pair C
          </button>
        </div>

        <div className="eq">
          <div className="eqLine">
            <span className="mono">u</span> = ({fmt(u[0])}, {fmt(u[1])})
            <span className="dot" />
            <span className="mono">v</span> = ({fmt(v[0])}, {fmt(v[1])})
          </div>
          <div className="eqLine">
            <span className="mono">w</span> = <span className="mono">a u + b v</span> = ({fmt(w[0])}, {fmt(w[1])})
          </div>
          {revealed ? (
            <div className="eqLine emph">
              <span className="mono">det[u v]</span> = {fmt(span.determinant)}
              <span className="dot" />
              <span className="mono">area</span> = {fmt(span.area)}
              <span className="dot" />
              <span className="mono">normalized area</span> = {fmt(span.normalizedArea)}
              <span className="status">{actualCopy.status}</span>
            </div>
          ) : (
            <div className="eqLine locked">area witness hidden until reveal</div>
          )}
          <div className="hint">Scaling and adding still produces another vector in the same ambient space.</div>
        </div>
      </div>

      <section className="predictionPanel">
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>What do these two generators sweep?</strong>
          <p>
            Inspect <span className="mono">u</span> and <span className="mono">v</span> first. The closure vector <span className="mono">w</span> stays visible; the span-collapse witness stays locked until you commit.
          </p>
        </div>

        <div className="choiceRow" role="group" aria-label="Vector-space span prediction">
          {(Object.keys(PREDICTION_COPY) as SpanPrediction[]).map((key) => (
            <button
              key={key}
              type="button"
              className={prediction === key ? 'selected' : ''}
              aria-pressed={prediction === key}
              onClick={() => choosePrediction(key)}
            >
              <strong>{PREDICTION_COPY[key].label}</strong>
              <span>{PREDICTION_COPY[key].detail}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="reveal"
          disabled={!prediction}
          onClick={() => {
            if (prediction) setRevealed(true)
          }}
        >
          Reveal span witness
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed && prediction ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `${actualCopy.status} is the span witness.`}</h4>
            <p>
              Prediction: {PREDICTION_COPY[prediction].label}. Actual: {actualCopy.label}. The determinant gives the signed area scale, while the normalized area protects the classification from tiny-vector false collapses.
            </p>
            <div className="resultGrid">
              <span>determinant</span>
              <strong>{fmt(span.determinant)}</strong>
              <span>area</span>
              <strong>{fmt(span.area)}</strong>
              <span>normalized area</span>
              <strong>{fmt(span.normalizedArea)}</strong>
              <span>span dimension</span>
              <strong>{span.dimension}</strong>
            </div>
            <label className="toggle revealToggle">
              <input
                type="checkbox"
                checked={showParallelogram}
                onChange={(e) => setShowParallelogram(e.target.checked)}
              />
              <span>Show parallelogram witness</span>
            </label>
          </>
        ) : (
          <p>{prediction ? 'Reveal the area witness to test your span prediction.' : 'Choose a span outcome to unlock the determinant and parallelogram area.'}</p>
        )}
      </section>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="svg"
        role="img"
        aria-label="Vector space playground"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>

        {/* grid */}
        {grid.map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={l.bold ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.12)'}
            strokeWidth={l.bold ? 1.5 : 1}
          />
        ))}

        {/* axes labels */}
        <text x={ORIGIN[0] + 6} y={18} fill="rgba(245, 245, 245, 0.65)" fontFamily="var(--font-mono)" fontSize="12">
          y
        </text>
        <text x={VIEW_W - 18} y={ORIGIN[1] - 6} fill="rgba(245, 245, 245, 0.65)" fontFamily="var(--font-mono)" fontSize="12">
          x
        </text>

        {/* post-reveal parallelogram area witness */}
        {revealed && showParallelogram ? (
          <path
            d={
              `M ${ORIGIN[0]} ${ORIGIN[1]} ` +
              `L ${uSvg[0]} ${uSvg[1]} ` +
              `L ${uSvg[0] + (vSvg[0] - ORIGIN[0])} ${uSvg[1] + (vSvg[1] - ORIGIN[1])} ` +
              `L ${vSvg[0]} ${vSvg[1]} Z`
            }
            fill="rgba(20, 184, 166, 0.06)"
            stroke="rgba(20, 184, 166, 0.25)"
            strokeWidth={1.5}
          />
        ) : null}

        {/* base vectors u and v */}
        <g style={{ color: MATH_COLORS.secondary }}>
          <line x1={ORIGIN[0]} y1={ORIGIN[1]} x2={uSvg[0]} y2={uSvg[1]} stroke={MATH_COLORS.secondary} strokeWidth={3} markerEnd="url(#arrow)" />
        </g>
        <g style={{ color: MATH_COLORS.primary }}>
          <line x1={ORIGIN[0]} y1={ORIGIN[1]} x2={vSvg[0]} y2={vSvg[1]} stroke={MATH_COLORS.primary} strokeWidth={3} markerEnd="url(#arrow)" />
        </g>

        {/* scaled vectors au and bv (thin) */}
        <g style={{ color: 'rgba(20, 184, 166, 0.9)' }}>
          <line
            x1={ORIGIN[0]}
            y1={ORIGIN[1]}
            x2={auSvg[0]}
            y2={auSvg[1]}
            stroke="rgba(20, 184, 166, 0.65)"
            strokeWidth={2}
            strokeDasharray="6 5"
            markerEnd="url(#arrow)"
          />
        </g>
        <g style={{ color: 'rgba(245, 158, 11, 0.9)' }}>
          <line
            x1={ORIGIN[0]}
            y1={ORIGIN[1]}
            x2={bvSvg[0]}
            y2={bvSvg[1]}
            stroke="rgba(245, 158, 11, 0.65)"
            strokeWidth={2}
            strokeDasharray="6 5"
            markerEnd="url(#arrow)"
          />
        </g>

        {/* result w */}
        <g style={{ color: MATH_COLORS.accent }}>
          <line x1={ORIGIN[0]} y1={ORIGIN[1]} x2={wSvg[0]} y2={wSvg[1]} stroke={MATH_COLORS.accent} strokeWidth={4} markerEnd="url(#arrow)" />
        </g>

        {/* handles */}
        <circle cx={uSvg[0]} cy={uSvg[1]} r={9} fill={MATH_COLORS.secondary} opacity={0.12} />
        <circle cx={uSvg[0]} cy={uSvg[1]} r={6} fill={MATH_COLORS.secondary} />
        <circle cx={uSvg[0]} cy={uSvg[1]} r={18} fill="transparent" onPointerDown={onHandleDown('u')} style={{ cursor: 'grab', pointerEvents: 'all' }} />

        <circle cx={vSvg[0]} cy={vSvg[1]} r={9} fill={MATH_COLORS.primary} opacity={0.12} />
        <circle cx={vSvg[0]} cy={vSvg[1]} r={6} fill={MATH_COLORS.primary} />
        <circle cx={vSvg[0]} cy={vSvg[1]} r={18} fill="transparent" onPointerDown={onHandleDown('v')} style={{ cursor: 'grab', pointerEvents: 'all' }} />

        {/* legend */}
        <g transform={`translate(16 ${VIEW_H - 86})`}>
          <rect x={0} y={0} width={230} height={70} rx={12} fill="rgba(8, 12, 20, 0.55)" stroke="rgba(245, 158, 11, 0.18)" />
          <g transform="translate(12 16)" fontFamily="var(--font-mono)" fontSize="12" fill="rgba(245, 245, 245, 0.8)">
            <circle cx={6} cy={6} r={4} fill={MATH_COLORS.secondary} />
            <text x={16} y={10}>u</text>

            <circle cx={6} cy={26} r={4} fill={MATH_COLORS.primary} />
            <text x={16} y={30}>v</text>

            <circle cx={6} cy={46} r={4} fill={MATH_COLORS.accent} />
            <text x={16} y={50}>w = a u + b v</text>
          </g>
        </g>
      </svg>

      <style jsx>{`
        .wrap {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        .controls {
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          background: rgba(8, 12, 20, 0.25);
          padding: 0.9rem 1rem;
        }

        .row {
          display: grid;
          grid-template-columns: 160px 1fr;
          gap: 0.75rem;
          align-items: center;
        }

        .row + .row {
          margin-top: 0.65rem;
        }

        .lbl {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.75rem;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .lblTop {
          font-family: var(--font-body);
        }

        .lblVal {
          font-family: var(--font-mono);
          color: var(--text-primary);
        }

        input[type='range'] {
          width: 100%;
          accent-color: var(--converge-teal);
        }

        .toggles {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          color: var(--text-secondary);
          user-select: none;
        }

        .btn {
          border: 1px solid var(--border-subtle);
          background: rgba(8, 12, 20, 0.35);
          color: var(--text-secondary);
          border-radius: 999px;
          padding: 0.35rem 0.75rem;
          font-size: 0.85rem;
          cursor: pointer;
          transition: border-color 0.2s ease, color 0.2s ease;
        }

        .btn:hover {
          border-color: var(--converge-teal);
          color: var(--text-primary);
        }

        .eq {
          margin-top: 0.9rem;
          padding-top: 0.85rem;
          border-top: 1px solid var(--border-subtle);
        }

        .eqLine {
          color: var(--text-secondary);
          font-size: 0.95rem;
          line-height: 1.55;
        }

        .eqLine + .eqLine {
          margin-top: 0.3rem;
        }

        .mono {
          font-family: var(--font-mono);
          color: var(--text-primary);
        }

        .dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.5);
          margin: 0 0.6rem;
          transform: translateY(-1px);
        }

        .status {
          display: inline-block;
          border: 1px solid rgba(20, 184, 166, 0.28);
          border-radius: 999px;
          color: rgba(153, 246, 228, 0.95);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          margin-left: 0.6rem;
          padding: 0.1rem 0.45rem;
        }

        .emph {
          color: var(--text-primary);
        }

        .locked {
          border: 1px dashed rgba(245, 158, 11, 0.28);
          border-radius: 8px;
          color: var(--text-muted);
          margin-top: 0.45rem;
          padding: 0.45rem 0.6rem;
        }

        .hint {
          margin-top: 0.4rem;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .predictionPanel,
        .result {
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          background: rgba(8, 12, 20, 0.32);
          padding: 0.9rem 1rem;
        }

        .predictionCopy {
          display: grid;
          gap: 0.25rem;
        }

        .predictionCopy span,
        .result span {
          color: var(--text-muted);
          font-size: 0.75rem;
          text-transform: uppercase;
        }

        .predictionCopy strong,
        .result h4 {
          color: var(--text-primary);
          font-size: 1rem;
          margin: 0;
        }

        .predictionCopy p,
        .result p {
          color: var(--text-secondary);
          font-size: 0.9rem;
          line-height: 1.55;
          margin: 0;
        }

        .choiceRow {
          display: grid;
          gap: 0.55rem;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-top: 0.85rem;
        }

        .choiceRow button {
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          background: rgba(8, 12, 20, 0.45);
          color: var(--text-secondary);
          cursor: pointer;
          display: grid;
          gap: 0.25rem;
          min-height: 96px;
          padding: 0.75rem;
          text-align: left;
        }

        .choiceRow button strong {
          color: var(--text-primary);
          font-size: 0.92rem;
        }

        .choiceRow button span {
          color: var(--text-muted);
          font-size: 0.78rem;
          line-height: 1.45;
          text-transform: none;
        }

        .choiceRow button.selected {
          border-color: rgba(20, 184, 166, 0.72);
          box-shadow: 0 0 0 1px rgba(20, 184, 166, 0.22);
        }

        .reveal {
          border: 1px solid rgba(20, 184, 166, 0.52);
          border-radius: 8px;
          background: rgba(20, 184, 166, 0.16);
          color: var(--text-primary);
          cursor: pointer;
          font-weight: 700;
          margin-top: 0.75rem;
          padding: 0.65rem 0.9rem;
          width: 100%;
        }

        .reveal:disabled {
          border-color: var(--border-subtle);
          color: var(--text-muted);
          cursor: not-allowed;
          opacity: 0.72;
        }

        .result {
          min-height: 76px;
        }

        .result.shown {
          border-color: rgba(20, 184, 166, 0.32);
        }

        .resultGrid {
          display: grid;
          gap: 0.45rem 0.75rem;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 0.75rem;
        }

        .resultGrid strong {
          color: var(--text-primary);
          font-family: var(--font-mono);
          font-size: 0.94rem;
        }

        .revealToggle {
          margin-top: 0.8rem;
        }

        .svg {
          width: 100%;
          height: auto;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-subtle);
          background: rgba(8, 12, 20, 0.55);
          box-shadow: var(--shadow-deep);
          touch-action: none;
        }

        .svg line,
        .svg path,
        .svg circle {
          transition:
            cx 160ms ease,
            cy 160ms ease,
            x1 160ms ease,
            x2 160ms ease,
            y1 160ms ease,
            y2 160ms ease,
            d 160ms ease,
            opacity 160ms ease;
        }

        @media (min-width: 980px) {
          .wrap {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .row {
            grid-template-columns: 1fr;
          }

          .toggles {
            grid-template-columns: 1fr;
          }

          .choiceRow,
          .resultGrid {
            grid-template-columns: 1fr;
          }

          .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
