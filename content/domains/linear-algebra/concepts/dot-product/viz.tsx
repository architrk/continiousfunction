import { useEffect, useMemo, useRef, useState } from 'react'
import type { Point2D } from '../../../../../lib/mathObjects'
import { clearDemoState, emitDemoState } from '../../../../../lib/demoState'
import { clamp, MATH_COLORS } from '../../../../../lib/mathObjects'

type DragTarget = 'u' | 'v'
type Prediction = 'positive' | 'orthogonal' | 'negative'

const VIEW_W = 560
const VIEW_H = 420
const SCALE = 50
const ORIGIN: Point2D = [VIEW_W / 2, VIEW_H / 2]
const PROJECTION_EPS = 0.05
const NORM_EPS = 0.2

const PREDICTIONS: Record<Prediction, { label: string; description: string }> = {
  positive: {
    label: 'Positive alignment',
    description: 'The projection lands with v, so u dot v should be positive.',
  },
  orthogonal: {
    label: 'Orthogonal / near zero',
    description: 'The projection nearly vanishes, so u dot v should be near zero.',
  },
  negative: {
    label: 'Negative / opposite',
    description: 'The projection points against v, so u dot v should be negative.',
  },
}

const PRESETS: Array<{ label: string; u: Point2D; v: Point2D }> = [
  { label: 'Case A', u: [2.4, 1.2], v: [1.2, 2.2] },
  { label: 'Case B', u: [2.5, 0], v: [0, 2.2] },
  { label: 'Case C', u: [2.2, 1.1], v: [-2.2, -1.1] },
  { label: 'Case D', u: [0, 0], v: [1.2, 2.2] },
]

const toSvg = ([x, y]: Point2D): Point2D => [ORIGIN[0] + x * SCALE, ORIGIN[1] - y * SCALE]
const fromSvg = ([sx, sy]: Point2D): Point2D => [(sx - ORIGIN[0]) / SCALE, -(sy - ORIGIN[1]) / SCALE]

const fmt = (n: number): string => {
  const r = Math.round(n * 100) / 100
  return (Math.abs(r) < 0.005 ? 0 : r).toFixed(2)
}

const angleDeg = (rad: number): number => (rad * 180) / Math.PI

const normalizeAngle = (rad: number): number => {
  let a = rad
  while (a <= -Math.PI) a += 2 * Math.PI
  while (a > Math.PI) a -= 2 * Math.PI
  return a
}

