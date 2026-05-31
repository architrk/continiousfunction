import { useEffect, useMemo, useState } from 'react'

import { clearDemoState, emitDemoState } from '../../../../../lib/demoState'

type Observation = 'H' | 'T'
type PresetKey = 'baseRate' | 'strongEvidence' | 'weakEvidence' | 'tailEvidence'
type PosteriorPrediction = 'decrease' | 'steady' | 'increase'

const PRESETS: Record<PresetKey, { label: string; priorB: number; pHeadA: number; pHeadB: number; observation: Observation }> = {
  baseRate: { label: 'rare B setup', priorB: 0.08, pHeadA: 0.35, pHeadB: 0.9, observation: 'H' },
  strongEvidence: { label: 'distinct coins', priorB: 0.35, pHeadA: 0.15, pHeadB: 0.85, observation: 'H' },
  weakEvidence: { label: 'close coins', priorB: 0.35, pHeadA: 0.45, pHeadB: 0.6, observation: 'H' },
  tailEvidence: { label: 'tail setup', priorB: 0.35, pHeadA: 0.25, pHeadB: 0.8, observation: 'T' },
}

const predictionChoices: Array<{
  id: PosteriorPrediction
  label: string
  hint: string
}> = [
  {
    id: 'decrease',
    label: 'B gets less likely',
    hint: 'Filtering by the observation should move mass away from coin B.',
  },
  {
    id: 'steady',
    label: 'B stays about same',
    hint: 'The observation should not move much mass relative to the prior.',
  },
  {
    id: 'increase',
    label: 'B gets more likely',
    hint: 'Filtering by the observation should move mass toward coin B.',
  },
]

function fmt(n: number) {
  const v = Math.abs(n) < 0.0005 ? 0 : n
  return v.toFixed(3)
}

function fmtPct(n: number) {
  return `${Math.round(n * 100)}%`
}

function classifyPosterior(prior: number, posterior: number): PosteriorPrediction {
  const delta = posterior - prior
  if (delta > 0.04) return 'increase'
  if (delta < -0.04) return 'decrease'
  return 'steady'
}

