import { useMemo, useState } from 'react'
import {
  buildCompanionGatewayRequest,
  getCompanionGatewayUrl,
  requestCompanionAnswer,
  type CompanionTask,
} from '../../lib/aiCompanion'
import SurfaceBackplate from '../editorial/SurfaceBackplate'

type PracticeChallenge = {
  id: string
  label: string
  anchor: string
  prompt: string
  hints: string[]
}

type DiagnosisOption = {
  id: string
  label: string
  cue: string
}

type Props = {
  conceptTitle: string
  conceptDescription?: string
  domainTitle: string
  prerequisites?: string[]
  nextConcept?: string
  demoPrompt: string
}

const diagnosisOptions: DiagnosisOption[] = [
  {
    id: 'symbol-drift',
    label: 'Symbol drift',
    cue: 'The notation moves, but the invariant idea is blurry.',
  },
  {
    id: 'demo-gap',
    label: 'Demo gap',
    cue: 'The interactive state feels separate from the math or code.',
  },
  {
    id: 'procedure-mimicry',
    label: 'Procedure mimicry',
    cue: 'The steps are repeatable, but the reason they work is missing.',
  },
  {
    id: 'prerequisite-fog',
    label: 'Prerequisite fog',
    cue: 'An earlier idea is doing hidden work.',
  },
]

function includesTerm(text: string, term: string) {
  const normalized = term.trim().toLowerCase()
  return normalized.length > 3 && text.includes(normalized)
}

