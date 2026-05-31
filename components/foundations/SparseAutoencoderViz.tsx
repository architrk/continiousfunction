import { useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { emitDemoState } from '../../lib/demoState'

type SparseAutoencoderVizProps = {
  width?: number
  height?: number
  chrome?: 'legacy' | 'notebook'
}

type SAEType = 'l1' | 'topk' | 'gated'
type CheckPhase = 'setup' | 'revealed'
type SAEPrediction = SAEType | null

type FrontierChallenge = {
  name: string
  sparsity: number
  answer: SAEType
  description: string
  observation: string
}

const FRONTIER_CHALLENGES: FrontierChallenge[] = [
  {
    name: 'Shrinkage check',
    sparsity: 6,
    answer: 'l1',
    description: 'At low L0, which curve should you inspect for L1 shrinkage bias?',
    observation: 'Inspect the L1 curve: a soft sparsity penalty can shrink active magnitudes, so reconstruction can lag at the same active-feature budget.',
  },
  {
    name: 'Fixed-budget check',
    sparsity: 20,
    answer: 'topk',
    description: 'Which variant makes the active-feature budget an explicit k?',
    observation: 'TopK makes the active-feature budget the direct knob: keep k latents, then compare reconstruction at that same L0.',
  },
  {
    name: 'Gate/magnitude check',
    sparsity: 15,
    answer: 'gated',
    description: 'Which variant separates feature detection from magnitude estimation?',
    observation: 'Gated SAEs separate the decision that a feature is present from the estimate of how strongly it contributes.',
  },
  {
    name: 'Scaled-toy caveat',
    sparsity: 32,
    answer: 'topk',
    description: 'Which preset is only an OpenAI-style TopK analogue, not an empirical GPT-4 operating point?',
    observation: 'The TopK preset is only an OpenAI-style analogue. This toy k is normalized for teaching and is not a GPT-4 measurement.',
  },
]

const OPERATING_PRESETS = [
  { name: 'Very sparse', type: 'topk' as SAEType, k: 5, description: 'Only a few active features per token; high interpretability pressure.' },
  { name: 'Gated low-L0 example', type: 'gated' as SAEType, k: 20, description: 'A gated mechanism example at a low active-feature budget.' },
  { name: 'OpenAI-style TopK analogue', type: 'topk' as SAEType, k: 32, description: 'A scaled teaching analogue for TopK control, not an empirical GPT-4 operating point.' },
  { name: 'Higher reconstruction budget', type: 'gated' as SAEType, k: 45, description: 'More active features usually improve reconstruction while reducing sparsity.' },
]

const saeColors: Record<SAEType, string> = {
  l1: '#8b5cf6',
  topk: '#22c55e',
  gated: '#f59e0b',
}

const saeLabels: Record<SAEType, string> = {
  l1: 'L1 SAE (tune lambda)',
  topk: 'TopK SAE (set k)',
  gated: 'Gated SAE',
}

const mechanismLabels: Record<SAEType, string> = {
  l1: 'L1 shrinkage',
  topk: 'TopK fixed budget',
  gated: 'gated detection/magnitude split',
}

function getReconForType(saeType: SAEType, sparsity: number) {
  if (saeType === 'l1') {
    return 0.055 + 0.4 / (1 + sparsity / 8)
  }
  if (saeType === 'topk') {
    return 0.022 + 0.34 / (1 + sparsity / 6)
  }
  return 0.035 + 0.31 / (1 + sparsity / 5)
}

function getMSEAtSparsity(sparsity: number) {
  return {
    l1: getReconForType('l1', sparsity),
    topk: getReconForType('topk', sparsity),
    gated: getReconForType('gated', sparsity),
  }
}

function formatToyMSE(mseValues: Record<SAEType, number>) {
  return `Toy MSE at this L0: L1 ${mseValues.l1.toFixed(3)}, TopK ${mseValues.topk.toFixed(3)}, gated ${mseValues.gated.toFixed(3)}.`
}

function getFrontierFeedback(
  predicted: SAEPrediction,
  challenge: FrontierChallenge,
  mseValues: Record<SAEType, number>
) {
  const matched = predicted === challenge.answer
  const predictionCopy = predicted
    ? `You chose ${mechanismLabels[predicted]}.`
    : 'No mechanism was selected.'
  const verdict = matched
    ? 'Prediction matched.'
    : `Prediction missed. Inspect ${mechanismLabels[challenge.answer]} for this observation.`

  return `${verdict} ${predictionCopy} ${challenge.observation} ${formatToyMSE(mseValues)}`
}

function getSAEInsight(selectedType: SAEType, sparsityParam: number, currentMSE: number) {
  if (selectedType === 'l1' && sparsityParam < 10) {
    return 'L1 with a strong sparsity penalty exposes shrinkage bias: active features can be pushed toward zero. Compare it with TopK or gated mechanisms at the same active-feature budget.'
  }

  if (selectedType === 'topk') {
    if (sparsityParam <= 5) {
      return `TopK with k=${sparsityParam} keeps only a few features active per token. That makes the budget easy to inspect, while reconstruction suffers in this toy frontier (MSE ${currentMSE.toFixed(3)}).`
    }
    if (sparsityParam >= 30) {
      return `TopK with k=${sparsityParam} fixes the toy active-feature budget directly. This mirrors the motivation for k-sparse SAEs; the slider value is normalized for teaching, not a GPT-4 measurement.`
    }
    return `TopK with k=${sparsityParam} activates exactly ${sparsityParam} toy features per token. Move the slider to test how controlled L0 changes reconstruction MSE (${currentMSE.toFixed(3)}).`
  }

  if (selectedType === 'gated') {
    return `Gated SAE separates feature detection from magnitude estimation. In this toy frontier, that removes the visible L1 shrinkage penalty at the same active-feature budget. Treat it as a mechanism illustration, not a universal ranking.`
  }

  return `L1 SAE at L0=${sparsityParam} has toy reconstruction MSE ${currentMSE.toFixed(3)}. The key question is whether the sparsity penalty is selecting useful features or simply shrinking active magnitudes.`
}

function getInsightTone(selectedType: SAEType, sparsityParam: number) {
  if (selectedType === 'l1' && sparsityParam < 10) return 'caution'
  if (selectedType === 'topk') return 'control'
  return 'mechanism'
}

export default function SparseAutoencoderViz({
  width = 600,
  height = 400,
  chrome = 'legacy',
}: SparseAutoencoderVizProps) {
  const [selectedType, setSelectedType] = useState<SAEType>('topk')
  const [sparsityParam, setSparsityParam] = useState(10)
  const [checkMode, setCheckMode] = useState(false)
  const [checkPhase, setCheckPhase] = useState<CheckPhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<FrontierChallenge | null>(null)
  const [prediction, setPrediction] = useState<SAEPrediction>(null)
  const [checkProgress, setCheckProgress] = useState({ correct: 0, total: 0 })

  const margin = { top: 20, right: 120, bottom: 60, left: 70 }
  const w = width - margin.left - margin.right
  const h = height - margin.top - margin.bottom

  const frontierData = useMemo(() => {
    const points = 50
    const sparsityRange = [0.5, 50]

    const generateFrontier = (saeType: SAEType) => {
      const data = []
      for (let i = 0; i < points; i += 1) {
        const t = i / (points - 1)
        const sparsity = sparsityRange[0] + t * (sparsityRange[1] - sparsityRange[0])
        data.push({ sparsity, recon: getReconForType(saeType, sparsity) })
      }
      return data
    }

    return {
      l1: generateFrontier('l1'),
      topk: generateFrontier('topk'),
      gated: generateFrontier('gated'),
    }
  }, [])

  const xScale = d3.scaleLinear()
    .domain([0, 50])
    .range([0, w])

  const yScale = d3.scaleLinear()
    .domain([0, 0.5])
    .range([h, 0])

  const lineGen = d3.line<{ sparsity: number; recon: number }>()
    .x(d => xScale(d.sparsity))
    .y(d => yScale(d.recon))

  const currentMSE = useMemo(
    () => getMSEAtSparsity(sparsityParam)[selectedType],
    [selectedType, sparsityParam]
  )

  const currentInsight = useMemo(
    () => getSAEInsight(selectedType, sparsityParam, currentMSE),
    [selectedType, sparsityParam, currentMSE]
  )

  const insightTone = getInsightTone(selectedType, sparsityParam)
  const challengeMSE = selectedChallenge ? getMSEAtSparsity(selectedChallenge.sparsity) : null

  useEffect(() => {
    emitDemoState({
      conceptId: 'sparse-autoencoders',
      label: 'Sparse autoencoder frontier',
      summary: `${saeLabels[selectedType]} at L0=${sparsityParam} has toy reconstruction MSE ${currentMSE.toFixed(3)}.`,
      values: [
        selectedType === 'topk'
          ? 'TopK directly fixes k active latents per token in this toy'
          : 'L1/gated slider represents a target average active-feature budget',
        'invariant: compare methods at the same L0 budget',
        'caveat: illustrative frontier, not trained SAE data',
        'next test: lower the active-feature budget until reconstruction failure becomes visible',
      ],
    })
  }, [currentMSE, selectedType, sparsityParam])

  const resetCheck = () => {
    setCheckPhase('setup')
    setSelectedChallenge(null)
    setPrediction(null)
  }

  const startChallenge = (challenge: FrontierChallenge) => {
    setSelectedChallenge(challenge)
    setPrediction(null)
    setCheckPhase('setup')
  }

  const submitPrediction = (pred: SAEType) => {
    if (!selectedChallenge) return

    setPrediction(pred)
    setSparsityParam(selectedChallenge.sparsity)
    setSelectedType(selectedChallenge.answer)
    setCheckProgress(prev => ({
      correct: prev.correct + (pred === selectedChallenge.answer ? 1 : 0),
      total: prev.total + 1,
    }))
    setCheckPhase('revealed')
  }

  const handlePreset = (preset: typeof OPERATING_PRESETS[0]) => {
    setSelectedType(preset.type)
    setSparsityParam(preset.k)
  }

  const toggleCheckMode = () => {
    const nextMode = !checkMode
    setCheckMode(nextMode)
    if (nextMode) resetCheck()
  }

  return (
    <div className={`sae-viz ${chrome}`}>
      <div className="prediction-toggle-row">
        <button
          type="button"
          onClick={toggleCheckMode}
          className={`check-toggle ${checkMode ? 'active' : ''}`}
          aria-pressed={checkMode}
        >
          {checkMode ? 'Close prediction check' : 'Start prediction check'}
        </button>
        {checkMode && checkProgress.total > 0 ? (
          <span className="check-status">Checks completed: {checkProgress.correct}/{checkProgress.total} matched</span>
        ) : null}
      </div>

      {checkMode ? (
        <div className="prediction-panel">
          {checkPhase === 'setup' && !selectedChallenge ? (
            <>
              <p className="prediction-title">Prediction check</p>
              <p className="prediction-copy">
                Pick an observation, choose the mechanism you think explains it, then reveal the toy frontier at that L0.
              </p>
              <div className="challenge-buttons">
                {FRONTIER_CHALLENGES.map(challenge => (
                  <button
                    key={challenge.name}
                    type="button"
                    onClick={() => startChallenge(challenge)}
                    title={challenge.description}
                    className="challenge-btn"
                  >
                    {challenge.name}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {checkPhase === 'setup' && selectedChallenge ? (
            <>
              <p className="prediction-title">{selectedChallenge.name}</p>
              <p className="prediction-copy">{selectedChallenge.description}</p>
              <p className="prediction-question">
                Which mechanism should explain the observation at L0={selectedChallenge.sparsity}?
              </p>
              <div className="choice-row">
                {(['l1', 'topk', 'gated'] as SAEType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => submitPrediction(type)}
                    className={`choice-btn ${type}`}
                  >
                    {mechanismLabels[type]}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {checkPhase === 'revealed' && selectedChallenge && challengeMSE ? (
            <>
              <div
                className={`result-message ${prediction === selectedChallenge.answer ? 'matched' : 'missed'}`}
                role="status"
                aria-live="polite"
              >
                {getFrontierFeedback(prediction, selectedChallenge, challengeMSE)}
              </div>
              <button type="button" onClick={resetCheck} className="try-another-btn">
                Try another check
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <p className="predict-first">
        Predict first: if two points use the same active-feature budget, which one should reconstruct better, and what mechanism explains the difference?
      </p>

      <div className="presets">
        {OPERATING_PRESETS.map(preset => {
          const active = selectedType === preset.type && sparsityParam === preset.k

          return (
            <button
              key={preset.name}
              type="button"
              onClick={() => handlePreset(preset)}
              className={`preset-btn ${active ? 'active' : ''}`}
              title={preset.description}
              aria-pressed={active}
            >
              {preset.name}
            </button>
          )
        })}
      </div>

      <div className={`dynamic-insight tone-${insightTone}`}>
        {currentInsight}
      </div>

      <div className="controls">
        <div className="control-group">
          <label>SAE type</label>
          <div className="button-group">
            {(['l1', 'topk', 'gated'] as SAEType[]).map(type => (
              <button
                key={type}
                type="button"
                className={selectedType === type ? 'active' : ''}
                onClick={() => setSelectedType(type)}
                style={{ borderColor: saeColors[type] }}
                aria-pressed={selectedType === type}
              >
                {saeLabels[type]}
              </button>
            ))}
          </div>
        </div>
        <div className="control-group slider-group">
          <label htmlFor="sae-active-feature-budget">
            {selectedType === 'topk' ? 'k active features' : 'Target average L0'}: {sparsityParam}
          </label>
          <input
            id="sae-active-feature-budget"
            type="range"
            min="1"
            max="50"
            step="1"
            value={sparsityParam}
            onChange={(event) => setSparsityParam(parseInt(event.target.value, 10))}
          />
        </div>
      </div>

      <div
        className="chart-scroll"
        role="region"
        aria-label="Scrollable sparse autoencoder frontier chart"
        tabIndex={0}
      >
        <svg width={width} height={height} role="img" aria-label="Sparse autoencoder visualization showing active features per token versus toy reconstruction MSE">
          <g transform={`translate(${margin.left},${margin.top})`}>
            <g className="axis axis-x" transform={`translate(0,${h})`}>
              {xScale.ticks(5).map(tick => (
                <g key={tick} transform={`translate(${xScale(tick)},0)`}>
                  <line y2="6" stroke="currentColor" />
                  <text y="20" textAnchor="middle" fontSize="12" fill="currentColor">
                    {tick}
                  </text>
                </g>
              ))}
              <text x={w / 2} y="45" textAnchor="middle" fontSize="14" fill="currentColor">
                Active features per token, L0
              </text>
            </g>

            <g className="axis axis-y">
              {yScale.ticks(5).map(tick => (
                <g key={tick} transform={`translate(0,${yScale(tick)})`}>
                  <line x2="-6" stroke="currentColor" />
                  <text x="-10" textAnchor="end" alignmentBaseline="middle" fontSize="12" fill="currentColor">
                    {tick.toFixed(2)}
                  </text>
                </g>
              ))}
              <text
                transform={`translate(-55,${h / 2}) rotate(-90)`}
                textAnchor="middle"
                fontSize="14"
                fill="currentColor"
              >
                Toy reconstruction MSE
              </text>
            </g>

            <g className="grid" opacity={0.05}>
              {xScale.ticks(10).map(tick => (
                <line
                  key={`v-${tick}`}
                  x1={xScale(tick)}
                  x2={xScale(tick)}
                  y1={0}
                  y2={h}
                  stroke="currentColor"
                />
              ))}
              {yScale.ticks(10).map(tick => (
                <line
                  key={`h-${tick}`}
                  x1={0}
                  x2={w}
                  y1={yScale(tick)}
                  y2={yScale(tick)}
                  stroke="currentColor"
                />
              ))}
            </g>

            {Object.entries(frontierData).map(([type, data]) => (
              <path
                key={type}
                d={lineGen(data) || ''}
                fill="none"
                stroke={saeColors[type as SAEType]}
                strokeWidth={selectedType === type ? 3 : 1.5}
                opacity={selectedType === type ? 1 : 0.3}
              />
            ))}

            {(() => {
              const point = {
                sparsity: sparsityParam,
                recon: currentMSE,
              }
              return (
                <g>
                  <circle
                    cx={xScale(point.sparsity)}
                    cy={yScale(point.recon)}
                    r={6}
                    fill={saeColors[selectedType]}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                  <text
                    x={xScale(point.sparsity)}
                    y={yScale(point.recon) - 15}
                    textAnchor="middle"
                    fontSize="11"
                    fill={saeColors[selectedType]}
                    fontWeight="bold"
                  >
                    Selected toy point
                  </text>
                </g>
              )
            })()}

            <g transform={`translate(${w + 10},20)`}>
              {(['l1', 'topk', 'gated'] as SAEType[]).map((type, index) => (
                <g key={type} transform={`translate(0,${index * 25})`}>
                  <line
                    x1="0"
                    x2="20"
                    y1="0"
                    y2="0"
                    stroke={saeColors[type]}
                    strokeWidth={selectedType === type ? 3 : 1.5}
                  />
                  <text x="25" y="5" fontSize="11" fill="currentColor">
                    {saeLabels[type]}
                  </text>
                </g>
              ))}
            </g>

            <g transform={`translate(${w * 0.15},${h * 0.2})`}>
              <text fontSize="10" fill="#f59e0b" fontStyle="italic">
                Lower toy MSE
              </text>
              <text y="12" fontSize="9" fill="#f59e0b" opacity={0.8}>
                same L0 only
              </text>
            </g>
          </g>
        </svg>
      </div>

      <div className="insight">
        <p>
          <strong>Mechanism invariant:</strong> compare SAE variants at the same active-feature budget.
          More active features usually improve reconstruction, but lower reconstruction loss is not the
          same as a cleaner or more faithful feature dictionary. This toy frontier is illustrative; real
          SAE quality also depends on feature interpretability, downstream loss, dead latents, and stability.
          OpenAI trained a 16M-latent TopK SAE on GPT-4 activations; this toy does not reproduce its data,
          scale, or operating point.
        </p>
      </div>

      <style jsx>{`
        .sae-viz {
          background: rgba(8, 12, 20, 0.5);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 8px;
          padding: 1.5rem;
          margin: 2rem 0;
          min-width: 0;
          color: var(--text-primary);
        }

        .prediction-toggle-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .check-toggle,
        .challenge-btn,
        .choice-btn,
        .try-another-btn,
        .preset-btn,
        .button-group button {
          font: inherit;
          min-height: 34px;
          cursor: pointer;
          transition: background 0.15s ease-out, border-color 0.15s ease-out, color 0.15s ease-out;
        }

        .check-toggle,
        .try-another-btn {
          font-size: 0.8rem;
          padding: 0.35rem 0.85rem;
          border-radius: 999px;
          border: 1px solid rgba(139, 92, 246, 0.3);
          background: rgba(15, 23, 42, 0.9);
          color: #e5e7eb;
        }

        .check-toggle.active {
          border-color: #8b5cf6;
          background: rgba(139, 92, 246, 0.18);
          color: #c4b5fd;
          font-weight: 600;
        }

        .check-status {
          font-size: 0.8rem;
          color: #9ca3af;
        }

        .prediction-panel {
          margin-bottom: 1rem;
          padding: 0.85rem;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(245, 158, 11, 0.1));
          border: 1px solid rgba(139, 92, 246, 0.3);
        }

        .prediction-title {
          font-size: 0.85rem;
          color: #c4b5fd;
          margin: 0 0 0.5rem;
          font-weight: 600;
        }

        .prediction-copy,
        .prediction-question {
          font-size: 0.78rem;
          color: #cbd5e1;
          line-height: 1.5;
          margin: 0 0 0.6rem;
        }

        .prediction-question {
          color: #e5e7eb;
          font-weight: 600;
        }

        .challenge-buttons,
        .choice-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .challenge-btn,
        .choice-btn {
          font-size: 0.75rem;
          padding: 0.45rem 0.7rem;
          border-radius: 6px;
          border: 1px solid rgba(139, 92, 246, 0.3);
          background: rgba(15, 23, 42, 0.9);
          color: #e5e7eb;
        }

        .choice-btn.l1 {
          border-color: #8b5cf6;
          color: #c4b5fd;
        }

        .choice-btn.topk {
          border-color: #22c55e;
          color: #86efac;
        }

        .choice-btn.gated {
          border-color: #f59e0b;
          color: #fcd34d;
        }

        .result-message {
          padding: 0.65rem;
          border-radius: 8px;
          margin-bottom: 0.65rem;
          font-size: 0.8rem;
          line-height: 1.55;
          color: #e5e7eb;
        }

        .result-message.matched {
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .result-message.missed {
          background: rgba(239, 68, 68, 0.14);
          border: 1px solid rgba(239, 68, 68, 0.28);
        }

        .predict-first {
          margin: 0 0 0.75rem;
          color: #cbd5e1;
          font-size: 0.86rem;
          line-height: 1.5;
        }

        .presets {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .preset-btn {
          font-size: 0.8rem;
          padding: 0.4rem 0.8rem;
          border-radius: 999px;
          border: 1px solid rgba(139, 92, 246, 0.25);
          background: rgba(15, 23, 42, 0.8);
          color: #e5e7eb;
        }

        .preset-btn:hover,
        .challenge-btn:hover,
        .choice-btn:hover,
        .try-another-btn:hover,
        .check-toggle:hover {
          background: rgba(139, 92, 246, 0.15);
          border-color: rgba(139, 92, 246, 0.5);
        }

        .preset-btn.active {
          background: rgba(139, 92, 246, 0.25);
          border-color: rgba(139, 92, 246, 0.7);
          color: #c4b5fd;
        }

        .dynamic-insight {
          padding: 0.75rem 1rem;
          border-radius: 10px;
          margin-bottom: 1rem;
          font-size: 0.88rem;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.9);
        }

        .tone-mechanism {
          background: linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(34, 197, 94, 0.05));
          border: 1px solid rgba(52, 211, 153, 0.3);
        }

        .tone-caution {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05));
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .tone-control {
          background: linear-gradient(135deg, rgba(96, 165, 250, 0.15), rgba(59, 130, 246, 0.05));
          border: 1px solid rgba(96, 165, 250, 0.3);
        }

        .controls {
          display: flex;
          gap: 2rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .control-group label {
          font-size: 0.9rem;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .button-group {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .button-group button {
          padding: 0.5rem 1rem;
          background: rgba(8, 12, 20, 0.8);
          border: 2px solid;
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 0.85rem;
        }

        .button-group button:hover {
          background: rgba(245, 158, 11, 0.1);
        }

        .button-group button.active {
          background: rgba(245, 158, 11, 0.2);
          font-weight: 700;
        }

        input[type="range"] {
          width: 100%;
          min-width: 200px;
        }

        .chart-scroll {
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 0.4rem;
        }

        svg {
          display: block;
          margin: 0 auto;
          min-width: 34rem;
        }

        .insight {
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(245, 158, 11, 0.1);
          border-left: 3px solid var(--accent);
          border-radius: 4px;
        }

        .insight p {
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.5;
          color: var(--text-secondary);
        }

        .insight strong {
          color: var(--text-primary);
        }

        .sae-viz.notebook {
          margin: 0;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: #17202a;
        }

        .sae-viz.notebook .prediction-panel,
        .sae-viz.notebook .dynamic-insight,
        .sae-viz.notebook .insight {
          color: #2f3c48;
          background: rgba(255, 251, 245, 0.78);
          border-color: rgba(27, 36, 48, 0.08);
        }

        .sae-viz.notebook .prediction-title {
          color: #1f6f78;
        }

        .sae-viz.notebook .prediction-copy,
        .sae-viz.notebook .prediction-question,
        .sae-viz.notebook .predict-first,
        .sae-viz.notebook .check-status {
          color: #4b5965;
        }

        .sae-viz.notebook .check-toggle,
        .sae-viz.notebook .challenge-btn,
        .sae-viz.notebook .choice-btn,
        .sae-viz.notebook .try-another-btn,
        .sae-viz.notebook .preset-btn,
        .sae-viz.notebook .button-group button {
          background: rgba(255, 251, 245, 0.82);
          color: #263747;
          border-color: rgba(27, 36, 48, 0.12);
        }

        .sae-viz.notebook .check-toggle.active,
        .sae-viz.notebook .preset-btn.active,
        .sae-viz.notebook .button-group button.active {
          background: rgba(31, 111, 120, 0.12);
          color: #1f6f78;
          border-color: rgba(31, 111, 120, 0.32);
        }

        .sae-viz.notebook .result-message {
          color: #263747;
        }

        .sae-viz.notebook .result-message.matched {
          background: rgba(34, 197, 94, 0.1);
          border-color: rgba(34, 197, 94, 0.24);
        }

        .sae-viz.notebook .result-message.missed {
          background: rgba(190, 18, 60, 0.08);
          border-color: rgba(190, 18, 60, 0.18);
        }

        .sae-viz.notebook .control-group label,
        .sae-viz.notebook .insight p,
        .sae-viz.notebook .insight strong {
          color: #2f3c48;
        }

        @media (max-width: 640px) {
          .sae-viz {
            padding: 1rem;
            margin: 1rem 0;
          }

          .sae-viz.notebook {
            padding: 0;
            margin: 0;
          }

          .controls,
          .control-group,
          .control-group label,
          .slider-group {
            min-width: 0;
            width: 100%;
          }

          .button-group button,
          .preset-btn,
          .challenge-btn,
          .choice-btn {
            white-space: normal;
          }

          input[type="range"] {
            min-width: 0;
          }
        }
      `}</style>
    </div>
  )
}
