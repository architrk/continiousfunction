import { useEffect, useMemo, useState } from 'react'
import katex from 'katex'
import type { DiscussionAnchorListItem } from '@/lib/discussionAnchors'
import { isDiscussionAnchorListItem } from '@/lib/discussionAnchors'
import { isContentObjectKey, type ContentObjectKey } from '@/lib/contentObjectKeys'
import {
  clearLocalObjectActionDraft,
  getLocalObjectActionDraft,
  getLocalObjectActionResolution,
  localObjectActionJournalEventName,
  saveLocalObjectActionDraft,
  saveLocalObjectActionResolution,
  type LocalObjectActionDraft,
  type LocalObjectActionResolution,
} from '@/lib/localObjectActionJournal'
import {
  getSavedLearningRouteSnapshot,
  learningRouteSnapshotEventName,
  type LearningRouteSnapshot,
  type LearningRouteSourceObject,
} from '@/lib/learningRouteSnapshot'
import {
  buildResearchDiscussionRoomPacket,
  type ResearchDiscussionCarriedObservation,
  type ResearchDiscussionRoomContext,
} from '@/lib/researchDiscussionRoom'
import { sanitizeRenderedHtml } from '@/lib/htmlSafety'

type ResearchReadingRoomProps = {
  eyebrow?: string
  title?: string
  intro?: string
  items: DiscussionAnchorListItem[]
  variant?: 'panel' | 'compact'
  draftMode?: 'full' | 'progressive'
  showAnchorIds?: boolean
  preferredAnchorId?: string
  objectRoomContext?: ResearchDiscussionRoomContext | ((item: DiscussionAnchorListItem) => ResearchDiscussionRoomContext | undefined)
  onFocusObject?: (item: DiscussionAnchorListItem, sourceObject: LearningRouteSourceObject) => void
}

function isMathLikeEquationLabel(value: string) {
  return /\\[a-zA-Z]+|[_^=]|[{}]/.test(value)
}

function renderInlineEquationHtml(value: string) {
  try {
    return sanitizeRenderedHtml(
      katex.renderToString(value.trim(), {
        displayMode: false,
        output: 'html',
        throwOnError: true,
        strict: 'ignore',
        trust: false,
      })
    )
  } catch {
    return null
  }
}

function compactSuggestion(value: string, limit: number) {
  const trimmed = value.trim()
  if (trimmed.length <= limit) return trimmed
  if (limit <= 3) return trimmed.slice(0, limit)
  return `${trimmed.slice(0, limit - 3).trimEnd()}...`
}

function ObjectContextLabel({ item }: { item: DiscussionAnchorListItem }) {
  const contextLabel = item.anchor.contextLabel
  if (!contextLabel) return null

  if (item.anchor.objectType !== 'equation' || !isMathLikeEquationLabel(contextLabel)) {
    return <em>{contextLabel}</em>
  }

  const equationHtml = renderInlineEquationHtml(contextLabel)
  if (!equationHtml) return <em>Equation snippet</em>

  return (
    <em
      className="object-context-equation"
      aria-label={`Rendered equation snippet: ${item.anchor.title}`}
      dangerouslySetInnerHTML={{ __html: equationHtml }}
    />
  )
}

