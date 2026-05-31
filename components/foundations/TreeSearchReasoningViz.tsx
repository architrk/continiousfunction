'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { clearDemoState, emitDemoState } from '../../lib/demoState'

type Mode = 'clean' | 'noisy'
type NodeId = 'root' | 'A' | 'A1' | 'B' | 'B1' | 'B2' | 'C' | 'C1' | 'C1a' | 'C1b' | 'C2'
type NodeState = 'unseen' | 'frontier' | 'expanded' | 'terminal'
type RootPrediction = Extract<NodeId, 'A' | 'B' | 'C'>

type NodeSpec = {
  id: NodeId
  label: string
  step: string
  parent?: NodeId
  children?: NodeId[]
  clean?: number
  noisy?: number
  bClean?: number
  bNoisy?: number
  terminal?: boolean
  correct?: boolean
}

type Row = {
  id: NodeId
  label: string
  step: string
  depth: number
  state: NodeState
  selected: boolean
  score: number | null
  cumulative: number | null
  heuristic: number | null
  value: number | null
  correct?: boolean
}

const ROOT_CHILDREN: RootPrediction[] = ['A', 'B', 'C']
const MAX_BUDGET = 6

const ROOT_PREDICTIONS: Array<{ id: RootPrediction; label: string; description: string }> = [
  {
    id: 'A',
    label: 'A: shortcut branch wins',
    description: 'The verifier backs up the shortcut path through A.',
  },
  {
    id: 'B',
    label: 'B: direct divide branch wins',
    description: 'The branch that divides both sides first becomes the visible recommendation.',
  },
  {
    id: 'C',
    label: 'C: expanded algebra branch wins',
    description: 'The expanded algebra continuation carries the largest backed-up value.',
  },
]

const TREE: Record<NodeId, NodeSpec> = {
  root: { id: 'root', label: 'prompt', step: '2(x + 3) = 14', children: ROOT_CHILDREN },
  A: { id: 'A', parent: 'root', label: 'A', step: '2x + 3 = 14', children: ['A1'], clean: -1.2, noisy: 1.2, bClean: -0.3, bNoisy: 1.1 },
  A1: { id: 'A1', parent: 'A', label: 'A1', step: 'x = 11/2', clean: -0.4, noisy: 1.6, terminal: true, correct: false },
  B: { id: 'B', parent: 'root', label: 'B', step: 'x + 3 = 7', children: ['B1', 'B2'], clean: 0.8, noisy: 0.8, bClean: 0.9, bNoisy: 0.9 },
  B1: { id: 'B1', parent: 'B', label: 'B1', step: 'x = 4', clean: 1.0, noisy: 1.0, terminal: true, correct: true },
  B2: { id: 'B2', parent: 'B', label: 'B2', step: 'x = 0', clean: -0.6, noisy: -0.6, terminal: true, correct: false },
  C: { id: 'C', parent: 'root', label: 'C', step: '2x + 6 = 14', children: ['C1', 'C2'], clean: 0.7, noisy: 0.7, bClean: 1.3, bNoisy: 1.3 },
  C1: { id: 'C1', parent: 'C', label: 'C1', step: '2x = 8', children: ['C1a', 'C1b'], clean: 0.9, noisy: 0.9, bClean: 0.8, bNoisy: 0.8 },
  C1a: { id: 'C1a', parent: 'C1', label: 'C1a', step: 'x = 4', clean: 0.8, noisy: 0.8, terminal: true, correct: true },
  C1b: { id: 'C1b', parent: 'C1', label: 'C1b', step: 'x = 1/4', clean: -0.6, noisy: -0.6, terminal: true, correct: false },
  C2: { id: 'C2', parent: 'C', label: 'C2', step: '2x = -8', clean: -0.8, noisy: -0.8, terminal: true, correct: false },
}

const ROW_ORDER: NodeId[] = ['root', 'A', 'A1', 'B', 'B1', 'B2', 'C', 'C1', 'C1a', 'C1b', 'C2']

function fmt(value: number) {
  const clean = Math.abs(value) < 0.0005 ? 0 : value
  return clean.toFixed(2)
}

