'use client'

import { useEffect, useRef, Suspense, lazy } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import ExplorableLayout, { useExplorable } from '@/components/explorable/ExplorableLayout'
import ExplorableSection from '@/components/explorable/ExplorableSection'
import { Point2D, MATH_COLORS } from '../../lib/mathObjects'

// Explore in depth link component
function ExploreLink({ href, label = 'Explore in depth' }: { href: string; label?: string }) {
  return (
    <Link href={href} className="explore-link">
      {label} →
      <style jsx>{`
        .explore-link {
          display: inline-block;
          margin-top: 1rem;
          font-size: 0.85rem;
          color: var(--converge-teal);
          text-decoration: none;
          transition: color 0.2s;
        }
        .explore-link:hover {
          color: var(--accent);
        }
      `}</style>
    </Link>
  )
}

// Import visualization components from foundations (canonical source with gamification)
const EquivarianceDemo = lazy(() => import('@/components/foundations/EquivarianceViz'))
const ParallelTransport = lazy(() => import('@/components/foundations/ParallelTransportViz'))

function LoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 360, color: '#b8b0a0' }}>
      Loading visualization...
    </div>
  )
}

function GeometricVisualPanel() {
  const { activeSection, params } = useExplorable()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const rotationAngle = (params.rotation as number) || 0
  const showTransformed = (params.showTransformed as boolean) ?? true

  // Draw equivariance demonstration
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = 360
    const height = 360
    const cx = width / 2
    const cy = height / 2

    ctx.fillStyle = MATH_COLORS.surface
    ctx.fillRect(0, 0, width, height)

    // Draw grid
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.1)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 10; i++) {
      const pos = i * 36
      ctx.beginPath()
      ctx.moveTo(pos, 0)
      ctx.lineTo(pos, height)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, pos)
      ctx.lineTo(width, pos)
      ctx.stroke()
    }

    // Original shape (hexagon)
    const hexPoints: Point2D[] = []
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3
      hexPoints.push([
        Math.cos(angle) * 60,
        Math.sin(angle) * 60,
      ])
    }

    // Draw original shape
    ctx.strokeStyle = MATH_COLORS.primary
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx + hexPoints[0][0], cy + hexPoints[0][1])
    for (let i = 1; i < hexPoints.length; i++) {
      ctx.lineTo(cx + hexPoints[i][0], cy + hexPoints[i][1])
    }
    ctx.closePath()
    ctx.stroke()

    // Draw transformed shape
    if (showTransformed && activeSection !== 'intro') {
      const rotatedPoints = hexPoints.map(([x, y]) => {
        const cos = Math.cos(rotationAngle)
        const sin = Math.sin(rotationAngle)
        return [x * cos - y * sin, x * sin + y * cos] as Point2D
      })

      ctx.strokeStyle = MATH_COLORS.secondary
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx + rotatedPoints[0][0], cy + rotatedPoints[0][1])
      for (let i = 1; i < rotatedPoints.length; i++) {
        ctx.lineTo(cx + rotatedPoints[i][0], cy + rotatedPoints[i][1])
      }
      ctx.closePath()
      ctx.stroke()

      // Draw rotation arc
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, 80, 0, rotationAngle)
      ctx.stroke()

      // Rotation label
      ctx.fillStyle = MATH_COLORS.secondary
      ctx.font = '12px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(
        `θ = ${(rotationAngle * 180 / Math.PI).toFixed(0)}°`,
        cx + Math.cos(rotationAngle / 2) * 95,
        cy + Math.sin(rotationAngle / 2) * 95
      )
    }

    // Feature map visualization (simplified CNN feature)
    if (activeSection === 'cnn' || activeSection === 'equivariance') {
      // Draw "feature detector" indicator
      const featurePos = activeSection === 'equivariance'
        ? [cx + 80 * Math.cos(rotationAngle), cy + 80 * Math.sin(rotationAngle)]
        : [cx + 80, cy]

      ctx.fillStyle = 'rgba(139, 92, 246, 0.8)'
      ctx.beginPath()
      ctx.arc(featurePos[0], featurePos[1], 8, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#8b5cf6'
      ctx.font = '10px "IBM Plex Sans", sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('feature', featurePos[0] + 12, featurePos[1] + 4)
    }

    // Legend
    ctx.font = '11px "IBM Plex Sans", sans-serif'
    ctx.fillStyle = MATH_COLORS.primary
    ctx.textAlign = 'left'
    ctx.fillText('Input', 20, 30)
    if (showTransformed && activeSection !== 'intro') {
      ctx.fillStyle = MATH_COLORS.secondary
      ctx.fillText('Transformed', 20, 48)
    }

  }, [activeSection, rotationAngle, showTransformed])

  // Use new advanced visualization components based on section
  if (activeSection === 'equivariance' || activeSection === 'cnn') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <EquivarianceDemo />
      </Suspense>
    )
  }

  if (activeSection === 'groups' || activeSection === 'graphs' || activeSection === 'manifolds') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <ParallelTransport />
      </Suspense>
    )
  }

  // Default legacy visualization
  return (
    <div>
      <canvas
        ref={canvasRef}
        width={360}
        height={360}
        style={{ borderRadius: '8px', border: '1px solid rgba(180, 160, 120, 0.15)' }}
      />
      <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#7a7468', textAlign: 'center' }}>
        Rotate input to see equivariant response
      </p>
    </div>
  )
}