export default function ProbabilityBasicsViz() {
  const [priorB, setPriorB] = useState(PRESETS.baseRate.priorB)
  const [pHeadA, setPHeadA] = useState(PRESETS.baseRate.pHeadA)
  const [pHeadB, setPHeadB] = useState(PRESETS.baseRate.pHeadB)
  const [observation, setObservation] = useState<Observation>(PRESETS.baseRate.observation)
  const [activePreset, setActivePreset] = useState<PresetKey | null>('baseRate')
  const [prediction, setPrediction] = useState<PosteriorPrediction | null>(null)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)

  const data = useMemo(() => {
    const priorA = 1 - priorB
    const joint = {
      AH: priorA * pHeadA,
      AT: priorA * (1 - pHeadA),
      BH: priorB * pHeadB,
      BT: priorB * (1 - pHeadB),
    }
    const likelihoodObsA = observation === 'H' ? pHeadA : 1 - pHeadA
    const likelihoodObsB = observation === 'H' ? pHeadB : 1 - pHeadB
    const evidence = priorA * likelihoodObsA + priorB * likelihoodObsB
    const jointBAndObs = priorB * likelihoodObsB
    const posteriorB = evidence > 0 ? jointBAndObs / evidence : 0

    return { priorA, joint, likelihoodObsA, likelihoodObsB, evidence, jointBAndObs, posteriorB }
  }, [observation, pHeadA, pHeadB, priorB])

  const predictionKey = `${priorB.toFixed(2)}:${pHeadA.toFixed(2)}:${pHeadB.toFixed(2)}:${observation}`
  const isRevealed = revealedKey === predictionKey
  const posteriorClass = classifyPosterior(priorB, data.posteriorB)
  const posteriorDelta = data.posteriorB - priorB
  const predictionCorrect = prediction === posteriorClass

  const resetReveal = () => {
    setPrediction(null)
    setRevealedKey(null)
    clearDemoState('probability-basics')
  }

  const applyPreset = (key: PresetKey) => {
    const preset = PRESETS[key]
    setPriorB(preset.priorB)
    setPHeadA(preset.pHeadA)
    setPHeadB(preset.pHeadB)
    setObservation(preset.observation)
    setActivePreset(key)
    resetReveal()
  }

  const update = (setter: (value: number) => void, value: number) => {
    setter(value)
    setActivePreset(null)
    resetReveal()
  }

  const updateObservation = (value: Observation) => {
    setObservation(value)
    setActivePreset(null)
    resetReveal()
  }

  const revealConditioning = () => {
    if (!prediction) return
    setRevealedKey(predictionKey)
  }

  useEffect(() => {
    if (!isRevealed) return

    emitDemoState({
      conceptId: 'probability-basics',
      label: 'Probability conditioning prediction',
      summary:
        `prediction=${prediction ?? 'none'}; actual=${posteriorClass}; ` +
        `P(B)=${fmt(priorB)} -> P(B|${observation})=${fmt(data.posteriorB)}.`,
      values: [
        `observation=${observation}`,
        `P(B)=${fmt(priorB)}`,
        `P(${observation}|A)=${fmt(data.likelihoodObsA)}`,
        `P(${observation}|B)=${fmt(data.likelihoodObsB)}`,
        `P(${observation})=${fmt(data.evidence)}`,
        `P(B and ${observation})=${fmt(data.jointBAndObs)}`,
        `P(B|${observation})=${fmt(data.posteriorB)}`,
        `posterior delta=${fmt(posteriorDelta)}`,
        `prediction correct=${predictionCorrect ? 'yes' : 'no'}`,
      ],
    })
  }, [
    data.evidence,
    data.jointBAndObs,
    data.likelihoodObsA,
    data.likelihoodObsB,
    data.posteriorB,
    isRevealed,
    observation,
    posteriorClass,
    posteriorDelta,
    prediction,
    predictionCorrect,
    priorB,
  ])

  useEffect(() => {
    clearDemoState('probability-basics')
  }, [])

  const rows = [
    { key: 'AH', coin: 'A', obs: 'H', value: data.joint.AH },
    { key: 'AT', coin: 'A', obs: 'T', value: data.joint.AT },
    { key: 'BH', coin: 'B', obs: 'H', value: data.joint.BH },
    { key: 'BT', coin: 'B', obs: 'T', value: data.joint.BT },
  ]

  return (
    <div className="wrap">
      <div className="controls">
        <div className="presetGroup" aria-label="Probability basics presets">
          {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
            <button key={key} type="button" aria-pressed={activePreset === key} onClick={() => applyPreset(key)}>
              {PRESETS[key].label}
            </button>
          ))}
        </div>

        <div className="sliders">
          <label>
            <span>P(coin B)</span>
            <input type="range" min="0.01" max="0.99" step="0.01" value={priorB} onChange={(event) => update(setPriorB, Number(event.target.value))} />
            <strong>{fmt(priorB)}</strong>
          </label>
          <label>
            <span>P(H | A)</span>
            <input type="range" min="0.01" max="0.99" step="0.01" value={pHeadA} onChange={(event) => update(setPHeadA, Number(event.target.value))} />
            <strong>{fmt(pHeadA)}</strong>
          </label>
          <label>
            <span>P(H | B)</span>
            <input type="range" min="0.01" max="0.99" step="0.01" value={pHeadB} onChange={(event) => update(setPHeadB, Number(event.target.value))} />
            <strong>{fmt(pHeadB)}</strong>
          </label>
          <div className="observe" aria-label="Observed outcome">
            <span>observe</span>
            <button type="button" aria-pressed={observation === 'H'} onClick={() => updateObservation('H')}>Head</button>
            <button type="button" aria-pressed={observation === 'T'} onClick={() => updateObservation('T')}>Tail</button>
          </div>
        </div>
      </div>

      <section className="prediction" aria-label="Posterior prediction">
        <div className="predictionCopy">
          <span>predict before conditioning</span>
          <strong>After observing {observation === 'H' ? 'Head' : 'Tail'}, how should belief in coin B move?</strong>
          <p>
            The prior and likelihoods are visible. The joint cells, evidence, and posterior stay hidden until you commit.
            About same means the posterior stays within 0.04 of the prior.
          </p>
        </div>
        <div className="predictionActions" role="group" aria-label="Predict posterior movement">
          {predictionChoices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className={prediction === choice.id ? 'selected' : ''}
              aria-pressed={prediction === choice.id}
              onClick={() => {
                setPrediction(choice.id)
                setRevealedKey(null)
                clearDemoState('probability-basics')
              }}
            >
              <strong>{choice.label}</strong>
              <span>{choice.hint}</span>
            </button>
          ))}
        </div>
        <button type="button" className="reveal" disabled={!prediction} onClick={revealConditioning}>
          Reveal conditioning
        </button>
        {isRevealed ? (
          <p role="status" className={predictionCorrect ? 'feedback correct' : 'feedback'}>
            {predictionCorrect ? 'Correct.' : 'Not quite.'} Actual movement: {posteriorClass}. P(B) moves from {fmt(priorB)} to {fmt(data.posteriorB)}{' '}
            after filtering the {observation} column and renormalizing by P({observation})={fmt(data.evidence)}.
          </p>
        ) : null}
      </section>

      <div className="metrics">
        <div>
          <span>prior P(A) / P(B)</span>
          <strong>{fmt(data.priorA)} / {fmt(priorB)}</strong>
        </div>
        <div>
          <span>likelihood P({observation} | A) / P({observation} | B)</span>
          <strong>{fmt(data.likelihoodObsA)} / {fmt(data.likelihoodObsB)}</strong>
        </div>
        <div>
          <span>evidence P({observation})</span>
          <strong>{isRevealed ? fmt(data.evidence) : 'hidden'}</strong>
        </div>
        <div>
          <span>joint P(B and {observation})</span>
          <strong>{isRevealed ? fmt(data.jointBAndObs) : 'hidden'}</strong>
        </div>
        <div>
          <span>posterior P(B | {observation})</span>
          <strong>{isRevealed ? fmt(data.posteriorB) : 'hidden'}</strong>
        </div>
      </div>

      <div className="stage">
        <div className="tablePanel">
          <h3>joint table</h3>
          <div className="jointGrid">
            <div />
            <strong>Head</strong>
            <strong>Tail</strong>
            <strong>coin A</strong>
            <Cell active={observation === 'H'} value={data.joint.AH} hidden={!isRevealed} />
            <Cell active={observation === 'T'} value={data.joint.AT} hidden={!isRevealed} />
            <strong>coin B</strong>
            <Cell active={observation === 'H'} value={data.joint.BH} hidden={!isRevealed} />
            <Cell active={observation === 'T'} value={data.joint.BT} hidden={!isRevealed} />
          </div>
          {isRevealed ? (
            <p>
              The active column is the event you observed. Its column sum is P({observation}) = {fmt(data.evidence)};
              conditioning divides each active cell by that sum.
            </p>
          ) : (
            <p>The active column is visible, but the joint masses and column sum stay hidden until prediction reveal.</p>
          )}
        </div>

        <svg viewBox="0 0 660 330" role="img" aria-label="Bayes rule as filtering the joint table by the observed outcome and renormalizing posterior mass.">
          <rect x="28" y="28" width="604" height="268" rx="8" className="plotBg" />
          <text x="52" y="62" className="title">filter event</text>
          <text x="362" y="62" className="title">renormalize</text>

          {rows.map((row, index) => {
            const y = 94 + index * 42
            const active = row.obs === observation
            return (
              <g key={row.key} opacity={active ? 1 : 0.32}>
                <rect x="54" y={y - 22} width="190" height="30" rx="7" className={active ? 'world active' : 'world'} />
                <text x="72" y={y - 3} className="worldText">coin {row.coin}, {row.obs}</text>
                <text x="178" y={y - 3} className="worldProb">{isRevealed ? fmt(row.value) : 'hidden'}</text>
                {active && <path d={`M 250 ${y - 8} C 302 ${y - 8}, 310 168, 352 168`} className="flow" />}
              </g>
            )
          })}

          <rect x="360" y="118" width="210" height="96" rx="8" className="posteriorBox" />
          <text x="382" y="148" className="posteriorLabel">P(B | {observation})</text>
          <rect x="382" y="168" width="150" height="18" rx="9" className="posteriorTrack" />
          <rect x="382" y="168" width={isRevealed ? 150 * data.posteriorB : 0} height="18" rx="9" className="posteriorBar" />
          <text x="382" y="204" className="posteriorValue">
            {isRevealed ? `${fmtPct(data.posteriorB)} after renormalizing by P(${observation})` : 'hidden until reveal'}
          </text>
        </svg>
      </div>

      <p className="claim">
        {isRevealed
          ? 'Bayes rule is not magic. It is the product rule plus normalization: keep the worlds compatible with the observation, then divide by the evidence so the remaining mass sums to one.'
          : 'Commit to a posterior direction first. Then reveal the joint masses and evidence denominator that make conditioning work.'}
      </p>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .controls {
          display: grid;
          grid-template-columns: minmax(170px, 0.28fr) minmax(0, 1fr);
          gap: 0.75rem;
          padding: 0.8rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 251, 245, 0.78);
        }

        .presetGroup,
        .sliders {
          display: grid;
          gap: 0.45rem;
        }

        button {
          min-height: 34px;
          border: 1px solid rgba(27, 36, 48, 0.12);
          border-radius: 8px;
          background: #fffaf0;
          color: #1b2430;
          padding: 0 0.68rem;
          font-size: 0.82rem;
          cursor: pointer;
          text-align: left;
        }

        button[aria-pressed='true'] {
          border-color: rgba(31, 111, 120, 0.58);
          background: rgba(226, 242, 239, 0.9);
        }

        label,
        .observe {
          display: grid;
          grid-template-columns: 7rem minmax(0, 1fr) 4.4rem;
          gap: 0.5rem;
          align-items: center;
          color: #4a5865;
          font-size: 0.78rem;
        }

        .observe {
          grid-template-columns: 7rem 1fr 1fr;
        }

        input {
          width: 100%;
        }

        label strong {
          color: #1b2430;
          font-family: var(--font-mono);
          text-align: right;
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
          gap: 0.6rem;
        }

        .prediction {
          display: grid;
          grid-template-columns: minmax(220px, 0.72fr) minmax(0, 1.28fr) auto;
          gap: 0.7rem;
          align-items: stretch;
          border: 1px solid rgba(31, 111, 120, 0.18);
          border-radius: 8px;
          padding: 0.75rem;
          background: linear-gradient(135deg, rgba(226, 242, 239, 0.9), rgba(255, 251, 245, 0.84));
        }

        .predictionCopy span {
          display: block;
          color: #1f6f78;
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .predictionCopy strong {
          display: block;
          margin-top: 0.25rem;
          color: #1b2430;
          line-height: 1.3;
        }

        .predictionCopy p,
        .feedback {
          margin: 0.35rem 0 0;
          color: #4a5865;
          font-size: 0.84rem;
          line-height: 1.45;
        }

        .predictionActions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .predictionActions button {
          display: grid;
          gap: 0.22rem;
          height: 100%;
          text-align: left;
          white-space: normal;
        }

        .predictionActions button span {
          color: #65717d;
          font-size: 0.75rem;
          line-height: 1.35;
        }

        .predictionActions button.selected {
          border-color: rgba(31, 111, 120, 0.5);
          background: #e2f2ef;
          color: #1f6f78;
        }

        .reveal {
          align-self: stretch;
          border-color: rgba(31, 111, 120, 0.4);
          background: #1f6f78;
          color: #fff;
          text-align: center;
        }

        .reveal:disabled {
          border-color: rgba(27, 36, 48, 0.12);
          background: #d7dee8;
          color: #65717d;
          cursor: not-allowed;
        }

        .feedback {
          grid-column: 1 / -1;
          border-top: 1px solid rgba(31, 111, 120, 0.16);
          padding-top: 0.55rem;
        }

        .feedback.correct {
          color: #1f6f4a;
        }

        .metrics div,
        .tablePanel {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.68);
        }

        .metrics div,
        .tablePanel {
          padding: 0.7rem;
        }

        .metrics span {
          display: block;
          color: #65717d;
          font-size: 0.74rem;
        }

        .metrics strong {
          color: #1b2430;
          font-family: var(--font-mono);
          overflow-wrap: anywhere;
        }

        .stage {
          display: grid;
          grid-template-columns: minmax(220px, 0.36fr) minmax(0, 1fr);
          gap: 0.75rem;
        }

        h3 {
          margin: 0 0 0.7rem;
          color: #1b2430;
          font-size: 0.92rem;
        }

        .jointGrid {
          display: grid;
          grid-template-columns: 4.4rem repeat(2, minmax(0, 1fr));
          gap: 0.35rem;
          align-items: center;
        }

        .jointGrid strong {
          color: #1b2430;
          font-family: var(--font-mono);
          font-size: 0.78rem;
        }

        .tablePanel p {
          margin: 0.7rem 0 0;
          color: #4a5865;
          font-size: 0.84rem;
          line-height: 1.45;
        }

        svg {
          width: 100%;
          height: auto;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(247, 250, 246, 0.94), rgba(245, 249, 255, 0.82));
        }

        .plotBg {
          fill: rgba(255, 255, 255, 0.64);
          stroke: rgba(27, 36, 48, 0.1);
        }

        .title,
        .worldText,
        .worldProb,
        .posteriorLabel,
        .posteriorValue {
          font-family: var(--font-mono);
        }

        .title {
          fill: #334150;
          font-size: 13px;
          font-weight: 700;
        }

        .world {
          fill: rgba(27, 36, 48, 0.06);
          stroke: rgba(27, 36, 48, 0.1);
        }

        .world.active {
          fill: rgba(226, 242, 239, 0.92);
          stroke: rgba(31, 111, 120, 0.3);
        }

        .worldText {
          fill: #1b2430;
          font-size: 12px;
          font-weight: 700;
        }

        .worldProb {
          fill: #4a5865;
          font-size: 11px;
        }

        .flow {
          fill: none;
          stroke: rgba(139, 94, 52, 0.5);
          stroke-width: 2.5;
          stroke-linecap: round;
        }

        .posteriorBox {
          fill: rgba(255, 255, 255, 0.82);
          stroke: rgba(31, 75, 153, 0.18);
        }

        .posteriorLabel {
          fill: #1b2430;
          font-size: 13px;
          font-weight: 700;
        }

        .posteriorTrack {
          fill: rgba(27, 36, 48, 0.08);
        }

        .posteriorBar {
          fill: #1f4b99;
        }

        .posteriorValue {
          fill: #4a5865;
          font-size: 11px;
        }

        .claim {
          margin: 0;
          color: #334150;
          font-size: 0.92rem;
          line-height: 1.55;
        }

        @media (max-width: 980px) {
          .controls,
          .stage,
          .prediction {
            grid-template-columns: 1fr;
          }

          .presetGroup {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 680px) {
          .metrics {
            grid-template-columns: 1fr;
          }

          .predictionActions {
            grid-template-columns: 1fr;
          }

          .presetGroup {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          label,
          .observe {
            grid-template-columns: 1fr;
          }

          label strong {
            text-align: left;
          }
        }
      `}</style>
    </div>
  )
}

function Cell({ active, hidden, value }: { active: boolean; hidden: boolean; value: number }) {
  return (
    <div className={active ? 'cell active' : 'cell'}>
      <span>{hidden ? 'hidden' : fmt(value)}</span>
      <style jsx>{`
        .cell {
          min-height: 2.2rem;
          display: grid;
          place-items: center;
          border-radius: 7px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(27, 36, 48, 0.04);
          color: #4a5865;
          font-family: var(--font-mono);
          font-size: 0.82rem;
        }

        .cell.active {
          border-color: rgba(31, 111, 120, 0.32);
          background: rgba(226, 242, 239, 0.9);
          color: #1b2430;
          font-weight: 700;
        }
      `}</style>
    </div>
  )
}