export default function PracticeShell({
  conceptTitle,
  conceptDescription,
  domainTitle,
  prerequisites = [],
  nextConcept,
  demoPrompt,
}: Props) {
  const prerequisiteText = prerequisites.length ? prerequisites.slice(0, 2).join(', ') : 'the opening intuition'
  const nextText = nextConcept || 'a connected concept'
  const [activeChallengeId, setActiveChallengeId] = useState('predict')
  const [answer, setAnswer] = useState('')
  const [revealedHints, setRevealedHints] = useState(0)
  const [selectedDiagnosisId, setSelectedDiagnosisId] = useState(diagnosisOptions[0].id)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [isAsking, setIsAsking] = useState(false)
  const [companionAnswer, setCompanionAnswer] = useState('')
  const [gatewayError, setGatewayError] = useState('')
  const gatewayReady = Boolean(getCompanionGatewayUrl())

  const challenges = useMemo<PracticeChallenge[]>(() => [
    {
      id: 'predict',
      label: 'Predict',
      anchor: 'Before the demo',
      prompt: `Before touching the demo, predict one visible change that should happen in ${conceptTitle}.`,
      hints: [
        `Use the page task as the physical test: ${demoPrompt}`,
        `Name the quantity, object, or relation that you expect to move first.`,
        `Finish with what should stay stable if the idea is really ${conceptTitle}.`,
      ],
    },
    {
      id: 'justify',
      label: 'Justify',
      anchor: 'Across forms',
      prompt: `Explain why the same idea should survive as intuition, math, code, and demo state.`,
      hints: [
        `Start from ${prerequisiteText}; what does this page reuse instead of replacing?`,
        'Write one sentence that starts with "because" and names a mechanism.',
        'Check whether your code words and math words point at the same object.',
      ],
    },
    {
      id: 'transfer',
      label: 'Transfer',
      anchor: 'Next edge',
      prompt: `Describe how this idea should help when you continue toward ${nextText}.`,
      hints: [
        `Use ${nextText} as the destination, not as a new topic dump.`,
        `Name one thing that carries over from ${conceptTitle} and one thing that changes.`,
        'Turn the bridge into a tiny test a learner could try on the next page.',
      ],
    },
  ], [conceptTitle, demoPrompt, nextText, prerequisiteText])

  const activeChallenge = challenges.find((challenge) => challenge.id === activeChallengeId) ?? challenges[0]
  const selectedDiagnosis = diagnosisOptions.find((option) => option.id === selectedDiagnosisId) ?? diagnosisOptions[0]
  const normalizedAnswer = answer.trim()
  const lowerAnswer = normalizedAnswer.toLowerCase()
  const answerWords = normalizedAnswer ? normalizedAnswer.split(/\s+/).length : 0

  const readinessChecks = useMemo(() => {
    const titleTerms = conceptTitle.split(/\s+/).filter((word) => word.length > 3)
    const prereqTerms = prerequisites.flatMap((item) => item.split(/\s+/)).filter((word) => word.length > 3)
    const nextTerms = nextConcept?.split(/\s+/).filter((word) => word.length > 3) ?? []
    const hasContextTerm = [...titleTerms, ...prereqTerms, ...nextTerms].some((term) => includesTerm(lowerAnswer, term))

    return [
      {
        label: 'Claim',
        detail: 'A concrete answer is on the canvas.',
        done: answerWords >= 18,
      },
      {
        label: 'Mechanism',
        detail: 'The answer names why the claim should hold.',
        done: /\b(because|therefore|so|invariant|changes|stays|maps|depends)\b/.test(lowerAnswer),
      },
      {
        label: 'Bridge',
        detail: 'It touches the page context or a neighboring idea.',
        done: hasContextTerm,
      },
    ]
  }, [answerWords, conceptTitle, lowerAnswer, nextConcept, prerequisites])

  const readyCount = readinessChecks.filter((check) => check.done).length
  const status = isAsking
    ? 'Asking companion'
    : gatewayError
      ? 'Companion unavailable'
      : companionAnswer
        ? 'Feedback ready'
        : copyFailed
          ? 'Copy unavailable'
          : copied
            ? 'Prompt copied'
            : `${readyCount}/${readinessChecks.length} checks ready`

  const practiceTask: CompanionTask = useMemo(() => ({
    id: 'practice-feedback',
    label: 'Practice Feedback',
    instruction:
      'Review my practice attempt without simply solving it for me. Identify whether my answer connects intuition, math, code, and the demo; diagnose the likely misconception; then give one next on-page test.',
  }), [])

  const companionRequest = useMemo(() => {
    const localTrace = [
      `Practice challenge: ${activeChallenge.label} (${activeChallenge.anchor})`,
      `Challenge prompt: ${activeChallenge.prompt}`,
      `Learner answer: ${normalizedAnswer || 'No answer written yet.'}`,
      `Selected misconception: ${selectedDiagnosis.label} - ${selectedDiagnosis.cue}`,
      `Hints revealed: ${revealedHints}/${activeChallenge.hints.length}`,
      `Local readiness checks: ${readinessChecks.map((check) => `${check.label}=${check.done ? 'yes' : 'no'}`).join(', ')}`,
    ].join('\n')

    return buildCompanionGatewayRequest({
      source: 'practice-shell',
      mode: 'concept',
      task: practiceTask,
      context: {
        contextLabel: 'AI-first practice shell',
        domainTitle,
        surfaceTitle: conceptTitle,
        description: conceptDescription,
        currentSection: 'Practice Loop',
        sectionStep: activeChallenge.label,
        sectionSummary: activeChallenge.prompt,
        sectionSnippet: localTrace,
        prerequisites,
        nextConcept,
        nextStep: demoPrompt,
      },
      learner: {
        question: normalizedAnswer || undefined,
        selectedText: localTrace,
        goal: 'Use the concept, not just read it',
        comfortLevel: readyCount === readinessChecks.length ? 'Ready for rigor' : 'Still forming the model',
        explanationStyle: 'Visual first',
        stuckReason: selectedDiagnosis.label,
      },
    })
  }, [
    activeChallenge,
    conceptDescription,
    conceptTitle,
    demoPrompt,
    domainTitle,
    nextConcept,
    normalizedAnswer,
    practiceTask,
    prerequisites,
    readinessChecks,
    readyCount,
    revealedHints,
    selectedDiagnosis,
  ])

  function switchChallenge(challengeId: string) {
    setActiveChallengeId(challengeId)
    setRevealedHints(0)
    setCompanionAnswer('')
    setGatewayError('')
  }

  function revealHint() {
    setRevealedHints((count) => Math.min(count + 1, activeChallenge.hints.length))
  }

  function resetPractice() {
    setAnswer('')
    setRevealedHints(0)
    setSelectedDiagnosisId(diagnosisOptions[0].id)
    setCopied(false)
    setCopyFailed(false)
    setCompanionAnswer('')
    setGatewayError('')
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(companionRequest.prompt)
      setCopied(true)
      setCopyFailed(false)
      setGatewayError('')
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
      setCopyFailed(true)
      window.setTimeout(() => setCopyFailed(false), 1800)
    }
  }

  async function askCompanion() {
    const gatewayUrl = getCompanionGatewayUrl()

    if (!gatewayUrl) {
      await copyPrompt()
      return
    }

    setIsAsking(true)
    setGatewayError('')
    setCompanionAnswer('')

    try {
      const response = await requestCompanionAnswer(companionRequest, gatewayUrl)
      setCompanionAnswer(response.nextAction ? `${response.answer}\n\nTry next: ${response.nextAction}` : response.answer)
    } catch {
      setGatewayError('Copy the prompt instead.')
    } finally {
      setIsAsking(false)
    }
  }

  return (
    <section className="practice-shell" aria-labelledby="practice-shell-title">
      <SurfaceBackplate variant="assessment" density="quiet" />

      <header className="practice-header">
        <div className="practice-copy">
          <p className="eyebrow">Practice Loop</p>
          <h2 id="practice-shell-title">Try the idea before it explains itself</h2>
          <p>{conceptDescription || `Use ${conceptTitle} as a live problem, then let the page sharpen the answer.`}</p>
        </div>
        <div className="status-pill" aria-live="polite">
          <span>Readiness</span>
          <strong>{status}</strong>
        </div>
      </header>

      <div className="practice-grid">
        <div className="challenge-panel">
          <div className="challenge-tabs" aria-label="Practice modes">
            {challenges.map((challenge) => (
              <button
                key={challenge.id}
                type="button"
                className={challenge.id === activeChallenge.id ? 'active' : ''}
                aria-pressed={challenge.id === activeChallenge.id}
                onClick={() => switchChallenge(challenge.id)}
              >
                <span>{challenge.anchor}</span>
                {challenge.label}
              </button>
            ))}
          </div>

          <div className="prompt-panel">
            <span>{activeChallenge.label}</span>
            <p>{activeChallenge.prompt}</p>
          </div>

          <div className="hint-ladder" aria-label="Hint ladder">
            {activeChallenge.hints.map((hint, index) => (
              <div key={hint} className={index < revealedHints ? 'hint revealed' : 'hint'}>
                <span>{`Hint ${index + 1}`}</span>
                <p>{index < revealedHints ? hint : 'Reveal when your model needs a nudge.'}</p>
              </div>
            ))}
          </div>
        </div>

        <label className="answer-canvas">
          <span>Your answer canvas</span>
          <textarea
            value={answer}
            onChange={(event) => {
              setAnswer(event.target.value)
              setCompanionAnswer('')
              setGatewayError('')
            }}
            rows={9}
            placeholder="Write a prediction, justification, or transfer test. Use because, name the mechanism, then connect it back to the page."
          />
        </label>
      </div>

      <div className="feedback-grid">
        <div className="signal-panel">
          <span>Local checks</span>
          {readinessChecks.map((check) => (
            <div key={check.label} className={check.done ? 'signal done' : 'signal'}>
              <strong>{check.label}</strong>
              <p>{check.detail}</p>
            </div>
          ))}
        </div>

        <fieldset className="diagnosis-panel">
          <legend>Misconception check</legend>
          <div className="diagnosis-options">
            {diagnosisOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={option.id === selectedDiagnosis.id ? 'active' : ''}
                aria-pressed={option.id === selectedDiagnosis.id}
                onClick={() => {
                  setSelectedDiagnosisId(option.id)
                  setCompanionAnswer('')
                  setGatewayError('')
                }}
              >
                <strong>{option.label}</strong>
                <span>{option.cue}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {companionAnswer || gatewayError ? (
        <div className={`companion-feedback ${gatewayError ? 'error' : ''}`} aria-live="polite">
          <span>{gatewayError ? 'Status' : 'AI feedback'}</span>
          <p>{gatewayError || companionAnswer}</p>
        </div>
      ) : null}

      <div className={`practice-actions ${gatewayReady ? 'with-copy' : ''}`}>
        <button type="button" onClick={revealHint} disabled={revealedHints >= activeChallenge.hints.length}>
          {revealedHints >= activeChallenge.hints.length ? 'All hints open' : 'Reveal hint'}
        </button>
        <button type="button" className="primary-action" onClick={askCompanion} disabled={isAsking}>
          {gatewayReady ? (isAsking ? 'Asking...' : 'Ask AI for feedback') : 'Copy AI feedback prompt'}
        </button>
        {gatewayReady ? (
          <button type="button" onClick={copyPrompt}>
            {copied ? 'Copied' : 'Copy prompt'}
          </button>
        ) : null}
        <button type="button" onClick={resetPractice}>
          Reset
        </button>
      </div>

      <style jsx>{`
        .practice-shell {
          position: relative;
          overflow: hidden;
          display: grid;
          gap: 1rem;
          min-width: 0;
          padding: 1.1rem;
          border-radius: 22px;
          border: 1px solid rgba(194, 74, 45, 0.18);
          background:
            linear-gradient(135deg, rgba(255, 251, 245, 0.95), rgba(245, 240, 230, 0.9)),
            linear-gradient(180deg, rgba(31, 111, 120, 0.07), transparent 54%);
          box-shadow: 0 20px 44px rgba(12, 22, 34, 0.08);
        }

        .practice-header,
        .practice-grid,
        .feedback-grid,
        .companion-feedback,
        .practice-actions {
          position: relative;
          z-index: 1;
        }

        .practice-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(10rem, 14rem);
          gap: 1rem;
          align-items: start;
        }

        .practice-copy {
          display: grid;
          gap: 0.45rem;
          min-width: 0;
          max-width: 58rem;
        }

        .eyebrow,
        .status-pill span,
        .prompt-panel span,
        .answer-canvas span,
        .signal-panel > span,
        .companion-feedback span,
        legend,
        .hint span {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-transform: uppercase;
          color: #8b5e34;
        }

        h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.75rem;
          line-height: 1.08;
          color: #17202a;
          overflow-wrap: anywhere;
        }

        p {
          margin: 0;
          color: #4f5e69;
          line-height: 1.55;
        }

        .status-pill {
          display: grid;
          gap: 0.3rem;
          min-width: 0;
          padding: 0.85rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.82);
        }

        .status-pill strong {
          color: #17202a;
          overflow-wrap: anywhere;
        }

        .practice-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(18rem, 1.08fr);
          gap: 0.9rem;
          min-width: 0;
        }

        .challenge-panel,
        .answer-canvas,
        .signal-panel,
        .diagnosis-panel,
        .companion-feedback {
          min-width: 0;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.82);
        }

        .challenge-panel {
          display: grid;
          gap: 0.75rem;
          padding: 0.85rem;
        }

        .challenge-tabs {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.45rem;
        }

        button {
          font: inherit;
        }

        .challenge-tabs button,
        .diagnosis-options button,
        .practice-actions button {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 251, 245, 0.9);
          color: #213040;
          cursor: pointer;
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
        }

        .challenge-tabs button {
          display: grid;
          gap: 0.18rem;
          min-height: 4.5rem;
          padding: 0.65rem;
          text-align: left;
          font-weight: 800;
        }

        .challenge-tabs button span {
          color: #65717c;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          font-weight: 500;
        }

        .challenge-tabs button.active,
        .diagnosis-options button.active {
          border-color: rgba(194, 74, 45, 0.34);
          background: rgba(255, 241, 232, 0.92);
        }

        .challenge-tabs button:hover,
        .diagnosis-options button:hover,
        .practice-actions button:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(31, 111, 120, 0.28);
        }

        .challenge-tabs button:focus-visible,
        .diagnosis-options button:focus-visible,
        .practice-actions button:focus-visible,
        textarea:focus-visible {
          outline: 2px solid rgba(31, 111, 120, 0.28);
          outline-offset: 2px;
        }

        .prompt-panel {
          display: grid;
          gap: 0.35rem;
          padding: 0.85rem;
          border-radius: 8px;
          background: rgba(239, 247, 245, 0.8);
          border: 1px solid rgba(31, 111, 120, 0.13);
        }

        .prompt-panel span,
        .signal-panel > span {
          color: #1f6f78;
        }

        .prompt-panel p {
          color: #273544;
          font-weight: 700;
        }

        .hint-ladder {
          display: grid;
          gap: 0.45rem;
        }

        .hint {
          display: grid;
          grid-template-columns: 4.4rem minmax(0, 1fr);
          gap: 0.65rem;
          align-items: start;
          padding: 0.65rem;
          border-radius: 8px;
          border: 1px dashed rgba(27, 36, 48, 0.14);
          background: rgba(255, 251, 245, 0.62);
        }

        .hint.revealed {
          border-style: solid;
          border-color: rgba(139, 94, 52, 0.18);
          background: rgba(255, 247, 236, 0.86);
        }

        .hint p {
          font-size: 0.92rem;
        }

        .answer-canvas {
          display: grid;
          gap: 0.5rem;
          padding: 0.85rem;
        }

        textarea {
          width: 100%;
          min-width: 0;
          min-height: 18rem;
          resize: vertical;
          padding: 0.9rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background:
            linear-gradient(rgba(31, 75, 153, 0.05) 1px, transparent 1px),
            rgba(255, 251, 245, 0.94);
          background-size: 100% 1.8rem;
          color: #17202a;
          font: inherit;
          line-height: 1.55;
        }

        textarea::placeholder {
          color: #7b858e;
        }

        .feedback-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
          gap: 0.9rem;
          min-width: 0;
        }

        .signal-panel,
        .diagnosis-panel {
          display: grid;
          gap: 0.55rem;
          padding: 0.85rem;
        }

        .diagnosis-panel {
          margin: 0;
        }

        legend {
          padding: 0;
          color: #8b5e34;
        }

        .signal {
          display: grid;
          gap: 0.16rem;
          padding: 0.58rem 0.65rem;
          border-radius: 8px;
          border-left: 4px solid rgba(91, 104, 116, 0.28);
          background: rgba(255, 251, 245, 0.62);
        }

        .signal.done {
          border-left-color: #1f6f78;
          background: rgba(239, 247, 245, 0.78);
        }

        .signal strong {
          color: #17202a;
          font-size: 0.92rem;
        }

        .signal p {
          font-size: 0.88rem;
        }

        .diagnosis-options {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
        }

        .diagnosis-options button {
          display: grid;
          gap: 0.28rem;
          min-height: 5.25rem;
          padding: 0.7rem;
          text-align: left;
        }

        .diagnosis-options strong {
          color: #17202a;
          overflow-wrap: anywhere;
        }

        .diagnosis-options span {
          color: #586673;
          font-size: 0.86rem;
          line-height: 1.35;
        }

        .companion-feedback {
          display: grid;
          gap: 0.45rem;
          padding: 0.85rem;
          border-color: rgba(31, 111, 120, 0.16);
          background: rgba(239, 247, 245, 0.86);
        }

        .companion-feedback.error {
          border-color: rgba(194, 74, 45, 0.2);
          background: rgba(255, 243, 236, 0.9);
        }

        .companion-feedback p {
          white-space: pre-wrap;
        }

        .practice-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.55rem;
        }

        .practice-actions.with-copy {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .practice-actions button {
          min-height: 42px;
          padding: 0.55rem 0.7rem;
          font-weight: 800;
        }

        .practice-actions .primary-action {
          background: #1b2430;
          color: #fff9ef;
          border-color: #1b2430;
        }

        .practice-actions button:disabled {
          opacity: 0.62;
          cursor: not-allowed;
        }

        @media (max-width: 900px) {
          .practice-header,
          .practice-grid,
          .feedback-grid,
          .practice-actions {
            grid-template-columns: 1fr;
          }

          .diagnosis-options {
            grid-template-columns: 1fr;
          }

          h2 {
            font-size: 1.42rem;
          }

          .hint {
            grid-template-columns: 1fr;
          }

          textarea {
            min-height: 14rem;
          }
        }

        @media (max-width: 520px) {
          .practice-shell {
            padding: 0.9rem;
          }

          .challenge-tabs {
            gap: 0.35rem;
          }

          .challenge-tabs button {
            min-height: 4.1rem;
            padding: 0.52rem;
            font-size: 0.88rem;
          }

          .challenge-tabs button span {
            font-size: 0.62rem;
          }
        }
      `}</style>
    </section>
  )
}
