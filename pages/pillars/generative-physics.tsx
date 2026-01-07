'use client'

import { useState, useMemo, useEffect, useRef, Suspense, lazy } from 'react'
import Head from 'next/head'
import ExplorableLayout, { useExplorable } from '../../components/ExplorableLayout'
import ExplorableSection from '../../components/ExplorableSection'
import PhasePortrait2D from '../../components/PhasePortrait2D'
import { VectorField2D, Point2D } from '../../lib/mathObjects'

// Import visualization components from foundations (canonical source with gamification)
const DiffusionForwardReverse = lazy(() => import('../../components/foundations/DiffusionProcessViz'))
const FlowMatching = lazy(() => import('../../components/foundations/FlowMatchingViz'))

function LoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 360, color: '#b8b0a0' }}>
      Loading visualization...
    </div>
  )
}

function GenerativeVisualPanel() {
  const { activeSection, params } = useExplorable()
  const animationRef = useRef<number>()
  const [particles, setParticles] = useState<Point2D[]>([])
  const [trajectories, setTrajectories] = useState<Point2D[][]>([])

  const noiseScale = (params.noiseScale as number) || 0.3
  const time = (params.time as number) || 0

  // Score function for a mixture of Gaussians
  const scoreField: VectorField2D = useMemo(() => ({
    fn: (x: number, y: number) => {
      // Two Gaussian modes
      const centers: Point2D[] = [[1, 1], [-1, -1]]
      const sigma = 0.5

      let scoreX = 0
      let scoreY = 0

      for (const [cx, cy] of centers) {
        const dx = x - cx
        const dy = y - cy
        const dist2 = dx * dx + dy * dy
        const weight = Math.exp(-dist2 / (2 * sigma * sigma))

        // Score is gradient of log probability
        scoreX -= (dx / (sigma * sigma)) * weight
        scoreY -= (dy / (sigma * sigma)) * weight
      }

      const mag = Math.sqrt(scoreX * scoreX + scoreY * scoreY)
      if (mag > 2) {
        scoreX = (scoreX / mag) * 2
        scoreY = (scoreY / mag) * 2
      }

      return [scoreX * 0.15, scoreY * 0.15]
    },
    domain: { x: [-3, 3], y: [-3, 3] },
    label: 'Score Field',
  }), [])

  // Flow field (interpolating from noise to data)
  const flowField: VectorField2D = useMemo(() => ({
    fn: (x: number, y: number) => {
      const t = time
      // Target point (mixture of Gaussians center)
      const target: Point2D = x > 0 ? [1, 1] : [-1, -1]
      // Flow vector pointing toward target
      const vx = (target[0] - x) * (1 - t)
      const vy = (target[1] - y) * (1 - t)
      return [vx * 0.1, vy * 0.1]
    },
    domain: { x: [-3, 3], y: [-3, 3] },
    label: 'Flow Field',
  }), [time])

  // Particle simulation
  useEffect(() => {
    if (activeSection !== 'diffusion' && activeSection !== 'flow') return

    // Initialize particles from noise
    const numParticles = 20
    let pts: Point2D[] = Array.from({ length: numParticles }, () => [
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4,
    ])
    let trajs: Point2D[][] = pts.map((p) => [p])

    let step = 0
    const maxSteps = 100
    const dt = 0.05

    const animate = () => {
      if (step >= maxSteps) return

      pts = pts.map((pt, i) => {
        let [vx, vy] = activeSection === 'diffusion'
          ? scoreField.fn(pt[0], pt[1])
          : flowField.fn(pt[0], pt[1])

        // Add noise for diffusion
        if (activeSection === 'diffusion') {
          vx += (Math.random() - 0.5) * noiseScale * 0.5
          vy += (Math.random() - 0.5) * noiseScale * 0.5
        }

        const newPt: Point2D = [
          pt[0] + vx * dt * 10,
          pt[1] + vy * dt * 10,
        ]
        trajs[i] = [...trajs[i], newPt]
        return newPt
      })

      setParticles(pts.slice())
      setTrajectories(trajs.map((t) => t.slice()))

      step++
      animationRef.current = requestAnimationFrame(animate)
    }

    setParticles(pts)
    setTrajectories(trajs)
    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [activeSection, noiseScale, scoreField, flowField])

  const field = activeSection === 'flow' ? flowField : scoreField

  // Use new advanced visualization components based on section
  if (activeSection === 'diffusion' || activeSection === 'diffusion-deep') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <DiffusionForwardReverse />
      </Suspense>
    )
  }

  if (activeSection === 'flow' || activeSection === 'flow-matching') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <FlowMatching />
      </Suspense>
    )
  }

  // Legacy visualization fallback for score section
  if (activeSection === 'score') {
    return (
      <div>
        <PhasePortrait2D
          field={field}
          trajectories={trajectories}
          currentPoint={particles[0]}
          width={360}
          height={360}
          showVectors={true}
          arrowDensity={8}
        />
        <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#7a7468', textAlign: 'center' }}>
          Particles flow from noise to data
        </p>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>∂</div>
      <p style={{ color: '#b8b0a0' }}>
        Scroll to see diffusion<br />and flow dynamics
      </p>
    </div>
  )
}

