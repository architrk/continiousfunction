'use client'

import { useEffect, useMemo, useState } from 'react'
import { clearDemoState, emitDemoState } from '../../lib/demoState'

type Token = (typeof VOCAB)[number]
type Profile = 'schema-friendly' | 'format-confused' | 'semantic-mismatch'
type Sampler = 'greedy' | 'sample'
type NotebookPrediction = 'raw' | 'masked' | 'impossible'

type StructuredDecodingVizProps = {
  chrome?: 'legacy' | 'notebook'
  conceptId?: string
}

type DecodeState = {
  q: number | null
  tokens: Token[]
  states: number[]
  accepted: boolean
  invalid: boolean
  forcedSteps: number
}

const VOCAB = [
  '{',
  '}',
  ':',
  ',',
  '"tool"',
  '"source"',
  '"k"',
  '"retrieve"',
  '"lookup"',
  '"docs"',
  '"tickets"',
  '1',
  '2',
  '"DROP"',
  '"extra"',
  'true',
  '<eos>',
] as const

const TRANSITIONS: Record<number, Partial<Record<Token, number>>> = {
  0: { '{': 1 },
  1: { '"tool"': 2 },
  2: { ':': 3 },
  3: { '"retrieve"': 4, '"lookup"': 4 },
  4: { ',': 5 },
  5: { '"source"': 6 },
  6: { ':': 7 },
  7: { '"docs"': 8, '"tickets"': 8 },
  8: { ',': 9 },
  9: { '"k"': 10 },
  10: { ':': 11 },
  11: { '1': 12, '2': 12 },
  12: { '}': 13 },
  13: { '<eos>': 14 },
}

const STATE_LABELS: Record<number, string> = {
  0: 'start',
  1: 'after {',
  2: 'after "tool"',
  3: 'choose tool',
  4: 'after tool',
  5: 'after comma',
  6: 'after "source"',
  7: 'choose source',
  8: 'after source',
  9: 'after comma',
  10: 'after "k"',
  11: 'choose k',
  12: 'after k',
  13: 'after }',
  14: 'accept',
}

const ACCEPT = new Set([14])
const INITIAL_STATE: DecodeState = { q: 0, tokens: [], states: [0], accepted: false, invalid: false, forcedSteps: 0 }

const NOTEBOOK_PREDICTION_LABELS: Record<NotebookPrediction, string> = {
  raw: 'Raw top wins',
  masked: 'Mask changes winner',
  impossible: 'No valid token',
}

const NOTEBOOK_OUTCOME_LABELS: Record<NotebookPrediction, string> = {
  raw: 'raw top wins',
  masked: 'mask changes winner',
  impossible: 'no valid token',
}

function fmt(value: number) {
  if (!Number.isFinite(value)) return '-'
  return Math.abs(value) < 0.0005 ? '0.00' : value.toFixed(2)
}

function goodStates() {
  const reverse = new Map<number, number[]>()
  for (const [fromRaw, arcs] of Object.entries(TRANSITIONS)) {
    const from = Number(fromRaw)
    for (const to of Object.values(arcs)) {
      if (typeof to !== 'number') continue
      reverse.set(to, [...(reverse.get(to) ?? []), from])
    }
  }

  const good = new Set<number>(ACCEPT)
  const stack = [...ACCEPT]
  while (stack.length) {
    const to = stack.pop() as number
    for (const from of reverse.get(to) ?? []) {
      if (!good.has(from)) {
        good.add(from)
        stack.push(from)
      }
    }
  }
  return good
}

const GOOD = goodStates()

function allowed(q: number | null): Token[] {
  if (q === null) return []
  return VOCAB.filter((token) => {
    const next = TRANSITIONS[q]?.[token]
    return typeof next === 'number' && GOOD.has(next)
  })
}

function baseLogits(q: number | null, profile: Profile): Record<Token, number> {
  const logits = Object.fromEntries(VOCAB.map((token) => [token, -2])) as Record<Token, number>
  for (const token of allowed(q)) logits[token] = 1

  if (q === 3) logits['"retrieve"'] = 2
  if (q === 7) logits['"docs"'] = 2
  if (q === 11) logits['2'] = 2

  if (profile === 'format-confused') {
    logits['"DROP"'] = 5
    logits['"extra"'] = 4
  }

  if (profile === 'semantic-mismatch' && q === 7) {
    logits['"tickets"'] = 5
    logits['"docs"'] = 1
  }

  return logits
}

function softmax(logits: Record<Token, number>, tokens: Token[], temperature: number) {
  if (!tokens.length) return Object.fromEntries(VOCAB.map((token) => [token, 0])) as Record<Token, number>
  const safeTemperature = Math.max(0.05, temperature)
  const maxLogit = Math.max(...tokens.map((token) => logits[token] / safeTemperature))
  const weights = new Map<Token, number>()
  let total = 0
  for (const token of tokens) {
    const weight = Math.exp(logits[token] / safeTemperature - maxLogit)
    weights.set(token, weight)
    total += weight
  }
  return Object.fromEntries(VOCAB.map((token) => [token, (weights.get(token) ?? 0) / total])) as Record<Token, number>
}

function applyTopP(probs: Record<Token, number>, topP: number) {
  const sorted = [...VOCAB].sort((a, b) => probs[b] - probs[a])
  const kept = new Set<Token>()
  let cumulative = 0
  for (const token of sorted) {
    if (probs[token] <= 0) continue
    kept.add(token)
    cumulative += probs[token]
    if (cumulative >= topP) break
  }

  const total = [...kept].reduce((sum, token) => sum + probs[token], 0)
  return Object.fromEntries(VOCAB.map((token) => [token, kept.has(token) && total > 0 ? probs[token] / total : 0])) as Record<Token, number>
}

