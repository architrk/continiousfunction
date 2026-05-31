import { useMemo, useState } from 'react'
import type { DiscussionAnchorListItem } from '@/lib/discussionAnchors'
import {
  buildResearchDiscussionRoomPacket,
  type ResearchDiscussionRoomCard,
} from '@/lib/researchDiscussionRoom'
import {
  buildCompanionGatewayRequest,
  getCompanionGatewayUrl,
  requestCompanionAnswer,
} from '@/lib/aiCompanion'

type ObjectRoomContribution = {
  id: string
  label: string
  title: string
  body: string
  meta: string
  tone: 'question' | 'teaching' | 'practice' | 'source' | 'ai' | 'open' | 'experiment'
}

type ObjectRoomPanelProps = {
  conceptId: string
  conceptTitle: string
  selectedItem: DiscussionAnchorListItem
  objectTypeLabel: string
  objectContext: string
  objectKeyLabel?: string | null
  sourceBoundary: string
  predictionHref: string
  codeHref: string
  roomHref: string
  onRememberObject?: () => void
}

function boundedText(value: string | undefined, limit: number, fallback = 'Selected learning object') {
  const text = value?.trim() || fallback
  if (text.length <= limit) return text
  if (limit <= 3) return text.slice(0, limit)
  return `${text.slice(0, limit - 3).trimEnd()}...`
}

function sourceLabel(item: DiscussionAnchorListItem, fallback: string) {
  const ids = item.anchor.sourceIds?.slice(0, 3).filter(Boolean) ?? []
  if (ids.length) return ids.join(', ')
  return fallback
}

function efficientAttentionContributions(
  selectedItem: DiscussionAnchorListItem,
  sourceBoundary: string
): ObjectRoomContribution[] {
  const objectTitle = boundedText(selectedItem.anchor.title, 92)
  const sourceIds = sourceLabel(selectedItem, sourceBoundary)

  return [
    {
      id: 'best-explanation',
      label: 'Best explanation',
      title: 'Separate cache writes, cache reads, and IO-aware attention.',
      body:
        'KV caching saves recomputing old keys and values, but every decode step still reads the stored K and V tensors. GQA changes the cache-size term Hkv; FlashAttention changes how exact attention is tiled so the full attention matrix is not materialized.',
      meta: `Attach to ${objectTitle}`,
      tone: 'teaching',
    },
    {
      id: 'student-question',
      label: 'Student question',
      title: 'If keys and values are already cached, why does long context still hurt?',
      body:
        'The cache removes repeated projection work, not the need to read prior K/V vectors. The first confusion to repair is whether compute was saved, memory traffic was saved, or both.',
      meta: 'Learner repair',
      tone: 'question',
    },
    {
      id: 'professor-note',
      label: 'Professor note',
      title: 'Make the invariant a shape statement before making it a systems claim.',
      body:
        'Name B, L, T, Hkv, d_head, and bytes before saying “efficient.” Then ask which symbol moves when context grows, when KV heads are shared, and when the kernel avoids materializing attention.',
      meta: 'Teach the chain',
      tone: 'teaching',
    },
    {
      id: 'practitioner-example',
      label: 'Practitioner example',
      title: 'A serving engineer cares about the term that must be read on every new token.',
      body:
        'Hold layers, batch, and head size fixed. Doubling T roughly doubles KV memory. Moving from full MHA to GQA reduces the KV-head factor, but quality, batching, paging, and hardware still decide the final latency.',
      meta: 'Production caveat',
      tone: 'practice',
    },
    {
      id: 'source-correction',
      label: 'Source correction',
      title: 'Do not credit FlashAttention for shrinking the decode KV cache.',
      body:
        'Use Shazeer and Ainslie for MQA/GQA decode bandwidth and KV-head sharing. Use Dao et al. for IO-aware exact attention and avoiding the full attention matrix. These are related efficiency stories, not the same lever.',
      meta: `Source boundary: ${sourceIds}`,
      tone: 'source',
    },
    {
      id: 'ai-summary',
      label: 'AI summary',
      title: 'The tutor prompt should answer from this object, not from generic attention lore.',
      body:
        'Ask for one formula, one toy-code witness, one source boundary, one misconception repair, and one next experiment. If the answer merges GQA and FlashAttention into one claim, mark it as ungrounded.',
      meta: 'Draft, not canonical',
      tone: 'ai',
    },
    {
      id: 'open-question',
      label: 'Open question',
      title: 'Where does the quality tradeoff appear when fewer KV heads serve more query heads?',
      body:
        'The room should preserve this as an open research/practice question instead of pretending the cache equation proves model quality. The next evidence needs model, workload, and metric boundaries.',
      meta: 'Unresolved by design',
      tone: 'open',
    },
    {
      id: 'next-experiment',
      label: 'Next experiment',
      title: 'Run the KV cache lab with one variable moving at a time.',
      body:
        'First double T and predict the memory change. Then reduce Hkv and predict the cache ratio. Keep FlashAttention out of that prediction until you switch to a prefill/training IO question.',
      meta: 'Prediction before reveal',
      tone: 'experiment',
    },
  ]
}

