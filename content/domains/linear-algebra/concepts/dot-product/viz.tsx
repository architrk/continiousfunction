import { useMemo, useRef, useState } from 'react'
import type { Point2D } from '../../../../../lib/mathObjects'
import { clamp, MATH_COLORS } from '../../../../../lib/mathObjects'

type DragTarget = 'u' | 'v'

const VIEW_W = 560
const VIEW_H = 420

const SCALE = 50 // pixels per unit
const ORIGIN: Point2D = [VIEW_W / 2, VIEW_H / 2]

const toSvg = ([x, y]: Point2D): Point2D => [ORIGIN[0] + x * SCALE, ORIGIN[1] - y * SCALE]
const fromSvg = ([sx, sy]: Point2D): Point2D => [(sx - ORIGIN[0]) / SCALE, -(sy - ORIGIN[1]) / SCALE]

const fmt = (n: number): string => {
  const r = Math.round(n * 100) / 100
  return (Math.abs(r) < 0.005 ? 0 : r).toFixed(2)
}

const angleDeg = (rad: number): number => (rad * 180) / Math.PI

const normalizeAngle = (rad: number): number => {
  // Normalize to (-pi, pi]
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
  const sweep = delta >= 0 ? 0 : 1 // svg y-axis is flipped; this produces a visually-correct direction

  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`
}

export default function DotProductViz() {
  const svgRef = useRef<SVGSVGElement | null>(null)

  const [u, setU] = useState<Point2D>([2.4, 1.2])
  const [v, setV] = useState<Point2D>([1.2, 2.2])
  const [showProjection, setShowProjection] = useState(true)
  const [showAngle, setShowAngle] = useState(true)
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

    return { dot, nu, nv, cos, theta, projScale, proj, perp }
  }, [u, v])

  const projSvg = useMemo(() => toSvg(stats.proj), [stats.proj])

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

  const setByTarget = (target: DragTarget, next: Point2D) => {
    const clamped: Point2D = [clamp(next[0], -5, 5), clamp(next[1], -5, 5)]
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

  const angleU = useMemo(() => Math.atan2(u[1], u[0]), [u])
  const angleV = useMemo(() => Math.atan2(v[1], v[0]), [v])

  const angleArc = useMemo(() => {
    if (!showAngle) return null
    const nu = stats.nu
    const nv = stats.nv
    if (nu < 1e-6 || nv < 1e-6) return null
    return arcPath(angleV, angleU, 34)
  }, [angleU, angleV, showAngle, stats.nu, stats.nv])

  const dotSign = stats.dot > 0.05 ? 'positive' : stats.dot < -0.05 ? 'negative' : 'zero'

  return (
    <div className="wrap">
      <div className="controls">
        <div className="row toggles">
          <label className="toggle">
            <input type="checkbox" checked={showProjection} onChange={(e) => setShowProjection(e.target.checked)} />
            <span>Show projection</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={showAngle} onChange={(e) => setShowAngle(e.target.checked)} />
            <span>Show angle</span>
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setU([2.4, 1.2])
              setV([1.2, 2.2])
              setShowProjection(true)
              setShowAngle(true)
            }}
          >
            Reset
          </button>
        </div>

        <div className="eq">
          <div className="eqLine">
            <span className="mono">u</span> = ({fmt(u[0])}, {fmt(u[1])})
            <span className="dot" />
            <span className="mono">v</span> = ({fmt(v[0])}, {fmt(v[1])})
          </div>

          <div className={`eqLine emph ${dotSign}`}>
            <span className="mono">u·v</span> = {fmt(stats.dot)}
            <span className="sep" />
            <span className="mono">cos θ</span> = {fmt(stats.cos)}
            <span className="sep" />
            <span className="mono">θ</span> = {fmt(angleDeg(stats.theta))}°
          </div>

          {showProjection ? (
            <div className="eqLine">
              <span className="mono">proj_v(u)</span> = ({fmt(stats.proj[0])}, {fmt(stats.proj[1])})
              <span className="sep" />
              <span className="mono">u⊥</span> = ({fmt(stats.perp[0])}, {fmt(stats.perp[1])})
            </div>
          ) : null}

          <div className="hint">
            Drag the endpoints. The dot product is the length of the projection times |v|, with a sign.
          </div>
        </div>
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

        {/* angle arc */}
        {angleArc ? <path d={angleArc} stroke="rgba(245, 245, 245, 0.55)" strokeWidth={2} fill="none" /> : null}

        {/* v vector */}
        <g style={{ color: MATH_COLORS.primary }}>
          <line
            x1={ORIGIN[0]}
            y1={ORIGIN[1]}
            x2={vSvg[0]}
            y2={vSvg[1]}
            stroke={MATH_COLORS.primary}
            strokeWidth={3}
            markerEnd="url(#arrow)"
          />
        </g>

        {/* u vector */}
        <g style={{ color: MATH_COLORS.secondary }}>
          <line
            x1={ORIGIN[0]}
            y1={ORIGIN[1]}
            x2={uSvg[0]}
            y2={uSvg[1]}
            stroke={MATH_COLORS.secondary}
            strokeWidth={3}
            markerEnd="url(#arrow)"
          />
        </g>

        {/* projection + perpendicular decomposition */}
        {showProjection ? (
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

            {/* right-angle marker when dot ~ 0 */}
            {Math.abs(stats.dot) < 0.06 && stats.nu > 0.2 && stats.nv > 0.2 ? (
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

        {/* drag handles */}
        <circle
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
          cx={vSvg[0]}
          cy={vSvg[1]}
          r={10}
          fill="rgba(245, 158, 11, 0.14)"
          stroke={MATH_COLORS.primary}
          strokeWidth={2}
          onPointerDown={onHandleDown('v')}
          style={{ cursor: 'grab' }}
        />

        {/* labels */}
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
          gap: 0.9rem;
          flex-wrap: wrap;
        }

        .toggles {
          justify-content: space-between;
        }

        .toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          color: rgba(245, 245, 245, 0.75);
          user-select: none;
        }

        .btn {
          appearance: none;
          border: 1px solid rgba(245, 158, 11, 0.25);
          background: rgba(245, 158, 11, 0.08);
          color: rgba(245, 245, 245, 0.9);
          padding: 0.35rem 0.6rem;
          border-radius: 10px;
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
          color: rgba(245, 245, 245, 0.82);
          font-size: 0.92rem;
          line-height: 1.35;
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .eqLine.emph {
          margin-top: 0.25rem;
          padding: 0.25rem 0.45rem;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(8, 12, 20, 0.35);
        }

        .eqLine.emph.positive {
          border-color: rgba(34, 197, 94, 0.28);
        }

        .eqLine.emph.negative {
          border-color: rgba(239, 68, 68, 0.28);
        }

        .mono {
          font-family: var(--font-mono);
          color: rgba(245, 245, 245, 0.9);
        }

        .dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(245, 245, 245, 0.35);
          margin: 0 0.15rem;
          transform: translateY(-1px);
        }

        .sep {
          width: 1px;
          height: 0.9rem;
          background: rgba(148, 163, 184, 0.18);
          margin: 0 0.2rem;
          transform: translateY(2px);
        }

        .hint {
          margin-top: 0.55rem;
          color: rgba(148, 163, 184, 0.8);
          font-size: 0.85rem;
        }

        .svg {
          width: 100%;
          height: auto;
          display: block;
          touch-action: none;
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