export default function GenerativePhysicsPillar() {
  return (
    <>
      <Head>
        <title>Generative Physics — Continuous Function</title>
      </Head>
      <ExplorableLayout
        title="Generative Physics"
      subtitle="Diffusion, flow matching, and the geometry of generation"
      visualPanel={<GenerativeVisualPanel />}
      initialParams={{ noiseScale: 0.3, time: 0 }}
    >
      <ExplorableSection id="intro">
        <h2>Generation as Gradient Flow</h2>
        <p>
          How do we generate samples from a complex distribution? The insight of modern
          generative models: define a continuous path from noise to data, then learn to
          traverse it.
        </p>
        <p>
          Whether diffusion, flow matching, or score-based methods, the core idea is
          the same: generation is physics, with data acting as an attractor.
        </p>
      </ExplorableSection>

      <ExplorableSection id="score">
        <h2>Score Functions</h2>
        <p>
          The score of a distribution is the gradient of its log-probability:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Score Definition</div>
          <p>
            s(x) = ∇<sub>x</sub> log p(x)
          </p>
        </div>
        <p>
          The score points toward regions of higher probability. If we follow the score,
          we flow uphill in probability space — toward the modes of the distribution.
        </p>
        <p>
          The visualization shows the score field for a mixture of two Gaussians.
          Arrows point toward the two modes.
        </p>
      </ExplorableSection>

      <ExplorableSection id="diffusion">
        <h2>Diffusion Models</h2>
        <p>
          Diffusion models define a forward process that gradually adds noise to data,
          then learn to reverse it:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Reverse SDE</div>
          <p>
            dx = [f(x,t) - g(t)²∇log p<sub>t</sub>(x)]dt + g(t)dw̄
          </p>
        </div>
        <p>
          The key insight: learning the score at each noise level is enough to reverse
          the diffusion process and generate samples.
        </p>
        <NoiseControl />
      </ExplorableSection>

      <ExplorableSection id="flow">
        <h2>Flow Matching</h2>
        <p>
          Flow matching takes a more direct approach: learn the velocity field that
          transports noise to data along straight paths.
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Optimal Transport</div>
          <p>
            x<sub>t</sub> = (1-t)x<sub>0</sub> + tx<sub>1</sub>
            <br />
            v(x<sub>t</sub>, t) = x<sub>1</sub> - x<sub>0</sub>
          </p>
        </div>
        <p>
          Rectified flows extend this by iteratively straightening the learned paths,
          enabling few-step generation.
        </p>
        <TimeControl />
      </ExplorableSection>

      <ExplorableSection id="comparison">
        <h2>The Big Picture</h2>
        <p>
          All these methods share a common structure:
        </p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ padding: '0.5rem 0' }}>
            <span style={{ color: '#f59e0b' }}>→</span> Define a path between noise and data
          </li>
          <li style={{ padding: '0.5rem 0' }}>
            <span style={{ color: '#f59e0b' }}>→</span> Learn the vector field along that path
          </li>
          <li style={{ padding: '0.5rem 0' }}>
            <span style={{ color: '#f59e0b' }}>→</span> Integrate to generate samples
          </li>
        </ul>
        <p>
          The differences lie in the choice of path and the training objective. Score matching
          targets the gradient of log probability; flow matching directly regresses on velocities.
        </p>
      </ExplorableSection>
    </ExplorableLayout>
    </>
  )
}

function NoiseControl() {
  const { params, setParam } = useExplorable()
  const noiseScale = (params.noiseScale as number) || 0.3

  return (
    <div className="param-control" style={{ display: 'flex', marginTop: '1rem' }}>
      <span>Noise σ:</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={noiseScale}
        onChange={(e) => setParam('noiseScale', parseFloat(e.target.value))}
        aria-label="Noise scale sigma"
        aria-valuetext={noiseScale.toFixed(2)}
      />
      <span className="value">{noiseScale.toFixed(2)}</span>
    </div>
  )
}

function TimeControl() {
  const { params, setParam } = useExplorable()
  const time = (params.time as number) || 0

  return (
    <div className="param-control" style={{ display: 'flex', marginTop: '1rem' }}>
      <span>Time t:</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={time}
        onChange={(e) => setParam('time', parseFloat(e.target.value))}
        aria-label="Time parameter"
        aria-valuetext={time.toFixed(2)}
      />
      <span className="value">{time.toFixed(2)}</span>
    </div>
  )
}
