'use client'

import { useState, useMemo, useEffect, useRef, Suspense, lazy } from 'react'
import Head from 'next/head'
import ExplorableLayout, { useExplorable } from '../../components/ExplorableLayout'
import ExplorableSection from '../../components/ExplorableSection'
import StateTimeline from '../../components/StateTimeline'
import KernelHeatmap from '../../components/KernelHeatmap'
import { NeuralState, Matrix2D, MATH_COLORS } from '../../lib/mathObjects'

// Import visualization components from foundations (canonical source with gamification)
const SuperpositionPolysemanticity = lazy(() => import('../../components/foundations/SuperpositionViz'))
const InductionHeads = lazy(() => import('../../components/foundations/InductionHeadsViz'))
const LinearProbes = lazy(() => import('../../components/foundations/LinearProbeViz'))

function LoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 360, color: '#b8b0a0' }}>
      Loading visualization...
    </div>
  )
}

function MechInterpVisualPanel() {
  const { activeSection, params } = useExplorable()

  const sparsity = (params.sparsity as number) || 0.8
  const numFeatures = (params.numFeatures as number) || 8

  // Simulated neural activations
  const neuralStates: NeuralState[] = useMemo(() => {
    const states: NeuralState[] = []
    const numSteps = 12
    const numNeurons = 16

    for (let t = 0; t < numSteps; t++) {
      const activations = Array.from({ length: numNeurons }, (_, i) => {
        // Simulate sparse, interpretable features
        const isActive = Math.random() > sparsity
        return isActive ? Math.random() * 0.8 + 0.2 : Math.random() * 0.1
      })
      states.push({
        layer: `L${Math.floor(t / 4) + 1}`,
        activations,
        timestamp: t,
      })
    }
    return states
  }, [sparsity])

  // Feature dictionary (SAE-like)
  const featureMatrix: Matrix2D = useMemo(() => {
    const data: number[][] = []
    const labels = ['edge', 'curve', 'color', 'texture', 'object', 'position', 'abstract', 'semantic']

    for (let i = 0; i < numFeatures; i++) {
      const row = Array.from({ length: 8 }, () => Math.random() * 2 - 1)
      // Normalize
      const norm = Math.sqrt(row.reduce((s, v) => s + v * v, 0))
      data.push(row.map((v) => v / norm))
    }

    return {
      data,
      rowLabels: Array.from({ length: numFeatures }, (_, i) => `F${i + 1}`),
      colLabels: labels.slice(0, 8),
      label: 'Feature Dictionary',
    }
  }, [numFeatures])

  // Use new advanced visualization components based on section
  if (activeSection === 'superposition') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SuperpositionPolysemanticity />
      </Suspense>
    )
  }

  if (activeSection === 'circuits') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <InductionHeads />
      </Suspense>
    )
  }

  if (activeSection === 'features' || activeSection === 'sae') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LinearProbes />
      </Suspense>
    )
  }

  // Legacy visualization fallback for activations
  if (activeSection === 'activations') {
    return (
      <div>
        <StateTimeline
          states={neuralStates}
          width={360}
          height={200}
          showActivations={true}
          highlightNeurons={[2, 5, 11]}
        />
        <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#7a7468', textAlign: 'center' }}>
          Highlighted: potentially interpretable neurons
        </p>
      </div>
    )
  }

  if (activeSection === 'sae-legacy') {
    return (
      <div>
        <KernelHeatmap
          matrix={featureMatrix}
          width={360}
          height={300}
          colorScheme="diverging"
          showValues={false}
          title="Learned Features"
        />
        <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#7a7468', textAlign: 'center' }}>
          SAE decoder weights
        </p>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>&#8853;</div>
      <p style={{ color: '#b8b0a0' }}>
        Scroll to probe<br />neural representations
      </p>
    </div>
  )
}