export default function ResearchReadingRoom({
  eyebrow = 'Research Room',
  title = 'Discuss the exact object',
  intro,
  items,
  variant = 'panel',
  draftMode,
  showAnchorIds = false,
  preferredAnchorId,
  objectRoomContext,
  onFocusObject,
}: ResearchReadingRoomProps) {
  const safeItems = useMemo(() => items.filter(isDiscussionAnchorListItem), [items])
  const [selectedAnchorId, setSelectedAnchorId] = useState<string>(
    preferredAnchorId && safeItems.some((item) => item.anchor.id === preferredAnchorId)
      ? preferredAnchorId
      : safeItems[0]?.anchor.id ?? ''
  )
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [routeSnapshot, setRouteSnapshot] = useState<LearningRouteSnapshot | null>(null)
  const [localDraft, setLocalDraft] = useState<LocalObjectActionDraft | null>(null)
  const [localResolution, setLocalResolution] = useState<LocalObjectActionResolution | null>(null)
  const [draftEditorObjectKey, setDraftEditorObjectKey] = useState<ContentObjectKey | null>(null)
  const [draftNote, setDraftNote] = useState('')
  const [draftNextAction, setDraftNextAction] = useState('')
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saved' | 'cleared' | 'resolved' | 'error'>('idle')

  useEffect(() => {
    if (!safeItems.length) {
      setSelectedAnchorId('')
      return
    }

    if (preferredAnchorId && safeItems.some((item) => item.anchor.id === preferredAnchorId)) {
      setSelectedAnchorId(preferredAnchorId)
      return
    }

    if (!safeItems.some((item) => item.anchor.id === selectedAnchorId)) {
      setSelectedAnchorId(safeItems[0].anchor.id)
    }
  }, [preferredAnchorId, safeItems, selectedAnchorId])

  const selectedItem = safeItems.find((item) => item.anchor.id === selectedAnchorId) ?? safeItems[0]
  const selectedObjectKey: ContentObjectKey | null =
    selectedItem?.anchor.objectKey && isContentObjectKey(selectedItem.anchor.objectKey)
      ? selectedItem.anchor.objectKey
      : null

  useEffect(() => {
    const refreshSnapshot = () => setRouteSnapshot(getSavedLearningRouteSnapshot())
    refreshSnapshot()

    window.addEventListener('storage', refreshSnapshot)
    window.addEventListener(learningRouteSnapshotEventName, refreshSnapshot)
    return () => {
      window.removeEventListener('storage', refreshSnapshot)
      window.removeEventListener(learningRouteSnapshotEventName, refreshSnapshot)
    }
  }, [])

  useEffect(() => {
    const currentAnchorId = routeSnapshot?.currentObject?.discussionAnchorId
    if (!currentAnchorId || currentAnchorId === selectedAnchorId) return
    if (!safeItems.some((item) => item.anchor.id === currentAnchorId)) return

    setSelectedAnchorId(currentAnchorId)
    setCopyStatus('idle')
  }, [routeSnapshot, safeItems, selectedAnchorId])

  useEffect(() => {
    const refreshDraft = () => {
      const nextDraft = getLocalObjectActionDraft(selectedObjectKey)
      const nextResolution = getLocalObjectActionResolution(selectedObjectKey)
      setLocalDraft(nextDraft)
      setLocalResolution(nextResolution)
      setDraftEditorObjectKey(selectedObjectKey)
      setDraftNote(nextDraft?.note ?? '')
      setDraftNextAction(nextDraft?.nextAction ?? '')
    }

    refreshDraft()
    setDraftStatus('idle')

    window.addEventListener('storage', refreshDraft)
    window.addEventListener(localObjectActionJournalEventName, refreshDraft)
    return () => {
      window.removeEventListener('storage', refreshDraft)
      window.removeEventListener(localObjectActionJournalEventName, refreshDraft)
    }
  }, [selectedObjectKey])

  const carriedObservation: ResearchDiscussionCarriedObservation | undefined =
    routeSnapshot?.currentObject?.discussionAnchorId === selectedItem?.anchor.id && routeSnapshot.lastObservation
      ? {
          label: routeSnapshot.lastObservation.label,
          value: routeSnapshot.lastObservation.value,
          detail: routeSnapshot.lastObservation.detail,
          nextQuestion: routeSnapshot.lastObservation.nextQuestion,
          source: routeSnapshot.lastObservation.source,
        }
      : undefined
  const selectedLocalDraft = localDraft?.objectKey === selectedObjectKey ? localDraft : null
  const selectedLocalResolution = localResolution?.objectKey === selectedObjectKey ? localResolution : null
  const selectedObjectRoomContext: ResearchDiscussionRoomContext | undefined =
    selectedItem
      ? typeof objectRoomContext === 'function'
        ? objectRoomContext(selectedItem)
        : objectRoomContext
      : undefined
  const draftEditorMatchesSelection = draftEditorObjectKey === selectedObjectKey
  const selectedDraftNote = draftEditorMatchesSelection ? draftNote : ''
  const selectedDraftNextAction = draftEditorMatchesSelection ? draftNextAction : ''
  const packet = selectedItem
    ? buildResearchDiscussionRoomPacket(
        selectedItem,
        carriedObservation,
        selectedLocalDraft ?? undefined,
        selectedObjectRoomContext
      )
    : null

  if (!selectedItem || !packet) return null

  const focusItem = (item: DiscussionAnchorListItem) => {
    const nextPacket = buildResearchDiscussionRoomPacket(item)
    const nextObjectKey =
      item.anchor.objectKey && isContentObjectKey(item.anchor.objectKey) ? item.anchor.objectKey : null
    if (item.anchor.id === selectedItem.anchor.id) {
      setCopyStatus('idle')
      onFocusObject?.(item, nextPacket.routeObject)
      return
    }

    setSelectedAnchorId(item.anchor.id)
    setCopyStatus('idle')
    setLocalDraft(null)
    setLocalResolution(null)
    setDraftEditorObjectKey(nextObjectKey)
    setDraftNote('')
    setDraftNextAction('')
    setDraftStatus('idle')
    onFocusObject?.(item, nextPacket.routeObject)
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(packet.aiPrompt)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
  }

  const saveDraft = () => {
    if (!selectedObjectKey) {
      setDraftStatus('error')
      return
    }

    const saved = saveLocalObjectActionDraft({
      version: 'cf-object-action-draft-v1',
      objectKey: selectedObjectKey,
      objectTitle: selectedItem.anchor.title,
      note: selectedDraftNote,
      nextAction: selectedDraftNextAction,
      updatedAt: new Date().toISOString(),
      source: 'research-reading-room',
    })

    setDraftStatus(saved ? 'saved' : 'error')
  }

  const clearDraft = () => {
    if (!selectedObjectKey) {
      setDraftStatus('error')
      return
    }

    const cleared = clearLocalObjectActionDraft(selectedObjectKey)
    if (cleared) {
      setLocalDraft(null)
      setDraftNote('')
      setDraftNextAction('')
      setDraftEditorObjectKey(selectedObjectKey)
    }
    setDraftStatus(cleared ? 'cleared' : 'error')
  }

  const resolveDraft = () => {
    if (!selectedObjectKey || !selectedLocalDraft) {
      setDraftStatus('error')
      return
    }

    const saved = saveLocalObjectActionResolution({
      version: 'cf-object-action-resolution-v1',
      objectKey: selectedObjectKey,
      objectTitle: selectedItem.anchor.title,
      resolvedAction: selectedLocalDraft.nextAction,
      resolutionNote: selectedDraftNote.trim() || selectedLocalDraft.note,
      updatedAt: new Date().toISOString(),
      source: 'research-reading-room',
    })

    if (saved) {
      setLocalDraft(null)
      setLocalResolution(getLocalObjectActionResolution(selectedObjectKey))
      setDraftNote('')
      setDraftNextAction('')
      setDraftEditorObjectKey(selectedObjectKey)
    }
    setDraftStatus(saved ? 'resolved' : 'error')
  }

  const canSaveDraft = Boolean(selectedObjectKey && selectedDraftNote.trim() && selectedDraftNextAction.trim())
  const draftStatusText = (() => {
    if (draftStatus === 'saved') return 'Saved locally in this browser.'
    if (draftStatus === 'cleared') return 'Local draft cleared.'
    if (draftStatus === 'resolved') return 'Marked resolved in this browser.'
    if (draftStatus === 'error') return 'Local draft could not be saved.'
    if (selectedLocalDraft) return `Last saved ${new Date(selectedLocalDraft.updatedAt).toLocaleString()}`
    if (selectedLocalResolution) return `Resolved ${new Date(selectedLocalResolution.updatedAt).toLocaleString()}`
    return 'No local draft saved.'
  })()
  const isPredictionObservation = packet.carriedObservation?.source === 'prediction-checkpoint'
  const carriedNextQuestion = isPredictionObservation ? packet.carriedObservation?.nextQuestion?.trim() : undefined
  const suggestedNextAction =
    !selectedLocalDraft && !selectedLocalResolution && carriedNextQuestion
      ? compactSuggestion(`Answer the carried question: ${carriedNextQuestion}`, 180)
      : undefined
  const suggestedDraftNote =
    !selectedLocalDraft && !selectedLocalResolution && isPredictionObservation && packet.carriedObservation
      ? compactSuggestion(`Prediction observation: ${packet.carriedObservation.value}`, 800)
      : undefined
  const draftSummaryTitle =
    selectedLocalDraft?.nextAction ??
    (selectedLocalResolution ? `Resolved: ${selectedLocalResolution.resolvedAction}` : suggestedNextAction) ??
    (selectedObjectKey ? 'No local draft saved yet' : 'Draft unavailable')
  const draftSummaryDetail = (() => {
    if (selectedLocalDraft?.note) return selectedLocalDraft.note
    if (selectedLocalResolution?.resolutionNote) return selectedLocalResolution.resolutionNote
    if (suggestedNextAction) {
      return 'Suggested by the carried prediction observation. Expand to save or replace it locally.'
    }
    if (selectedObjectKey) return 'Open the draft below to save one note and next action in this browser.'
    return 'This object needs a content object key before local action drafts can attach to it.'
  })()
  const useProgressiveDraft = draftMode === 'progressive' || variant === 'compact'
  const progressiveDraftHint = selectedObjectKey
    ? selectedLocalDraft
      ? 'Saved draft summarized above; expand to edit'
      : selectedLocalResolution
        ? 'Resolved locally; expand to save a new action'
      : suggestedNextAction
        ? 'Prediction suggests this next action; expand to save'
        : 'Expand only when ready to capture one local next action'
    : 'Needs a canonical object key'
  const observationSummaryLabel =
    packet.carriedObservation?.source === 'prediction-checkpoint'
      ? 'Carried prediction observation'
      : 'Carried route observation'
  const showCompactStateStrip = variant === 'compact' && Boolean(packet.carriedObservation || selectedObjectKey)
  const evidenceNotebookSteps = [
    {
      step: '01',
      label: 'Predict',
      detail: packet.carriedObservation?.label ?? 'Commit before reveal',
    },
    {
      step: '02',
      label: 'Observe',
      detail: packet.carriedObservation?.value ?? 'Attach the first observation',
    },
    {
      step: '03',
      label: 'Ground',
      detail: `${packet.evidenceChecklist.length} evidence check${packet.evidenceChecklist.length === 1 ? '' : 's'} ready`,
    },
    {
      step: '04',
      label: 'Carry',
      detail: selectedLocalDraft?.nextAction ?? selectedLocalResolution?.resolvedAction ?? suggestedNextAction ?? 'Save one next action',
    },
  ]
  const draftCopy = (
    <div>
      <span>Local action draft</span>
      {selectedObjectKey ? (
        <p>This draft stays locally in this browser for <code>{selectedObjectKey}</code>.</p>
      ) : (
        <p>This object needs a content object key before local action drafts can attach to it.</p>
      )}
    </div>
  )
  const draftFields = (
    <>
      <label>
        <span>Draft note</span>
        <textarea
          value={selectedDraftNote}
          onChange={(event) => {
            setDraftEditorObjectKey(selectedObjectKey)
            setDraftNote(event.target.value)
            setDraftStatus('idle')
          }}
          maxLength={800}
          disabled={!selectedObjectKey}
          placeholder={suggestedDraftNote}
        />
      </label>
      <label>
        <span>Next action</span>
        <input
          type="text"
          value={selectedDraftNextAction}
          onChange={(event) => {
            setDraftEditorObjectKey(selectedObjectKey)
            setDraftNextAction(event.target.value)
            setDraftStatus('idle')
          }}
          maxLength={180}
          disabled={!selectedObjectKey}
          placeholder={suggestedNextAction}
        />
      </label>
      <div className="draft-actions">
        {suggestedNextAction ? (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setDraftEditorObjectKey(selectedObjectKey)
              if (!selectedDraftNote.trim() && suggestedDraftNote) setDraftNote(suggestedDraftNote)
              if (!selectedDraftNextAction.trim()) setDraftNextAction(suggestedNextAction)
              setDraftStatus('idle')
            }}
            disabled={!selectedObjectKey}
          >
            Use carried observation
          </button>
        ) : null}
        <button type="button" onClick={saveDraft} disabled={!canSaveDraft}>
          Save local draft
        </button>
        {selectedLocalDraft ? (
          <button type="button" className="secondary" onClick={resolveDraft}>
            Mark resolved
          </button>
        ) : null}
        <button
          type="button"
          className="secondary"
          onClick={clearDraft}
          disabled={!selectedObjectKey || (!selectedLocalDraft && !selectedDraftNote && !selectedDraftNextAction)}
        >
          Clear
        </button>
        <em role="status">{draftStatusText}</em>
      </div>
    </>
  )

  return (
    <section className={`research-reading-room ${variant}`} aria-labelledby="research-reading-room-title">
      <div className="room-heading">
        <p>{eyebrow}</p>
        <h3 id="research-reading-room-title">{title}</h3>
        {intro ? <span>{intro}</span> : null}
      </div>

      {showCompactStateStrip ? (
        <div className="room-state-strip" aria-label="Drawer route state summary">
          {packet.carriedObservation ? (
            <section className="room-state-card observation">
              <span>{observationSummaryLabel}</span>
              <strong>{packet.carriedObservation.value}</strong>
              {packet.carriedObservation.detail ? <p>{packet.carriedObservation.detail}</p> : null}
            </section>
          ) : null}
          <section className="room-state-card draft">
            <span>{selectedLocalResolution && !selectedLocalDraft ? 'Resolved local action' : 'Next local action'}</span>
            <strong>{draftSummaryTitle}</strong>
            <p>{draftSummaryDetail}</p>
            {selectedLocalDraft ? <em>{draftStatusText}</em> : null}
            {selectedLocalResolution && !selectedLocalDraft ? <em>{draftStatusText}</em> : null}
            {selectedLocalDraft ? (
              <button type="button" onClick={resolveDraft}>
                Mark action resolved
              </button>
            ) : null}
          </section>
        </div>
      ) : null}

      <div className="room-layout">
        <div className="object-rail" aria-label="Research discussion objects">
          {safeItems.map((item) => {
            const itemPacket = buildResearchDiscussionRoomPacket(item)
            return (
              <button
                key={item.anchor.id}
                type="button"
                className={item.anchor.id === selectedItem.anchor.id ? 'active' : ''}
                onClick={() => focusItem(item)}
              >
                <span>{itemPacket.objectTypeLabel}</span>
                <strong>{item.anchor.title}</strong>
                <ObjectContextLabel item={item} />
              </button>
            )
          })}
        </div>

        <article className="room-detail">
          <div className="object-meta">
            <span>{packet.objectTypeLabel}</span>
            <ObjectContextLabel item={selectedItem} />
          </div>

          <div className="evidence-notebook-strip" aria-label="Prediction to evidence notebook loop">
            {evidenceNotebookSteps.map((step) => (
              <section key={step.step}>
                <span>{step.step}</span>
                <strong>{step.label}</strong>
                <em>{step.detail}</em>
              </section>
            ))}
          </div>

          <h4>{selectedItem.anchor.title}</h4>

          <div className="question-block">
            <span>Anchored question</span>
            <p>{selectedItem.thread.seedPrompt}</p>
          </div>

          {packet.carriedObservation ? (
            <div className="carried-observation" aria-label="Carried route observation">
              <span>{observationSummaryLabel}</span>
              <strong>{packet.carriedObservation.value}</strong>
              {packet.carriedObservation.detail ? <p>{packet.carriedObservation.detail}</p> : null}
            </div>
          ) : null}

          {useProgressiveDraft ? (
            <details
              className={
                selectedObjectKey
                  ? 'local-action-draft compact-draft progressive'
                  : 'local-action-draft compact-draft progressive muted'
              }
              aria-label="Local action draft"
            >
              <summary>
                <span>Local action draft</span>
                <strong>{draftSummaryTitle}</strong>
                <em>{progressiveDraftHint}</em>
              </summary>
              <div className="local-action-draft-fields">
                {draftCopy}
                {draftFields}
              </div>
            </details>
          ) : (
            <div className={selectedObjectKey ? 'local-action-draft' : 'local-action-draft muted'} aria-label="Local action draft">
              {draftCopy}
              {draftFields}
            </div>
          )}

          <div className="room-columns">
            <section aria-label="Evidence to inspect">
              <span>Evidence to inspect</span>
              <ul>
                {packet.evidenceChecklist.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </section>

            <section aria-label="Resolution rubric">
              <span>What would resolve this</span>
              <ul>
                {packet.resolutionRubric.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </section>
          </div>

          <div className="prompt-block">
            <span>Grounded AI handoff</span>
            <p>{packet.aiPrompt}</p>
          </div>

          <div className="room-actions">
            <button type="button" onClick={copyPrompt}>
              {copyStatus === 'copied' ? 'Copied prompt' : copyStatus === 'error' ? 'Copy failed' : 'Copy research prompt'}
            </button>
            {selectedItem.anchor.href ? <a href={selectedItem.anchor.href}>Open source object</a> : null}
          </div>

          {showAnchorIds ? (
            <code>{selectedItem.anchor.objectKey ? `${selectedItem.anchor.id}\n${selectedItem.anchor.objectKey}` : selectedItem.anchor.id}</code>
          ) : null}
        </article>
      </div>

      <style jsx>{`
        .research-reading-room {
          display: grid;
          gap: 0.85rem;
          min-width: 0;
          padding: 0.95rem;
          border: 1px solid rgba(27, 36, 48, 0.09);
          border-radius: 20px;
          background: rgba(255, 251, 245, 0.84);
          box-shadow: 0 16px 32px rgba(27, 36, 48, 0.05);
        }

        .research-reading-room.compact {
          padding: 0.82rem;
          border-radius: 18px;
          box-shadow: none;
        }

        .room-heading,
        .room-detail,
        .object-rail,
        .room-columns section {
          min-width: 0;
        }

        .room-heading {
          display: grid;
          gap: 0.34rem;
        }

        .room-heading p,
        .object-meta span,
        .question-block span,
        .room-columns span,
        .prompt-block span,
        .object-rail span {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .room-heading p {
          margin: 0;
          color: #1f6f78;
        }

        .room-heading h3,
        .room-detail h4 {
          margin: 0;
          color: #151d27;
          line-height: 1.1;
          overflow-wrap: break-word;
        }

        .room-heading h3 {
          font-size: clamp(1.2rem, 2vw, 1.5rem);
        }

        .room-heading h3::before,
        .room-detail h4::before {
          content: none;
          display: none;
        }

        .room-heading span {
          color: #52606c;
          line-height: 1.55;
          overflow-wrap: break-word;
        }

        .room-layout {
          display: grid;
          grid-template-columns: minmax(210px, 0.34fr) minmax(0, 1fr);
          gap: 0.7rem;
          min-width: 0;
        }

        .room-state-strip {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
          min-width: 0;
        }

        .room-state-card {
          display: grid;
          gap: 0.24rem;
          min-width: 0;
          padding: 0.64rem;
          border-radius: 14px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.78);
        }

        .room-state-card.observation {
          border-color: rgba(31, 111, 120, 0.16);
          background: rgba(231, 248, 244, 0.68);
        }

        .room-state-card span {
          font-family: var(--font-mono);
          font-size: 0.62rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        .room-state-card.draft span {
          color: #c24a2d;
        }

        .room-state-card strong,
        .compact-draft summary strong {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
          color: #151d27;
          line-height: 1.28;
          overflow-wrap: anywhere;
        }

        .room-state-card p,
        .room-state-card em {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          margin: 0;
          overflow: hidden;
          color: #52606c;
          font-size: 0.78rem;
          font-style: normal;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .room-state-card button {
          width: max-content;
          max-width: 100%;
          min-height: 32px;
          padding: 0.44rem 0.62rem;
          border-radius: 999px;
          border: 1px solid rgba(194, 74, 45, 0.22);
          background: rgba(255, 251, 245, 0.9);
          color: #1b2430;
          font: inherit;
          font-size: 0.78rem;
          font-weight: 740;
          cursor: pointer;
        }

        .object-rail {
          display: grid;
          gap: 0.5rem;
          align-content: start;
        }

        .object-rail button {
          display: grid;
          gap: 0.3rem;
          min-height: 82px;
          padding: 0.7rem;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 14px;
          background: rgba(255, 251, 245, 0.86);
          color: #1b2430;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }

        .object-rail button.active,
        .object-rail button:hover {
          border-color: rgba(31, 111, 120, 0.24);
          background: rgba(231, 248, 244, 0.78);
          transform: translateY(-1px);
        }

        .object-rail span,
        .question-block span,
        .carried-observation span,
        .room-columns span,
        .prompt-block span {
          color: #c24a2d;
        }

        .object-rail strong {
          color: #151d27;
          line-height: 1.3;
          overflow-wrap: break-word;
        }

        .object-rail em,
        .object-meta em {
          color: #65717d;
          font-size: 0.82rem;
          font-style: normal;
          line-height: 1.35;
          overflow-wrap: break-word;
        }

        .object-context-equation {
          display: block;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
        }

        .object-context-equation :global(.katex) {
          color: #33404d;
          font-size: 0.86rem;
          line-height: 1.25;
          white-space: nowrap;
        }

        .room-detail {
          display: grid;
          align-content: start;
          gap: 0.7rem;
          padding: 0.85rem;
          border-radius: 16px;
          border: 1px solid rgba(31, 111, 120, 0.14);
          background: rgba(247, 252, 250, 0.76);
        }

        .object-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.42rem;
          align-items: center;
        }

        .object-meta span {
          width: max-content;
          max-width: 100%;
          padding: 0.22rem 0.42rem;
          border-radius: 999px;
          background: rgba(31, 111, 120, 0.1);
          color: #1f6f78;
        }

        .room-detail h4 {
          font-size: 1.08rem;
        }

        .question-block,
        .prompt-block,
        .local-action-draft,
        .local-action-draft label {
          display: grid;
          gap: 0.32rem;
          min-width: 0;
        }

        .evidence-notebook-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.44rem;
          min-width: 0;
        }

        .evidence-notebook-strip section {
          display: grid;
          align-content: start;
          gap: 0.16rem;
          min-width: 0;
          min-height: 4.55rem;
          padding: 0.56rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.72);
        }

        .evidence-notebook-strip section:nth-child(even) {
          background: rgba(231, 248, 244, 0.58);
        }

        .evidence-notebook-strip span {
          color: #c24a2d;
          font-family: var(--font-mono);
          font-size: 0.56rem;
          letter-spacing: 0.1em;
        }

        .evidence-notebook-strip strong {
          color: #151d27;
          line-height: 1.08;
        }

        .evidence-notebook-strip em {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
          color: #52606c;
          font-size: 0.7rem;
          font-style: normal;
          line-height: 1.24;
          overflow-wrap: anywhere;
        }

        .question-block p,
        .carried-observation p,
        .local-action-draft p,
        .prompt-block p,
        li {
          color: #455361;
          line-height: 1.55;
          overflow-wrap: break-word;
        }

        .local-action-draft {
          gap: 0.55rem;
          padding: 0.7rem;
          border-radius: 14px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.72);
        }

        .compact-draft {
          align-content: start;
        }

        .local-action-draft.muted {
          background: rgba(27, 36, 48, 0.04);
        }

        .compact-draft summary {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.18rem 0.55rem;
          align-items: center;
          min-width: 0;
          cursor: pointer;
          list-style: none;
        }

        .compact-draft summary::-webkit-details-marker {
          display: none;
        }

        .compact-draft summary::after {
          content: '+';
          display: inline-grid;
          place-items: center;
          width: 1.6rem;
          height: 1.6rem;
          border-radius: 999px;
          background: rgba(31, 111, 120, 0.1);
          color: #1f6f78;
          font-weight: 850;
        }

        .compact-draft[open] summary::after {
          content: '−';
        }

        .compact-draft summary > span {
          grid-column: 1 / 2;
        }

        .compact-draft summary strong {
          grid-column: 1 / 2;
          -webkit-line-clamp: 1;
        }

        .compact-draft summary em {
          grid-column: 1 / 3;
          color: #65717d;
          font-size: 0.78rem;
          font-style: normal;
          line-height: 1.35;
        }

        .local-action-draft-fields {
          display: grid;
          gap: 0.55rem;
          min-width: 0;
          margin-top: 0.6rem;
        }

        .local-action-draft p {
          margin: 0;
          font-size: 0.82rem;
        }

        .local-action-draft code {
          display: inline;
          width: auto;
          padding: 0;
          background: transparent;
          color: #1f6f78;
          font-size: inherit;
        }

        .local-action-draft label span,
        .local-action-draft > div > span,
        .local-action-draft-fields > div > span,
        .draft-actions em {
          color: #1f6f78;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .local-action-draft textarea,
        .local-action-draft input {
          min-width: 0;
          width: 100%;
          border: 1px solid rgba(27, 36, 48, 0.12);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.82);
          color: #1b2430;
          font: inherit;
          padding: 0.55rem 0.62rem;
        }

        .local-action-draft textarea {
          min-height: 5.5rem;
          resize: vertical;
        }

        .local-action-draft textarea:disabled,
        .local-action-draft input:disabled {
          cursor: not-allowed;
          opacity: 0.62;
        }

        .draft-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }

        .draft-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 0.48rem 0.68rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: #1f6f78;
          color: #fbf4e8;
          font: inherit;
          font-weight: 730;
          cursor: pointer;
        }

        .draft-actions button.secondary {
          background: rgba(255, 251, 245, 0.92);
          color: #1b2430;
        }

        .draft-actions button:disabled {
          cursor: not-allowed;
          opacity: 0.48;
        }

        .draft-actions em {
          color: #65717d;
          font-style: normal;
          letter-spacing: 0;
          text-transform: none;
        }

        .question-block p,
        .carried-observation p,
        .prompt-block p {
          margin: 0;
        }

        .carried-observation {
          display: grid;
          gap: 0.34rem;
          min-width: 0;
          padding: 0.7rem;
          border: 1px solid rgba(31, 111, 120, 0.16);
          border-radius: 14px;
          background: rgba(231, 248, 244, 0.74);
        }

        .carried-observation span {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        .carried-observation strong {
          color: #151d27;
          line-height: 1.35;
          overflow-wrap: break-word;
        }

        .room-columns {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.6rem;
        }

        .room-columns section {
          display: grid;
          gap: 0.38rem;
          padding: 0.7rem;
          border-radius: 14px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.72);
        }

        ul {
          display: grid;
          gap: 0.34rem;
          margin: 0;
          padding-left: 1.05rem;
        }

        .prompt-block {
          padding: 0.7rem;
          border-radius: 14px;
          border: 1px solid rgba(194, 74, 45, 0.16);
          background: rgba(255, 244, 238, 0.72);
        }

        .prompt-block p {
          max-height: 9.5rem;
          overflow: auto;
          white-space: pre-wrap;
        }

        .room-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
        }

        .room-actions button,
        .room-actions a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0.56rem 0.78rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: #1b2430;
          color: #fbf4e8;
          font: inherit;
          font-weight: 730;
          text-decoration: none;
          cursor: pointer;
        }

        .room-actions a {
          background: rgba(255, 251, 245, 0.92);
          color: #1b2430;
        }

        .room-actions button:hover,
        .room-actions a:hover {
          border-color: rgba(31, 111, 120, 0.28);
          background: #1f6f78;
          color: #fbf4e8;
          transform: translateY(-1px);
        }

        .object-rail button:focus-visible,
        .room-actions button:focus-visible,
        .room-actions a:focus-visible,
        .local-action-draft textarea:focus-visible,
        .local-action-draft input:focus-visible,
        .draft-actions button:focus-visible {
          outline: 2px solid rgba(31, 111, 120, 0.42);
          outline-offset: 2px;
        }

        code {
          width: fit-content;
          max-width: 100%;
          padding: 0.36rem 0.45rem;
          border-radius: 8px;
          background: rgba(27, 36, 48, 0.06);
          color: #33404d;
          font-size: 0.74rem;
          line-height: 1.35;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        @media (max-width: 960px) {
          .room-layout,
          .room-columns,
          .room-state-strip {
            grid-template-columns: 1fr;
          }

          .evidence-notebook-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .research-reading-room {
            padding: 0.78rem;
            border-radius: 16px;
          }

          .room-actions,
          .room-actions button,
          .room-actions a,
          .draft-actions,
          .draft-actions button {
            width: 100%;
          }

          .evidence-notebook-strip section {
            min-height: 4.2rem;
            padding: 0.5rem;
          }
        }
      `}</style>
    </section>
  )
}