function genericContributions(
  conceptTitle: string,
  selectedItem: DiscussionAnchorListItem,
  sourceBoundary: string
): ObjectRoomContribution[] {
  const objectTitle = boundedText(selectedItem.anchor.title, 92)

  return [
    {
      id: 'best-explanation',
      label: 'Best explanation',
      title: `Explain ${objectTitle} by naming the invariant first.`,
      body: 'The room should keep the current object, exact question, evidence, and next action together before any social or AI layer appears.',
      meta: conceptTitle,
      tone: 'teaching',
    },
    {
      id: 'student-question',
      label: 'Student question',
      title: selectedItem.thread.seedPrompt,
      body: 'Keep the learner-facing confusion visible so the next answer repairs the right mental model.',
      meta: 'Learner repair',
      tone: 'question',
    },
    {
      id: 'professor-note',
      label: 'Professor note',
      title: 'Define symbols, assumptions, and the prerequisite bridge before moving on.',
      body: 'The professor contribution should make the explanation transferable without flattening the hard part.',
      meta: 'Teach the chain',
      tone: 'teaching',
    },
    {
      id: 'practitioner-example',
      label: 'Practitioner example',
      title: 'Attach one real implementation or usage pressure to the object.',
      body: 'A practitioner example is useful only when it names what changes, what stays fixed, and what the toy page cannot prove.',
      meta: 'Applied boundary',
      tone: 'practice',
    },
    {
      id: 'source-correction',
      label: 'Source correction',
      title: 'Separate local explanation from source-supported evidence.',
      body: 'The room should show what is supported, weakened, or still an assumption before an answer becomes canonical.',
      meta: sourceBoundary,
      tone: 'source',
    },
    {
      id: 'ai-summary',
      label: 'AI summary',
      title: 'Summarize the object with evidence and one next move.',
      body: 'AI output is a draft: useful for orientation, but never silently promoted into the atlas.',
      meta: 'Draft, not canonical',
      tone: 'ai',
    },
    {
      id: 'open-question',
      label: 'Open question',
      title: 'What evidence would change confidence about this object?',
      body: 'A good object room preserves uncertainty as a work item instead of hiding it behind polished prose.',
      meta: 'Unresolved by design',
      tone: 'open',
    },
    {
      id: 'next-experiment',
      label: 'Next experiment',
      title: 'Make one prediction, reveal one observation, carry one repair.',
      body: 'The next experiment should target the selected object directly, not a broad curiosity sweep.',
      meta: 'Prediction before reveal',
      tone: 'experiment',
    },
  ]
}

