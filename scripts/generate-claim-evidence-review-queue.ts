/* eslint-disable @typescript-eslint/no-var-requires */

// Generate a deterministic queue of claim checks that still need substantive
// source-support review. Run via: npm run generate-claim-evidence-review-queue

;(() => {
  const fs = require('node:fs') as typeof import('node:fs')
  const path = require('node:path') as typeof import('node:path')

  require('ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs' },
  })

  const {
    loadConceptMetas,
  } = require('../lib/contentLoader.ts') as typeof import('../lib/contentLoader')
  const {
    buildClaimEvidenceReviewQueueArtifact,
    formatClaimEvidenceReviewQueueMarkdown,
    serializeClaimEvidenceReviewQueueArtifact,
  } = require('../lib/claimEvidenceReviewQueue.ts') as typeof import('../lib/claimEvidenceReviewQueue')

  const contentRoot = path.join(process.cwd(), 'content')
  const generatedDir = path.join(contentRoot, '_generated')
  const queuePath = path.join(generatedDir, 'claim-evidence-review-queue.json')
  const markdownPath = path.join(contentRoot, '_agent', 'CLAIM_EVIDENCE_REVIEW_QUEUE.md')

  fs.mkdirSync(generatedDir, { recursive: true })

  const artifact = buildClaimEvidenceReviewQueueArtifact(loadConceptMetas(contentRoot))
  fs.writeFileSync(queuePath, serializeClaimEvidenceReviewQueueArtifact(artifact))
  fs.writeFileSync(markdownPath, formatClaimEvidenceReviewQueueMarkdown(artifact))

  // eslint-disable-next-line no-console
  console.log(
    `[generate-claim-evidence-review-queue] Wrote ${artifact.items.length} pending claim reviews to ${path.relative(process.cwd(), queuePath)}`
  )
})()
