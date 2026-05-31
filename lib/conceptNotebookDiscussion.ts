import {
  buildDiscussionAnchor,
  buildDiscussionPlaceholder,
  isDiscussionSegment,
  maxDiscussionSeedPromptLength,
  type DiscussionAnchorListItem,
  type DiscussionObjectType,
} from './discussionAnchors'
import {
  conceptObjectSpanLabel,
  conceptObjectSpanNumber,
  conceptObjectSpanSectionId,
  type ConceptObjectSpan,
} from './conceptObjectSpans'
import { buildConceptContentObjectKey, type ContentObjectKey } from './contentObjectKeys'
import {
  claimEvidenceReviewLabel,
  claimEvidenceReviewPromptLines,
  type ClaimEvidenceReview,
} from './claimEvidenceReview'

export type ConceptNotebookSource = {
  id: string
  title: string
  authors?: string
  year?: number
  kind?: string
  url?: string
  note?: string
}

export type ConceptNotebookClaimCheck = {
  id: string
  claim: string
  status: 'source-checked' | 'needs-review' | 'weakened'
  source_ids?: string[]
  support?: string
  caveat?: string
  object_refs?: string[]
  evidence_review?: ClaimEvidenceReview
}

export type ConceptNotebookDiscussionConcept = {
  id: string
  title: string
  domain: string
  slug: string
  short_description?: string
  sources?: ConceptNotebookSource[]
  claim_checks?: ConceptNotebookClaimCheck[]
  objectSpans?: ConceptObjectSpan[]
}

type ConceptDiscussionSeed = {
  objectType: DiscussionObjectType
  segments: [string, ...string[]]
  title: string
  contextLabel: string
  prompt: string
  href?: string
  sourceIds?: string[]
  objectKey?: ContentObjectKey
}

function boundedText(value: string | undefined, limit: number, fallback = 'Concept notebook') {
  const text = value?.trim() || fallback
  if (text.length <= limit) return text
  if (limit <= 3) return text.slice(0, limit)
  return `${text.slice(0, limit - 3).trimEnd()}...`
}

function compactPrompt(value: string) {
  return boundedText(value, 360)
}

export function sourceSegmentForConceptSource(source: ConceptNotebookSource, index: number) {
  return isDiscussionSegment(source.id) ? source.id : `source-${index + 1}`
}

export function sourceDomIdForConceptSource(source: ConceptNotebookSource, index: number) {
  return `source-${sourceSegmentForConceptSource(source, index)}`
}

export function sourceSpanDomIdForConceptSource(source: ConceptNotebookSource, index: number) {
  return `source-span-${sourceSegmentForConceptSource(source, index)}`
}

export function claimCheckSegmentForConceptClaimCheck(
  claimCheck: Pick<ConceptNotebookClaimCheck, 'id'>,
  index: number
) {
  void index
  return isDiscussionSegment(claimCheck.id) ? claimCheck.id : null
}

export function claimCheckDomIdForConceptClaimCheck(
  claimCheck: Pick<ConceptNotebookClaimCheck, 'id'>,
  index: number
) {
  const segment = claimCheckSegmentForConceptClaimCheck(claimCheck, index)
  return segment ? `claim-check-${segment}` : null
}

function sourceContextLabel(source: ConceptNotebookSource) {
  const meta = [
    source.kind ?? 'reference',
    source.year ? String(source.year) : undefined,
    source.note,
  ].filter((part): part is string => Boolean(part))

  return boundedText(meta.join(' - '), 140, source.title)
}