export default function ObjectRoomPanel({
  conceptId,
  conceptTitle,
  selectedItem,
  objectTypeLabel,
  objectContext,
  objectKeyLabel,
  sourceBoundary,
  predictionHref,
  codeHref,
  roomHref,
  onRememberObject,
}: ObjectRoomPanelProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [answer, setAnswer] = useState('')
  const [gatewayError, setGatewayError] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const isEfficientAttentionRoom = conceptId === 'efficient-attention'
  const contributions =
    isEfficientAttentionRoom
      ? efficientAttentionContributions(selectedItem, sourceBoundary)
      : genericContributions(conceptTitle, selectedItem, sourceBoundary)
  const objectTitle = boundedText(selectedItem.anchor.title, 112)
  const objectQuestion = boundedText(selectedItem.thread.seedPrompt, 220)
  const handoffCards: ResearchDiscussionRoomCard[] = contributions.map((contribution) => ({
    label: contribution.label,
    title: contribution.title,
    body: contribution.body,
    meta: contribution.meta,
  }))
  const nextExperiment = contributions.find((contribution) => contribution.id === 'next-experiment')
  const objectRoomPacket = useMemo(
    () =>
      buildResearchDiscussionRoomPacket(selectedItem, undefined, undefined, {
        objectContext,
        sourceBoundary,
        roomCards: handoffCards,
        nextExperiment: nextExperiment ? `${nextExperiment.title} ${nextExperiment.body}` : undefined,
        canonicality:
          'This is a local distilled object room for tutoring and discussion. Treat it as draft context, not canonical atlas content.',
      }),
    [handoffCards, nextExperiment, objectContext, selectedItem, sourceBoundary]
  )
  const gatewayUrl = getCompanionGatewayUrl()
  const gatewayReady = Boolean(gatewayUrl)
  const companionRequest = useMemo(
    () =>
      buildCompanionGatewayRequest({
        source: 'concept-panel',
        mode: 'concept',
        task: {
          id: 'object-room-tutor',
          label: 'Object room tutor',
          instruction:
            'Use the selected object-room packet to answer as a careful tutor. Start with the best explanation, repair the likely misconception, respect the source boundary, and end with the next experiment.',
        },
        context: {
          contextLabel: `${conceptTitle} object room`,
          surfaceTitle: `${conceptTitle}: ${objectTitle}`,
          description: objectContext,
          currentSection: 'High-signal object room',
          sectionSnippet: objectRoomPacket.aiPrompt,
          nextStep: nextExperiment?.title,
        },
        learner: {
          question: objectQuestion,
          goal: 'Understand the idea',
          explanationStyle: 'Visual first',
          stuckReason: 'Object-room handoff',
        },
      }),
    [conceptTitle, nextExperiment?.title, objectContext, objectQuestion, objectRoomPacket.aiPrompt, objectTitle]
  )
  const objectRoomPrompt = companionRequest.prompt
  const roomEyebrow = isEfficientAttentionRoom ? 'KV Cache Object Room' : 'Object Room'
  const roomTitle = isEfficientAttentionRoom
    ? 'Watch which term changes before comparing efficiency methods.'
    : 'Discuss one object through evidence, correction, and one next experiment.'

  const copyObjectRoomPrompt = async () => {
    onRememberObject?.()
    try {
      await navigator.clipboard.writeText(objectRoomPrompt)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 1800)
    } catch {
      setCopyStatus('error')
      window.setTimeout(() => setCopyStatus('idle'), 1800)
    }
  }

  const askCompanion = async () => {
    onRememberObject?.()

    if (!gatewayReady) {
      await copyObjectRoomPrompt()
      return
    }

    setIsAsking(true)
    setAnswer('')
    setGatewayError('')
    setCopyStatus('idle')

    try {
      const response = await requestCompanionAnswer(companionRequest, gatewayUrl)
      setAnswer(response.nextAction ? `${response.answer}\n\nTry next: ${response.nextAction}` : response.answer)
    } catch {
      setGatewayError('Companion unavailable. Copy the object-room prompt instead.')
    } finally {
      setIsAsking(false)
    }
  }

  return (
    <section id="object-room-prototype" className="object-room-prototype" aria-labelledby="object-room-title" data-testid="object-room-prototype">
      <div className="object-room-header">
        <div>
          <p>{roomEyebrow}</p>
          <h2 id="object-room-title">{roomTitle}</h2>
        </div>
        <span>Local distilled room</span>
      </div>

      <div className="object-room-current" aria-label="Current object room context">
        <div>
          <span>{objectTypeLabel}</span>
          <strong>{objectTitle}</strong>
          <p>{objectQuestion}</p>
        </div>
        <aside>
          <em>{objectContext}</em>
          {objectKeyLabel ? <code>{objectKeyLabel}</code> : null}
        </aside>
      </div>

      <div className="object-room-card-grid" aria-label="Structured object-room contributions">
        {contributions.map((contribution) => (
          <article key={contribution.id} className={`object-room-card ${contribution.tone}`} data-testid="object-room-card">
            <span>{contribution.label}</span>
            <strong>{contribution.title}</strong>
            <p>{contribution.body}</p>
            <em>{contribution.meta}</em>
          </article>
        ))}
      </div>

      <div className="object-room-ai-handoff" aria-label="Grounded object room AI handoff" data-testid="object-room-ai-handoff">
        <div>
          <span>Grounded AI handoff</span>
          <strong>Ask from the room packet, not generic attention lore.</strong>
          <p>{objectRoomPrompt}</p>
        </div>
        {answer || gatewayError ? (
          <section className={gatewayError ? 'handoff-answer error' : 'handoff-answer'} aria-live="polite">
            <span>{gatewayError ? 'Status' : 'Companion draft'}</span>
            <p>{gatewayError || answer}</p>
          </section>
        ) : null}
        <div className="handoff-actions">
          {gatewayReady ? (
            <button type="button" onClick={askCompanion} disabled={isAsking}>
              {isAsking ? 'Asking...' : 'Ask companion'}
            </button>
          ) : null}
          <button type="button" onClick={copyObjectRoomPrompt}>
            {copyStatus === 'copied'
              ? 'Copied room prompt'
              : copyStatus === 'error'
                ? 'Copy failed'
                : gatewayReady
                  ? 'Copy room prompt'
                  : 'Copy for AI'}
          </button>
        </div>
      </div>

      <div className="object-room-actions" aria-label="Object room actions">
        <a href={roomHref} onClick={onRememberObject}>Ask with this object</a>
        <a href={predictionHref} onClick={onRememberObject}>Run prediction</a>
        <a href={codeHref} onClick={onRememberObject}>Inspect code witness</a>
      </div>

      <style jsx>{`
        .object-room-prototype {
          display: grid;
          gap: 0.82rem;
          min-width: 0;
          padding: 0.95rem;
          border-radius: 22px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background:
            linear-gradient(135deg, rgba(21, 40, 47, 0.96), rgba(23, 32, 42, 0.94)),
            #17202a;
          box-shadow: 0 18px 44px rgba(8, 16, 26, 0.16);
          color: #fffaf0;
        }

        .object-room-header,
        .object-room-current,
        .object-room-actions {
          min-width: 0;
        }

        .object-room-header {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 0.8rem;
        }

        .object-room-header div {
          display: grid;
          gap: 0.28rem;
          min-width: 0;
        }

        .object-room-header p,
        .object-room-current span,
        .object-room-card span {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.66rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .object-room-header p {
          color: #62d4d0;
        }

        .object-room-header h2 {
          margin: 0;
          color: #fffaf0;
          font-family: var(--font-display);
          font-size: clamp(1.35rem, 2.2vw, 1.95rem);
          line-height: 1.05;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }

        .object-room-header > span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 2rem;
          max-width: 12rem;
          padding: 0.32rem 0.58rem;
          border-radius: 999px;
          border: 1px solid rgba(244, 192, 111, 0.28);
          background: rgba(244, 192, 111, 0.11);
          color: #f9e0aa;
          font-size: 0.72rem;
          font-weight: 760;
          line-height: 1.1;
          text-align: center;
        }

        .object-room-current {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(13rem, 0.52fr);
          gap: 0.7rem;
          padding: 0.76rem;
          border-radius: 14px;
          border: 1px solid rgba(255, 250, 240, 0.12);
          background: rgba(255, 250, 240, 0.07);
        }

        .object-room-current > div,
        .object-room-current aside {
          display: grid;
          align-content: start;
          gap: 0.28rem;
          min-width: 0;
        }

        .object-room-current span {
          color: #f4c06f;
        }

        .object-room-current strong {
          color: #fffaf0;
          font-size: 1rem;
          line-height: 1.18;
          overflow-wrap: anywhere;
        }

        .object-room-current p {
          margin: 0;
          color: rgba(239, 247, 245, 0.82);
          line-height: 1.45;
          overflow-wrap: anywhere;
        }

        .object-room-current em {
          color: rgba(239, 247, 245, 0.76);
          font-style: normal;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .object-room-current code {
          display: block;
          max-width: 100%;
          overflow-x: auto;
          padding: 0.42rem 0.48rem;
          border-radius: 8px;
          border: 1px solid rgba(255, 250, 240, 0.12);
          background: rgba(7, 14, 22, 0.26);
          color: #dceff0;
          font-size: 0.68rem;
          white-space: nowrap;
        }

        .object-room-card-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.58rem;
          min-width: 0;
        }

        .object-room-card {
          display: grid;
          align-content: start;
          gap: 0.42rem;
          min-width: 0;
          min-height: 13rem;
          padding: 0.72rem;
          border-radius: 8px;
          border: 1px solid rgba(255, 250, 240, 0.12);
          background: rgba(255, 250, 240, 0.92);
          color: #17202a;
        }

        .object-room-card.question {
          border-top: 4px solid #62d4d0;
        }

        .object-room-card.teaching {
          border-top: 4px solid #f4c06f;
        }

        .object-room-card.practice {
          border-top: 4px solid #8ba6d9;
        }

        .object-room-card.source {
          border-top: 4px solid #c45a4a;
        }

        .object-room-card.ai {
          border-top: 4px solid #8f7ac8;
        }

        .object-room-card.open {
          border-top: 4px solid #bf6b43;
        }

        .object-room-card.experiment {
          border-top: 4px solid #2f7a78;
        }

        .object-room-card span {
          color: #1f6f78;
          font-size: 0.6rem;
        }

        .object-room-card.source span,
        .object-room-card.open span {
          color: #b24b3f;
        }

        .object-room-card strong {
          color: #17202a;
          font-size: 0.92rem;
          line-height: 1.24;
          overflow-wrap: anywhere;
        }

        .object-room-card p {
          margin: 0;
          color: #52606b;
          font-size: 0.78rem;
          line-height: 1.42;
          overflow-wrap: anywhere;
        }

        .object-room-card em {
          align-self: end;
          color: #6b7280;
          font-family: var(--font-mono);
          font-size: 0.62rem;
          font-style: normal;
          letter-spacing: 0.07em;
          line-height: 1.28;
          text-transform: uppercase;
          overflow-wrap: anywhere;
        }

        .object-room-ai-handoff {
          display: grid;
          gap: 0.55rem;
          min-width: 0;
          padding: 0.74rem;
          border-radius: 14px;
          border: 1px solid rgba(98, 212, 208, 0.2);
          background: rgba(7, 14, 22, 0.22);
        }

        .object-room-ai-handoff > div:first-child {
          display: grid;
          gap: 0.3rem;
          min-width: 0;
        }

        .object-room-ai-handoff span,
        .handoff-answer span {
          color: #62d4d0;
          font-family: var(--font-mono);
          font-size: 0.62rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .object-room-ai-handoff strong {
          color: #fffaf0;
          line-height: 1.24;
          overflow-wrap: anywhere;
        }

        .object-room-ai-handoff p {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 5;
          margin: 0;
          overflow: hidden;
          color: rgba(239, 247, 245, 0.78);
          font-size: 0.76rem;
          line-height: 1.42;
          overflow-wrap: anywhere;
          white-space: pre-line;
        }

        .handoff-answer {
          display: grid;
          gap: 0.24rem;
          min-width: 0;
          padding: 0.58rem;
          border-radius: 10px;
          border: 1px solid rgba(244, 192, 111, 0.22);
          background: rgba(255, 250, 240, 0.08);
        }

        .handoff-answer.error {
          border-color: rgba(196, 90, 74, 0.28);
        }

        .handoff-answer p {
          -webkit-line-clamp: 7;
        }

        .handoff-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.42rem;
          min-width: 0;
        }

        .handoff-actions button {
          min-height: 2.75rem;
          padding: 0.42rem 0.62rem;
          border-radius: 8px;
          border: 1px solid rgba(255, 250, 240, 0.16);
          background: rgba(255, 250, 240, 0.92);
          color: #15282f;
          font: inherit;
          font-size: 0.76rem;
          font-weight: 850;
          cursor: pointer;
        }

        .handoff-actions button:first-child {
          background: #62d4d0;
        }

        .handoff-actions button:disabled {
          cursor: wait;
          opacity: 0.68;
        }

        .object-room-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.48rem;
        }

        .object-room-actions a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
          min-height: 2.75rem;
          padding: 0.42rem 0.56rem;
          border-radius: 8px;
          border: 1px solid rgba(255, 250, 240, 0.16);
          background: #f4c06f;
          color: #15282f;
          font-size: 0.78rem;
          font-weight: 850;
          line-height: 1.14;
          text-align: center;
          text-decoration: none;
          overflow-wrap: anywhere;
        }

        .object-room-actions a:nth-child(2) {
          background: #62d4d0;
        }

        .object-room-actions a:nth-child(3) {
          background: #fffaf0;
        }

        .object-room-actions a:hover {
          transform: translateY(-1px);
          text-shadow: none;
        }

        @media (max-width: 980px) {
          .object-room-card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .object-room-prototype {
            gap: 0.58rem;
            padding: 0.58rem;
            border-radius: 14px;
            box-shadow: none;
          }

          .object-room-header {
            align-items: stretch;
            flex-direction: column;
            gap: 0.42rem;
          }

          .object-room-header h2 {
            font-size: 1.1rem;
          }

          .object-room-header p,
          .object-room-current span,
          .object-room-card span {
            font-size: 0.54rem;
          }

          .object-room-header > span {
            width: fit-content;
            min-height: 1.65rem;
            font-size: 0.62rem;
          }

          .object-room-current {
            grid-template-columns: 1fr;
            gap: 0.48rem;
            padding: 0.58rem;
            border-radius: 12px;
          }

          .object-room-current strong {
            font-size: 0.88rem;
          }

          .object-room-current p,
          .object-room-current em {
            font-size: 0.72rem;
            line-height: 1.34;
          }

          .object-room-card-grid {
            grid-template-columns: 1fr;
            gap: 0.44rem;
          }

          .object-room-card {
            min-height: 0;
            gap: 0.34rem;
            padding: 0.58rem;
          }

          .object-room-card strong {
            font-size: 0.82rem;
          }

          .object-room-card p {
            font-size: 0.7rem;
            line-height: 1.34;
          }

          .object-room-card em {
            font-size: 0.55rem;
          }

          .object-room-ai-handoff {
            gap: 0.44rem;
            padding: 0.58rem;
            border-radius: 12px;
          }

          .object-room-ai-handoff span,
          .handoff-answer span {
            font-size: 0.55rem;
          }

          .object-room-ai-handoff strong {
            font-size: 0.82rem;
          }

          .object-room-ai-handoff p {
            -webkit-line-clamp: 4;
            font-size: 0.7rem;
            line-height: 1.34;
          }

          .handoff-actions {
            display: grid;
          }

          .handoff-actions button {
            min-height: 2.75rem;
            font-size: 0.7rem;
          }

          .object-room-actions {
            grid-template-columns: 1fr;
            gap: 0.36rem;
          }

          .object-room-actions a {
            min-height: 2.75rem;
            font-size: 0.7rem;
          }
        }
      `}</style>
    </section>
  )
}
