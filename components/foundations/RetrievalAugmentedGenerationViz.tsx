'use client'

import { useEffect, useMemo, useState } from 'react'
import { emitDemoState } from '../../lib/demoState'

type Answer = '30' | '14' | '45' | 'unknown'
type RagPrediction = 'absent' | 'covered-wrong' | 'fresh-wins' | null

type RagVizProps = {
  chrome?: 'legacy' | 'notebook'
  conceptId?: string
}

type Doc = {
  id: string
  label: string
  text: string
  embedding: [number, number]
  fresh: 0 | 1
  supportsAnswer: Answer
  gen: Record<Answer, number>
}

type Row = Doc & {
  cosine: number
  noise: number
  score: number
  retrieved: boolean
  weight: number
}

const ANSWERS: Answer[] = ['30', '14', '45', 'unknown']
const TRUE_ANSWER: Answer = '30'
const QUERY: [number, number] = [1, 0]

const SCENARIOS = [
  {
    id: 'similarity-k1',
    label: 'Similarity only, k=1',
    description: 'Use one chunk and rank by embedding similarity only.',
    topK: 1,
    tau: 0.25,
    freshBonus: 0,
    noiseSigma: 0,
    seed: 0,
  },
  {
    id: 'similarity-k2',
    label: 'Similarity only, k=2',
    description: 'Use two chunks and rank by embedding similarity only.',
    topK: 2,
    tau: 0.25,
    freshBonus: 0,
    noiseSigma: 0,
    seed: 0,
  },
  {
    id: 'freshness-k2',
    label: 'Freshness rerank, k=2',
    description: 'Use two chunks and add a freshness feature to the retrieval score.',
    topK: 2,
    tau: 0.25,
    freshBonus: 0.12,
    noiseSigma: 0,
    seed: 0,
  },
] as const

const DOCS: Doc[] = [
  {
    id: 'old_policy',
    label: 'old policy',
    text: '2024 handbook: standard returns are accepted within 14 days.',
    embedding: normalize([0.98, 0.2]),
    fresh: 0,
    supportsAnswer: '14',
    gen: { '30': 0.05, '14': 0.86, '45': 0.02, unknown: 0.07 },
  },
  {
    id: 'current_policy',
    label: 'current policy',
    text: 'April 2026 policy: standard returns are accepted within 30 days.',
    embedding: normalize([0.92, 0.39]),
    fresh: 1,
    supportsAnswer: '30',
    gen: { '30': 0.82, '14': 0.05, '45': 0.03, unknown: 0.1 },
  },
  {
    id: 'forum_exception',
    label: 'forum exception',
    text: 'A customer once returned a jacket after 45 days during a promotion.',
    embedding: normalize([0.86, -0.51]),
    fresh: 0,
    supportsAnswer: '45',
    gen: { '30': 0.1, '14': 0.05, '45': 0.75, unknown: 0.1 },
  },
  {
    id: 'shipping',
    label: 'shipping',
    text: 'Express shipping arrives in 2 business days.',
    embedding: normalize([0.3, 0.95]),
    fresh: 1,
    supportsAnswer: 'unknown',
    gen: { '30': 0.15, '14': 0.1, '45': 0.05, unknown: 0.7 },
  },
  {
    id: 'warranty',
    label: 'warranty',
    text: 'Electronics warranty coverage lasts one year.',
    embedding: normalize([0.1, -0.99]),
    fresh: 1,
    supportsAnswer: 'unknown',
    gen: { '30': 0.12, '14': 0.08, '45': 0.05, unknown: 0.75 },
  },
]

function normalize(v: [number, number]): [number, number] {
  const length = Math.hypot(v[0], v[1])
  return [v[0] / length, v[1] / length]
}

function dot(a: [number, number], b: [number, number]) {
  return a[0] * b[0] + a[1] * b[1]
}

function fmt(value: number) {
  const clean = Math.abs(value) < 0.0005 ? 0 : value
  return clean.toFixed(3)
}