function sourceReviewSeeds(
  concept: ConceptNotebookDiscussionConcept,
  conceptHref: string,
  sources: ConceptNotebookSource[]
): ConceptDiscussionSeed[] {
  return sources.slice(0, 4).map((source, index) => {
    const segment = sourceSegmentForConceptSource(source, index)
    const sourceTitle = boundedText(source.title, 120, source.id)
    const mechanismClaim = concept.short_description
      ? `the mechanism claim "${concept.short_description}"`
      : `the mechanism claim for ${concept.title}`

    return {
      objectType: 'source' as const,
      segments: [concept.domain, concept.id, 'source', segment] as [string, ...string[]],
      title: boundedText(source.title, 160, `${concept.title} source ${index + 1}`),
      contextLabel: sourceContextLabel(source),
      prompt: compactPrompt(
        `Does ${sourceTitle} directly support ${mechanismClaim}, and which local equation, code witness, or demo state should be checked against it?`
      ),
      href: `${conceptHref}#${sourceDomIdForConceptSource(source, index)}`,
      sourceIds: [source.id],
      objectKey: buildConceptContentObjectKey('source', concept.domain, concept.id, segment) ?? undefined,
    }
  })
}

function sourceSpanReviewSeeds(
  concept: ConceptNotebookDiscussionConcept,
  conceptHref: string,
  sources: ConceptNotebookSource[]
): ConceptDiscussionSeed[] {
  return sources
    .map((source, index) => ({ source, index }))
    .filter(({ source }) => source.note?.trim())
    .slice(0, 4)
    .map(({ source, index }) => {
      const segment = sourceSegmentForConceptSource(source, index)
      const sourceTitle = boundedText(source.title, 120, source.id)
      const sourceNote = boundedText(source.note, 140, source.title)

      return {
        objectType: 'source' as const,
        segments: [concept.domain, concept.id, 'source-span', segment] as [string, ...string[]],
        title: boundedText(`${source.title} support span`, 160, `${concept.title} source span ${index + 1}`),
        contextLabel: sourceNote,
        prompt: compactPrompt(
          `For this source note from ${sourceTitle}, which exact ${concept.title} mechanism claim does it support, which equation/code/demo object should be checked, and what remains unverified?`
        ),
        href: `${conceptHref}#${sourceSpanDomIdForConceptSource(source, index)}`,
        sourceIds: [source.id],
        objectKey: buildConceptContentObjectKey('source-span', concept.domain, concept.id, segment) ?? undefined,
      }
    })
}

function claimCheckSourceIds(claimCheck: ConceptNotebookClaimCheck) {
  return (claimCheck.source_ids ?? []).map((sourceId) => sourceId.trim()).filter(Boolean)
}

function claimCheckContextLabel(claimCheck: ConceptNotebookClaimCheck) {
  const sourceIds = claimCheckSourceIds(claimCheck)
  const status = claimEvidenceReviewLabel(claimCheck.evidence_review)
  const sourceLabel = sourceIds.length ? sourceIds.join(', ') : 'source ids pending'

  return boundedText(`${status} - ${sourceLabel}`, 140, status)
}

function claimCheckReviewPrompt(concept: ConceptNotebookDiscussionConcept, claimCheck: ConceptNotebookClaimCheck) {
  const sourceIds = claimCheckSourceIds(claimCheck)
  const objectRefs = (claimCheck.object_refs ?? []).map((objectRef) => objectRef.trim()).filter(Boolean)
  const prompt = [
    `Review this claim check for ${concept.title}.`,
    `Claim: ${claimCheck.claim}`,
    `Status: ${claimCheck.status}`,
    ...claimEvidenceReviewPromptLines(claimCheck.evidence_review),
    `Source IDs: ${sourceIds.join(', ') || 'not listed'}`,
    `Support note: ${claimCheck.support?.trim() || 'not specified'}`,
    `Caveat: ${claimCheck.caveat?.trim() || 'not specified'}`,
    `Object refs: ${objectRefs.join(', ') || 'not listed'}`,
    'Question: Do the cited sources and local witnesses support this precise claim, and what remains an assumption?',
  ].join('\n')

  return boundedText(prompt, maxDiscussionSeedPromptLength)
}

