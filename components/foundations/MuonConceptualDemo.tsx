import { useState } from 'react'

const WIDTH = 260
const HEIGHT = 260
const CENTER_X = WIDTH / 2
const CENTER_Y = HEIGHT / 2
const SCALE = 80

type Vec2 = [number, number]

function normalize([x, y]: Vec2): Vec2 {
  const n = Math.hypot(x, y) || 1
  return [x / n, y / n]
}

function gramSchmidt(v1: Vec2, v2: Vec2): [Vec2, Vec2] {
  const u1 = normalize(v1)
  const dot = u1[0] * v2[0] + u1[1] * v2[1]
  const proj: Vec2 = [dot * u1[0], dot * u1[1]]
  const v2perp: Vec2 = [v2[0] - proj[0], v2[1] - proj[1]]
  const u2 = normalize(v2perp)
  return [u1, u2]
}

function toSvg([x, y]: Vec2): { x: number; y: number } {
  return {
    x: CENTER_X + x * SCALE,
    y: CENTER_Y - y * SCALE
  }
}

export default function MuonConceptualDemo() {
  const [coupling, setCoupling] = useState(1.4)

  const v1: Vec2 = [1, 0.0]
  const v2: Vec2 = [1, coupling]

  const [u1, u2] = gramSchmidt(v1, v2)

  const v1Svg = toSvg(normalize(v1))
  const v2Svg = toSvg(normalize(v2))
  const u1Svg = toSvg(u1)
  const u2Svg = toSvg(u2)

  return (
    <section className="card interactive-card">
      <h2>Muon-Style Orthogonalization (Toy Demo)</h2>
      <p className="muted">
        Move the slider to couple two neurons (rows of a weight matrix). Then
        see how orthogonalization re-bases them into cleaner directions.
      </p>
      <div className="muon-layout">
        <svg
          width={WIDTH}
          height={HEIGHT}
          className="muon-chart"
          role="img"
          aria-label="2D view of weight vectors before and after orthogonalization"
        >
          <line
            x1={0}
            y1={CENTER_Y}
            x2={WIDTH}
            y2={CENTER_Y}
            className="axis-line"
          />
          <line
            x1={CENTER_X}
            y1={0}
            x2={CENTER_X}
            y2={HEIGHT}
            className="axis-line"
          />
          <line
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={v1Svg.x}
            y2={v1Svg.y}
            className="muon-row-original"
          />
          <line
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={v2Svg.x}
            y2={v2Svg.y}
            className="muon-row-original"
          />
          <line
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={u1Svg.x}
            y2={u1Svg.y}
            className="muon-row-ortho u1"
          />
          <line
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={u2Svg.x}
            y2={u2Svg.y}
            className="muon-row-ortho u2"
          />
        </svg>
        <div className="muon-controls">
          <label className="slider-label">
            Row coupling ({coupling.toFixed(2)})
            <input
              type="range"
              min={0.1}
              max={2.5}
              step={0.1}
              value={coupling}
              onChange={(e) => setCoupling(parseFloat(e.target.value))}
            />
          </label>
          <p className="caption">
            When rows are highly coupled, gradient updates can stretch some
            directions too much. Muon orthogonalizes updates for hidden
            matrices, which you can think of as continually pivoting towards
            clean, near-orthogonal directions with controlled spectral norm.
          </p>
        </div>
      </div>
    </section>
  )
}
