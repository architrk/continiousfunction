import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import VizShell from '@/components/viz/VizShell'
import VizStageAdapter from '@/components/viz/VizStageAdapter'
import { emitDemoState } from '../../../../../lib/demoState'

type Scenario = {
  id: string
  title: string
  hardLabel: string
  labels: string[]
  teacherLogits: number[]
  studentLogits: number[]
}

const scenarios: Scenario[] = [
  {
    id: 'animal',
    title: 'animal image',
    hardLabel: 'cat',
    labels: ['cat', 'dog', 'fox', 'truck', 'fish'],
    teacherLogits: [4.2, 2.4, 1.7, -0.8, -1.2],
    studentLogits: [3.7, 0.4, 2.2, -0.5, -0.8],
  },
  {
    id: 'next-token',
    title: 'next-token choice',
    hardLabel: 'therefore',
    labels: ['therefore', 'because', 'however', 'banana', 'matrix'],
    teacherLogits: [4.0, 3.1, 2.9, -1.0, 0.1],
    studentLogits: [3.6, 1.2, 2.5, -0.7, 0.0],
  },
  {
    id: 'bird',
    title: 'fine-grained class',
    hardLabel: 'sparrow',
    labels: ['sparrow', 'finch', 'robin', 'plane', 'chair'],
    teacherLogits: [3.9, 3.0, 2.3, -0.5, -0.8],
    studentLogits: [3.2, 1.0, 2.5, -0.2, -0.9],
  },
]

const tauOptions = [1, 2, 4, 8]
const alphaOptions = [0.25, 0.5, 0.75]

const softmax = (logits: number[], tau: number) => {
  const scaled = logits.map((logit) => logit / tau)
  const maxLogit = Math.max(...scaled)
  const exps = scaled.map((value) => Math.exp(value - maxLogit))
  const denom = exps.reduce((sum, value) => sum + value, 0)
  return exps.map((value) => value / denom)
}

const kl = (p: number[], q: number[]) =>
  p.reduce((sum, value, index) => sum + value * Math.log((value + 1e-12) / (q[index] + 1e-12)), 0)

const fmt = (value: number) => value.toFixed(value >= 10 ? 1 : 3)

function getAnalysis(scenario: Scenario, tau: number, alpha: number) {
  const teacher = softmax(scenario.teacherLogits, tau)
  const studentSoft = softmax(scenario.studentLogits, tau)
  const studentHard = softmax(scenario.studentLogits, 1)
  const hardIndex = scenario.labels.indexOf(scenario.hardLabel)
  const gaps = teacher.map((teacherProb, index) => teacherProb - studentSoft[index])
  const nonLabelCandidates = scenario.labels
    .map((label, index) => ({ label, index, gap: gaps[index] }))
    .filter((candidate) => candidate.index !== hardIndex)
  const bestPull = nonLabelCandidates.reduce((best, current) => (current.gap > best.gap ? current : best))
  const kdLoss = tau * tau * kl(teacher, studentSoft)
  const hardLoss = -Math.log(studentHard[hardIndex] + 1e-12)
  const totalLoss = (1 - alpha) * hardLoss + alpha * kdLoss
  const entropy = -teacher.reduce((sum, p) => sum + p * Math.log(p + 1e-12), 0)

  return {
    teacher,
    studentSoft,
    studentHard,
    gaps,
    hardIndex,
    bestPull,
    kdLoss,
    hardLoss,
    totalLoss,
    entropy,
  }
}