function claimCheckReviewSeeds(
  concept: ConceptNotebookDiscussionConcept,
  conceptHref: string,
  claimChecks: ConceptNotebookClaimCheck[]
): ConceptDiscussionSeed[] {
  return claimChecks
    .filter((claimCheck) => claimCheck.id && claimCheck.claim)
    .flatMap((claimCheck, index) => {
      const segment = claimCheckSegmentForConceptClaimCheck(claimCheck, index)
      if (!segment) return []
      const sourceIds = claimCheckSourceIds(claimCheck)

      return [{
        objectType: 'claim' as const,
        segments: [concept.domain, concept.id, 'claim-check', segment] as [string, ...string[]],
        title: boundedText(claimCheck.claim, 160, `${concept.title} claim check`),
        contextLabel: claimCheckContextLabel(claimCheck),
        prompt: claimCheckReviewPrompt(concept, claimCheck),
        href: `${conceptHref}#claim-check-${segment}`,
        sourceIds,
        objectKey: buildConceptContentObjectKey('claim', concept.domain, concept.id, claimCheck.id) ?? undefined,
      }]
    })
}

function objectSpanReviewSeeds(
  concept: ConceptNotebookDiscussionConcept,
  conceptHref: string,
  sourceIds: string[]
): ConceptDiscussionSeed[] {
  return (concept.objectSpans ?? []).slice(0, 7).map((span) => {
    const label = conceptObjectSpanLabel(span)
    const sectionId = conceptObjectSpanSectionId(span)
    const spanNumber = conceptObjectSpanNumber(span)
    const title = `${concept.title} ${label.toLowerCase()}`
    const prompt =
      span.kind === 'equation'
        ? `For ${label} in ${concept.title}, what does each symbol mean, what assumption makes it valid, and which source or code witness supports it?`
        : `For ${label} in ${concept.title}, which line mirrors the equation, what input/output shape matters, and what small perturbation should change the result?`

    return {
      objectType: span.kind,
      segments: [concept.domain, concept.id, sectionId, `${span.kind}-${spanNumber}`] as [string, ...string[]],
      title: boundedText(title, 160),
      contextLabel: boundedText(span.snippet, 140, label),
      prompt: compactPrompt(prompt),
      href: `${conceptHref}#${span.domId}`,
      sourceIds,
      objectKey:
        buildConceptContentObjectKey(span.kind === 'equation' ? 'equation' : 'code', concept.domain, concept.id, span.domId) ??
        undefined,
    }
  })
}