const arcPath = (start: number, end: number, r: number): string => {
  const delta = normalizeAngle(end - start)
  const a0 = start
  const a1 = start + delta

  const x0 = ORIGIN[0] + r * Math.cos(a0)
  const y0 = ORIGIN[1] - r * Math.sin(a0)
  const x1 = ORIGIN[0] + r * Math.cos(a1)
  const y1 = ORIGIN[1] - r * Math.sin(a1)

  const large = Math.abs(delta) > Math.PI ? 1 : 0
  const sweep = delta >= 0 ? 0 : 1

  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`
}

export function classifyProjection(signedProjectionLength: number): Prediction {
  if (signedProjectionLength > PROJECTION_EPS) return 'positive'
  if (signedProjectionLength < -PROJECTION_EPS) return 'negative'
  return 'orthogonal'
}

function readablePrediction(prediction: Prediction | null) {
  return prediction === null ? 'none' : PREDICTIONS[prediction].label
}

export default function DotProductViz() {
  const svgRef = useRef<SVGSVGElement | null>(null)

  const [u, setU] = useState<Point2D>([2.4, 1.2])
  const [v, setV] = useState<Point2D>([1.2, 2.2])
  const [showProjection, setShowProjection] = useState(true)
  const [showAngle, setShowAngle] = useState(true)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [drag, setDrag] = useState<{ target: DragTarget; pointerId: number } | null>(null)

  const uSvg = useMemo(() => toSvg(u), [u])
  const vSvg = useMemo(() => toSvg(v), [v])

  const stats = useMemo(() => {
    const dot = u[0] * v[0] + u[1] * v[1]
    const nu2 = u[0] * u[0] + u[1] * u[1]
    const nv2 = v[0] * v[0] + v[1] * v[1]
    const nu = Math.sqrt(nu2)
    const nv = Math.sqrt(nv2)

    const cos = nu > 1e-9 && nv > 1e-9 ? dot / (nu * nv) : 0
    const theta = nu > 1e-9 && nv > 1e-9 ? Math.acos(clamp(cos, -1, 1)) : 0
    const projScale = nv2 > 1e-9 ? dot / nv2 : 0
    const proj: Point2D = [projScale * v[0], projScale * v[1]]
    const perp: Point2D = [u[0] - proj[0], u[1] - proj[1]]
    const signedProjectionLength = nv > 1e-9 ? dot / nv : 0
    const projectionLength = Math.abs(signedProjectionLength)
    const perpLength = Math.hypot(perp[0], perp[1])

    return { dot, nu, nv, cos, theta, projScale, signedProjectionLength, projectionLength, proj, perp, perpLength }
  }, [u, v])

  const projSvg = useMemo(() => toSvg(stats.proj), [stats.proj])
  const isDegenerate = stats.nu < NORM_EPS || stats.nv < NORM_EPS
  const actualPrediction = classifyProjection(stats.signedProjectionLength)
  const alignmentState =
    actualPrediction === 'orthogonal'
      ? 'orthogonal / near zero'
      : actualPrediction === 'positive'
        ? 'positive alignment'
        : 'negative / opposite alignment'
  const predictionCorrect = prediction !== null && prediction === actualPrediction

  const grid = useMemo(() => {
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; bold: boolean }> = []
    const max = 5

    for (let i = -max; i <= max; i++) {
      const x = ORIGIN[0] + i * SCALE
      const y = ORIGIN[1] - i * SCALE
      const bold = i === 0

      lines.push({ x1: x, y1: 0, x2: x, y2: VIEW_H, bold })
      lines.push({ x1: 0, y1: y, x2: VIEW_W, y2: y, bold })
    }

    return lines
  }, [])

  const resetReveal = (clearPredictionValue = true) => {
    if (clearPredictionValue) setPrediction(null)
    setRevealed(false)
    clearDemoState('dot-product')
  }

  const setByTarget = (target: DragTarget, next: Point2D) => {
    const clamped: Point2D = [clamp(next[0], -5, 5), clamp(next[1], -5, 5)]
    resetReveal()
    if (target === 'u') setU(clamped)
    else setV(clamped)
  }

  const pointerToSvgPoint = (clientX: number, clientY: number): Point2D | null => {
    const el = svgRef.current
    if (!el) return null
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null
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

  const angleU = useMemo(() => Math.atan2(u[1], u[0]), [u])
  const angleV = useMemo(() => Math.atan2(v[1], v[0]), [v])

  const angleArc = useMemo(() => {
    if (!revealed || !showAngle) return null
    if (stats.nu < 1e-6 || stats.nv < 1e-6) return null
    return arcPath(angleV, angleU, 34)
  }, [angleU, angleV, revealed, showAngle, stats.nu, stats.nv])

  const applyPreset = (preset: { u: Point2D; v: Point2D }) => {
    setU(preset.u)
    setV(preset.v)
    setShowProjection(true)
    setShowAngle(true)
    resetReveal()
  }

  const choosePrediction = (value: Prediction) => {
    setPrediction(value)
    resetReveal(false)
  }

  const reveal = () => {
    if (!prediction || isDegenerate) return
    setRevealed(true)
  }

  useEffect(() => {
    clearDemoState('dot-product')
    return () => clearDemoState('dot-product')
  }, [])

  useEffect(() => {
    if (!revealed || !prediction || isDegenerate) {
      clearDemoState('dot-product')
      return
    }

    emitDemoState({
      conceptId: 'dot-product',
      label: 'Dot product projection-sign reveal',
      summary:
        `${predictionCorrect ? 'Correct' : 'Prediction missed'}: learner predicted ${readablePrediction(prediction)}; actual ${alignmentState}. ` +
        `u=(${fmt(u[0])}, ${fmt(u[1])}), v=(${fmt(v[0])}, ${fmt(v[1])}); ` +
        `u dot v=${fmt(stats.dot)}, cos theta=${fmt(stats.cos)}, theta=${fmt(angleDeg(stats.theta))}deg; ` +
        `signed scalar projection ${fmt(stats.signedProjectionLength)}.`,
      values: [
        'prediction phase: revealed',
        `learner prediction: ${readablePrediction(prediction)}`,
        `actual alignment: ${alignmentState}`,
        `prediction correct: ${predictionCorrect ? 'yes' : 'no'}`,
        `u: (${fmt(u[0])}, ${fmt(u[1])})`,
        `v: (${fmt(v[0])}, ${fmt(v[1])})`,
        `dot product: ${fmt(stats.dot)}`,
        `cos theta: ${fmt(stats.cos)}`,
        `theta: ${fmt(angleDeg(stats.theta))}deg`,
        `|u|: ${fmt(stats.nu)}`,
        `|v|: ${fmt(stats.nv)}`,
        `projection coefficient: ${fmt(stats.projScale)}`,
        `signed scalar projection: ${fmt(stats.signedProjectionLength)}`,
        `projection length: ${fmt(stats.projectionLength)}`,
        `proj_v(u): (${fmt(stats.proj[0])}, ${fmt(stats.proj[1])})`,
        `perpendicular residual: (${fmt(stats.perp[0])}, ${fmt(stats.perp[1])})`,
        `perp length: ${fmt(stats.perpLength)}`,
        `visible layers: ${showProjection ? 'projection' : 'projection hidden'}, ${showAngle ? 'angle' : 'angle hidden'}`,
      ],
    })
  }, [
    alignmentState,
    isDegenerate,
    prediction,
    predictionCorrect,
    revealed,
    showAngle,
    showProjection,
    stats.cos,
    stats.dot,
    stats.nu,
    stats.nv,
    stats.perp,
    stats.perpLength,
    stats.proj,
    stats.projScale,
    stats.projectionLength,
    stats.signedProjectionLength,
    stats.theta,
    u,
    v,
  ])

  return (
    <div className="wrap" data-revealed={revealed ? 'true' : 'false'}>
      <div className="controls">
        <div className="row toggles">
          {revealed ? (
            <>
              <label className="toggle">
                <input type="checkbox" checked={showProjection} onChange={(e) => setShowProjection(e.target.checked)} />
                <span>Show projection</span>
              </label>
              <label className="toggle">
                <input type="checkbox" checked={showAngle} onChange={(e) => setShowAngle(e.target.checked)} />
                <span>Show angle</span>
              </label>
            </>
          ) : (
            <span className="locked">projection and angle locked until reveal</span>
          )}
          <div className="presetRow" aria-label="Dot product neutral cases">
            {PRESETS.map((preset) => (
              <button key={preset.label} type="button" className="btn" onClick={() => applyPreset(preset)}>
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="eq">
          <div className="eqLine">
            <span className="mono">u</span> = ({fmt(u[0])}, {fmt(u[1])})
            <span className="dot" />
            <span className="mono">v</span> = ({fmt(v[0])}, {fmt(v[1])})
          </div>

          {revealed ? (
            <>
              <div className={`eqLine emph ${actualPrediction}`}>
                <span className="mono">u dot v</span> = {fmt(stats.dot)}
                <span className="sep" />
                <span className="mono">cos theta</span> = {fmt(stats.cos)}
                <span className="sep" />
                <span className="mono">theta</span> = {fmt(angleDeg(stats.theta))} deg
                <span className="badge">{alignmentState}</span>
              </div>

              {showProjection ? (
                <div className="eqLine">
                  <span className="mono">proj_v(u)</span> = ({fmt(stats.proj[0])}, {fmt(stats.proj[1])})
                  <span className="sep" />
                  <span className="mono">u_perp</span> = ({fmt(stats.perp[0])}, {fmt(stats.perp[1])})
                  <span className="sep" />
                  <span className="mono">projection coefficient</span> = {fmt(stats.projScale)}
                  <span className="sep" />
                  <span className="mono">signed scalar projection</span> = {fmt(stats.signedProjectionLength)}
                  <span className="sep" />
                  <span className="mono">projection length</span> = {fmt(stats.projectionLength)}
                </div>
              ) : null}
            </>
          ) : (
            <div className="eqLine hiddenLine">derived dot, angle, and projection values hidden until prediction</div>
          )}

          <div className="hint">
            {revealed
              ? 'For nonzero vectors, the sign of u dot v, cos theta, and the signed projection of u along v agree.'
              : 'Look at the two arrows. Will the part of u that points along v land with v, vanish, or point against v?'}
          </div>
        </div>

        <section className="predictionPanel" aria-label="Dot product projection-sign prediction">
          <div className="predictionCopy">
            <span>predict the projection sign</span>
            <strong>Where will the part of u along v point?</strong>
          </div>
          <div className="predictionChoices" role="group" aria-label="Projection sign choices">
            {(Object.keys(PREDICTIONS) as Prediction[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={prediction === key}
                className={prediction === key ? 'selected' : ''}
                onClick={() => choosePrediction(key)}
              >
                <strong>{PREDICTIONS[key].label}</strong>
                <span>{PREDICTIONS[key].description}</span>
              </button>
            ))}
          </div>
          <button type="button" className="revealButton" disabled={!prediction || isDegenerate} onClick={reveal}>
            Reveal dot product
          </button>
          {isDegenerate ? <p className="guard">Move both vectors away from the origin first.</p> : null}
        </section>

        {revealed ? (
          <p className={predictionCorrect ? 'result good' : 'result bad'}>
            Prediction: {readablePrediction(prediction)} | Actual: {alignmentState} | {predictionCorrect ? 'correct' : 'not this time'}
          </p>
        ) : null}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="svg"
        role="img"
        aria-label="Dot product playground"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>

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

        <text x={ORIGIN[0] + 6} y={18} fill="rgba(245, 245, 245, 0.65)" fontFamily="var(--font-mono)" fontSize="12">
          y
        </text>
        <text x={VIEW_W - 18} y={ORIGIN[1] - 6} fill="rgba(245, 245, 245, 0.65)" fontFamily="var(--font-mono)" fontSize="12">
          x
        </text>

        {angleArc ? <path d={angleArc} stroke="rgba(245, 245, 245, 0.55)" strokeWidth={2} fill="none" /> : null}

        <g style={{ color: MATH_COLORS.primary }}>
          <line x1={ORIGIN[0]} y1={ORIGIN[1]} x2={vSvg[0]} y2={vSvg[1]} stroke={MATH_COLORS.primary} strokeWidth={3} markerEnd="url(#arrow)" />
        </g>

        <g style={{ color: MATH_COLORS.secondary }}>
          <line x1={ORIGIN[0]} y1={ORIGIN[1]} x2={uSvg[0]} y2={uSvg[1]} stroke={MATH_COLORS.secondary} strokeWidth={3} markerEnd="url(#arrow)" />
        </g>

        {revealed && showProjection ? (
          <>
            <g style={{ color: MATH_COLORS.positive }}>
              <line
                x1={ORIGIN[0]}
                y1={ORIGIN[1]}
                x2={projSvg[0]}
                y2={projSvg[1]}
                stroke={MATH_COLORS.positive}
                strokeWidth={3}
                strokeDasharray="6 5"
                markerEnd="url(#arrow)"
              />
            </g>
            <g style={{ color: MATH_COLORS.accent }}>
              <line
                x1={projSvg[0]}
                y1={projSvg[1]}
                x2={uSvg[0]}
                y2={uSvg[1]}
                stroke={MATH_COLORS.accent}
                strokeWidth={2.5}
                strokeDasharray="4 4"
                markerEnd="url(#arrow)"
              />
            </g>

            {Math.abs(stats.signedProjectionLength) < PROJECTION_EPS && stats.nu > NORM_EPS && stats.nv > NORM_EPS ? (
              <rect
                x={ORIGIN[0] + 6}
                y={ORIGIN[1] - 18}
                width={12}
                height={12}
                fill="rgba(245, 245, 245, 0.08)"
                stroke="rgba(245, 245, 245, 0.35)"
              />
            ) : null}
          </>
        ) : null}

        <circle
          data-vector-handle="u"
          cx={uSvg[0]}
          cy={uSvg[1]}
          r={10}
          fill="rgba(20, 184, 166, 0.15)"
          stroke={MATH_COLORS.secondary}
          strokeWidth={2}
          onPointerDown={onHandleDown('u')}
          style={{ cursor: 'grab' }}
        />
        <circle
          data-vector-handle="v"
          cx={vSvg[0]}
          cy={vSvg[1]}
          r={10}
          fill="rgba(245, 158, 11, 0.14)"
          stroke={MATH_COLORS.primary}
          strokeWidth={2}
          onPointerDown={onHandleDown('v')}
          style={{ cursor: 'grab' }}
        />

        <text x={uSvg[0] + 10} y={uSvg[1] - 10} fill={MATH_COLORS.secondary} fontFamily="var(--font-mono)" fontSize="12">
          u
        </text>
        <text x={vSvg[0] + 10} y={vSvg[1] - 10} fill={MATH_COLORS.primary} fontFamily="var(--font-mono)" fontSize="12">
          v
        </text>
      </svg>

      <style jsx>{`
        .wrap {
          border: 1px solid rgba(245, 158, 11, 0.14);
          border-radius: 14px;
          background: rgba(10, 12, 18, 0.55);
          overflow: hidden;
        }

        .controls {
          padding: 0.9rem 1rem 0.75rem;
          border-bottom: 1px solid rgba(245, 158, 11, 0.12);
        }

        .row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .toggles {
          justify-content: space-between;
        }

        .presetRow {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .toggle,
        .locked {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: rgba(245, 245, 245, 0.75);
          font-size: 0.9rem;
          user-select: none;
        }

        .locked {
          color: rgba(148, 163, 184, 0.82);
        }

        .btn {
          appearance: none;
          min-height: 2rem;
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: 8px;
          background: rgba(245, 158, 11, 0.08);
          color: rgba(245, 245, 245, 0.9);
          padding: 0.35rem 0.6rem;
          font-size: 0.85rem;
          cursor: pointer;
        }

        .btn:hover {
          background: rgba(245, 158, 11, 0.12);
        }

        .eq {
          margin-top: 0.75rem;
          font-family: var(--font-sans);
        }

        .eqLine {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          align-items: baseline;
          color: rgba(245, 245, 245, 0.82);
          font-size: 0.92rem;
          line-height: 1.35;
        }

        .eqLine.emph {
          margin-top: 0.25rem;
          padding: 0.25rem 0.45rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 8px;
          background: rgba(8, 12, 20, 0.35);
        }

        .eqLine.emph.positive {
          border-color: rgba(34, 197, 94, 0.28);
        }

        .eqLine.emph.negative {
          border-color: rgba(239, 68, 68, 0.28);
        }

        .eqLine.emph.orthogonal {
          border-color: rgba(245, 158, 11, 0.32);
        }

        .hiddenLine {
          margin-top: 0.25rem;
          color: rgba(148, 163, 184, 0.82);
        }

        .mono {
          color: rgba(245, 245, 245, 0.9);
          font-family: var(--font-mono);
        }

        .dot {
          width: 6px;
          height: 6px;
          margin: 0 0.15rem;
          border-radius: 999px;
          background: rgba(245, 245, 245, 0.35);
          transform: translateY(-1px);
        }

        .sep {
          width: 1px;
          height: 0.9rem;
          margin: 0 0.2rem;
          background: rgba(148, 163, 184, 0.18);
          transform: translateY(2px);
        }

        .badge {
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 999px;
          color: rgba(245, 245, 245, 0.78);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          padding: 0.12rem 0.45rem;
        }

        .hint {
          margin-top: 0.55rem;
          color: rgba(148, 163, 184, 0.8);
          font-size: 0.85rem;
        }

        .predictionPanel {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(18rem, 1.4fr) auto;
          gap: 0.75rem;
          align-items: center;
          margin-top: 0.85rem;
          border: 1px solid rgba(245, 158, 11, 0.16);
          border-radius: 8px;
          background: rgba(8, 12, 20, 0.32);
          padding: 0.7rem;
        }

        .predictionCopy {
          display: grid;
          min-width: 0;
          gap: 0.28rem;
        }

        .predictionCopy span {
          color: rgba(245, 158, 11, 0.92);
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .predictionCopy strong {
          color: rgba(245, 245, 245, 0.92);
          font-size: 0.95rem;
          line-height: 1.25;
        }

        .predictionChoices {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.45rem;
          min-width: 0;
        }

        .predictionChoices button {
          display: grid;
          gap: 0.2rem;
          min-height: 4.1rem;
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          color: rgba(245, 245, 245, 0.9);
          padding: 0.5rem;
          font: inherit;
          font-size: 0.76rem;
          text-align: left;
          cursor: pointer;
        }

        .predictionChoices button span {
          color: rgba(203, 213, 225, 0.78);
          font-size: 0.7rem;
          line-height: 1.25;
        }

        .predictionChoices button.selected,
        .predictionChoices button[aria-pressed='true'] {
          border-color: rgba(245, 158, 11, 0.55);
          background: rgba(245, 158, 11, 0.13);
        }

        .revealButton {
          align-self: stretch;
          min-width: 8.5rem;
          border: 0;
          border-radius: 8px;
          background: rgba(245, 158, 11, 0.9);
          color: #1f1305;
          padding: 0.55rem 0.72rem;
          font: inherit;
          font-size: 0.8rem;
          font-weight: 760;
          cursor: pointer;
        }

        .revealButton:disabled {
          cursor: not-allowed;
          opacity: 0.48;
        }

        .guard {
          grid-column: 1 / -1;
          margin: 0;
          color: rgba(252, 165, 165, 0.92);
          font-size: 0.78rem;
        }

        .result {
          margin: 0.75rem 0 0;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 8px;
          background: rgba(8, 12, 20, 0.32);
          color: rgba(245, 245, 245, 0.86);
          padding: 0.55rem 0.7rem;
          font-family: var(--font-mono);
          font-size: 0.76rem;
          line-height: 1.45;
        }

        .result.good {
          border-color: rgba(34, 197, 94, 0.24);
          color: rgba(187, 247, 208, 0.92);
        }

        .result.bad {
          border-color: rgba(239, 68, 68, 0.24);
          color: rgba(254, 202, 202, 0.94);
        }

        .svg {
          width: 100%;
          height: auto;
          display: block;
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

        @media (max-width: 820px) {
          .predictionPanel {
            grid-template-columns: 1fr;
          }

          .predictionChoices {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .controls {
            padding: 0.75rem 0.85rem 0.65rem;
          }
        }
      `}</style>
    </div>
  )
}