function fmtPct(value: number) {
  return `${Math.round(value * 100)}%`
}

function seededNoise(seed: number, index: number) {
  let x = Math.imul(seed + 17, 1103515245) + Math.imul(index + 3, 12345)
  x ^= x >>> 13
  x = Math.imul(x, 1274126177)
  const u = ((x ^ (x >>> 16)) >>> 0) / 4294967295
  return (u - 0.5) * 2
}

function softmax(values: number[], tau: number) {
  const safeTau = Math.max(0.05, tau)
  const scaled = values.map((value) => value / safeTau)
  const maxValue = Math.max(...scaled)
  const weights = scaled.map((value) => Math.exp(value - maxValue))
  const total = weights.reduce((sum, value) => sum + value, 0)
  return weights.map((value) => value / total)
}

function runRag(k: number, tau: number, freshBonus: number, noiseSigma: number, seed: number) {
  const scored = DOCS.map((doc, index) => {
    const cosine = dot(QUERY, doc.embedding)
    const noise = noiseSigma * seededNoise(seed, index)
    return {
      ...doc,
      cosine,
      noise,
      score: cosine + freshBonus * doc.fresh + noise,
      retrieved: false,
      weight: 0,
    }
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))

  const top = scored.slice(0, k)
  const weights = softmax(top.map((row) => row.score), tau)
  const weightById = new Map(top.map((row, index) => [row.id, weights[index]]))

  const rows: Row[] = scored.map((row) => ({
    ...row,
    retrieved: weightById.has(row.id),
    weight: weightById.get(row.id) ?? 0,
  }))

  const answerProbs = Object.fromEntries(ANSWERS.map((answer) => [answer, 0])) as Record<Answer, number>
  for (const row of rows) {
    if (!row.retrieved) continue
    for (const answer of ANSWERS) answerProbs[answer] += row.weight * row.gen[answer]
  }

  const selectedAnswer = ANSWERS.reduce((best, answer) => (answerProbs[answer] > answerProbs[best] ? answer : best), ANSWERS[0])
  const cited = rows
    .filter((row) => row.retrieved)
    .reduce((best, row) => (row.gen[selectedAnswer] * row.weight > best.gen[selectedAnswer] * best.weight ? row : best), rows.find((row) => row.retrieved) as Row)
  const coverage = rows.some((row) => row.retrieved && row.supportsAnswer === TRUE_ANSWER)
  const evidenceMass = rows.reduce((sum, row) => sum + (row.retrieved && row.supportsAnswer === TRUE_ANSWER ? row.weight : 0), 0)

  return {
    rows,
    answerProbs,
    selectedAnswer,
    cited,
    coverage,
    evidenceMass,
    pCorrect: answerProbs[TRUE_ANSWER],
    correct: selectedAnswer === TRUE_ANSWER,
    citationSupports: cited.supportsAnswer === selectedAnswer,
    freshnessOk: cited.fresh === 1,
  }
}

function answerLabel(answer: Answer) {
  return answer === 'unknown' ? 'unknown' : `${answer} days`
}

function predictionLabel(prediction: RagPrediction) {
  if (prediction === 'absent') return 'current evidence absent from top-k'
  if (prediction === 'covered-wrong') return 'covered but still wrong'
  if (prediction === 'fresh-wins') return 'fresh evidence wins'
  return 'none'
}

function classifyRegime(data: ReturnType<typeof runRag>): Exclude<RagPrediction, null> {
  if (!data.coverage) return 'absent'
  if (!data.correct) return 'covered-wrong'
  return 'fresh-wins'
}

function scenarioLabelFor(id: string) {
  return SCENARIOS.find((scenario) => scenario.id === id)?.label ?? 'Custom settings'
}

