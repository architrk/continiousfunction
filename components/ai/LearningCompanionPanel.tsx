import { useEffect, useMemo, useState } from 'react'
import {
  buildCompanionGatewayRequest,
  getCompanionGatewayUrl,
  requestCompanionAnswer,
  type CompanionMode,
} from '../../lib/aiCompanion'
import {
  DEMO_STATE_EVENT,
  formatDemoStateForPrompt,
  type DemoStateEventDetail,
  type DemoStateSummary,
} from '../../lib/demoState'
import SurfaceBackplate from '../editorial/SurfaceBackplate'

type PromptSeed = {
  id: string
  label: string
  prompt: string
}

type Props = {
  mode?: CompanionMode
  title: string
  contextLabel?: string
  description?: string
  currentSection?: string
  nextStep?: string
  promptSeeds?: PromptSeed[]
  compact?: boolean
  id?: string
  demoStateScope?: string
}

const defaultHomeSeeds: PromptSeed[] = [
  {
    id: 'place-me',
    label: 'Place Me',
    prompt: 'Ask me 5 quick questions, then recommend the best Continuous Function learning path for my current level.',
  },
  {
    id: 'learning-plan',
    label: 'Build A Plan',
    prompt: 'Turn this atlas into a 2-week learning plan with one concept, one demo, and one short coding task per day.',
  },
  {
    id: 'unstuck',
    label: 'Get Me Unstuck',
    prompt: 'I feel stuck learning modern AI foundations. Diagnose the likely missing prerequisite and give me one tiny next action.',
  },
]

const defaultConceptSeeds: PromptSeed[] = [
  {
    id: 'explain',
    label: 'Explain It',
    prompt: 'Explain the central idea in plain language, then restate it with the exact math objects from the page.',
  },
  {
    id: 'quiz',
    label: 'Quiz Me',
    prompt: 'Give me a 5-question check for understanding. Start easy, then include one transfer question.',
  },
  {
    id: 'debug',
    label: 'Debug My Model',
    prompt: 'Find the most likely misconception a learner would have here, then correct it with a small example.',
  },
  {
    id: 'code',
    label: 'Code Bridge',
    prompt: 'Map the notation on this page to runnable Python step by step, with shapes or dimensions where relevant.',
  },
]

const learnerGoals = [
  'Understand the idea',
  'Solve problems',
  'Implement it',
  'Connect prerequisites',
]

const comfortLevels = [
  'New to this',
  'Somewhat familiar',
  'Ready for rigor',
]

const explanationStyles = [
  'Visual first',
  'Math first',
  'Code first',
]

const stuckReasons = [
  'Not stuck',
  'Missing prerequisite',
  'Equation jump',
  'Code mismatch',
  'Demo surprise',
]

