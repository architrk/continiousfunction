import { useMemo, useState } from 'react'
import {
  buildCompanionGatewayRequest,
  getCompanionGatewayUrl,
  requestCompanionAnswer,
  type CompanionTask,
} from '../../lib/aiCompanion'
import SurfaceBackplate from '../editorial/SurfaceBackplate'

type SectionTone = 'intuition' | 'math' | 'code' | 'demo'

type SectionAction = CompanionTask & {
  title: string
}

type Props = {
  conceptTitle: string
  conceptDescription?: string
  domainTitle: string
  sectionTitle: string
  sectionStep: string
  sectionSummary: string
  sectionSnippet?: string
  prerequisites?: string[]
  nextConcept?: string
  tone?: SectionTone
}

const actions: SectionAction[] = [
  {
    id: 'explain',
    label: 'Explain',
    title: 'Explain this section',
    instruction:
      'Explain this section in plain language first, then restate the same idea with the exact symbols, code objects, or demo state from the excerpt.',
  },
  {
    id: 'quiz',
    label: 'Quiz',
    title: 'Quiz me on this section',
    instruction:
      'Give me a short check for understanding: two recall questions, one transfer question, and one answer key that teaches from mistakes.',
  },
  {
    id: 'connect',
    label: 'Connect',
    title: 'Connect this to a prerequisite',
    instruction:
      'Connect this section to the most relevant prerequisite. Name what carries over, what changes, and one small example that links the two ideas.',
  },
  {
    id: 'code',
    label: 'Code',
    title: 'Turn this into code',
    instruction:
      'Turn this section into runnable Python-style pseudocode. Keep notation and variable names aligned with the page, and call out shapes where they matter.',
  },
  {
    id: 'debug',
    label: 'Debug',
    title: 'Debug my misconception',
    instruction:
      'Name the most tempting misconception in this section, show why it is tempting, then correct it with a tiny counterexample or page-grounded test.',
  },
]

