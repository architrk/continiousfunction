import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import {
  DISCUSSION_ANCHOR_VERSION,
  DISCUSSION_THREAD_PLACEHOLDER_VERSION,
  type DiscussionAnchorListItem,
} from '@/lib/discussionAnchors'
import { clearLearningRouteSnapshot, saveLearningRouteSnapshot } from '@/lib/learningRouteSnapshot'
import {
  clearLocalObjectActionJournal,
  getLocalObjectActionDraft,
  getLocalObjectActionResolution,
  localObjectActionJournalEventName,
  saveLocalObjectActionDraft,
} from '@/lib/localObjectActionJournal'
import ResearchReadingRoom from './ResearchReadingRoom'

const claimObjectKey = 'claim:llm-systems/llm-serving#iteration-scheduling-kv-cache-memory'
const equationObjectKey = 'equation:attention-transformers/rope#math-object-1'

const items: DiscussionAnchorListItem[] = [
  {
    anchor: {
      version: DISCUSSION_ANCHOR_VERSION,
      id: 'claim/attention-serving/what-is-compressed',
      objectType: 'claim',
      surface: 'attention-serving',
      title: 'KV compression claim',
      contextLabel: 'Paper claim',
      sourceIds: ['input'],
      objectKey: claimObjectKey,
    },
    thread: {
      version: DISCUSSION_THREAD_PLACEHOLDER_VERSION,
      anchorId: 'claim/attention-serving/what-is-compressed',
      state: 'placeholder',
      seedPrompt: 'What exactly is being compressed?',
    },
  },
  {
    anchor: {
      version: DISCUSSION_ANCHOR_VERSION,
      id: 'equation/attention-serving/kv-memory-symbol',
      objectType: 'equation',
      surface: 'attention-serving',
      title: 'Mem_KV equation',
      contextLabel: 'Equation',
      objectKey: equationObjectKey,
    },
    thread: {
      version: DISCUSSION_THREAD_PLACEHOLDER_VERSION,
      anchorId: 'equation/attention-serving/kv-memory-symbol',
      state: 'placeholder',
      seedPrompt: 'Which symbol does the method reduce?',
    },
  },
  {
    anchor: {
      version: DISCUSSION_ANCHOR_VERSION,
      id: 'misconception/attention-serving/not-object-keyed',
      objectType: 'misconception',
      surface: 'attention-serving',
      title: 'Unkeyed misconception',
      contextLabel: 'Draft disabled',
    },
    thread: {
      version: DISCUSSION_THREAD_PLACEHOLDER_VERSION,
      anchorId: 'misconception/attention-serving/not-object-keyed',
      state: 'placeholder',
      seedPrompt: 'Why can this not keep an object-attached action yet?',
    },
  },
]