function distribution(logits: Record<Token, number>, tokens: Token[], temperature: number, topP: number) {
  return applyTopP(softmax(logits, tokens, temperature), topP)
}

function randomUnit(seed: number, step: number) {
  let t = (seed + 1) * 0x6d2b79f5 + step * 0x1b56c4e9
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function chooseToken(probs: Record<Token, number>, sampler: Sampler, seed: number, step: number): Token {
  if (sampler === 'greedy') {
    return VOCAB.reduce((best, token) => (probs[token] > probs[best] ? token : best), VOCAB[0])
  }

  const draw = randomUnit(seed, step)
  let cumulative = 0
  for (const token of VOCAB) {
    cumulative += probs[token]
    if (draw <= cumulative) return token
  }
  return VOCAB[VOCAB.length - 1]
}

function advance(state: DecodeState, settings: { constrained: boolean; profile: Profile; sampler: Sampler; temperature: number; topP: number; seed: number }) {
  if (state.accepted || state.invalid || state.q === null) return state

  const logits = baseLogits(state.q, settings.profile)
  const viable = allowed(state.q)
  const candidateTokens = settings.constrained ? viable : [...VOCAB]
  if (!candidateTokens.length) return { ...state, invalid: true, q: null }

  const probs = distribution(logits, candidateTokens, settings.temperature, settings.topP)
  const token = chooseToken(probs, settings.sampler, settings.seed, state.tokens.length)
  const next = TRANSITIONS[state.q]?.[token]
  const forced = viable.length === 1 ? 1 : 0
  const tokens = [...state.tokens, token]

  if (typeof next !== 'number') {
    return { ...state, q: null, tokens, invalid: true, forcedSteps: state.forcedSteps + forced }
  }

  return {
    q: next,
    tokens,
    states: [...state.states, next],
    accepted: ACCEPT.has(next),
    invalid: false,
    forcedSteps: state.forcedSteps + forced,
  }
}

function runToEnd(state: DecodeState, settings: { constrained: boolean; profile: Profile; sampler: Sampler; temperature: number; topP: number; seed: number }) {
  let current = state
  for (let i = 0; i < 32; i += 1) {
    if (current.accepted || current.invalid) return current
    current = advance(current, settings)
  }
  return { ...current, invalid: true, q: null }
}

function sourceFrom(tokens: Token[]) {
  const index = tokens.indexOf('"source"')
  return index >= 0 ? tokens[index + 2] : undefined
}

function tokenRows(q: number | null, profile: Profile, constrained: boolean, temperature: number, topP: number) {
  const logits = baseLogits(q, profile)
  const raw = distribution(logits, [...VOCAB], temperature, 1)
  const viable = allowed(q)
  const masked = distribution(logits, constrained ? viable : [...VOCAB], temperature, topP)
  return VOCAB.map((token) => ({ token, logit: logits[token], raw: raw[token], allowed: viable.includes(token), masked: masked[token] }))
}

function rejectionMass(q: number | null, profile: Profile, temperature: number) {
  const logits = baseLogits(q, profile)
  const raw = distribution(logits, [...VOCAB], temperature, 1)
  return 1 - allowed(q).reduce((sum, token) => sum + raw[token], 0)
}

function topRow(rows: ReturnType<typeof tokenRows>, key: 'raw' | 'masked') {
  return rows.reduce<(typeof rows)[number] | null>((best, row) => {
    if (row[key] <= 0) return best
    if (!best || row[key] > best[key]) return row
    return best
  }, null)
}

function readableTokenList(tokens: Token[]) {
  return tokens.length ? tokens.join(', ') : 'none'
}

export default function StructuredDecodingViz({
  chrome = 'legacy',
  conceptId = 'structured-decoding',
}: StructuredDecodingVizProps) {
  const isNotebook = chrome === 'notebook'
  const [constrained, setConstrained] = useState(true)
  const [profile, setProfile] = useState<Profile>('format-confused')
  const [sampler, setSampler] = useState<Sampler>('greedy')
  const [temperature, setTemperature] = useState(1)
  const [topP, setTopP] = useState(1)
  const [seed, setSeed] = useState(3)
  const [state, setState] = useState<DecodeState>(INITIAL_STATE)
  const [notebookPrediction, setNotebookPrediction] = useState<NotebookPrediction | null>(null)
  const [notebookRevealed, setNotebookRevealed] = useState(false)

  const settings = useMemo(() => ({ constrained, profile, sampler, temperature, topP, seed }), [constrained, profile, sampler, seed, temperature, topP])
  const rows = useMemo(() => tokenRows(state.q, profile, constrained, temperature, topP), [constrained, profile, state.q, temperature, topP])
  const schemaRows = useMemo(() => tokenRows(state.q, profile, true, temperature, topP), [profile, state.q, temperature, topP])
  const currentAllowed = useMemo(() => allowed(state.q), [state.q])
  const currentSource = sourceFrom(state.tokens)
  const semanticCorrect = state.accepted ? currentSource === '"docs"' : null
  const distinctStates = new Set(state.states).size
  const emitted = state.tokens.length ? state.tokens.join(' ') : 'empty'
  const rawTop = topRow(schemaRows, 'raw')
  const maskedTop = topRow(schemaRows, 'masked')
  const rawTopToken = rawTop?.token ?? null
  const maskedTopToken = maskedTop?.token ?? null
  const hasLiveParserState = state.q !== null && !state.accepted && !state.invalid
  const nextToken = hasLiveParserState ? constrained ? maskedTopToken : rawTopToken : null
  const nextState = state.q !== null && nextToken ? TRANSITIONS[state.q]?.[nextToken] ?? null : null
  const wouldBeInvalid = nextToken !== null && typeof nextState !== 'number'
  const notebookOutcome: NotebookPrediction = !currentAllowed.length
    ? 'impossible'
    : !constrained || rawTopToken === maskedTopToken
      ? 'raw'
      : 'masked'
  const notebookPredictionCorrect = notebookRevealed && notebookPrediction !== null
    ? notebookPrediction === notebookOutcome
    : null
  const rawTopValid = rawTopToken !== null && currentAllowed.includes(rawTopToken)
  const invalidMaskedTokens = useMemo(
    () => schemaRows
      .filter((row) => !row.allowed && row.raw > 0)
      .sort((a, b) => b.raw - a.raw)
      .slice(0, 4)
      .map((row) => row.token),
    [schemaRows]
  )
  const validMass = useMemo(
    () => currentAllowed.reduce((sum, token) => {
      const row = schemaRows.find((candidate) => candidate.token === token)
      return sum + (row?.raw ?? 0)
    }, 0),
    [currentAllowed, schemaRows]
  )
  const maskedTopProb = maskedTopToken
    ? schemaRows.find((row) => row.token === maskedTopToken)?.masked ?? 0
    : 0
  const notebookSettings = useMemo(
    () => ({ constrained, profile, sampler: 'greedy' as const, temperature, topP, seed }),
    [constrained, profile, seed, temperature, topP]
  )

  const resetNotebookReveal = (clearSharedState = true) => {
    setNotebookPrediction(null)
    setNotebookRevealed(false)
    if (isNotebook && clearSharedState) clearDemoState(conceptId)
  }

  const reset = () => {
    setState(INITIAL_STATE)
    resetNotebookReveal()
  }
  const step = () => setState((current) => advance(current, settings))
  const run = () => setState((current) => runToEnd(current, settings))

  const stepNotebook = () => {
    setState((current) => advance(current, notebookSettings))
    resetNotebookReveal()
  }

  const runNotebook = () => {
    setState((current) => runToEnd(current, notebookSettings))
    resetNotebookReveal()
  }

  useEffect(() => {
    if (!isNotebook) return
    clearDemoState(conceptId)
    return () => clearDemoState(conceptId)
  }, [conceptId, isNotebook])

  useEffect(() => {
    if (!isNotebook || !notebookRevealed || notebookPrediction === null) return

    const values = [
      'slice: structured-decoding-valid-token-mask-reveal',
      `state: ${state.q === null ? 'dead' : `q${state.q} ${STATE_LABELS[state.q]}`}`,
      `prefix: ${emitted}`,
      `constraint: ${constrained ? 'on' : 'off'}`,
      `profile: ${profile}`,
      `prediction: ${NOTEBOOK_PREDICTION_LABELS[notebookPrediction]}`,
      `actual: ${NOTEBOOK_OUTCOME_LABELS[notebookOutcome]}`,
      `prediction correct: ${notebookPredictionCorrect === true ? 'yes' : 'no'}`,
      `raw top token: ${rawTopToken ?? 'none'}`,
      `raw top valid: ${rawTopValid ? 'yes' : 'no'}`,
      `valid continuations: ${readableTokenList(currentAllowed)}`,
      `invalid continuations masked: ${readableTokenList(invalidMaskedTokens)}`,
      `selected token: ${nextToken ?? 'none'}`,
      `masked-logit rule: invalid continuations receive zero probability before softmax renormalizes valid continuations`,
      `valid probability mass before renormalization: ${fmt(validMass)}`,
      `renormalized p(${maskedTopToken ?? 'none'}): ${fmt(maskedTopProb)}`,
      `next parser state: ${wouldBeInvalid ? 'invalid/dead' : nextState === null ? 'none' : `q${nextState} ${STATE_LABELS[nextState]}`}`,
      'visible layers: valid mask, masked probabilities, rejection mass, parser transition, prediction correctness',
      'guarantee boundary: formal schema validity is not truth, safety, or task success',
      'evidence loop: predict -> observe -> ground -> carry',
    ]

    if (state.accepted || state.invalid) {
      values.push(
        `accepted: ${state.accepted ? 'yes' : 'no'}`,
        `invalid prefix: ${state.invalid ? 'yes' : 'no'}`,
        `selected source: ${currentSource?.replaceAll('"', '') ?? 'none'}`,
        `semantic task: ${semanticCorrect === null ? 'pending' : semanticCorrect ? 'source=docs' : 'wrong source'}`,
      )
    }

    emitDemoState({
      conceptId,
      label: 'Structured decoding valid-token mask reveal',
      summary: `Learner predicted ${NOTEBOOK_PREDICTION_LABELS[notebookPrediction]}; at ${state.q === null ? 'dead state' : `q${state.q}`}, the ${constrained ? 'schema mask' : 'unconstrained decoder'} selects ${nextToken ?? 'no token'}; prediction ${notebookPredictionCorrect ? 'matched' : 'missed'} and the formal guarantee stops at schema membership.`,
      values,
    })
  }, [
    conceptId,
    constrained,
    currentSource,
    currentAllowed,
    emitted,
    invalidMaskedTokens,
    isNotebook,
    maskedTopProb,
    maskedTopToken,
    nextState,
    nextToken,
    notebookOutcome,
    notebookPrediction,
    notebookPredictionCorrect,
    notebookRevealed,
    profile,
    rawTopToken,
    rawTopValid,
    semanticCorrect,
    state.accepted,
    state.invalid,
    state.q,
    temperature,
    validMass,
    wouldBeInvalid,
  ])

  if (isNotebook) {
    const currentStateLabel = state.q === null ? 'dead' : `q${state.q} ${STATE_LABELS[state.q]}`
    const rejection = rejectionMass(state.q, profile, temperature)
    const visibleRows = notebookRevealed
      ? schemaRows
      : schemaRows.map((row) => ({ ...row, allowed: false, masked: 0 }))
    const resultTone = notebookPredictionCorrect === true
      ? 'correct'
      : notebookPredictionCorrect === false || notebookOutcome === 'impossible' || wouldBeInvalid
        ? 'bad'
        : 'neutral'
    const maskEvidenceSteps = [
      {
        title: 'Predict',
        detail:
          notebookPrediction === null
            ? 'Commit before the mask outcome unlocks.'
            : `Committed to ${NOTEBOOK_PREDICTION_LABELS[notebookPrediction]}.`,
      },
      {
        title: 'Observe',
        detail: notebookRevealed
          ? `Actual: ${NOTEBOOK_OUTCOME_LABELS[notebookOutcome]}.`
          : 'Allowed tokens and masked probabilities stay hidden.',
      },
      {
        title: 'Ground',
        detail: notebookRevealed
          ? nextState === null
            ? 'No live parser transition remains.'
            : `DFA transition reaches q${nextState} ${STATE_LABELS[nextState]}.`
          : 'Reason from raw logits and current automaton state.',
      },
      {
        title: 'Carry',
        detail: notebookRevealed
          ? `${notebookPredictionCorrect ? 'Matched' : 'Missed'}; carry mask, next state, and guarantee boundary.`
          : 'Research Room receives compact parser evidence after reveal.',
      },
    ]
    const maskActiveEvidenceIndex = notebookRevealed ? 3 : 0

    return (
      <>
        <section className="structured-decoding-demo notebook" data-child-demo-gate="structured-decoding-mask">
          <div className="notebook-prompt">
            <div>
              <h3>Prediction check: what survives the schema mask?</h3>
              <p>
                The model still proposes ordinary logits. The automaton state
                decides which next tokens can still reach an accepting JSON-like
                call. Predict the next-token outcome before revealing the mask.
              </p>
            </div>
            <div className="state-pill">
              <span>current state</span>
              <strong>{currentStateLabel}</strong>
            </div>
          </div>

          <div className="notebook-controls" aria-label="Structured decoding notebook controls">
            <label>
              <span>schema mask</span>
              <select
                value={constrained ? 'on' : 'off'}
                onChange={(event) => {
                  setConstrained(event.target.value === 'on')
                  setState(INITIAL_STATE)
                  resetNotebookReveal()
                }}
              >
                <option value="on">on</option>
                <option value="off">off</option>
              </select>
            </label>
            <label>
              <span>model profile</span>
              <select
                value={profile}
                onChange={(event) => {
                  setProfile(event.target.value as Profile)
                  setState(INITIAL_STATE)
                  resetNotebookReveal()
                }}
              >
                <option value="format-confused">format-confused</option>
                <option value="schema-friendly">schema-friendly</option>
                <option value="semantic-mismatch">semantic-mismatch</option>
              </select>
            </label>
            <label>
              <span>temperature {fmt(temperature)}</span>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(event) => {
                  setTemperature(Number(event.target.value))
                  resetNotebookReveal()
                }}
              />
            </label>
            <label>
              <span>top-p after mask {fmt(topP)}</span>
              <input
                type="range"
                min="0.35"
                max="1"
                step="0.05"
                value={topP}
                onChange={(event) => {
                  setTopP(Number(event.target.value))
                  resetNotebookReveal()
                }}
              />
            </label>
          </div>

          <div className="prediction-grid" role="group" aria-label="Predict the next-token mask outcome">
            {([
              ['raw', 'Raw top wins', `The raw highest-logit token ${rawTopToken ?? 'none'} is emitted.`],
              ['masked', 'Mask changes winner', 'The schema mask replaces the raw top token with the highest valid token.'],
              ['impossible', 'No valid token', 'The current prefix cannot continue to acceptance.'],
            ] as const).map(([choice, label, detail]) => (
              <button
                key={choice}
                type="button"
                aria-pressed={notebookPrediction === choice}
                onClick={() => {
                  setNotebookPrediction(choice)
                  setNotebookRevealed(false)
                  clearDemoState(conceptId)
                }}
              >
                <span>{label}</span>
                <small>{detail}</small>
              </button>
            ))}
          </div>

          <div className="evidence-strip" aria-label="Structured decoding evidence loop">
            {maskEvidenceSteps.map((step, index) => (
              <article key={step.title} className={index === maskActiveEvidenceIndex ? 'active' : ''}>
                <div>
                  <span>{index + 1}</span>
                  <strong>{step.title}</strong>
                </div>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>

          <div className="notebook-actions">
            <button
              type="button"
              disabled={!notebookPrediction}
              onClick={() => setNotebookRevealed(true)}
            >
              Reveal mask
            </button>
            <button type="button" className="ghost" disabled={!notebookRevealed || !hasLiveParserState || nextToken === null} onClick={stepNotebook}>
              Emit revealed token
            </button>
            <button type="button" className="ghost" disabled={!notebookRevealed || !hasLiveParserState} onClick={runNotebook}>
              Run to EOS
            </button>
            <button type="button" className="ghost" onClick={reset}>
              Reset
            </button>
          </div>

          {notebookRevealed ? (
            <p className={`notebook-result ${resultTone}`} role="status" aria-live="polite">
              {notebookPredictionCorrect === true
                ? 'Correct: '
                : notebookPredictionCorrect === false
                  ? 'Not quite: '
                  : 'Result: '}
              {notebookOutcome === 'impossible'
                ? 'there is no schema-valid next token from this state.'
                : !constrained
                  ? <>mask is off, so this is the unconstrained baseline. The raw top token <code>{rawTopToken}</code> is emitted; the schema mask shown below is counterfactual.</>
                  : notebookOutcome === 'raw'
                    ? <>the raw top token <code>{rawTopToken}</code> is schema-valid, so the mask leaves the winner unchanged.</>
                    : <>the mask zeros out the raw top token <code>{rawTopToken}</code> and emits the highest valid token <code>{maskedTopToken}</code>.</>}
              {' '}
              {wouldBeInvalid
                ? 'The raw token has no DFA transition here, so the prefix enters an invalid/dead state.'
                : nextState === null
                  ? 'There is no valid next DFA state.'
                  : <>Next state: <code>q{nextState} {STATE_LABELS[nextState]}</code>.</>}
              {' '}The guarantee is only formal schema membership, not truth, safety, or task success.
            </p>
          ) : (
            <p className="pre-reveal">
              Before reveal, the raw logits are visible but the allowed-token
              column, masked probabilities, and result diagnosis stay hidden.
            </p>
          )}

          <section className="prefix-panel">
            <h3>Prefix trace</h3>
            <p>{emitted}</p>
          </section>

          <div className="notebook-layout">
            <section className="panel state-panel">
              <h3>DFA state</h3>
              <div className="state-grid">
                {Object.entries(STATE_LABELS).map(([idRaw, label]) => {
                  const id = Number(idRaw)
                  const active = state.q === id
                  const visited = state.states.includes(id)
                  return (
                    <div key={id} className={`state ${active ? 'active' : ''} ${visited ? 'visited' : ''}`}>
                      <strong>q{id}</strong>
                      <span>{label}</span>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="panel token-panel">
              <div className="panel-heading">
                <h3>Raw logits to schema mask</h3>
                {notebookRevealed ? <span>rejection mass {fmt(rejection)}</span> : <span>mask hidden</span>}
              </div>
              <div className="token-table" role="table" aria-label="Token mask table">
                <div className="token-header" role="row">
                  <span>token</span>
                  <span>logit</span>
                  <span>raw p</span>
                  <span>allowed</span>
                  <span>masked p</span>
                </div>
                {visibleRows.map((row) => {
                  const isRawTop = row.token === rawTopToken
                  const isMaskedTop = notebookRevealed && row.token === maskedTopToken
                  return (
                    <div
                      key={row.token}
                      className={`token-row ${isRawTop ? 'raw-top' : ''} ${isMaskedTop ? 'masked-top' : ''} ${notebookRevealed && row.allowed ? 'allowed' : ''}`}
                      role="row"
                    >
                      <code>{row.token}</code>
                      <span>{fmt(row.logit)}</span>
                      <span>{fmt(row.raw)}</span>
                      <span>{notebookRevealed ? row.allowed ? 'yes' : 'no' : '?'}</span>
                      <span>{notebookRevealed ? fmt(row.masked) : 'hidden'}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          <div className="summary-grid">
            <Metric label="accepted" text={state.accepted ? 'yes' : 'no'} tone={state.accepted ? 'good' : 'neutral'} />
            <Metric label="invalid prefix" text={state.invalid ? 'yes' : 'no'} tone={state.invalid ? 'bad' : 'neutral'} />
            <Metric label="selected source" text={currentSource?.replaceAll('"', '') ?? '-'} tone={semanticCorrect === false ? 'bad' : semanticCorrect ? 'good' : 'neutral'} />
            <Metric label="semantic task" text={semanticCorrect === null ? 'pending' : semanticCorrect ? 'source=docs' : 'wrong source'} tone={semanticCorrect === false ? 'bad' : semanticCorrect ? 'good' : 'neutral'} />
          </div>

          <p className={semanticCorrect === false || state.invalid ? 'boundary warning' : 'boundary'}>
            {state.invalid
              ? 'With the mask off, a high-logit token can leave the schema language immediately.'
              : semanticCorrect === false
                ? 'This run is schema-valid, but it selected the wrong source for the hidden task.'
                : 'A correct mask constrains syntax. It does not prove the chosen enum is true, useful, safe, or task-correct.'}
          </p>
        </section>

        <style jsx>{`
          .structured-decoding-demo {
            color: #17202a;
            display: grid;
            gap: 0.9rem;
          }

          .notebook-prompt,
          .notebook-controls,
          .prediction-grid,
          .notebook-actions,
          .prefix-panel,
          .panel,
          .summary-grid {
            background: rgba(255, 252, 246, 0.88);
            border: 1px solid rgba(27, 36, 48, 0.1);
            border-radius: 8px;
            min-width: 0;
            padding: 0.85rem;
          }

          .notebook-prompt {
            align-items: start;
            display: grid;
            gap: 1rem;
            grid-template-columns: minmax(0, 1fr) minmax(10rem, 0.28fr);
          }

          h3,
          p {
            margin: 0;
          }

          h3 {
            color: #1b2430;
            font-size: 0.96rem;
            margin-bottom: 0.4rem;
          }

          .notebook-prompt p,
          .pre-reveal,
          .boundary {
            color: #536170;
            font-size: 0.82rem;
            line-height: 1.48;
          }

          .state-pill {
            background: rgba(31, 111, 120, 0.08);
            border: 1px solid rgba(31, 111, 120, 0.18);
            border-radius: 8px;
            display: grid;
            gap: 0.22rem;
            padding: 0.65rem;
          }

          .state-pill span,
          label span,
          .panel-heading span {
            color: #65717d;
            font-size: 0.68rem;
            font-weight: 700;
          }

          .state-pill strong,
          code {
            color: #17202a;
            font-family: var(--font-mono);
          }

          .notebook-controls {
            display: grid;
            gap: 0.65rem;
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          label {
            display: grid;
            gap: 0.34rem;
            min-width: 0;
          }

          select,
          input {
            background: white;
            border: 1px solid rgba(27, 36, 48, 0.16);
            border-radius: 7px;
            color: #17202a;
            font: inherit;
            min-width: 0;
            padding: 0.42rem 0.48rem;
            width: 100%;
          }

          input[type='range'] {
            border: 0;
            padding: 0;
          }

          .prediction-grid {
            display: grid;
            gap: 0.65rem;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .evidence-strip {
            display: grid;
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

          .evidence-strip article {
            min-width: 0;
            min-height: 7rem;
            border-radius: 8px;
            background: #111827;
            border: 1px solid #1f2937;
            padding: 0.62rem;
            color: #cbd5e1;
          }

          .evidence-strip article.active {
            background: #fff7ed;
            border-color: #f59e0b;
            color: #17202a;
          }

          .evidence-strip article div {
            display: flex;
            align-items: center;
            gap: 0.45rem;
            margin-bottom: 0.42rem;
          }

          .evidence-strip article span {
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

          .evidence-strip article.active span {
            background: #f59e0b;
            color: #111827;
          }

          .evidence-strip article strong {
            color: #f8fafc;
            font-family: inherit;
            font-size: 0.78rem;
          }

          .evidence-strip article.active strong {
            color: #111827;
          }

          .evidence-strip article p {
            color: #cbd5e1;
            font-size: 0.74rem;
            line-height: 1.35;
          }

          .evidence-strip article.active p {
            color: #374151;
          }

          .prediction-grid button,
          .notebook-actions button {
            border: 1px solid rgba(31, 111, 120, 0.22);
            border-radius: 8px;
            background: white;
            color: #1b2430;
            cursor: pointer;
            font: inherit;
            min-width: 0;
            padding: 0.65rem;
            text-align: left;
          }

          .prediction-grid button[aria-pressed='true'] {
            background: rgba(31, 111, 120, 0.12);
            border-color: rgba(31, 111, 120, 0.48);
          }

          .prediction-grid button span {
            display: block;
            font-weight: 800;
          }

          .prediction-grid button small {
            color: #65717d;
            display: block;
            font-size: 0.72rem;
            line-height: 1.35;
            margin-top: 0.28rem;
          }

          .notebook-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.55rem;
          }

          .notebook-actions button {
            background: #1f6f78;
            color: white;
            font-weight: 800;
            padding: 0.52rem 0.7rem;
          }

          .notebook-actions .ghost {
            background: white;
            color: #334150;
          }

          .notebook-actions button:disabled {
            cursor: not-allowed;
            opacity: 0.52;
          }

          .notebook-result,
          .pre-reveal,
          .boundary {
            border-left: 3px solid #1f6f78;
            border-radius: 0 8px 8px 0;
            background: rgba(31, 111, 120, 0.08);
            padding: 0.65rem 0.75rem;
          }

          .notebook-result {
            color: #214f58;
            font-size: 0.83rem;
            line-height: 1.48;
          }

          .notebook-result.bad,
          .boundary.warning {
            background: rgba(180, 75, 59, 0.1);
            border-left-color: #b44b3b;
            color: #662b22;
          }

          .notebook-result.correct {
            background: rgba(31, 111, 120, 0.1);
            border-left-color: #1f6f78;
          }

          .prefix-panel p {
            color: #17202a;
            font-family: var(--font-mono);
            font-size: 0.86rem;
            line-height: 1.45;
            overflow-wrap: anywhere;
          }

          .notebook-layout {
            display: grid;
            gap: 0.85rem;
            grid-template-columns: 0.82fr 1.18fr;
          }

          .state-grid {
            display: grid;
            gap: 0.42rem;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .state {
            background: rgba(255, 255, 255, 0.62);
            border: 1px solid rgba(27, 36, 48, 0.09);
            border-radius: 7px;
            min-width: 0;
            padding: 0.42rem;
          }

          .state.visited {
            box-shadow: inset 3px 0 0 #8a98a8;
          }

          .state.active {
            background: rgba(31, 111, 120, 0.1);
            border-color: rgba(31, 111, 120, 0.4);
            box-shadow: inset 3px 0 0 #1f6f78;
          }

          .state span {
            color: #65717d;
            display: block;
            font-size: 0.68rem;
            line-height: 1.25;
            margin-top: 0.12rem;
          }

          .panel-heading {
            align-items: baseline;
            display: flex;
            justify-content: space-between;
            gap: 0.6rem;
          }

          .token-table {
            display: grid;
            gap: 0.26rem;
            overflow-x: auto;
            padding-bottom: 0.1rem;
          }

          .token-header,
          .token-row {
            align-items: center;
            display: grid;
            gap: 0.34rem;
            grid-template-columns: minmax(5rem, 1fr) repeat(4, minmax(4rem, 0.72fr));
            min-width: 31rem;
          }

          .token-header {
            color: #65717d;
            font-size: 0.65rem;
            font-weight: 800;
          }

          .token-row {
            background: rgba(27, 36, 48, 0.04);
            border-radius: 6px;
            color: #334150;
            font-size: 0.69rem;
            padding: 0.28rem 0.34rem;
          }

          .token-row.raw-top {
            outline: 1px solid rgba(180, 75, 59, 0.24);
            background: rgba(180, 75, 59, 0.08);
          }

          .token-row.allowed {
            background: rgba(242, 193, 78, 0.16);
          }

          .token-row.masked-top {
            outline: 1px solid rgba(31, 111, 120, 0.32);
            background: rgba(31, 111, 120, 0.1);
          }

          .summary-grid {
            display: grid;
            gap: 0.55rem;
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .structured-decoding-demo button:focus-visible,
          .structured-decoding-demo input:focus-visible,
          .structured-decoding-demo select:focus-visible {
            box-shadow: 0 0 0 4px rgba(31, 111, 120, 0.18);
            outline: 2px solid #1f6f78;
            outline-offset: 2px;
          }

          @media (max-width: 900px) {
            .notebook-prompt,
            .notebook-controls,
            .prediction-grid,
            .evidence-strip,
            .notebook-layout,
            .summary-grid {
              grid-template-columns: 1fr;
            }

            .state-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
        `}</style>
      </>
    )
  }

  return (
    <div className="demo" data-accepted={state.accepted ? 'yes' : 'no'} data-invalid={state.invalid ? 'yes' : 'no'} data-prefix={state.tokens.join(' ')}>
      <div className="controls" aria-label="Schema Mask Explorer controls">
        <label>
          <span>constraint</span>
          <select value={constrained ? 'on' : 'off'} onChange={(event) => { setConstrained(event.target.value === 'on'); reset() }}>
            <option value="on">on</option>
            <option value="off">off</option>
          </select>
        </label>
        <label>
          <span>model profile</span>
          <select value={profile} onChange={(event) => { setProfile(event.target.value as Profile); reset() }}>
            <option value="format-confused">format-confused</option>
            <option value="schema-friendly">schema-friendly</option>
            <option value="semantic-mismatch">semantic-mismatch</option>
          </select>
        </label>
        <label>
          <span>sampler</span>
          <select value={sampler} onChange={(event) => setSampler(event.target.value as Sampler)}>
            <option value="greedy">greedy</option>
            <option value="sample">sample</option>
          </select>
        </label>
        <label>
          <span>temperature</span>
          <input type="range" min="0.5" max="2" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} />
          <strong>{fmt(temperature)}</strong>
        </label>
        <label>
          <span>top-p after mask</span>
          <input type="range" min="0.35" max="1" step="0.05" value={topP} onChange={(event) => setTopP(Number(event.target.value))} />
          <strong>{fmt(topP)}</strong>
        </label>
        <label>
          <span>seed</span>
          <input type="number" min="0" max="99" value={seed} onChange={(event) => setSeed(Number(event.target.value))} />
        </label>
        <div className="buttons">
          <button type="button" onClick={step}>Step</button>
          <button type="button" onClick={run}>Run to EOS</button>
          <button type="button" onClick={reset}>Reset</button>
        </div>
      </div>

      <div className="summary">
        <Metric label="accepted" text={state.accepted ? 'yes' : 'no'} tone={state.accepted ? 'good' : 'neutral'} />
        <Metric label="invalid prefix" text={state.invalid ? 'yes' : 'no'} tone={state.invalid ? 'bad' : 'neutral'} />
        <Metric label="current state" text={state.q === null ? 'dead' : `q${state.q} ${STATE_LABELS[state.q]}`} />
        <Metric label="|M(q)|" text={`${currentAllowed.length}`} />
        <Metric label="rejection mass" text={fmt(rejectionMass(state.q, profile, temperature))} />
        <Metric label="semantic task" text={semanticCorrect === null ? 'pending' : semanticCorrect ? 'source=docs' : 'wrong source'} tone={semanticCorrect === false ? 'bad' : semanticCorrect ? 'good' : 'neutral'} />
      </div>

      <section className="prefixPanel">
        <h3>Schema Mask Explorer</h3>
        <p>{emitted}</p>
      </section>

      <div className="layout">
        <section className="panel">
          <h3>DFA state</h3>
          <div className="stateGrid">
            {Object.entries(STATE_LABELS).map(([idRaw, label]) => {
              const id = Number(idRaw)
              const active = state.q === id
              const visited = state.states.includes(id)
              return (
                <div key={id} className={`state ${active ? 'active' : ''} ${visited ? 'visited' : ''}`}>
                  <strong>q{id}</strong>
                  <span>{label}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="panel">
          <h3>token distribution</h3>
          <div className="table" role="table" aria-label="token mask table">
            <div className="header" role="row">
              <span>token</span>
              <span>logit</span>
              <span>raw p</span>
              <span>allowed</span>
              <span>masked p</span>
            </div>
            {rows.map((row) => (
              <div key={row.token} className={`row ${row.allowed ? 'allowed' : ''} ${row.masked > 0 ? 'kept' : ''}`} role="row">
                <code>{row.token}</code>
                <span>{fmt(row.logit)}</span>
                <span>{fmt(row.raw)}</span>
                <span>{row.allowed ? 'yes' : 'no'}</span>
                <span>{fmt(row.masked)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="summary">
        <Metric label="forced steps" text={`${state.forcedSteps}`} />
        <Metric label="tokens emitted" text={`${state.tokens.length}`} />
        <Metric label="naive checks" text={`${state.tokens.length * VOCAB.length}`} />
        <Metric label="cached checks" text={`${distinctStates * VOCAB.length}`} />
        <Metric label="intended source" text="docs" />
        <Metric label="selected source" text={currentSource?.replaceAll('"', '') ?? '-'} tone={semanticCorrect === false ? 'bad' : semanticCorrect ? 'good' : 'neutral'} />
      </div>

      <p className={semanticCorrect === false ? 'warning' : state.invalid ? 'warning' : 'claim'}>
        {state.invalid
          ? 'Without the mask, a high-logit token can leave the schema language immediately.'
          : semanticCorrect === false
            ? 'The output is schema-valid, but the selected source is semantically wrong for the hidden task.'
            : 'The mask guarantees only formal schema membership; the model still chooses among valid alternatives.'}
      </p>

      <style jsx>{`
        .demo {
          display: grid;
          gap: 0.8rem;
        }

        .controls,
        .summary,
        .panel,
        .prefixPanel {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 252, 246, 0.84);
        }

        .controls {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.65rem;
          padding: 0.75rem;
        }

        label {
          display: grid;
          min-width: 0;
          gap: 0.34rem;
          color: #536170;
          font-size: 0.72rem;
        }

        select,
        input {
          min-width: 0;
          width: 100%;
          border: 1px solid rgba(27, 36, 48, 0.16);
          border-radius: 7px;
          background: white;
          color: #17202a;
          padding: 0.4rem 0.48rem;
          font: inherit;
        }

        input[type='range'] {
          padding: 0;
          border: 0;
        }

        strong,
        code {
          color: #17202a;
          font-family: var(--font-mono);
        }

        .buttons {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.45rem;
          align-self: end;
        }

        button {
          min-width: 0;
          border: 1px solid rgba(31, 111, 120, 0.22);
          border-radius: 7px;
          background: #1f6f78;
          color: white;
          cursor: pointer;
          font-size: 0.76rem;
          font-weight: 700;
          padding: 0.45rem 0.5rem;
        }

        button:nth-child(2) {
          background: #6f5fbf;
          border-color: rgba(111, 95, 191, 0.28);
        }

        button:nth-child(3) {
          background: white;
          color: #334150;
          border-color: rgba(27, 36, 48, 0.16);
        }

        .summary {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 0.55rem;
          padding: 0.65rem;
        }

        .prefixPanel,
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

        .prefixPanel p {
          overflow-wrap: anywhere;
          color: #17202a;
          font-family: var(--font-mono);
          font-size: 0.86rem;
          line-height: 1.45;
        }

        .layout {
          display: grid;
          grid-template-columns: 0.82fr 1.18fr;
          gap: 0.75rem;
        }

        .stateGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .state {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.09);
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.62);
          padding: 0.45rem;
        }

        .state.visited {
          box-shadow: inset 3px 0 0 #8a98a8;
        }

        .state.active {
          border-color: rgba(31, 111, 120, 0.4);
          background: rgba(31, 111, 120, 0.1);
          box-shadow: inset 3px 0 0 #1f6f78;
        }

        .state span {
          display: block;
          color: #65717d;
          font-size: 0.68rem;
          line-height: 1.25;
          margin-top: 0.12rem;
        }

        .table {
          display: grid;
          gap: 0.26rem;
        }

        .header,
        .row {
          display: grid;
          grid-template-columns: minmax(4.7rem, 1fr) repeat(4, minmax(3.6rem, 0.72fr));
          gap: 0.34rem;
          align-items: center;
        }

        .header {
          color: #65717d;
          font-size: 0.65rem;
          font-weight: 700;
        }

        .row {
          border-radius: 6px;
          background: rgba(27, 36, 48, 0.04);
          color: #334150;
          font-size: 0.69rem;
          padding: 0.28rem 0.34rem;
        }

        .row.allowed {
          background: rgba(242, 193, 78, 0.16);
        }

        .row.kept {
          outline: 1px solid rgba(31, 111, 120, 0.24);
          background: rgba(31, 111, 120, 0.09);
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
          .summary,
          .layout {
            grid-template-columns: 1fr;
          }

          .stateGrid,
          .header,
          .row {
            grid-template-columns: 1fr;
          }

          .buttons {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

function Metric({ label, text, tone = 'neutral' }: { label: string; text: string; tone?: 'neutral' | 'good' | 'bad' }) {
  const toneStyles = {
    neutral: {
      borderColor: 'rgba(27, 36, 48, 0.08)',
      background: 'rgba(255, 255, 255, 0.58)',
    },
    good: {
      borderColor: 'rgba(31, 111, 120, 0.22)',
      background: 'rgba(31, 111, 120, 0.08)',
    },
    bad: {
      borderColor: 'rgba(180, 75, 59, 0.24)',
      background: 'rgba(180, 75, 59, 0.08)',
    },
  }[tone]

  return (
    <div
      className={`metric ${tone}`}
      style={{
        minWidth: 0,
        border: `1px solid ${toneStyles.borderColor}`,
        borderRadius: 8,
        background: toneStyles.background,
        padding: '0.45rem',
      }}
    >
      <span style={{ display: 'block', color: '#65717d', fontSize: '0.66rem' }}>{label}</span>
      <strong
        style={{
          display: 'block',
          overflowWrap: 'anywhere',
          color: '#17202a',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          lineHeight: 1.32,
        }}
      >
        {text}
      </strong>
    </div>
  )
}