export default function SectionAIActionStrip({
  conceptTitle,
  conceptDescription,
  domainTitle,
  sectionTitle,
  sectionStep,
  sectionSummary,
  sectionSnippet,
  prerequisites = [],
  nextConcept,
  tone = 'intuition',
}: Props) {
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [activeGatewayActionId, setActiveGatewayActionId] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [gatewayError, setGatewayError] = useState('')

  const activeAction = actions.find((action) => action.id === copiedActionId)
  const gatewayUrl = getCompanionGatewayUrl()
  const gatewayReady = Boolean(gatewayUrl)
  const gatewayAction = actions.find((action) => action.id === activeGatewayActionId)
  const status = activeGatewayActionId
    ? `Asking ${gatewayAction?.label ?? 'AI'}...`
    : gatewayError
      ? 'Companion unavailable'
      : answer
        ? 'Response ready'
        : copyFailed
          ? 'Copy unavailable'
          : activeAction
            ? `Copied ${activeAction.label} prompt`
            : ''

  const requestByAction = useMemo(() => {
    return new Map(
      actions.map((action) => {
        return [
          action.id,
          buildCompanionGatewayRequest({
            source: 'concept-section',
            mode: 'concept',
            task: action,
            context: {
              domainTitle,
              surfaceTitle: conceptTitle,
              description: conceptDescription,
              currentSection: sectionTitle,
              sectionStep,
              sectionSummary,
              sectionSnippet,
              prerequisites,
              nextConcept,
            },
          }),
        ]
      })
    )
  }, [
    conceptDescription,
    conceptTitle,
    domainTitle,
    nextConcept,
    prerequisites,
    sectionSnippet,
    sectionStep,
    sectionSummary,
    sectionTitle,
  ])

  async function copyActionPrompt(actionId: string) {
    const request = requestByAction.get(actionId)
    if (!request) return

    try {
      await navigator.clipboard.writeText(request.prompt)
      setCopiedActionId(actionId)
      setCopyFailed(false)
      setGatewayError('')
      window.setTimeout(() => setCopiedActionId(null), 1800)
    } catch {
      setCopiedActionId(null)
      setCopyFailed(true)
      window.setTimeout(() => setCopyFailed(false), 1800)
    }
  }

  async function runAction(actionId: string) {
    if (!gatewayReady) {
      await copyActionPrompt(actionId)
      return
    }

    const request = requestByAction.get(actionId)
    if (!request) return

    setActiveGatewayActionId(actionId)
    setAnswer('')
    setGatewayError('')

    try {
      const response = await requestCompanionAnswer(request, gatewayUrl)
      setAnswer(response.nextAction ? `${response.answer}\n\nTry next: ${response.nextAction}` : response.answer)
    } catch {
      setGatewayError('Copy the prompt instead.')
    } finally {
      setActiveGatewayActionId(null)
    }
  }

  return (
    <div className={`ai-action-strip ${tone}`} aria-label={`AI actions for ${sectionTitle}`}>
      <SurfaceBackplate variant={tone === 'demo' ? 'assessment' : 'companion'} density="quiet" />
      <div className="strip-head">
        <span>Section prompt</span>
        <span className="strip-status" aria-live="polite">
          {status}
        </span>
      </div>

      <div className="action-row" role="list">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            title={action.title}
            aria-label={`${action.title} for ${sectionTitle}`}
            data-ai-section-action={action.id}
            onClick={() => runAction(action.id)}
            disabled={activeGatewayActionId !== null}
          >
            {action.label}
          </button>
        ))}
      </div>

      {answer || gatewayError ? (
        <div className={`strip-answer ${gatewayError ? 'error' : ''}`} aria-live="polite">
          <p>{gatewayError || answer}</p>
        </div>
      ) : null}

      <style jsx>{`
        .ai-action-strip {
          --tone: #1f6f78;
          --tone-soft: rgba(31, 111, 120, 0.1);
          position: relative;
          overflow: hidden;
          display: grid;
          gap: 0.65rem;
          min-width: 0;
          padding: 0.8rem;
          border-radius: 18px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(135deg, rgba(255, 251, 245, 0.86), rgba(247, 250, 247, 0.9)),
            radial-gradient(circle at top right, var(--tone-soft), transparent 42%);
        }

        .strip-head,
        .action-row,
        .strip-answer {
          position: relative;
          z-index: 1;
        }

        .ai-action-strip.math {
          --tone: #1f4b99;
          --tone-soft: rgba(31, 75, 153, 0.12);
        }

        .ai-action-strip.code {
          --tone: #8b5e34;
          --tone-soft: rgba(139, 94, 52, 0.13);
        }

        .ai-action-strip.demo {
          --tone: #1f6f78;
          --tone-soft: rgba(31, 111, 120, 0.12);
        }

        .strip-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
        }

        .strip-head span:first-child {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--tone);
        }

        .strip-status {
          min-height: 1rem;
          color: #5c6873;
          font-size: 0.78rem;
          line-height: 1.2;
          text-align: right;
          overflow-wrap: anywhere;
        }

        .action-row {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0.45rem;
          min-width: 0;
        }

        button {
          min-width: 0;
          min-height: 36px;
          padding: 0.45rem 0.6rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 999px;
          background: rgba(255, 251, 245, 0.92);
          color: #24303d;
          cursor: pointer;
          font: inherit;
          font-size: 0.82rem;
          font-weight: 700;
          line-height: 1;
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
        }

        button:hover,
        button:focus-visible {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--tone), transparent 56%);
          background: color-mix(in srgb, var(--tone), white 86%);
          outline: none;
        }

        button:focus-visible {
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--tone), transparent 78%);
        }

        button:disabled {
          opacity: 0.68;
          cursor: progress;
        }

        .strip-answer {
          padding: 0.75rem;
          border-radius: 14px;
          border: 1px solid rgba(31, 111, 120, 0.14);
          background: rgba(255, 251, 245, 0.74);
        }

        .strip-answer.error {
          border-color: rgba(194, 74, 45, 0.18);
          background: rgba(255, 243, 236, 0.86);
        }

        .strip-answer p {
          margin: 0;
          color: #344554;
          font-size: 0.9rem;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        @media (max-width: 720px) {
          .strip-head {
            align-items: flex-start;
            flex-direction: column;
            gap: 0.35rem;
          }

          .strip-status {
            text-align: left;
          }

          .action-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  )
}