export default function RetrievalAugmentedGenerationViz({
  chrome = 'legacy',
  conceptId = 'retrieval-augmented-generation',
}: RagVizProps) {
  const isNotebook = chrome === 'notebook'
  const [topK, setTopK] = useState(2)
  const [tau, setTau] = useState(0.25)
  const [freshBonus, setFreshBonus] = useState(0)
  const [noiseSigma, setNoiseSigma] = useState(0)
  const [seed, setSeed] = useState(0)
  const [scenarioId, setScenarioId] = useState<string>('similarity-k2')
  const [prediction, setPrediction] = useState<RagPrediction>(null)
  const [revealed, setRevealed] = useState(false)

  const data = useMemo(() => runRag(topK, tau, freshBonus, noiseSigma, seed), [freshBonus, noiseSigma, seed, tau, topK])
  const regime = useMemo(() => classifyRegime(data), [data])
  const showOutcomes = !isNotebook || revealed
  const predictionCorrect = revealed && prediction !== null ? prediction === regime : null
  const displayRows = useMemo(
    () => showOutcomes
      ? data.rows
      : DOCS.map((doc) => data.rows.find((row) => row.id === doc.id) ?? {
        ...doc,
        cosine: 0,
        noise: 0,
        score: 0,
        retrieved: false,
        weight: 0,
      }),
    [data.rows, showOutcomes]
  )

  const resetReveal = () => {
    setPrediction(null)
    setRevealed(false)
  }

  const applyScenario = (scenario: typeof SCENARIOS[number]) => {
    setTopK(scenario.topK)
    setTau(scenario.tau)
    setFreshBonus(scenario.freshBonus)
    setNoiseSigma(scenario.noiseSigma)
    setSeed(scenario.seed)
    setScenarioId(scenario.id)
    resetReveal()
  }

  const markCustomChange = () => {
    setScenarioId('custom')
    resetReveal()
  }

  useEffect(() => {
    if (!isNotebook) return
    resetReveal()
  }, [topK, tau, freshBonus, noiseSigma, seed, isNotebook])

  useEffect(() => {
    if (!isNotebook) return

    const values = [
      `scenario: ${scenarioLabelFor(scenarioId)}`,
      `top-k: ${topK}`,
      `temperature: ${fmt(tau)}`,
      `freshness rerank: ${fmt(freshBonus)}`,
      `retrieval noise: ${fmt(noiseSigma)}`,
      `prediction: ${predictionLabel(prediction)}`,
      `revealed: ${revealed ? 'yes' : 'no'}`,
    ]

    if (revealed) {
      values.push(
        `regime: ${predictionLabel(regime)}`,
        `retrieved ids: ${data.rows.filter((row) => row.retrieved).map((row) => row.id).join(', ')}`,
        `selected answer: ${answerLabel(data.selectedAnswer)}`,
        `answer correctness: ${data.correct ? 'correct' : 'wrong'}`,
        `coverage: ${data.coverage ? 'yes' : 'no'}`,
        `evidence mass: ${fmt(data.evidenceMass)}`,
        `citation support: ${data.citationSupports ? 'supports selected answer' : 'does not support selected answer'}`,
        `cited freshness: ${data.cited.fresh ? 'fresh' : 'stale'}`,
        `cited source: ${data.cited.id}`,
      )
    }

    emitDemoState({
      conceptId,
      label: 'RAG evidence-selection prediction',
      summary: revealed
        ? `${predictionLabel(regime)}: selected ${answerLabel(data.selectedAnswer)} with evidence mass ${fmt(data.evidenceMass)}.`
        : 'Predict whether retrieval misses current evidence, covers it but stays wrong, or gives fresh evidence enough mass to win.',
      values,
    })
  }, [
    conceptId,
    data.citationSupports,
    data.cited.fresh,
    data.cited.id,
    data.correct,
    data.coverage,
    data.evidenceMass,
    data.rows,
    data.selectedAnswer,
    freshBonus,
    isNotebook,
    noiseSigma,
    prediction,
    regime,
    revealed,
    scenarioId,
    seed,
    tau,
    topK,
  ])

  const rootProps = isNotebook
    ? {}
    : {
        'data-answer': data.selectedAnswer,
        'data-coverage': data.coverage ? 'yes' : 'no',
        'data-cited-source': data.cited.id,
      }

  return (
    <div className={`demo rag-demo ${isNotebook ? 'notebook' : 'legacy'}`} {...rootProps}>
      {isNotebook ? (
        <div className="notebook-setup">
          <div className="scenario-grid" aria-label="RAG scenario presets">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                aria-pressed={scenarioId === scenario.id}
                onClick={() => applyScenario(scenario)}
              >
                <span>{scenario.label}</span>
                <small>{scenario.description}</small>
              </button>
            ))}
          </div>

          <div className="prediction-grid" role="group" aria-label="Predict RAG evidence-selection regime">
            {([
              ['absent', 'Current evidence absent from top-k', 'The top-k set misses the current policy chunk.'],
              ['covered-wrong', 'Covered but still wrong', 'The current chunk is retrieved, but its answer does not win the mixture.'],
              ['fresh-wins', 'Fresh evidence wins', 'The current chunk receives enough mass to select the true answer.'],
            ] as const).map(([choice, label, detail]) => (
              <button
                key={choice}
                type="button"
                aria-pressed={prediction === choice}
                onClick={() => {
                  setPrediction(choice)
                  setRevealed(false)
                }}
              >
                <span>{label}</span>
                <small>{detail}</small>
              </button>
            ))}
          </div>

          <div className="notebook-actions">
            <button type="button" disabled={!prediction} onClick={() => setRevealed(true)}>
              Reveal evidence mix
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => applyScenario(SCENARIOS[1])}
            >
              Reset
            </button>
          </div>
        </div>
      ) : null}

      <div className="controls" aria-label="RAG controls">
        <label>
          <span>top-k context budget</span>
          <input type="range" min="1" max="5" step="1" value={topK} onChange={(event) => {
            markCustomChange()
            setTopK(Number(event.target.value))
          }} />
          <strong>{topK}</strong>
        </label>
        <label>
          <span>retrieval temperature</span>
          <input type="range" min="0.12" max="1" step="0.01" value={tau} onChange={(event) => {
            markCustomChange()
            setTau(Number(event.target.value))
          }} />
          <strong>{fmt(tau)}</strong>
        </label>
        <label>
          <span>freshness rerank</span>
          <input type="range" min="0" max="0.25" step="0.01" value={freshBonus} onChange={(event) => {
            markCustomChange()
            setFreshBonus(Number(event.target.value))
          }} />
          <strong>{fmt(freshBonus)}</strong>
        </label>
        <label>
          <span>retrieval noise</span>
          <input type="range" min="0" max="0.18" step="0.01" value={noiseSigma} onChange={(event) => {
            markCustomChange()
            setNoiseSigma(Number(event.target.value))
          }} />
          <strong>{fmt(noiseSigma)}</strong>
        </label>
        <label>
          <span>noise seed</span>
          <input type="number" min="0" max="99" value={seed} onChange={(event) => {
            markCustomChange()
            setSeed(Number(event.target.value))
          }} />
        </label>
      </div>

      {showOutcomes ? (
        <div className="summary">
          <Metric label="coverage" text={data.coverage ? 'right chunk in top-k' : 'right chunk not in top-k'} tone={data.coverage ? 'good' : 'bad'} />
          <Metric label="evidence mass" text={fmt(data.evidenceMass)} />
          <Metric label="P(correct)" text={fmt(data.pCorrect)} />
          <Metric label="answer correctness" text={data.correct ? 'correct' : 'wrong'} tone={data.correct ? 'good' : 'bad'} />
          <Metric label="selected answer" text={answerLabel(data.selectedAnswer)} tone={data.correct ? 'good' : 'bad'} />
          <Metric label="cited source" text={data.cited.id} />
          <Metric label="citation supports" text={data.citationSupports ? 'selected answer' : 'not selected answer'} tone={data.citationSupports ? 'good' : 'bad'} />
          <Metric label="cited freshness" text={data.cited.fresh ? 'fresh' : 'stale'} tone={data.cited.fresh ? 'good' : 'bad'} />
        </div>
      ) : (
        <p className="preReveal">
          Before reveal, use only the scenario settings, query, candidate chunks,
          and embedding map to predict the retrieval regime.
        </p>
      )}

      <section className="query">
        <h3>query</h3>
        <p>What is NovaCart's current standard return window?</p>
      </section>

      <div className="layout">
        <section className="panel">
          <h3>embedding memory map</h3>
          <svg viewBox="0 0 360 240" role="img" aria-label="Query and document embeddings">
            <line x1="42" x2="318" y1="120" y2="120" stroke="currentColor" opacity="0.18" />
            <line x1="180" x2="180" y1="24" y2="216" stroke="currentColor" opacity="0.18" />
            <circle cx={mapX(QUERY[0])} cy={mapY(QUERY[1])} r="8" fill="#6f5fbf" />
            <text x={mapX(QUERY[0]) - 34} y={mapY(QUERY[1]) - 12} fontSize="12" fill="currentColor">query</text>
            {displayRows.map((row) => (
              <g key={row.id}>
                <circle
                  cx={mapX(row.embedding[0])}
                  cy={mapY(row.embedding[1])}
                  r={showOutcomes && row.retrieved ? 7 : 5}
                  fill={showOutcomes && row.retrieved ? '#1f6f78' : '#8a98a8'}
                  opacity={showOutcomes && row.retrieved ? 1 : 0.55}
                />
                <text x={mapX(row.embedding[0]) + 8} y={mapY(row.embedding[1]) + 4} fontSize="11" fill="currentColor">{row.label}</text>
              </g>
            ))}
          </svg>
        </section>

        <section className="panel">
          <h3>{showOutcomes ? 'retrieved chunks' : 'candidate chunks'}</h3>
          <div className="docList">
            {displayRows.map((row) => (
              <article key={row.id} className={`doc ${showOutcomes && row.retrieved ? 'retrieved' : ''} ${showOutcomes && row.supportsAnswer === TRUE_ANSWER ? 'goodEvidence' : ''}`}>
                <div className="docHead">
                  <strong>{row.label}</strong>
                  <span>{showOutcomes ? (row.retrieved ? 'top-k' : 'outside') : 'candidate'}</span>
                </div>
                <p>{row.text}</p>
                <div className="docMetrics">
                  {showOutcomes ? (
                    <>
                      <Small label="cos" text={fmt(row.cosine)} />
                      <Small label="noise" text={fmt(row.noise)} />
                      <Small label="score" text={fmt(row.score)} />
                      <Small label="weight" text={fmt(row.weight)} />
                      <Small label="supports" text={answerLabel(row.supportsAnswer)} />
                      <Small label="fresh" text={row.fresh ? 'yes' : 'no'} />
                    </>
                  ) : (
                    <>
                      <Small label="fresh" text={row.fresh ? 'yes' : 'no'} />
                      <Small label="source" text={row.id} />
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {showOutcomes ? (
          <section className="panel">
            <h3>answer mixture</h3>
            <div className="answerBars">
              {ANSWERS.map((answer) => (
                <div key={answer} className={`answer ${answer === data.selectedAnswer ? 'selected' : ''} ${answer === TRUE_ANSWER ? 'trueAnswer' : ''}`}>
                  <span>{answerLabel(answer)}</span>
                  <div className="track" aria-label={`${answerLabel(answer)} probability ${fmtPct(data.answerProbs[answer])}`}>
                    <div className="fill" style={{ width: `${Math.max(2, data.answerProbs[answer] * 100)}%` }} />
                  </div>
                  <code>{fmt(data.answerProbs[answer])}</code>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {showOutcomes ? (
        <p
          className={data.correct ? 'claim' : 'warning'}
          role={isNotebook ? 'status' : undefined}
          aria-live={isNotebook ? 'polite' : undefined}
        >
          {isNotebook && predictionCorrect !== null ? (predictionCorrect ? 'Prediction correct: ' : 'Prediction not quite: ') : null}
          {data.coverage && !data.correct
            ? 'The current-policy chunk is retrieved, but the stale chunk still has enough weight for the mixture to select the wrong answer.'
            : data.correct
              ? 'Fresh evidence has enough retrieval weight for the generator mixture to select the current answer.'
              : 'The retriever did not include the current evidence, so the generator can only answer from stale or irrelevant chunks.'}
        </p>
      ) : null}

      <style jsx>{`
        .demo {
          display: grid;
          gap: 0.8rem;
        }

        .demo.notebook {
          padding: 0.75rem;
        }

        .notebook-setup {
          display: grid;
          gap: 0.7rem;
        }

        .scenario-grid,
        .prediction-grid {
          display: grid;
          gap: 0.55rem;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .scenario-grid button,
        .prediction-grid button,
        .notebook-actions button {
          min-width: 0;
          border: 1px solid rgba(31, 111, 120, 0.2);
          border-radius: 8px;
          background: rgba(255, 252, 246, 0.9);
          color: #1b2430;
          cursor: pointer;
          font: inherit;
          padding: 0.62rem;
          text-align: left;
        }

        .scenario-grid button[aria-pressed='true'],
        .prediction-grid button[aria-pressed='true'] {
          border-color: rgba(31, 111, 120, 0.46);
          background: rgba(31, 111, 120, 0.12);
        }

        .scenario-grid button span,
        .prediction-grid button span {
          display: block;
          font-weight: 800;
        }

        .scenario-grid button small,
        .prediction-grid button small {
          display: block;
          margin-top: 0.25rem;
          color: #65717d;
          font-size: 0.7rem;
          line-height: 1.32;
        }

        .notebook-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
        }

        .notebook-actions button {
          width: auto;
          background: #1f6f78;
          color: white;
          font-weight: 800;
        }

        .notebook-actions .ghost {
          background: white;
          color: #334150;
        }

        .notebook-actions button:disabled {
          cursor: not-allowed;
          opacity: 0.52;
        }

        .controls,
        .summary,
        .query,
        .panel,
        .preReveal {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 252, 246, 0.84);
        }

        .controls,
        .summary {
          display: grid;
          gap: 0.65rem;
          padding: 0.75rem;
        }

        .controls {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .summary {
          grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
        }

        .preReveal {
          margin: 0;
          border-left: 3px solid #1f6f78;
          background: rgba(31, 111, 120, 0.08);
          color: #214f58;
          padding: 0.65rem 0.75rem;
          border-radius: 0 8px 8px 0;
          font-size: 0.82rem;
          line-height: 1.48;
        }

        label {
          display: grid;
          min-width: 0;
          gap: 0.34rem;
          color: #536170;
          font-size: 0.72rem;
        }

        input {
          min-width: 0;
          width: 100%;
        }

        input[type='number'] {
          border: 1px solid rgba(27, 36, 48, 0.16);
          border-radius: 7px;
          background: white;
          color: #17202a;
          padding: 0.4rem 0.48rem;
          font: inherit;
        }

        strong,
        code {
          color: #17202a;
          font-family: var(--font-mono);
        }

        .query,
        .panel {
          padding: 0.75rem;
        }

        h3,
        p {
          margin: 0;
        }

        h3 {
          color: #1b2430;
          font-size: 0.95rem;
          margin-bottom: 0.6rem;
        }

        .query p {
          color: #17202a;
          font-size: 0.95rem;
          font-weight: 700;
        }

        .layout {
          display: grid;
          grid-template-columns: 0.82fr 1.18fr 0.9fr;
          gap: 0.75rem;
          align-items: start;
        }

        svg {
          display: block;
          width: 100%;
          height: auto;
          color: #536170;
        }

        .docList,
        .answerBars {
          display: grid;
          gap: 0.55rem;
        }

        .doc {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.62);
          padding: 0.6rem;
        }

        .doc.retrieved {
          border-color: rgba(31, 111, 120, 0.32);
          box-shadow: inset 3px 0 0 #1f6f78;
        }

        .doc.goodEvidence.retrieved {
          background: rgba(31, 111, 120, 0.08);
        }

        .docHead {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          align-items: center;
          margin-bottom: 0.35rem;
        }

        .docHead span {
          border-radius: 999px;
          background: rgba(27, 36, 48, 0.08);
          color: #536170;
          padding: 0.1rem 0.4rem;
          font-size: 0.64rem;
          font-weight: 700;
        }

        .doc p {
          color: #334150;
          font-size: 0.74rem;
          line-height: 1.36;
        }

        .docMetrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.35rem;
          margin-top: 0.5rem;
        }

        .answer {
          display: grid;
          grid-template-columns: 5.2rem minmax(0, 1fr) 3.2rem;
          gap: 0.45rem;
          align-items: center;
          color: #536170;
          font-size: 0.74rem;
        }

        .answer.selected span {
          color: #17202a;
          font-weight: 800;
        }

        .answer.trueAnswer .fill {
          background: #1f6f78;
        }

        .track {
          height: 0.62rem;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(27, 36, 48, 0.08);
        }

        .fill {
          height: 100%;
          border-radius: inherit;
          background: #b44b3b;
        }

        .claim,
        .warning {
          margin: 0;
          border-left: 3px solid #1f6f78;
          background: rgba(31, 111, 120, 0.1);
          color: #214f58;
          padding: 0.6rem 0.7rem;
          border-radius: 0 8px 8px 0;
          font-size: 0.8rem;
          line-height: 1.45;
        }

        .warning {
          border-left-color: #b44b3b;
          background: rgba(180, 75, 59, 0.1);
          color: #662b22;
        }

        .demo button:focus-visible,
        .demo input:focus-visible {
          outline: 2px solid #1f6f78;
          outline-offset: 2px;
          box-shadow: 0 0 0 4px rgba(31, 111, 120, 0.18);
        }

        @media (max-width: 1120px) {
          .controls,
          .summary,
          .scenario-grid,
          .prediction-grid,
          .layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

function mapX(value: number) {
  return 180 + value * 118
}

function mapY(value: number) {
  return 120 - value * 82
}

function Metric({ label, text, tone = 'neutral' }: { label: string; text: string; tone?: 'neutral' | 'good' | 'bad' }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{text}</strong>
      <style jsx>{`
        .metric {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.58);
          padding: 0.45rem;
        }

        .metric.good {
          border-color: rgba(31, 111, 120, 0.22);
          background: rgba(31, 111, 120, 0.08);
        }

        .metric.bad {
          border-color: rgba(180, 75, 59, 0.24);
          background: rgba(180, 75, 59, 0.08);
        }

        span {
          display: block;
          color: #65717d;
          font-size: 0.66rem;
        }

        strong {
          display: block;
          overflow-wrap: anywhere;
          color: #17202a;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          line-height: 1.32;
        }
      `}</style>
    </div>
  )
}

function Small({ label, text }: { label: string; text: string }) {
  return (
    <div className="small">
      <span>{label}</span>
      <code>{text}</code>
      <style jsx>{`
        .small {
          min-width: 0;
          border-radius: 6px;
          background: rgba(27, 36, 48, 0.05);
          padding: 0.32rem;
        }

        span {
          display: block;
          color: #65717d;
          font-size: 0.6rem;
        }

        code {
          display: block;
          overflow-wrap: anywhere;
          color: #17202a;
          font-family: var(--font-mono);
          font-size: 0.68rem;
        }
      `}</style>
    </div>
  )
}
