import dynamic from 'next/dynamic'
import VizShell from '@/components/viz/VizShell'
import VizStageAdapter from '@/components/viz/VizStageAdapter'

const LossLandscapeViz = dynamic(() => import('@/components/foundations/LossLandscapeViz'), {
  ssr: false,
})

const EdgeOfStabilityViz = dynamic(() => import('@/components/foundations/EdgeOfStabilityViz'), {
  ssr: false,
})

export default function LossLandscapesViz() {
  return (
    <>
    <VizShell
      eyebrow="Interactive demo"
      title="A 2D slice exposes loss, curvature, and SAM's neighborhood check"
      subtitle="Step SGD and SAM from the same point, then predict which trajectory ends with lower local sharpness under this toy Hessian proxy."
      metrics={['2D toy slice', 'lambda-max sharpness proxy', 'SAM perturbation radius rho']}
      notes={
        <p>
          A 2D slice is a diagnostic window, not the full high-dimensional
          landscape. Here sharpness means a local Hessian lambda-max proxy in
          this toy surface; in nonconvex regions curvature can be
          direction-dependent and the Hessian can be indefinite.
        </p>
      }
      challenge={
        <p>
          Before checking, predict which path ends with lower measured
          sharpness after the fixed rollout: SAM, SGD, or neither.
        </p>
      }
    >
      <VizStageAdapter
        padding="none"
        overflowX
        ariaLabel="Scrollable loss-landscape sharpness visualization"
      >
        <LossLandscapeViz chrome="notebook" conceptId="loss-landscapes" />
      </VizStageAdapter>
    </VizShell>
    <VizShell
      eyebrow="Interactive demo · stage 2"
      title="Toy stability line: sharpness meets the learning-rate threshold"
      subtitle="Choose a learning rate, then predict whether this toy trajectory stays safely below lambda-max < 2/eta, hovers near the toy threshold, or crosses into divergence."
      metrics={['eta learning rate', '2/eta threshold', 'lambda-max edge ratio', 'toy loss trend']}
      notes={
        <p>
          The red line is the local quadratic gradient-descent edge,
          lambda-max = 2/eta. The teal curve is a toy sharpness trace, not a
          measured neural-network Hessian. In real training, related
          edge-of-stability behavior can involve short-term non-monotone loss
          while long-term loss still decreases; this demo isolates the toy
          threshold mechanism without making that behavior part of the checked
          source claim.
        </p>
      }
      challenge={
        <p>
          Before revealing the trace, predict the regime: safely below the line,
          hovering near the toy threshold, or divergent after crossing. Then
          compare your prediction to lambda-max/(2/eta) and the toy loss trend.
        </p>
      }
    >
      <VizStageAdapter
        padding="none"
        overflowX
        ariaLabel="Scrollable edge-of-stability visualization"
      >
        <EdgeOfStabilityViz chrome="notebook" conceptId="loss-landscapes" />
      </VizStageAdapter>
    </VizShell>
    </>
  )
}