function formatNullableScore(value: number | null) {
  return value === null ? 'hidden' : fmt(value)
}

function edgeScore(id: NodeId, mode: Mode) {
  if (id === 'root') return 0
  return TREE[id][mode] ?? 0
}

function heuristic(id: NodeId, mode: Mode) {
  const node = TREE[id]
  return mode === 'clean' ? node.bClean ?? 0 : node.bNoisy ?? 0
}

function depthOf(id: NodeId): number {
  const parent = TREE[id].parent
  return parent ? depthOf(parent) + 1 : 0
}

function runSearch(mode: Mode, budget: number) {
  const visible = new Set<NodeId>(['root', ...ROOT_CHILDREN])
  const expanded = new Set<NodeId>(['root'])
  const expansionOrder: NodeId[] = []

  const cumulative = (id: NodeId): number => {
    const parent = TREE[id].parent
    return parent ? cumulative(parent) + edgeScore(id, mode) : 0
  }

  const isFrontier = (id: NodeId) => {
    const node = TREE[id]
    return visible.has(id) && !node.terminal && !expanded.has(id)
  }

  for (let step = 0; step < budget; step += 1) {
    const frontier = ROW_ORDER.filter(isFrontier)
    if (!frontier.length) break
    const chosen = frontier.reduce((best, id) => {
      const bestScore = cumulative(best) + heuristic(best, mode)
      const score = cumulative(id) + heuristic(id, mode)
      return score > bestScore ? id : best
    }, frontier[0])
    expanded.add(chosen)
    expansionOrder.push(chosen)
    for (const child of TREE[chosen].children ?? []) visible.add(child)
  }

  const value = (id: NodeId): number => {
    const node = TREE[id]
    if (node.terminal) return 0
    if (!expanded.has(id)) return heuristic(id, mode)
    const children = (node.children ?? []).filter((child) => visible.has(child))
    if (!children.length) return heuristic(id, mode)
    return Math.max(...children.map((child) => edgeScore(child, mode) + value(child)))
  }

  const selectedPath: NodeId[] = ['root']
  while (expanded.has(selectedPath[selectedPath.length - 1])) {
    const current = selectedPath[selectedPath.length - 1]
    const children = (TREE[current].children ?? []).filter((child) => visible.has(child))
    if (!children.length) break
    const chosen = children.reduce((best, id) => {
      const bestScore = edgeScore(best, mode) + value(best)
      const score = edgeScore(id, mode) + value(id)
      return score > bestScore ? id : best
    }, children[0])
    selectedPath.push(chosen)
    if (TREE[chosen].terminal) break
  }

  const rows: Row[] = ROW_ORDER.map((id) => {
    const node = TREE[id]
    const isVisible = visible.has(id)
    const state: NodeState = !isVisible ? 'unseen' : node.terminal ? 'terminal' : expanded.has(id) ? 'expanded' : 'frontier'
    const showHeuristic = state === 'frontier'
    return {
      id,
      label: node.label,
      step: node.step,
      depth: depthOf(id),
      state,
      selected: selectedPath.includes(id),
      score: id === 'root' || !isVisible ? null : edgeScore(id, mode),
      cumulative: id === 'root' || !isVisible ? null : cumulative(id),
      heuristic: showHeuristic ? heuristic(id, mode) : null,
      value: !isVisible ? null : value(id),
      correct: node.correct,
    }
  })

  const terminalCandidate = selectedPath[selectedPath.length - 1]
  const terminal = TREE[terminalCandidate].terminal ? terminalCandidate : undefined
  const frontierSize = ROW_ORDER.filter(isFrontier).length
  const rootBranchScores = ROOT_CHILDREN.reduce<Record<RootPrediction, number | null>>(
    (scores, child) => {
      scores[child] = visible.has(child) ? edgeScore(child, mode) + value(child) : null
      return scores
    },
    { A: null, B: null, C: null }
  )

  return {
    rows,
    selectedPath,
    terminal,
    frontierSize,
    expansionOrder,
    rootValue: value('root'),
    rootBranchScores,
  }
}