export default function KnowledgeDistillationConceptViz() {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id)
  const [tau, setTau] = useState(4)
  const [alpha, setAlpha] = useState(0.5)
  const [prediction, setPrediction] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0]
  const analysis = useMemo(() => getAnalysis(scenario, tau, alpha), [alpha, scenario, tau])
  const predictionCorrect = prediction === analysis.bestPull.label

  useEffect(() => {
    emitDemoState({
      conceptId: 'knowledge-distillation',
      label: 'Knowledge distillation dark-knowledge demo',
      summary: revealed
        ? `Temperature tau=${tau} reveals ${analysis.bestPull.label} as the largest non-label teacher pull; KD loss ${fmt(analysis.kdLoss)}, hard loss ${fmt(analysis.hardLoss)}.`
        : `Learner is predicting which non-label class the student should increase under teacher matching for ${scenario.title}.`,
      values: [
        `scenario: ${scenario.title}`,
        `hard label: ${scenario.hardLabel}`,
        `tau: ${tau}`,
        `alpha: ${alpha}`,
        `prediction: ${prediction ?? 'none'}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
      ],
    })
  }, [
    alpha,
    analysis.bestPull.label,
    analysis.hardLoss,
    analysis.kdLoss,
    prediction,
    revealed,
    scenario.hardLabel,
    scenario.title,
    tau,
  ])

  const resetReveal = () => setRevealed(false)

  return (
    <VizShell
      eyebrow="Interactive demo"
      title="Knowledge distillation: predict the dark-knowledge pull"
      subtitle="Choose a scenario and temperature, then predict which non-label class the softened teacher asks the student to increase most."
      metrics={['teacher logits', 'temperature tau', 'KL teacher || student', 'hard/KD mix alpha']}
      challenge={
        <p>
          Hard labels only say the top class. Before reveal, predict which
          non-label class carries the largest teacher signal for the student.
        </p>
      }
      notes={
        <p>
          This toy shows distribution matching, not a full training run. The
          useful signal is the teacher/student probability gap after temperature
          softening; larger systems add data filtering, capacity limits, and
          sequence-level losses.
        </p>
      }
    >
      <VizStageAdapter padding="normal">
        <div className="distill-demo">
          <div className="controls" aria-label="Knowledge distillation demo controls">
            <div className="control-group">
              <span>Scenario</span>
              <div className="segmented">
                {scenarios.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={scenario.id === option.id ? 'active' : ''}
                    onClick={() => {
                      setScenarioId(option.id)
                      setPrediction(null)
                      resetReveal()
                    }}
                  >
                    {option.title}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <span>Temperature tau</span>
              <div className="segmented">
                {tauOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={tau === option ? 'active' : ''}
                    onClick={() => {
                      setTau(option)
                      resetReveal()
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <span>KD mix alpha</span>
              <div className="segmented">
                {alphaOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={alpha === option ? 'active' : ''}
                    onClick={() => {
                      setAlpha(option)
                      resetReveal()
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <section className="prediction-panel">
            <h4>Predict the largest non-label pull</h4>
            <div className="choice-row" role="group" aria-label="Distillation target prediction">
              {scenario.labels
                .filter((label) => label !== scenario.hardLabel)
                .map((label) => (
                  <button
                    key={label}
                    type="button"
                    className={prediction === label ? 'selected' : ''}
                    onClick={() => {
                      setPrediction(label)
                      resetReveal()
                    }}
                    aria-pressed={prediction === label}
                  >
                    {label}
                  </button>
                ))}
            </div>
          </section>

          <div className="stage-grid">
            <section className="logit-panel">
              <div className="panel-head">
                <h4>Visible logits</h4>
                <span>hard label: {scenario.hardLabel}</span>
              </div>
              <div className="logit-list">
                {scenario.labels.map((label, index) => {
                  const teacherLogit = scenario.teacherLogits[index]
                  const studentLogit = scenario.studentLogits[index]
                  const maxAbs = Math.max(...scenario.teacherLogits.map(Math.abs), ...scenario.studentLogits.map(Math.abs))
                  return (
                    <div className="logit-row" key={label}>
                      <span className={label === scenario.hardLabel ? 'label hard' : 'label'}>{label}</span>
                      <div className="bars">
                        <span
                          className="bar teacher"
                          style={{ '--width': `${Math.max(5, (Math.abs(teacherLogit) / maxAbs) * 100)}%` } as CSSProperties}
                        >
                          T {teacherLogit.toFixed(1)}
                        </span>
                        <span
                          className="bar student"
                          style={{ '--width': `${Math.max(5, (Math.abs(studentLogit) / maxAbs) * 100)}%` } as CSSProperties}
                        >
                          S {studentLogit.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="prob-panel">
              <div className="panel-head">
                <h4>Softened probabilities</h4>
                <span>{revealed ? `entropy ${fmt(analysis.entropy)}` : 'hidden until reveal'}</span>
              </div>
              <div className="prob-list">
                {scenario.labels.map((label, index) => (
                  <div className="prob-row" key={label}>
                    <span>{label}</span>
                    <div className="prob-bars">
                      <i
                        className="teacher-prob"
                        style={{ width: revealed ? `${analysis.teacher[index] * 100}%` : '18%' }}
                      />
                      <i
                        className="student-prob"
                        style={{ width: revealed ? `${analysis.studentSoft[index] * 100}%` : '18%' }}
                      />
                    </div>
                    <strong>
                      {revealed
                        ? `${fmt(analysis.teacher[index])} / ${fmt(analysis.studentSoft[index])}`
                        : '???'}
                    </strong>
                  </div>
                ))}
              </div>
              <p>Rows show teacher probability / student probability at tau.</p>
            </section>

            <section className="reveal-panel">
              <h4>Reveal</h4>
              <dl>
                <div>
                  <dt>Hard CE</dt>
                  <dd>{revealed ? fmt(analysis.hardLoss) : 'Hidden'}</dd>
                </div>
                <div>
                  <dt>KD KL term</dt>
                  <dd>{revealed ? fmt(analysis.kdLoss) : 'Hidden'}</dd>
                </div>
                <div>
                  <dt>Total mix</dt>
                  <dd>{revealed ? fmt(analysis.totalLoss) : 'Hidden'}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="reveal"
                disabled={!prediction}
                onClick={() => setRevealed(true)}
              >
                Reveal teacher pull
              </button>
              {!prediction ? <p className="hint">Choose a non-label class to unlock the reveal.</p> : null}
            </section>
          </div>

          <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
            {revealed ? (
              <>
                <div className="result-copy">
                  <h4>{predictionCorrect ? 'Prediction matches.' : 'The dark-knowledge signal is visible.'}</h4>
                  <p>
                    The largest non-label gap is {analysis.bestPull.label}: the
                    teacher assigns more softened probability to it than the
                    student does. This is the extra supervision hard labels
                    omit: the student is not only learning "{scenario.hardLabel}",
                    it is learning the teacher's similarity structure.
                  </p>
                </div>
                <div className="gap-table" role="table" aria-label="Teacher minus student probability gaps">
                  <div className="table-row head" role="row">
                    <span>class</span>
                    <span>teacher - student</span>
                    <span>direction</span>
                  </div>
                  {scenario.labels.map((label, index) => {
                    const gap = analysis.gaps[index]
                    const isBest = label === analysis.bestPull.label
                    return (
                      <div key={label} className={isBest ? 'table-row best' : 'table-row'} role="row">
                        <span>{label}</span>
                        <span>{gap >= 0 ? '+' : ''}{fmt(gap)}</span>
                        <span>{gap >= 0 ? 'increase' : 'decrease'}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <p>
                The probability gaps are hidden until you commit. Temperature
                makes the teacher less one-hot, so the non-top classes can
                carry useful training signal.
              </p>
            )}
          </section>
        </div>

        <style jsx>{`
          .distill-demo {
            display: grid;
            gap: 1rem;
            color: #18222d;
          }

          .controls,
          .stage-grid {
            display: grid;
            gap: 0.75rem;
          }

          .controls {
            grid-template-columns: 1.2fr 0.8fr 0.8fr;
          }

          .stage-grid {
            grid-template-columns: minmax(0, 1.15fr) minmax(0, 1.15fr) minmax(220px, 0.8fr);
          }

          .control-group,
          .prediction-panel,
          .logit-panel,
          .prob-panel,
          .reveal-panel,
          .result {
            border: 1px solid rgba(24, 34, 45, 0.1);
            background: rgba(255, 253, 248, 0.8);
            border-radius: 14px;
            padding: 0.85rem;
            min-width: 0;
          }

          h4,
          .control-group > span,
          .panel-head {
            color: #30404f;
            font-size: 0.82rem;
          }

          h4,
          .control-group > span {
            display: block;
            margin: 0 0 0.55rem;
            font-weight: 800;
          }

          .segmented,
          .choice-row {
            display: flex;
            flex-wrap: wrap;
            gap: 0.45rem;
          }

          button {
            min-height: 34px;
            border: 1px solid rgba(24, 34, 45, 0.14);
            border-radius: 999px;
            background: #fffaf0;
            color: #293947;
            font: inherit;
            font-size: 0.78rem;
            font-weight: 700;
            padding: 0.45rem 0.7rem;
            cursor: pointer;
          }

          button:hover,
          button:focus-visible {
            border-color: #1b7180;
            outline: none;
          }

          button.active,
          button.selected {
            background: #1b7180;
            border-color: #1b7180;
            color: #ffffff;
          }

          button:disabled {
            cursor: not-allowed;
            opacity: 0.52;
          }

          .panel-head {
            display: flex;
            justify-content: space-between;
            gap: 0.65rem;
            align-items: baseline;
            margin-bottom: 0.7rem;
          }

          .panel-head h4 {
            margin: 0;
          }

          .panel-head span {
            color: #66727d;
            font-family: var(--font-mono);
            font-size: 0.72rem;
          }

          .logit-list,
          .prob-list,
          .gap-table {
            display: grid;
            gap: 0.45rem;
          }

          .logit-row {
            display: grid;
            grid-template-columns: 76px minmax(0, 1fr);
            gap: 0.55rem;
            align-items: center;
          }

          .label {
            color: #66727d;
            font-family: var(--font-mono);
            font-size: 0.72rem;
          }

          .label.hard {
            color: #8f3d2b;
            font-weight: 800;
          }

          .bars {
            display: grid;
            gap: 0.18rem;
          }

          .bar {
            display: block;
            width: var(--width);
            min-width: 38px;
            border-radius: 999px;
            padding: 0.18rem 0.45rem;
            color: #ffffff;
            font-family: var(--font-mono);
            font-size: 0.68rem;
            white-space: nowrap;
          }

          .bar.teacher {
            background: #8f3d2b;
          }

          .bar.student {
            background: #1b7180;
          }

          .prob-row {
            display: grid;
            grid-template-columns: 78px minmax(0, 1fr) 78px;
            gap: 0.55rem;
            align-items: center;
          }

          .prob-row > span {
            color: #66727d;
            font-family: var(--font-mono);
            font-size: 0.72rem;
          }

          .prob-row strong {
            color: #2f3f4c;
            font-family: var(--font-mono);
            font-size: 0.68rem;
            text-align: right;
          }

          .prob-bars {
            display: grid;
            gap: 0.16rem;
          }

          .prob-bars i {
            display: block;
            min-width: 4px;
            height: 8px;
            border-radius: 999px;
          }

          .teacher-prob {
            background: #8f3d2b;
          }

          .student-prob {
            background: #1b7180;
          }

          .prob-panel p,
          .hint,
          .result p {
            margin: 0.7rem 0 0;
            color: #52606c;
            font-size: 0.86rem;
            line-height: 1.55;
          }

          dl {
            display: grid;
            gap: 0.55rem;
            margin: 0 0 0.8rem;
          }

          dl div {
            display: flex;
            justify-content: space-between;
            gap: 0.65rem;
            border-bottom: 1px solid rgba(24, 34, 45, 0.08);
            padding-bottom: 0.45rem;
          }

          dt {
            color: #66727d;
            font-size: 0.78rem;
          }

          dd {
            margin: 0;
            color: #24313d;
            font-family: var(--font-mono);
            font-size: 0.78rem;
            text-align: right;
          }

          .reveal {
            width: 100%;
            border-radius: 10px;
            background: #24313d;
            border-color: #24313d;
            color: #ffffff;
          }

          .result {
            background: rgba(245, 248, 246, 0.92);
          }

          .result.shown {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(300px, 0.92fr);
            gap: 0.85rem;
          }

          .result h4 {
            margin: 0;
            color: #1d5f68;
          }

          .table-row {
            display: grid;
            grid-template-columns: 1fr 1fr 0.8fr;
            gap: 0.45rem;
            padding: 0.5rem 0.55rem;
            border-radius: 9px;
            background: rgba(255, 255, 255, 0.74);
            color: #344654;
            font-family: var(--font-mono);
            font-size: 0.72rem;
          }

          .table-row.head {
            background: transparent;
            color: #66727d;
            font-weight: 800;
          }

          .table-row.best {
            background: #e6f2f1;
            color: #155d68;
            font-weight: 800;
          }

          @media (max-width: 900px) {
            .controls,
            .stage-grid,
            .result.shown {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 520px) {
            .logit-row,
            .prob-row {
              grid-template-columns: 1fr;
            }

            .prob-row strong {
              text-align: left;
            }

            .gap-table {
              overflow-x: auto;
            }

            .table-row {
              min-width: 360px;
            }
          }
        `}</style>
      </VizStageAdapter>
    </VizShell>
  )
}
