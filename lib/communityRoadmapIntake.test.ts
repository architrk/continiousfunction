import {
  buildCommunityRoadmapReviewPacket,
  platformRoadmapObjectKey,
} from './communityRoadmapIntake'

describe('community roadmap intake', () => {
  it('anchors platform-scope suggestions to the platform roadmap object and keeps founder control', () => {
    const packet = buildCommunityRoadmapReviewPacket({
      scope: 'platform',
      contributionType: 'route-suggestion',
      contributorRole: 'professor',
      title: 'Add a reviewer bench before public rooms',
      body: 'The collaboration surface should start with invited reviewers around one flagship route before any public forum appears.',
      proposedChange: 'Add a private reviewer bench milestone before public object-room posting.',
      confidence: 'high',
    })

    expect(packet.status).toBe('ready-for-review')
    expect(packet.acceptedForReview).toBe(true)
    expect(packet.canonical).toBe(false)
    expect(packet.suggestion?.objectKey).toBe(platformRoadmapObjectKey)
    expect(packet.reviewLane).toBe('founder-roadmap')
    expect(packet.founderDecisionRequired).toBe(true)
    expect(packet.canonicalBoundary).toContain('founder/editor approval')
  })

  it('requires a concrete object unless the suggestion is explicitly platform-scoped', () => {
    const packet = buildCommunityRoadmapReviewPacket({
      contributionType: 'question',
      title: 'This path feels unclear',
      body: 'I am not sure what I should do after reading the first explanation on this page.',
    })

    expect(packet.status).toBe('needs-object')
    expect(packet.acceptedForReview).toBe(false)
    expect(packet.blockers.map((blocker) => blocker.id)).toContain('missing-object-key')
    expect(packet.nextAction).toContain('valid content object key')
  })

  it('routes learner confusion into the learner pilot lane without requiring source evidence', () => {
    const packet = buildCommunityRoadmapReviewPacket({
      objectKey: 'misconception:attention-transformers/efficient-attention#kv-cache-memory',
      contributionType: 'misconception-report',
      contributorRole: 'student',
      title: 'I thought KV cache reduced memory',
      body: 'The page helped with compute savings, but I still expected the cache to reduce total memory instead of moving memory pressure.',
      confidence: 'medium',
    })

    expect(packet.status).toBe('ready-for-review')
    expect(packet.reviewLane).toBe('learner-pilot')
    expect(packet.roadmapArea).toBe('personalization')
    expect(packet.founderDecisionRequired).toBe(false)
  })

  it('requires evidence for source-grounded corrections', () => {
    const packet = buildCommunityRoadmapReviewPacket({
      objectKey: 'claim:attention-transformers/efficient-attention#flashattention-io-aware',
      contributionType: 'source-evidence',
      contributorRole: 'researcher',
      title: 'This claim needs source boundaries',
      body: 'The local explanation may be compressing the paper claim too far and should distinguish IO movement from asymptotic attention complexity.',
    })

    expect(packet.status).toBe('needs-evidence')
    expect(packet.acceptedForReview).toBe(false)
    expect(packet.blockers.map((blocker) => blocker.id)).toContain('missing-evidence')
  })

  it('rejects malformed evidence object keys before a suggestion can guide roadmap work', () => {
    const packet = buildCommunityRoadmapReviewPacket({
      objectKey: 'claim:attention-transformers/efficient-attention#flashattention-io-aware',
      contributionType: 'source-evidence',
      contributorRole: 'researcher',
      title: 'Attach the exact source span',
      body: 'This correction should point at the exact source span rather than a broad paper title.',
      evidenceObjectKeys: ['https://example.com/paper'],
    })

    expect(packet.status).toBe('needs-evidence')
    expect(packet.blockers.map((blocker) => blocker.id)).toContain('invalid-evidence-object-key')
  })

  it('requires an exact proposed change for canonical improvement proposals', () => {
    const packet = buildCommunityRoadmapReviewPacket({
      objectKey: 'equation:attention-transformers/efficient-attention#math-object-2',
      contributionType: 'canonical-improvement-proposal',
      contributorRole: 'ta',
      title: 'Clarify the KV memory equation',
      body: 'Students are mixing up sequence length, head count, and value dimension in the current explanation.',
      evidenceObjectKeys: ['source-span:attention-transformers/efficient-attention#dao-flashattention'],
    })

    expect(packet.status).toBe('needs-proposed-change')
    expect(packet.founderDecisionRequired).toBe(true)
    expect(packet.blockers.map((blocker) => blocker.id)).toContain('missing-proposed-change')
  })

  it('routes practitioner examples into a review lane without making them canonical', () => {
    const packet = buildCommunityRoadmapReviewPacket({
      objectKey: 'code:attention-transformers/efficient-attention#code-witness-1',
      contributionType: 'practitioner-example',
      contributorRole: 'practitioner',
      title: 'Add a minimal paged KV cache witness',
      body: 'A small PyTorch-style pseudocode example could show why serving systems page the KV cache instead of recomputing K and V.',
      proposedChange: 'Add a code witness showing a decode loop that appends only the newest KV row.',
    })

    expect(packet.status).toBe('ready-for-review')
    expect(packet.reviewLane).toBe('practitioner-review')
    expect(packet.roadmapArea).toBe('demo-and-code')
    expect(packet.canonical).toBe(false)
  })

  it('marks AI-generated suggestions as draft material requiring founder review', () => {
    const packet = buildCommunityRoadmapReviewPacket({
      objectKey: 'route:domains/attention-transformers/efficient-attention',
      contributionType: 'route-suggestion',
      contributorRole: 'ai-agent',
      title: 'Split route before FlashAttention',
      body: 'The route may need a smaller memory-bandwidth prerequisite before learners reach the FlashAttention source span.',
      proposedChange: 'Insert a short memory hierarchy repair object before the FlashAttention section.',
      aiGenerated: true,
    })

    expect(packet.status).toBe('ready-for-review')
    expect(packet.founderDecisionRequired).toBe(true)
    expect(packet.canonicalBoundary).toContain('AI-assisted suggestion')
  })
})