export default function LearningCompanionPanel({
  mode = 'concept',
  title,
  contextLabel,
  description,
  currentSection,
  nextStep,
  promptSeeds,
  compact = false,
  id,
  demoStateScope,
}: Props) {
  const seeds = promptSeeds ?? (mode === 'home' ? defaultHomeSeeds : defaultConceptSeeds)
  const [activeSeedId, setActiveSeedId] = useState(seeds[0]?.id ?? 'custom')
  const [question, setQuestion] = useState('')
  const [goal, setGoal] = useState(learnerGoals[0])
  const [comfortLevel, setComfortLevel] = useState(comfortLevels[0])
  const [explanationStyle, setExplanationStyle] = useState(explanationStyles[0])
  const [stuckReason, setStuckReason] = useState(stuckReasons[0])
  const [copied, setCopied] = useState(false)
  const [answer, setAnswer] = useState('')
  const [gatewayError, setGatewayError] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [demoState, setDemoState] = useState<DemoStateSummary | null>(null)

  const activeSeed = seeds.find((seed) => seed.id === activeSeedId) ?? seeds[0]
  const gatewayUrl = getCompanionGatewayUrl()
  const gatewayReady = Boolean(gatewayUrl)
  const demoStatePrompt = demoState ? formatDemoStateForPrompt(demoState) : undefined

  useEffect(() => {
    setDemoState(null)
    if (!demoStateScope || typeof window === 'undefined') return undefined

    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail?.conceptId === demoStateScope) {
        setDemoState('cleared' in detail ? null : detail)
      }
    }

    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)
    return () => window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
  }, [demoStateScope])

  const companionRequest = useMemo(() => {
    return buildCompanionGatewayRequest({
      source: mode === 'home' ? 'home-panel' : 'concept-panel',
      mode,
      task: {
        id: activeSeed?.id ?? 'custom',
        label: activeSeed?.label ?? 'Custom',
        instruction: activeSeed?.prompt ?? 'Help me understand this learning surface.',
      },
      context: {
        contextLabel,
        surfaceTitle: title,
        description,
        currentSection,
        sectionSnippet: demoStatePrompt,
        nextStep,
      },
      learner: {
        question: question.trim() || undefined,
        goal,
        comfortLevel,
        explanationStyle,
        stuckReason: stuckReason === 'Not stuck' ? undefined : stuckReason,
      },
    })
  }, [
    activeSeed,
    comfortLevel,
    contextLabel,
    currentSection,
    description,
    demoStatePrompt,
    explanationStyle,
    goal,
    mode,
    nextStep,
    question,
    stuckReason,
    title,
  ])

  const composedPrompt = companionRequest.prompt

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(composedPrompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  async function askCompanion() {
    if (!gatewayReady) {
      await copyPrompt()
      return
    }

    setIsAsking(true)
    setGatewayError('')
    setAnswer('')

    try {
      const response = await requestCompanionAnswer(companionRequest, gatewayUrl)
      setAnswer(response.nextAction ? `${response.answer}\n\nTry next: ${response.nextAction}` : response.answer)
    } catch {
      setGatewayError('Companion unavailable. Copy the prompt instead.')
    } finally {
      setIsAsking(false)
    }
  }

  return (
    <section id={id} className={`companion ${compact ? 'compact' : ''}`} aria-label="Object-attached learning companion">
      <SurfaceBackplate variant="companion" density={compact ? 'quiet' : 'standard'} />
      <div className="companion-header">
        <p className="eyebrow">Object Companion</p>
        <h2>{mode === 'home' ? 'Plan beside the atlas' : 'Ask beside the selected object'}</h2>
        {description ? <p>{description}</p> : null}
      </div>

      <div className="prompt-grid" role="list" aria-label="Companion prompt modes">
        {seeds.map((seed) => (
          <button
            key={seed.id}
            type="button"
            className={seed.id === activeSeedId ? 'active' : ''}
            onClick={() => setActiveSeedId(seed.id)}
          >
            {seed.label}
          </button>
        ))}
      </div>

      <label className="question-box">
        <span>Your question</span>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={mode === 'home' ? 'e.g. I know calculus but not transformers.' : 'e.g. Why does this equation match the demo?'}
          rows={compact ? 3 : 4}
        />
      </label>

      <div className="learner-state" aria-label="Learner preferences">
        <label>
          <span>Goal</span>
          <select value={goal} onChange={(event) => setGoal(event.target.value)}>
            {learnerGoals.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Comfort</span>
          <select value={comfortLevel} onChange={(event) => setComfortLevel(event.target.value)}>
            {comfortLevels.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Style</span>
          <select value={explanationStyle} onChange={(event) => setExplanationStyle(event.target.value)}>
            {explanationStyles.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Stuck on</span>
          <select value={stuckReason} onChange={(event) => setStuckReason(event.target.value)}>
            {stuckReasons.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      {demoState ? (
        <div className="demo-state-panel" aria-live="polite">
          <span>Demo state</span>
          <strong>{demoState.label}</strong>
          <p>{demoState.summary}</p>
        </div>
      ) : null}

      <div className="prompt-preview">
        <span>Context prompt</span>
        <p>{composedPrompt}</p>
      </div>

      {answer || gatewayError ? (
        <div className={`answer-panel ${gatewayError ? 'error' : ''}`} aria-live="polite">
          <span>{gatewayError ? 'Status' : 'Companion reply'}</span>
          <p>{gatewayError || answer}</p>
        </div>
      ) : null}

      <div className="action-buttons">
        {gatewayReady ? (
          <button type="button" className="ask-button" onClick={askCompanion} disabled={isAsking}>
            {isAsking ? 'Asking...' : 'Ask companion'}
          </button>
        ) : null}
        <button type="button" className="copy-button" onClick={copyPrompt}>
          {copied ? 'Copied prompt' : 'Copy prompt for AI'}
        </button>
      </div>

      <style jsx>{`
        .companion {
          position: relative;
          overflow: hidden;
          display: grid;
          gap: 1rem;
          padding: 1.1rem;
          border-radius: 24px;
          border: 1px solid rgba(31, 111, 120, 0.18);
          background:
            linear-gradient(135deg, rgba(255, 251, 245, 0.94), rgba(239, 247, 245, 0.9)),
            radial-gradient(circle at top right, rgba(31, 111, 120, 0.16), transparent 40%);
          box-shadow: 0 18px 40px rgba(7, 15, 25, 0.08);
        }

        .companion-header,
        .prompt-grid,
        .question-box,
        .learner-state,
        .prompt-preview,
        .demo-state-panel,
        .answer-panel,
        .action-buttons {
          position: relative;
          z-index: 1;
        }

        .companion.compact {
          padding: 1rem;
          border-radius: 20px;
        }

        .companion-header {
          display: grid;
          gap: 0.45rem;
        }

        .eyebrow {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.28rem, 2.4vw, 1.75rem);
          line-height: 1.05;
          color: #151d27;
        }

        p {
          margin: 0;
          color: #455361;
          line-height: 1.55;
        }

        .prompt-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
        }

        button {
          font: inherit;
        }

        .prompt-grid button {
          min-height: 38px;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.88);
          color: #263543;
          cursor: pointer;
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
        }

        .prompt-grid button:hover,
        .prompt-grid button.active {
          transform: translateY(-1px);
          border-color: rgba(31, 111, 120, 0.32);
          background: rgba(224, 245, 241, 0.86);
        }

        .question-box {
          display: grid;
          gap: 0.45rem;
        }

        .question-box span,
        .prompt-preview span,
        .learner-state span {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #5a6874;
        }

        textarea {
          width: 100%;
          min-width: 0;
          resize: vertical;
          padding: 0.85rem;
          border-radius: 16px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.9);
          color: #17202a;
          font: inherit;
          line-height: 1.45;
        }

        textarea:focus {
          outline: 2px solid rgba(31, 111, 120, 0.26);
          outline-offset: 2px;
        }

        .learner-state {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
        }

        .learner-state label {
          display: grid;
          gap: 0.35rem;
          min-width: 0;
        }

        select {
          min-width: 0;
          width: 100%;
          min-height: 38px;
          padding: 0.45rem 0.65rem;
          border-radius: 12px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.92);
          color: #213040;
          font: inherit;
          font-size: 0.86rem;
        }

        select:focus {
          outline: 2px solid rgba(31, 111, 120, 0.26);
          outline-offset: 2px;
        }

        .prompt-preview {
          display: grid;
          gap: 0.4rem;
          padding: 0.85rem;
          border-radius: 16px;
          border: 1px solid rgba(31, 111, 120, 0.14);
          background: rgba(255, 251, 245, 0.68);
        }

        .demo-state-panel {
          display: grid;
          gap: 0.32rem;
          padding: 0.8rem;
          border-radius: 16px;
          border: 1px solid rgba(194, 74, 45, 0.16);
          background: rgba(255, 247, 236, 0.78);
        }

        .demo-state-panel span {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #8b5e34;
        }

        .demo-state-panel strong {
          color: #17202a;
          font-size: 0.94rem;
          line-height: 1.3;
        }

        .demo-state-panel p {
          font-size: 0.86rem;
          line-height: 1.45;
        }

        .prompt-preview p {
          max-height: 9.5rem;
          overflow: auto;
          font-family: var(--font-mono);
          font-size: 0.76rem;
          line-height: 1.5;
          white-space: pre-wrap;
        }

        .answer-panel {
          display: grid;
          gap: 0.4rem;
          padding: 0.85rem;
          border-radius: 16px;
          border: 1px solid rgba(31, 111, 120, 0.16);
          background: rgba(239, 247, 245, 0.82);
        }

        .answer-panel.error {
          border-color: rgba(194, 74, 45, 0.2);
          background: rgba(255, 243, 236, 0.88);
        }

        .answer-panel span {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #5a6874;
        }

        .answer-panel p {
          white-space: pre-wrap;
        }

        .action-buttons {
          display: grid;
          grid-template-columns: ${gatewayReady ? 'repeat(2, minmax(0, 1fr))' : '1fr'};
          gap: 0.55rem;
        }

        .copy-button,
        .ask-button {
          min-height: 42px;
          border: 0;
          border-radius: 999px;
          cursor: pointer;
          font-weight: 700;
        }

        .ask-button {
          background: #1f6f78;
          color: #f8f3ea;
          box-shadow: 0 14px 28px rgba(31, 111, 120, 0.14);
        }

        .copy-button {
          background: #1b2430;
          color: #f8f3ea;
          box-shadow: 0 14px 28px rgba(27, 36, 48, 0.16);
        }

        .ask-button:disabled {
          opacity: 0.72;
          cursor: progress;
        }

        .copy-button:hover,
        .ask-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        @media (max-width: 720px) {
          .prompt-grid,
          .learner-state,
          .action-buttons {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}