export default function MechInterpPillar() {
  return (
    <>
      <Head>
        <title>Mechanistic Interpretability — Continuous Function</title>
      </Head>
      <ExplorableLayout
        title="Mechanistic Interpretability"
      subtitle="Reverse-engineering neural computation"
      visualPanel={<MechInterpVisualPanel />}
      initialParams={{ sparsity: 0.8, numFeatures: 8 }}
    >
      <ExplorableSection id="intro">
        <h2>What Do Networks Compute?</h2>
        <p>
          Neural networks learn rich internal representations, but understanding what
          they compute remains challenging. Mechanistic interpretability aims to
          reverse-engineer these computations into human-understandable algorithms.
        </p>
        <p>
          The goal: not just <em>that</em> a network works, but <em>how</em> it works,
          neuron by neuron, layer by layer.
        </p>
      </ExplorableSection>

      <ExplorableSection id="activations">
        <h2>Reading Activations</h2>
        <p>
          The first step is understanding what patterns of activation mean. Some neurons
          respond to interpretable features — edges, colors, concepts. Others encode
          more abstract properties.
        </p>
        <p>
          The visualization shows activations across layers and time. Highlighted neurons
          show potentially interpretable patterns.
        </p>
        <SparsityControl />
      </ExplorableSection>

      <ExplorableSection id="superposition">
        <h2>Superposition</h2>
        <p>
          A key challenge: networks encode more features than they have neurons.
          Features are represented in <em>superposition</em> — overlapping, distributed
          patterns that interfere with each other.
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Superposition Hypothesis</div>
          <p>
            If features are sparse (rarely active together), a network can encode
            n features in m dimensions where n {'>'} m by tolerating some interference.
          </p>
        </div>
        <p>
          This is efficient but makes interpretation harder — we can't just look
          at individual neurons.
        </p>
      </ExplorableSection>

      <ExplorableSection id="sae">
        <h2>Sparse Autoencoders</h2>
        <p>
          Sparse autoencoders (SAEs) attempt to disentangle superposed representations.
          They learn a dictionary of features that reconstructs activations:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">SAE Objective</div>
          <p>
            min ||x - Wf(W<sup>T</sup>x)||² + λ||f(W<sup>T</sup>x)||₁
          </p>
        </div>
        <p>
          The sparsity penalty encourages each input to be explained by a small number
          of features, ideally corresponding to interpretable concepts.
        </p>
        <NumFeaturesControl />
      </ExplorableSection>

      <ExplorableSection id="features">
        <h2>Feature Interpretation</h2>
        <p>
          Once we have features, we can study them:
        </p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ padding: '0.5rem 0' }}>
            <span style={{ color: '#f59e0b' }}>→</span> Find examples that maximally activate each feature
          </li>
          <li style={{ padding: '0.5rem 0' }}>
            <span style={{ color: '#f59e0b' }}>→</span> Ablate features to see their causal effect
          </li>
          <li style={{ padding: '0.5rem 0' }}>
            <span style={{ color: '#f59e0b' }}>→</span> Track how features compose across layers
          </li>
        </ul>
        <p>
          The dream: a complete catalog of features and circuits that explains
          everything a model knows and computes.
        </p>
      </ExplorableSection>

      <ExplorableSection id="circuits">
        <h2>Circuits</h2>
        <p>
          Features don't act in isolation — they connect into circuits. A circuit is
          a subgraph of the computation that implements a specific algorithm.
        </p>
        <p>
          Example circuits discovered in language models:
        </p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ padding: '0.5rem 0' }}>
            <span style={{ color: '#14b8a6' }}>•</span> Induction heads (in-context learning)
          </li>
          <li style={{ padding: '0.5rem 0' }}>
            <span style={{ color: '#14b8a6' }}>•</span> Indirect object identification
          </li>
          <li style={{ padding: '0.5rem 0' }}>
            <span style={{ color: '#14b8a6' }}>•</span> Greater-than comparison
          </li>
        </ul>
        <p>
          Understanding circuits gives us mechanistic insight into model behavior
          and potential failure modes.
        </p>
      </ExplorableSection>
    </ExplorableLayout>
    </>
  )
}

function SparsityControl() {
  const { params, setParam } = useExplorable()
  const sparsity = (params.sparsity as number) || 0.8

  return (
    <div className="param-control" style={{ display: 'flex', marginTop: '1rem' }}>
      <span>Sparsity:</span>
      <input
        type="range"
        min="0.5"
        max="0.95"
        step="0.05"
        value={sparsity}
        onChange={(e) => setParam('sparsity', parseFloat(e.target.value))}
        aria-label="Sparsity"
        aria-valuetext={`${(sparsity * 100).toFixed(0)} percent`}
      />
      <span className="value">{(sparsity * 100).toFixed(0)}%</span>
    </div>
  )
}

function NumFeaturesControl() {
  const { params, setParam } = useExplorable()
  const numFeatures = (params.numFeatures as number) || 8

  return (
    <div className="param-control" style={{ display: 'flex', marginTop: '1rem' }}>
      <span>Features:</span>
      <input
        type="range"
        min="4"
        max="16"
        step="1"
        value={numFeatures}
        onChange={(e) => setParam('numFeatures', parseInt(e.target.value))}
        aria-label="Number of features"
        aria-valuetext={`${numFeatures} features`}
      />
      <span className="value">{numFeatures}</span>
    </div>
  )
}