export default function TreeSearchReasoningViz() {
  const [mode, setMode] = useState<Mode>('clean')
  const [budget, setBudget] = useState(2)
  const [showTruth, setShowTruth] = useState(false)
  const [prediction, setPrediction] = useState<RootPrediction | null>(null)
  const [revealed, setRevealed] = useState(false)

  const data = useMemo(() => runSearch(mode, budget), [budget, mode])
  const expectedRoot = data.selectedPath[1] as RootPrediction | undefined
  const predictionCorrect = prediction !== null && prediction === expectedRoot
  const selectedPathText = data.selectedPath.join(' -> ')
  const terminal = data.terminal ? TREE[data.terminal] : null
  const terminalLabel = !revealed
    ? 'hidden until reveal'
    : !terminal
      ? 'No terminal answer selected yet'
      : showTruth
        ? terminal.correct
          ? 'correct terminal'
          : 'wrong terminal'
        : 'terminal reached, truth hidden'
  const selectedWrong = terminal?.correct === false
  const truthKnownWrong = revealed && showTruth && selectedWrong
  const rootScoreText = ROOT_CHILDREN.map((child) => `${child}=${formatNullableScore(data.rootBranchScores[child])}`).join(', ')
  const explanation = !revealed
    ? 'Commit to a root branch before opening the backed-up path, V(root), node values, and hidden-correctness diagnostic.'
    : !terminal
      ? `The backup chose ${expectedRoot ?? 'no root branch'} by visible r + V scores (${rootScoreText}); the path currently ends at an unfinished frontier prefix.`
      : mode === 'noisy'
        ? showTruth
          ? selectedWrong
            ? 'The backup chose A by verifier value, but hidden correctness marks A1 wrong. The search rule did not see truth; it amplified a verifier false positive.'
            : 'Hidden correctness reveals that the selected terminal is correct; selection still used only verifier-backed values.'
          : `The backup chose ${expectedRoot} because its root score is largest: ${rootScoreText}. Hidden correctness is still off.`
        : showTruth
          ? selectedWrong
            ? 'Hidden correctness reveals a wrong selected terminal, despite the verifier-backed path.'
            : 'Hidden correctness reveals that the selected terminal is correct; selection still used only verifier-backed values.'
          : `The backup chose ${expectedRoot} because its root score is largest: ${rootScoreText}. Hidden correctness is still off.`
  const treeEvidenceSteps = [
    {
      title: 'Predict',
      detail:
        prediction === null
          ? 'Commit to the root branch before backup values unlock.'
          : `Committed to branch ${prediction}.`,
    },
    {
      title: 'Observe',
      detail: revealed
        ? `Selected path: ${selectedPathText}.`
        : 'V(root), selected path, and node values stay hidden.',
    },
    {
      title: 'Ground',
      detail: revealed
        ? `Compare root scores: ${rootScoreText}.`
        : 'Use r, G, and frontier b; hidden truth is not used.',
    },
    {
      title: 'Carry',
      detail: revealed
        ? `${predictionCorrect ? 'Matched' : 'Missed'}; carry selected path and truth boundary.`
        : 'Research Room receives compact search evidence after reveal.',
    },
  ]
  const treeActiveEvidenceIndex = revealed ? 3 : 0

  const resetReveal = (clearPredictionValue = true) => {
    if (clearPredictionValue) setPrediction(null)
    setRevealed(false)
    setShowTruth(false)
    clearDemoState('tree-search-reasoning')
  }

  const updateMode = (value: Mode) => {
    setMode(value)
    resetReveal()
  }

  const updateBudget = (value: number) => {
    setBudget(value)
    resetReveal()
  }

  const choosePrediction = (value: RootPrediction) => {
    setPrediction(value)
    resetReveal(false)
  }

  const revealBackup = () => {
    if (!prediction) return
    setRevealed(true)
  }

  const updateShowTruth = (value: boolean) => {
    if (!revealed) return
    setShowTruth(value)
  }

  useEffect(() => {
    clearDemoState('tree-search-reasoning')
    return () => clearDemoState('tree-search-reasoning')
  }, [])

  useEffect(() => {
    if (!revealed || !prediction || !expectedRoot) return

    emitDemoState({
      conceptId: 'tree-search-reasoning',
      label: 'Prefix-tree max-backup prediction reveal',
      summary:
        `${mode} verifier, budget ${budget}: learner predicted ${prediction}; ` +
        `max backup selected ${selectedPathText}; prediction ${predictionCorrect ? 'matched' : 'missed'}. ` +
        (showTruth && terminal
          ? `Hidden correctness: ${terminal.correct ? 'correct terminal' : 'wrong terminal'}.`
          : 'Hidden correctness remains hidden.'),
      values: [
        `verifier mode: ${mode}`,
        `expansion budget: ${budget}`,
        `learner prediction: ${prediction}`,
        `expected root branch: ${expectedRoot}`,
        `prediction correct: ${predictionCorrect ? 'yes' : 'no'}`,
        `selected path: ${selectedPathText}`,
        `selected terminal: ${data.terminal ?? 'none'}`,
        `expanded prefixes: ${data.expansionOrder.join(', ') || 'none'}`,
        `frontier size: ${data.frontierSize}`,
        `V(root): ${fmt(data.rootValue)}`,
        `root branch backups: ${rootScoreText}`,
        `hidden correctness: ${showTruth ? 'shown' : 'hidden'}`,
        ...(showTruth && terminal
          ? [`selected terminal correctness: ${terminal.correct ? 'correct' : 'wrong'}`]
          : []),
        'evidence loop: predict -> observe -> ground -> carry',
      ],
    })
  }, [
    budget,
    data.expansionOrder,
    data.frontierSize,
    data.rootValue,
    data.terminal,
    expectedRoot,
    mode,
    prediction,
    predictionCorrect,
    revealed,
    rootScoreText,
    selectedPathText,
    showTruth,
    terminal,
  ])

  return (
    <div className="demo" data-mode={mode} data-revealed={revealed ? 'true' : 'false'}>
      <div className="controls" aria-label="Prefix Budget Explorer controls">
        <label>
          <span>verifier mode</span>
          <select value={mode} onChange={(event) => updateMode(event.target.value as Mode)}>
            <option value="clean">clean verifier</option>
            <option value="noisy">noisy verifier</option>
          </select>
        </label>
        <label>
          <span>prefix expansions after root</span>
          <input type="range" min="0" max={MAX_BUDGET} step="1" value={budget} onChange={(event) => updateBudget(Number(event.target.value))} />
          <strong>{budget}</strong>
        </label>
        {revealed ? (
          <label className="toggle">
            <input type="checkbox" checked={showTruth} onChange={(event) => updateShowTruth(event.target.checked)} />
            <span>show hidden correctness</span>
          </label>
        ) : (
          <div className="truthLocked">hidden correctness locked</div>
        )}
      </div>

      <section className="predictionPanel" aria-label="Tree search root-branch prediction" data-child-demo-gate="tree-search-max-backup">
        <div className="predictionCopy">
          <span>predict the max backup</span>
          <strong>Which root branch will the visible verifier values recommend?</strong>
          <p>
            Use the visible tree, local r scores, path totals G, and frontier heuristics b. Hidden correctness is not used by the search rule.
          </p>
        </div>
        <div className="predictionChoices" role="group" aria-label="Root branch prediction choices">
          {ROOT_PREDICTIONS.map((choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={prediction === choice.id}
              className={prediction === choice.id ? 'selected' : ''}
              onClick={() => choosePrediction(choice.id)}
            >
              <strong>{choice.label}</strong>
              <span>{choice.description}</span>
            </button>
          ))}
        </div>
        <div className="evidenceStrip" aria-label="Tree search evidence loop">
          {treeEvidenceSteps.map((step, index) => (
            <article key={step.title} className={index === treeActiveEvidenceIndex ? 'active' : ''}>
              <div>
                <span>{index + 1}</span>
                <strong>{step.title}</strong>
              </div>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
        <button type="button" className="revealButton" disabled={!prediction} onClick={revealBackup}>
          Reveal backed-up path
        </button>
      </section>

      <div className="summary">
        <Metric label="selected visible path" text={revealed ? selectedPathText : 'hidden until reveal'} />
        <Metric label="selected terminal" text={terminalLabel} tone={terminal && showTruth ? (terminal.correct ? 'good' : 'bad') : 'neutral'} />
        <Metric label="expanded prefixes" text={`${data.expansionOrder.length}`} />
        <Metric label="frontier size" text={`${data.frontierSize}`} />
        <Metric label="V(root)" text={revealed ? fmt(data.rootValue) : 'hidden'} />
      </div>

      {revealed ? (
        <p className={predictionCorrect ? 'result good' : 'result bad'}>
          Actual recommendation: {expectedRoot ?? 'none'} | Your prediction: {prediction ?? 'none'} | {predictionCorrect ? 'correct' : 'not this time'}
        </p>
      ) : null}

      <section className="panel">
        <div className="panelHead">
          <h3>Prefix Budget Explorer</h3>
          <code>{data.expansionOrder.length ? `expanded: ${data.expansionOrder.join(', ')}` : 'expanded: none'}</code>
        </div>
        <div className="tree" aria-label="finite prefix tree">
          {data.rows.map((row) => (
            <NodeCard key={row.id} row={row} showBackup={revealed} showTruth={revealed && showTruth} />
          ))}
        </div>
      </section>

      {revealed ? (
        <div className="backupScores" aria-label="Root branch backup scores">
          {ROOT_CHILDREN.map((child) => (
            <div key={child}>
              <span>{child}: r({child}) + V({child})</span>
              <strong>{formatNullableScore(data.rootBranchScores[child])}</strong>
            </div>
          ))}
        </div>
      ) : null}

      <div className="legend" aria-label="tree search state legend">
        <span><i className="frontierMark" /> frontier</span>
        <span><i className="expandedMark" /> expanded</span>
        <span><i className="selectedMark" /> backed-up path after reveal</span>
        <span><i className="unseenMark" /> unseen</span>
      </div>

      <p className={truthKnownWrong ? 'warning' : 'claim'}>{explanation}</p>

      <style jsx>{`
        .demo {
          display: grid;
          gap: 0.8rem;
        }

        .controls,
        .predictionPanel,
        .summary,
        .panel,
        .backupScores,
        .legend {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 252, 246, 0.82);
        }

        .controls,
        .summary {
          display: grid;
          gap: 0.65rem;
          padding: 0.75rem;
        }

        .controls {
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.35fr) minmax(10rem, 0.75fr);
          align-items: end;
        }

        .summary {
          grid-template-columns: 1.35fr 1.2fr repeat(3, minmax(0, 0.7fr));
        }

        .predictionPanel {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.95fr) auto;
          gap: 0.75rem;
          align-items: center;
          padding: 0.75rem;
        }

        .predictionCopy {
          display: grid;
          min-width: 0;
          gap: 0.28rem;
        }

        .predictionCopy span {
          color: #1f6f78;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .predictionCopy strong {
          color: #17202a;
          font-size: 0.95rem;
          line-height: 1.25;
        }

        .predictionCopy p {
          margin: 0;
          color: #536170;
          font-size: 0.8rem;
          line-height: 1.45;
        }

        .predictionChoices {
          display: grid;
          gap: 0.42rem;
          min-width: 0;
        }

        .predictionChoices button {
          display: grid;
          gap: 0.16rem;
          min-height: 2.85rem;
          border: 1px solid rgba(27, 36, 48, 0.14);
          border-radius: 8px;
          background: #fffaf1;
          color: #17202a;
          padding: 0.52rem 0.62rem;
          font: inherit;
          font-size: 0.78rem;
          text-align: left;
          cursor: pointer;
        }

        .predictionChoices button span {
          color: #536170;
          font-size: 0.72rem;
          line-height: 1.25;
        }

        .predictionChoices button.selected,
        .predictionChoices button[aria-pressed='true'] {
          border-color: rgba(31, 111, 120, 0.58);
          background: rgba(222, 245, 241, 0.9);
        }

        .evidenceStrip {
          display: grid;
          grid-column: 1 / -1;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.5rem;
          padding: 0.6rem;
          border-radius: 8px;
          background:
            linear-gradient(rgba(148, 163, 184, 0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.045) 1px, transparent 1px),
            #0f172a;
          background-size: 22px 22px;
          border: 1px solid #334155;
        }

        .evidenceStrip article {
          min-width: 0;
          min-height: 7rem;
          border-radius: 8px;
          background: #111827;
          border: 1px solid #1f2937;
          color: #cbd5e1;
          padding: 0.62rem;
        }

        .evidenceStrip article.active {
          background: #fff7ed;
          border-color: #f59e0b;
          color: #17202a;
        }

        .evidenceStrip article div {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          margin-bottom: 0.42rem;
        }

        .evidenceStrip article span {
          align-items: center;
          background: #334155;
          border-radius: 999px;
          color: #f8fafc;
          display: inline-flex;
          flex: 0 0 auto;
          font-size: 0.72rem;
          font-weight: 900;
          height: 1.35rem;
          justify-content: center;
          width: 1.35rem;
        }

        .evidenceStrip article.active span {
          background: #f59e0b;
          color: #111827;
        }

        .evidenceStrip article strong {
          color: #f8fafc;
          font-family: inherit;
          font-size: 0.78rem;
        }

        .evidenceStrip article.active strong {
          color: #111827;
        }

        .evidenceStrip article p {
          color: #cbd5e1;
          font-size: 0.74rem;
          line-height: 1.35;
        }

        .evidenceStrip article.active p {
          color: #374151;
        }

        .revealButton {
          align-self: stretch;
          justify-self: start;
          min-width: 9rem;
          border: 0;
          border-radius: 8px;
          background: #1f6f78;
          color: #fffaf1;
          padding: 0.55rem 0.72rem;
          font: inherit;
          font-size: 0.8rem;
          font-weight: 760;
          cursor: pointer;
        }

        .revealButton:disabled {
          cursor: not-allowed;
          opacity: 0.48;
        }

        label {
          display: grid;
          min-width: 0;
          gap: 0.35rem;
          color: #536170;
          font-size: 0.74rem;
        }

        select,
        input[type='range'] {
          width: 100%;
        }

        select {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.16);
          border-radius: 7px;
          background: white;
          color: #17202a;
          padding: 0.42rem 0.5rem;
          font: inherit;
        }

        strong,
        code {
          color: #17202a;
          font-family: var(--font-mono);
        }

        .toggle {
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          align-self: center;
        }

        .toggle input {
          width: 1rem;
          height: 1rem;
          accent-color: #1f6f78;
        }

        .truthLocked {
          align-self: center;
          color: #65717d;
          font-size: 0.74rem;
        }

        .panel {
          padding: 0.75rem;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          gap: 0.7rem;
          align-items: baseline;
          margin-bottom: 0.7rem;
        }

        h3,
        p {
          margin: 0;
        }

        h3 {
          color: #1b2430;
          font-size: 0.95rem;
        }

        .panelHead code {
          overflow-wrap: anywhere;
          color: #536170;
          font-size: 0.72rem;
        }

        .tree {
          display: grid;
          grid-template-columns: 0.78fr 1fr 1fr 1fr;
          gap: 0.6rem;
          align-items: stretch;
        }

        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem 0.9rem;
          padding: 0.6rem 0.7rem;
          color: #536170;
          font-size: 0.75rem;
        }

        .legend span {
          display: inline-flex;
          gap: 0.35rem;
          align-items: center;
        }

        .legend i {
          width: 0.72rem;
          height: 0.72rem;
          border-radius: 999px;
          display: inline-block;
          border: 1px solid rgba(27, 36, 48, 0.18);
        }

        .frontierMark {
          background: #f2c14e;
        }

        .expandedMark {
          background: #1f6f78;
        }

        .selectedMark {
          background: #6f5fbf;
        }

        .unseenMark {
          background: #d8dde3;
        }

        .backupScores {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.6rem;
          padding: 0.65rem;
        }

        .backupScores > div {
          min-width: 0;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.68);
          padding: 0.55rem;
        }

        .backupScores span {
          display: block;
          color: #536170;
          font-size: 0.7rem;
        }

        .result {
          margin: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.72);
          color: #214f58;
          padding: 0.55rem 0.7rem;
          font-family: var(--font-mono);
          font-size: 0.76rem;
          line-height: 1.45;
        }

        .result.bad {
          color: #7a3328;
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

        @media (max-width: 1040px) {
          .controls,
          .predictionPanel,
          .summary,
          .backupScores,
          .tree,
          .evidenceStrip {
            grid-template-columns: 1fr;
          }

          .panelHead {
            display: grid;
          }
        }
      `}</style>
    </div>
  )
}

function NodeCard({ row, showBackup, showTruth }: { row: Row; showBackup: boolean; showTruth: boolean }) {
  const stateText = row.id === 'root' ? 'root' : row.state
  const nodeStyle = {
    '--tree-column': String(row.depth + 1),
  } as CSSProperties

  return (
    <article className={`node ${row.state} ${showBackup && row.selected ? 'selected' : ''}`} style={nodeStyle}>
      <div className="nodeHead">
        <strong>{row.label}</strong>
        <span>{stateText}</span>
      </div>
      <p>{row.step}</p>
      <dl>
        <div>
          <dt>r</dt>
          <dd>{row.score === null ? '-' : fmt(row.score)}</dd>
        </div>
        <div>
          <dt>G</dt>
          <dd>{row.cumulative === null ? '-' : fmt(row.cumulative)}</dd>
        </div>
        <div>
          <dt>b</dt>
          <dd>{row.heuristic === null ? '-' : fmt(row.heuristic)}</dd>
        </div>
        <div>
          <dt>V</dt>
          <dd>{showBackup ? row.value === null ? '-' : fmt(row.value) : 'hidden'}</dd>
        </div>
      </dl>
      {row.state === 'terminal' && showTruth ? <small className={row.correct ? 'good' : 'bad'}>{row.correct ? 'hidden truth: correct' : 'hidden truth: wrong'}</small> : null}
      <style jsx>{`
        .node {
          grid-column: var(--tree-column);
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.7);
          padding: 0.62rem;
          box-shadow: inset 3px 0 0 rgba(27, 36, 48, 0.12);
        }

        .node.unseen {
          opacity: 0.56;
          background: rgba(242, 244, 247, 0.7);
        }

        .node.frontier {
          box-shadow: inset 3px 0 0 #f2c14e;
        }

        .node.expanded {
          box-shadow: inset 3px 0 0 #1f6f78;
        }

        .node.terminal {
          box-shadow: inset 3px 0 0 #8a98a8;
        }

        .node.selected {
          border-color: rgba(111, 95, 191, 0.55);
          background: rgba(111, 95, 191, 0.08);
          box-shadow: inset 3px 0 0 #6f5fbf;
        }

        .nodeHead {
          display: flex;
          justify-content: space-between;
          gap: 0.45rem;
          align-items: center;
        }

        strong,
        dd {
          color: #17202a;
          font-family: var(--font-mono);
        }

        span {
          border-radius: 999px;
          background: rgba(27, 36, 48, 0.08);
          color: #536170;
          padding: 0.1rem 0.38rem;
          font-size: 0.64rem;
          font-weight: 700;
        }

        p {
          margin: 0.42rem 0 0;
          min-height: 2rem;
          color: #263443;
          font-size: 0.8rem;
          line-height: 1.35;
        }

        dl {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.32rem;
          margin: 0.55rem 0 0;
        }

        dl div {
          min-width: 0;
          border-radius: 6px;
          background: rgba(27, 36, 48, 0.05);
          padding: 0.3rem 0.34rem;
        }

        dt {
          color: #65717d;
          font-size: 0.62rem;
          line-height: 1;
        }

        dd {
          margin: 0.1rem 0 0;
          font-size: 0.72rem;
        }

        small {
          display: block;
          margin-top: 0.45rem;
          font-size: 0.68rem;
          font-weight: 700;
        }

        small.good {
          color: #1f6f78;
        }

        small.bad {
          color: #9b3d30;
        }

        @media (max-width: 1040px) {
          .node {
            grid-column: 1;
          }
        }
      `}</style>
    </article>
  )
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