describe('ResearchReadingRoom', () => {
  beforeEach(() => {
    clearLearningRouteSnapshot()
    clearLocalObjectActionJournal()
  })

  it('renders evidence, resolution, prompt handoff, and anchor id for the selected object', () => {
    render(<ResearchReadingRoom items={items} showAnchorIds />)

    expect(screen.getByText('Research Room')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'KV compression claim' })).toBeInTheDocument()
    expect(screen.getByText('Evidence to inspect')).toBeInTheDocument()
    expect(screen.getByText('What would resolve this')).toBeInTheDocument()
    expect(screen.getByText('Grounded AI handoff')).toBeInTheDocument()
    expect(screen.getAllByText(/claim\/attention-serving\/what-is-compressed/)).toHaveLength(2)
    expect(screen.getAllByText(/claim:llm-systems\/llm-serving#iteration-scheduling-kv-cache-memory/)).toHaveLength(3)
    expect(screen.getByText('Source ids to inspect: input')).toBeInTheDocument()
  })

  it('renders math-like equation context labels as KaTeX while preserving non-equation labels', () => {
    const rawEquationTex = String.raw`\mathrm{Attn}(Q,K,V)=\mathrm{softmax}(QK^\top/\sqrt{d})V`
    const rawTexItems: DiscussionAnchorListItem[] = [
      items[0],
      {
        ...items[1],
        anchor: {
          ...items[1].anchor,
          title: 'FlashAttention math objects',
          contextLabel: rawEquationTex,
        },
      },
    ]

    const { container } = render(<ResearchReadingRoom items={rawTexItems} />)

    expect(screen.getAllByText('Paper claim')).toHaveLength(2)
    expect(screen.queryByText(rawEquationTex)).not.toBeInTheDocument()
    expect(container.querySelectorAll('.object-context-equation .katex')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /equation flashattention math objects/i }))

    expect(container.querySelectorAll('.object-context-equation .katex')).toHaveLength(2)
  })

  it('focuses clicked objects and exposes their route source object', () => {
    const onFocusObject = jest.fn()
    render(<ResearchReadingRoom items={items} onFocusObject={onFocusObject} />)

    fireEvent.click(screen.getByRole('button', { name: /equation mem_kv equation equation/i }))

    expect(screen.getByText('Which symbol does the method reduce?')).toBeInTheDocument()
    expect(onFocusObject).toHaveBeenCalledWith(
      items[1],
      expect.objectContaining({
        type: 'equation',
        discussionAnchorId: 'equation/attention-serving/kv-memory-symbol',
        title: 'Mem_KV equation',
        objectKey: equationObjectKey,
      })
    )
  })

  it('can open with a preferred object already selected', () => {
    render(<ResearchReadingRoom items={items} preferredAnchorId="equation/attention-serving/kv-memory-symbol" />)

    expect(screen.getByRole('heading', { name: 'Mem_KV equation' })).toBeInTheDocument()
    expect(screen.getByText('Which symbol does the method reduce?')).toBeInTheDocument()
  })

  it('surfaces carried route observations for the selected discussion object', async () => {
    saveLearningRouteSnapshot({
      version: 'cf-route-snapshot-v1',
      source: 'concept-notebook',
      paperTitle: 'Concept notebook: Efficient Attention',
      inputKind: 'concept notebook',
      mappingId: 'concept:efficient-attention',
      routeLabels: ['Efficient Attention', 'LLM Serving'],
      routeConceptIds: ['efficient-attention', 'llm-serving'],
      sourceObjects: [
        {
          type: 'equation',
          id: 'kv-memory-symbol',
          discussionAnchorId: 'equation/attention-serving/kv-memory-symbol',
          title: 'Mem_KV equation',
        },
      ],
      currentObject: {
        type: 'equation',
        id: 'kv-memory-symbol',
        discussionAnchorId: 'equation/attention-serving/kv-memory-symbol',
        title: 'Mem_KV equation',
        status: 'prediction checkpoint revealed',
      },
      lastObservation: {
        label: 'Demo prediction',
        value: 'Prediction lens: An invariant holds',
        detail: 'Name what stays true while controls change.',
        nextQuestion: 'Which slider tests the central claim?',
        source: 'prediction-checkpoint',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
      createdAt: '2026-05-04T00:00:00.000Z',
    })

    render(<ResearchReadingRoom items={items} />)

    expect(await screen.findByRole('heading', { name: 'Mem_KV equation' })).toBeInTheDocument()
    expect(await screen.findByText('Carried prediction observation')).toBeInTheDocument()
    expect(screen.getByText('Prediction lens: An invariant holds')).toBeInTheDocument()
    expect(screen.getByText('Name what stays true while controls change.')).toBeInTheDocument()
    expect(screen.getByText(/Carried route observation:/)).toBeInTheDocument()
  })

  it('raises prediction observations and saved drafts into the compact drawer state strip', async () => {
    saveLearningRouteSnapshot({
      version: 'cf-route-snapshot-v1',
      source: 'concept-notebook',
      paperTitle: 'Concept notebook: Efficient Attention',
      inputKind: 'concept notebook',
      mappingId: 'concept:efficient-attention',
      routeLabels: ['Efficient Attention', 'LLM Serving'],
      routeConceptIds: ['efficient-attention', 'llm-serving'],
      currentObject: {
        type: 'equation',
        id: 'kv-memory-symbol',
        discussionAnchorId: 'equation/attention-serving/kv-memory-symbol',
        title: 'Mem_KV equation',
        status: 'prediction checkpoint revealed',
      },
      lastObservation: {
        label: 'Demo prediction',
        value: 'Prediction lens: An invariant holds',
        detail: 'Name what stays true while controls change.',
        nextQuestion: 'Which slider tests the central claim?',
        source: 'prediction-checkpoint',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
      createdAt: '2026-05-04T00:00:00.000Z',
    })
    saveLocalObjectActionDraft({
      version: 'cf-object-action-draft-v1',
      objectKey: equationObjectKey,
      objectTitle: 'Mem_KV equation',
      note: 'Equation note should sit above the full editor.',
      nextAction: 'Check the reduced symbol before moving on.',
      updatedAt: '2026-05-06T00:02:00.000Z',
      source: 'research-reading-room',
    })

    render(<ResearchReadingRoom items={items} variant="compact" />)

    expect(await screen.findByRole('heading', { name: 'Mem_KV equation' })).toBeInTheDocument()
    const stateStrip = screen.getByLabelText('Drawer route state summary')
    expect(within(stateStrip).getByText('Carried prediction observation')).toBeInTheDocument()
    expect(within(stateStrip).getByText('Prediction lens: An invariant holds')).toBeInTheDocument()
    expect(within(stateStrip).getByText('Name what stays true while controls change.')).toBeInTheDocument()
    expect(within(stateStrip).getByText('Next local action')).toBeInTheDocument()
    expect(within(stateStrip).getByText('Check the reduced symbol before moving on.')).toBeInTheDocument()
    expect(within(stateStrip).getByText('Equation note should sit above the full editor.')).toBeInTheDocument()
    expect(screen.getByLabelText('Local action draft').tagName).toBe('DETAILS')
    expect(screen.getByLabelText('Local action draft')).not.toHaveAttribute('open')
    expect(screen.getByText('Saved draft summarized above; expand to edit')).toBeInTheDocument()
  })

  it('turns a carried prediction observation into a concrete local action suggestion', async () => {
    saveLearningRouteSnapshot({
      version: 'cf-route-snapshot-v1',
      source: 'concept-notebook',
      paperTitle: 'Concept notebook: Efficient Attention',
      inputKind: 'concept notebook',
      mappingId: 'concept:efficient-attention',
      routeLabels: ['Efficient Attention', 'LLM Serving'],
      routeConceptIds: ['efficient-attention', 'llm-serving'],
      currentObject: {
        type: 'equation',
        id: 'kv-memory-symbol',
        discussionAnchorId: 'equation/attention-serving/kv-memory-symbol',
        title: 'Mem_KV equation',
        status: 'prediction checkpoint revealed',
      },
      lastObservation: {
        label: 'Demo prediction',
        value: 'Prediction lens: An invariant holds',
        detail: 'Name what stays true while controls change.',
        nextQuestion: 'Which slider tests the central claim?',
        source: 'prediction-checkpoint',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
      createdAt: '2026-05-04T00:00:00.000Z',
    })

    render(<ResearchReadingRoom items={items} variant="compact" />)

    const suggestedAction = 'Answer the carried question: Which slider tests the central claim?'
    expect(await screen.findByRole('heading', { name: 'Mem_KV equation' })).toBeInTheDocument()
    const stateStrip = screen.getByLabelText('Drawer route state summary')
    expect(within(stateStrip).getByText('Carried prediction observation')).toBeInTheDocument()
    expect(within(stateStrip).getByText(suggestedAction)).toBeInTheDocument()
    expect(
      within(stateStrip).getByText('Suggested by the carried prediction observation. Expand to save or replace it locally.')
    ).toBeInTheDocument()

    const localDraft = screen.getByLabelText('Local action draft')
    expect(localDraft.tagName).toBe('DETAILS')
    expect(localDraft).not.toHaveAttribute('open')
    expect(within(localDraft).getByText(suggestedAction)).toBeInTheDocument()
    expect(within(localDraft).getByText('Prediction suggests this next action; expand to save')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Use carried observation' }))

    expect(screen.getByLabelText('Draft note')).toHaveValue('Prediction observation: Prediction lens: An invariant holds')
    expect(screen.getByLabelText('Next action')).toHaveValue(suggestedAction)

    fireEvent.click(screen.getByRole('button', { name: 'Save local draft' }))

    expect(screen.getByRole('status')).toHaveTextContent('Saved locally in this browser.')
    expect(getLocalObjectActionDraft(equationObjectKey)).toEqual(
      expect.objectContaining({
        note: 'Prediction observation: Prediction lens: An invariant holds',
        nextAction: suggestedAction,
      })
    )
  })

  it('keeps compact local drafting progressive when no draft exists yet', () => {
    render(<ResearchReadingRoom items={items} variant="compact" />)

    const localDraft = screen.getByLabelText('Local action draft')
    expect(localDraft.tagName).toBe('DETAILS')
    expect(localDraft).not.toHaveAttribute('open')
    expect(within(localDraft).getByText('No local draft saved yet')).toBeInTheDocument()
    expect(within(localDraft).getByText('Expand only when ready to capture one local next action')).toBeInTheDocument()
  })

  it('saves a local draft against the selected canonical object key and includes it in the AI handoff', () => {
    render(<ResearchReadingRoom items={items} />)

    fireEvent.change(screen.getByLabelText('Draft note'), {
      target: { value: 'The learner still needs the exact source span for this memory claim.' },
    })
    fireEvent.change(screen.getByLabelText('Next action'), {
      target: { value: 'Inspect the paper clue before trusting the summary.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save local draft' }))

    expect(screen.getByRole('status')).toHaveTextContent('Saved locally in this browser.')
    expect(getLocalObjectActionDraft(claimObjectKey)).toEqual(
      expect.objectContaining({
        objectKey: claimObjectKey,
        note: 'The learner still needs the exact source span for this memory claim.',
        nextAction: 'Inspect the paper clue before trusting the summary.',
      })
    )
    expect(screen.getByText(/Local action draft:/)).toBeInTheDocument()
    expect(screen.getByText(/Next action: Inspect the paper clue before trusting the summary./)).toBeInTheDocument()
  })

  it('marks a saved local object action resolved and removes the active draft', () => {
    saveLocalObjectActionDraft({
      version: 'cf-object-action-draft-v1',
      objectKey: claimObjectKey,
      objectTitle: 'KV compression claim',
      note: 'The memory slider is the direct witness.',
      nextAction: 'Answer the carried question: which slider tests the memory claim?',
      updatedAt: '2026-05-11T00:00:00.000Z',
      source: 'research-reading-room',
    })

    render(<ResearchReadingRoom items={items} variant="compact" />)

    fireEvent.click(screen.getByRole('button', { name: 'Mark action resolved' }))

    expect(getLocalObjectActionDraft(claimObjectKey)).toBeNull()
    expect(getLocalObjectActionResolution(claimObjectKey)).toEqual(
      expect.objectContaining({
        resolvedAction: 'Answer the carried question: which slider tests the memory claim?',
        resolutionNote: 'The memory slider is the direct witness.',
      })
    )
    expect(screen.getByText('Resolved local action')).toBeInTheDocument()
    expect(screen.getAllByText('Resolved: Answer the carried question: which slider tests the memory claim?').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Marked resolved in this browser.').length).toBeGreaterThan(0)
  })

  it('does not leak one object draft into another selected object prompt', () => {
    saveLocalObjectActionDraft({
      version: 'cf-object-action-draft-v1',
      objectKey: claimObjectKey,
      objectTitle: 'KV compression claim',
      note: 'Claim-only note.',
      nextAction: 'Check claim source.',
      updatedAt: '2026-05-06T00:00:00.000Z',
      source: 'research-reading-room',
    })

    render(<ResearchReadingRoom items={items} />)

    expect(screen.getAllByText(/Claim-only note./)).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: /equation mem_kv equation equation/i }))

    expect(screen.queryByText(/Claim-only note./)).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('No local draft saved.')
  })

  it('keeps the selected object draft when the active object is clicked again', () => {
    saveLocalObjectActionDraft({
      version: 'cf-object-action-draft-v1',
      objectKey: claimObjectKey,
      objectTitle: 'KV compression claim',
      note: 'Active item draft should remain visible.',
      nextAction: 'Keep it in the prompt.',
      updatedAt: '2026-05-06T00:00:00.000Z',
      source: 'research-reading-room',
    })

    render(<ResearchReadingRoom items={items} />)

    fireEvent.click(screen.getByRole('button', { name: /claim kv compression claim paper claim/i }))

    expect(screen.getByLabelText('Draft note')).toHaveValue('Active item draft should remain visible.')
    expect(screen.getByText(/Draft note: Active item draft should remain visible./)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Last saved/)
  })

  it('clears unsaved editor text synchronously when switching selected objects', () => {
    render(<ResearchReadingRoom items={items} />)

    fireEvent.change(screen.getByLabelText('Draft note'), {
      target: { value: 'Unsaved claim text must not ride along.' },
    })
    fireEvent.change(screen.getByLabelText('Next action'), {
      target: { value: 'This belongs to the claim.' },
    })

    fireEvent.click(screen.getByRole('button', { name: /equation mem_kv equation equation/i }))

    expect(screen.getByLabelText('Draft note')).toHaveValue('')
    expect(screen.getByLabelText('Next action')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Save local draft' })).toBeDisabled()
    expect(screen.queryByText(/Unsaved claim text must not ride along./)).not.toBeInTheDocument()
  })

  it('clears only the selected object draft', () => {
    saveLocalObjectActionDraft({
      version: 'cf-object-action-draft-v1',
      objectKey: claimObjectKey,
      objectTitle: 'KV compression claim',
      note: 'Draft to remove.',
      nextAction: 'Clear this.',
      updatedAt: '2026-05-06T00:00:00.000Z',
      source: 'research-reading-room',
    })
    saveLocalObjectActionDraft({
      version: 'cf-object-action-draft-v1',
      objectKey: equationObjectKey,
      objectTitle: 'Mem_KV equation',
      note: 'Equation draft should survive.',
      nextAction: 'Check the symbol meaning.',
      updatedAt: '2026-05-06T00:01:00.000Z',
      source: 'research-reading-room',
    })

    render(<ResearchReadingRoom items={items} />)

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(screen.getByRole('status')).toHaveTextContent('Local draft cleared.')
    expect(screen.getByLabelText('Draft note')).toHaveValue('')
    expect(getLocalObjectActionDraft(claimObjectKey)).toBeNull()
    expect(getLocalObjectActionDraft(equationObjectKey)?.note).toBe('Equation draft should survive.')
    expect(screen.queryByText(/Draft to remove./)).not.toBeInTheDocument()
  })

  it('refreshes the selected draft from journal and storage events without cross-object leakage', () => {
    render(<ResearchReadingRoom items={items} />)

    act(() => {
      saveLocalObjectActionDraft({
        version: 'cf-object-action-draft-v1',
        objectKey: claimObjectKey,
        objectTitle: 'KV compression claim',
        note: 'Loaded from custom event.',
        nextAction: 'Use the prompt handoff.',
        updatedAt: '2026-05-06T00:00:00.000Z',
        source: 'research-reading-room',
      })
      window.dispatchEvent(new CustomEvent(localObjectActionJournalEventName))
    })

    expect(screen.getByLabelText('Draft note')).toHaveValue('Loaded from custom event.')
    expect(screen.getByText(/Draft note: Loaded from custom event./)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /equation mem_kv equation equation/i }))
    expect(screen.queryByText(/Loaded from custom event./)).not.toBeInTheDocument()

    act(() => {
      saveLocalObjectActionDraft({
        version: 'cf-object-action-draft-v1',
        objectKey: claimObjectKey,
        objectTitle: 'KV compression claim',
        note: 'Updated claim draft should stay hidden.',
        nextAction: 'Stay on claim.',
        updatedAt: '2026-05-06T00:01:00.000Z',
        source: 'research-reading-room',
      })
      window.dispatchEvent(new Event('storage'))
    })
    expect(screen.queryByText(/Updated claim draft should stay hidden./)).not.toBeInTheDocument()

    act(() => {
      saveLocalObjectActionDraft({
        version: 'cf-object-action-draft-v1',
        objectKey: equationObjectKey,
        objectTitle: 'Mem_KV equation',
        note: 'Equation draft loaded from storage event.',
        nextAction: 'Check the reduced symbol.',
        updatedAt: '2026-05-06T00:02:00.000Z',
        source: 'research-reading-room',
      })
      window.dispatchEvent(new Event('storage'))
    })

    expect(screen.getByLabelText('Draft note')).toHaveValue('Equation draft loaded from storage event.')
    expect(screen.getByText(/Draft note: Equation draft loaded from storage event./)).toBeInTheDocument()
  })

  it('disables local action drafts for objects without canonical object keys', () => {
    render(<ResearchReadingRoom items={items} />)

    fireEvent.click(screen.getByRole('button', { name: /misconception unkeyed misconception draft disabled/i }))

    expect(screen.getByText('This object needs a content object key before local action drafts can attach to it.')).toBeInTheDocument()
    expect(screen.getByLabelText('Draft note')).toBeDisabled()
    expect(screen.getByLabelText('Next action')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save local draft' })).toBeDisabled()
    expect(screen.getByText('Local action draft')).toBeInTheDocument()
  })
})