export function buildConceptDiscussionItems(
  concept: ConceptNotebookDiscussionConcept,
  domainTitle: string,
  hasVisualization: boolean
): DiscussionAnchorListItem[] {
  const conceptHref = `/domains/${concept.domain}/${concept.slug}/`
  const safeSources = (concept.sources ?? []).filter((source) => source.id && source.title).slice(0, 6)
  const sourceIds = safeSources.map((source) => source.id).filter(Boolean).slice(0, 6)
  const sourceLabel =
    safeSources[0]?.title ??
    (sourceIds.length ? `${sourceIds.length} canonical references` : 'Source grounding')
  const claimPrompt = concept.short_description
    ? `Which exact evidence on this page supports or weakens this claim: "${concept.short_description}"?`
    : `What claim is ${concept.title} making, and what evidence on this page would make it stronger or weaker?`
  const seeds: ConceptDiscussionSeed[] = [
    {
      objectType: 'concept' as const,
      segments: [concept.domain, concept.id] as [string, ...string[]],
      title: boundedText(concept.title, 160),
      contextLabel: boundedText(domainTitle, 140),
      prompt: compactPrompt(`What is the smallest example that makes ${concept.title} click without losing the math?`),
      href: `${conceptHref}#intuition`,
      sourceIds,
      objectKey: buildConceptContentObjectKey('concept', concept.domain, concept.id) ?? undefined,
    },
    {
      objectType: 'equation' as const,
      segments: [concept.domain, concept.id, 'math'] as [string, ...string[]],
      title: boundedText(`${concept.title} math objects`, 160),
      contextLabel: 'Equation and notation',
      prompt: compactPrompt(
        `Which symbol, shape, or assumption in the ${concept.title} math section is doing the most work?`
      ),
      href: `${conceptHref}#math`,
      sourceIds,
    },
    {
      objectType: 'code-witness' as const,
      segments: [concept.domain, concept.id, 'code'] as [string, ...string[]],
      title: boundedText(`${concept.title} code witness`, 160),
      contextLabel: 'Runnable code object',
      prompt: compactPrompt(
        `Which line in the ${concept.title} code witness mirrors the central equation, and what output should change under a small perturbation?`
      ),
      href: `${conceptHref}#code`,
      sourceIds,
    },
    ...objectSpanReviewSeeds(concept, conceptHref, sourceIds),
    ...(sourceIds.length
      ? [
          {
            objectType: 'source' as const,
            segments: [concept.domain, concept.id, 'sources'] as [string, ...string[]],
            title: boundedText(`${concept.title} source grounding`, 160),
            contextLabel: boundedText(sourceLabel, 140),
            prompt: compactPrompt(
              `Which source attached to ${concept.title} supports the mechanism, equation, demo, or code witness most directly?`
            ),
            href: `${conceptHref}#source-grounding`,
            sourceIds,
            objectKey: buildConceptContentObjectKey('source', concept.domain, concept.id, 'sources') ?? undefined,
          },
          ...sourceReviewSeeds(concept, conceptHref, safeSources),
          ...sourceSpanReviewSeeds(concept, conceptHref, safeSources),
        ]
      : []),
    {
      objectType: 'claim' as const,
      segments: [concept.domain, concept.id, 'central-claim'] as [string, ...string[]],
      title: boundedText(`${concept.title} central claim`, 160),
      contextLabel: 'Mechanism claim',
      prompt: compactPrompt(claimPrompt),
      href: `${conceptHref}#claim-review`,
      sourceIds,
      objectKey: buildConceptContentObjectKey('claim', concept.domain, concept.id, 'central-claim') ?? undefined,
    },
    ...claimCheckReviewSeeds(concept, conceptHref, concept.claim_checks ?? []),
    {
      objectType: 'misconception' as const,
      segments: [concept.domain, concept.id, 'likely-misconception'] as [string, ...string[]],
      title: boundedText(`${concept.title} likely misconception`, 160),
      contextLabel: 'Misconception check',
      prompt: compactPrompt(
        `What is the easiest wrong mental model for ${concept.title}, and what minimal counterexample would correct it?`
      ),
      href: `${conceptHref}${hasVisualization ? '#interactive-demo' : '#math'}`,
      sourceIds,
      objectKey: buildConceptContentObjectKey('misconception', concept.domain, concept.id, 'likely-misconception') ?? undefined,
    },
    ...(hasVisualization
      ? [
          {
            objectType: 'visualization' as const,
            segments: [concept.domain, concept.id, 'interactive-demo'] as [string, ...string[]],
            title: boundedText(`${concept.title} interactive demo`, 160),
            contextLabel: 'Visualization object',
            prompt: compactPrompt(
              `Which slider or state change in the ${concept.title} demo would test the central claim most directly?`
            ),
            href: `${conceptHref}#interactive-demo`,
            sourceIds,
            objectKey: buildConceptContentObjectKey('demo', concept.domain, concept.id, 'interactive-demo') ?? undefined,
          },
        ]
      : []),
  ]

  return seeds.flatMap((seed) => {
    const anchor = buildDiscussionAnchor({
      objectType: seed.objectType,
      surface: 'concept-notebook',
      segments: seed.segments,
      title: seed.title,
      contextLabel: seed.contextLabel,
      href: seed.href,
      sourceIds: seed.sourceIds,
      objectKey: seed.objectKey,
    })
    if (!anchor) return []

    const thread = buildDiscussionPlaceholder(anchor, seed.prompt)
    return thread ? [{ anchor, thread }] : []
  })
}