export default function GeometricDLPillar() {
  return (
    <>
      <Head>
        <title>Geometric Deep Learning — Continuous Function</title>
      </Head>
      <ExplorableLayout
        title="Geometric Deep Learning"
        subtitle="Symmetry as inductive bias"
        visualPanel={<GeometricVisualPanel />}
        initialParams={{ rotation: 0, showTransformed: true }}
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Pillars', href: '/pillars' },
          { label: 'Geometric DL' }
        ]}
    >
      <ExplorableSection id="intro">
        <h2>Why Geometry Matters</h2>
        <p>
          The structure of your data should inform the structure of your model. If rotating
          an image shouldn't change what object it contains, your network should reflect
          that symmetry.
        </p>
        <p>
          Geometric deep learning makes this precise: we design networks that are
          <em> equivariant</em> to group transformations of the input.
        </p>
      </ExplorableSection>

      <ExplorableSection id="equivariance">
        <h2>Equivariance</h2>
        <p>
          A function f is equivariant to a transformation g if transforming the input
          leads to a predictably transformed output:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Equivariance Condition</div>
          <p>
            f(g · x) = g · f(x)
          </p>
        </div>
        <p>
          Rotate the input using the slider below. Watch how an equivariant feature
          detector moves with the rotation — it detects the same feature, just in
          the transformed location.
        </p>
        <RotationControl />
        <ExploreLink href="/foundations/lie-groups/" />
      </ExplorableSection>

      <ExplorableSection id="cnn">
        <h2>CNNs as Translation Equivariance</h2>
        <p>
          Convolutional neural networks are equivariant to translations. A feature
          detected at position (x, y) will be detected at position (x+Δx, y+Δy)
          when the input is shifted.
        </p>
        <p>
          This is why CNNs work so well for images: we don't need to learn separate
          detectors for "cat in top-left corner" and "cat in bottom-right corner".
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Weight Sharing</div>
          <p>
            The same convolutional kernel is applied at every spatial location,
            encoding translation equivariance into the architecture.
          </p>
        </div>
      </ExplorableSection>

      <ExplorableSection id="groups">
        <h2>Group Theory</h2>
        <p>
          Symmetries form mathematical structures called groups. Common examples:
        </p>
        <table style={{ width: '100%', marginTop: '1rem' }}>
          <thead>
            <tr>
              <th>Group</th>
              <th>Symmetry</th>
              <th>Application</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>SO(2)</td>
              <td>Rotation</td>
              <td>Aerial imagery</td>
            </tr>
            <tr>
              <td>SE(3)</td>
              <td>Rotation + Translation</td>
              <td>Molecules, robotics</td>
            </tr>
            <tr>
              <td>S<sub>n</sub></td>
              <td>Permutation</td>
              <td>Sets, graphs</td>
            </tr>
          </tbody>
        </table>
      </ExplorableSection>

      <ExplorableSection id="graphs">
        <h2>Graph Neural Networks</h2>
        <p>
          GNNs are equivariant to node permutations. Reordering the nodes of a graph
          doesn't change what the network computes — the output permutes accordingly.
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Message Passing</div>
          <p>
            h<sub>v</sub><sup>(k)</sup> = UPDATE(h<sub>v</sub><sup>(k-1)</sup>, AGG({'{'}h<sub>u</sub><sup>(k-1)</sup> : u ∈ N(v){'}'}))
          </p>
        </div>
        <p>
          The aggregation function (sum, mean, max) is permutation-invariant,
          making the overall network permutation-equivariant.
        </p>
      </ExplorableSection>
    </ExplorableLayout>
    </>
  )
}

function RotationControl() {
  const { params, setParam } = useExplorable()
  const rotation = (params.rotation as number) || 0

  return (
    <div className="param-control" style={{ display: 'flex', marginTop: '1rem' }}>
      <span>Rotation:</span>
      <input
        type="range"
        min="0"
        max={Math.PI * 2}
        step="0.05"
        value={rotation}
        onChange={(e) => setParam('rotation', parseFloat(e.target.value))}
        aria-label="Rotation angle"
        aria-valuetext={`${(rotation * 180 / Math.PI).toFixed(0)} degrees`}
      />
      <span className="value">{(rotation * 180 / Math.PI).toFixed(0)}°</span>
    </div>
  )
}
