/* eslint-disable @typescript-eslint/no-var-requires */

// Validation script for filesystem-driven content under ./content
// Designed to run via: npx ts-node --transpileOnly scripts/validate-content.ts
// Keep this script self-contained: avoid importing TS modules that may be ESM-only.

;(() => {
const fs = require('node:fs') as typeof import('node:fs')
const path = require('node:path') as typeof import('node:path')

let YAML: any
try {
  YAML = require('yaml')
} catch {
  console.error('[validate-content] Missing dependency: "yaml". Install with: npm i -D yaml')
  process.exit(1)
}

type Severity = 'error' | 'warn'

type Issue = {
  severity: Severity
  code: string
  message: string
  file?: string
}

const ISSUE = (severity: Severity, code: string, message: string, file?: string): Issue => ({
  severity,
  code,
  message,
  file,
})

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const readFile = (p: string): string => fs.readFileSync(p, 'utf8')

const exists = (p: string): boolean => {
  try {
    fs.accessSync(p)
    return true
  } catch {
    return false
  }
}

const listDirs = (p: string): string[] => {
  if (!exists(p)) return []
  return fs
    .readdirSync(p, { withFileTypes: true })
    .filter((d: any) => d.isDirectory())
    .map((d: any) => d.name)
}

const parseYaml = (p: string, issues: Issue[]): any => {
  try {
    const raw = readFile(p)
    return YAML.parse(raw)
  } catch (e: any) {
    issues.push(ISSUE('error', 'YAML_PARSE', `Failed to parse YAML: ${e?.message ?? String(e)}`, p))
    return null
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const HEX_RE = /^#[0-9a-fA-F]{6}$/
const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n?/
const FENCED_CODE_RE = /```[\s\S]*?```/g
const INLINE_CODE_RE = /`[^`\n]+`/g
const DISPLAY_MATH_RE = /\$\$[\s\S]*?\$\$/g
const INLINE_MATH_RE = /\$[^$\n]+\$/g
const VIZ_PLACEHOLDER_RE = /\{\s*\/\*\s*viz\.tsx component renders here if it exists\s*\*\/\s*\}/g
const HTML_OR_JSX_RE = /<\/?[A-Za-z][\w:-]*\b/
const IMPORT_EXPORT_RE = /^\s*(?:import|export)\s/m
const BRACE_EXPR_RE = /(^|[^\\])[{}]/
const HTML_COMMENT_RE = /<!--|-->/
const MARKDOWN_LINK_RE = /\[[^\]]*]\(([^)]+)\)/g
const PLACEHOLDER_TEXT_RE = /\b(?:TODO|TBD|coming soon|demo planned|placeholder|lorem ipsum)\b/i
const NO_DEMO_TEXT_RE = /\b(?:no interactive demo yet|no live visualization is registered|demo planned|coming soon|placeholder)\b/i
const SOURCE_KINDS = new Set(['paper', 'book', 'article', 'documentation', 'course-notes', 'reference'])
const CLAIM_CHECK_STATUSES = new Set(['source-checked', 'needs-review', 'weakened'])
const CLAIM_EVIDENCE_REVIEW_STATES = new Set(['source-linked', 'source-note-reviewed', 'substantive-reviewed'])
const SOURCE_SEGMENT_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/
const CONTENT_OBJECT_MANIFEST_VERSION = 'cf-content-object-manifest-v1'
const CONTENT_OBJECT_KEY_VERSION = 'cf-content-object-key-v1'
const CONTENT_OBJECT_TYPES = new Set([
  'concept',
  'route',
  'demo',
  'equation',
  'code',
  'source',
  'source-span',
  'claim',
  'misconception',
  'paper',
])
const CONTENT_OBJECT_STABILITIES = new Set(['canonical', 'content-derived', 'generated-span', 'route-derived'])
const CONTENT_OBJECT_SEGMENT_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/
const CONTENT_OBJECT_FRAGMENT_RE = /^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/
const MATH_OBJECT_REF_RE = /^#math-object-[1-9]\d*$/
const CODE_WITNESS_REF_RE = /^#code-witness-[1-9]\d*$/
const SOURCE_SPAN_REF_RE = /^#source-span-[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/

type ContentObjectManifestContext = {
  path: string
  keys: Set<string>
  expectedKeys: Set<string>
  objects: Record<string, unknown>[]
}

type ClaimCheckHandoffValidator = (input: {
  concepts: Record<string, unknown>[]
  manifestObjects: Record<string, unknown>[]
}) => Array<{
  code: string
  message: string
  conceptId: string
  claimCheckId?: string
}>

type ClaimEvidenceReviewQueueBuilder = (concepts: Record<string, unknown>[]) => Record<string, unknown>
type ClaimEvidenceReviewQueueMarkdownFormatter = (artifact: Record<string, unknown>) => string
type ClaimEvidenceReviewSourceIdValidator = (
  value: unknown,
  knownSourceIds: ReadonlySet<string>
) => Array<{
  code: string
  message: string
}>

const oneOf = <T extends string>(v: any, allowed: readonly T[]): v is T => typeof v === 'string' && allowed.includes(v as T)

const allowedUrlTarget = (rawTarget: string): boolean => {
  const target = rawTarget.trim().split(/\s+/, 1)[0]?.replace(/^<|>$/g, '') ?? ''
  if (!target) return true
  if (target.startsWith('/')) return true
  if (target.startsWith('#')) return true
  if (target.startsWith('./')) return true
  if (target.startsWith('../')) return true

  const protocolMatch = /^([a-zA-Z][a-zA-Z\d+.-]*):/.exec(target)
  if (!protocolMatch) return false

  const protocol = protocolMatch[1].toLowerCase()
  return protocol === 'http' || protocol === 'https' || protocol === 'mailto'
}

const getContentMdxSafetyErrors = (raw: string): string[] => {
  const stripped = raw
    .replace(/\r\n/g, '\n')
    .replace(FRONTMATTER_RE, '')
    .replace(VIZ_PLACEHOLDER_RE, '')
    .replace(FENCED_CODE_RE, ' ')
    .replace(INLINE_CODE_RE, ' ')
    .replace(DISPLAY_MATH_RE, ' ')
    .replace(INLINE_MATH_RE, ' ')

  const errors: string[] = []

  if (IMPORT_EXPORT_RE.test(stripped)) {
    errors.push('import/export statements are not allowed in content.mdx')
  }

  if (HTML_OR_JSX_RE.test(stripped) || HTML_COMMENT_RE.test(stripped)) {
    errors.push('raw HTML/JSX is not allowed in content.mdx')
  }

  if (BRACE_EXPR_RE.test(stripped)) {
    errors.push('MDX expressions/comments are not allowed in content.mdx')
  }

  MARKDOWN_LINK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = MARKDOWN_LINK_RE.exec(stripped))) {
    if (!allowedUrlTarget(match[1])) {
      errors.push(`link target uses a disallowed protocol or relative form: ${match[1].trim()}`)
    }
  }

  return errors
}

const getContentMdxMathRenderingErrors = (raw: string): string[] => {
  const normalized = raw.replace(/\r\n/g, '\n')
  const errors: string[] = []
  const lines = normalized.split('\n')
  let inFence = false

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) inFence = !inFence
    if (inFence) return

    if ((trimmed.startsWith('$$') || trimmed.endsWith('$$')) && trimmed !== '$$') {
      errors.push(`display math delimiters should be on their own lines so KaTeX renders a display block (line ${index + 1})`)
    }
  })

  const checkMathBody = (body: string, startLine: number, options: { isDisplay: boolean }) => {
    const doubleEscapedCommandRe = /\\\\[A-Za-z!,;:,.{}|]/g
    let match: RegExpExecArray | null
    while ((match = doubleEscapedCommandRe.exec(body))) {
      const line = startLine + body.slice(0, match.index).split('\n').length - 1
      errors.push(`math contains a double-escaped LaTeX command '${match[0]}' that may render as raw text (line ${line})`)
    }

    if (options.isDisplay) {
      const displayLineBreakEnvRe = /\\begin\{(?:aligned|alignedat|array|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases|gathered|split|smallmatrix|subarray)\}/
      const displayModeLineBreakRe = /\\\\(?:\s|$)/g
      while ((match = displayModeLineBreakRe.exec(body))) {
        if (displayLineBreakEnvRe.test(body)) continue
        const line = startLine + body.slice(0, match.index).split('\n').length - 1
        errors.push(`display math contains a raw line-break command '\\\\' outside a multiline LaTeX environment (line ${line})`)
      }
    }
  }

  let i = 0
  while (i < normalized.length) {
    if (normalized.startsWith('```', i)) {
      const endLine = normalized.indexOf('\n', i)
      const fenceEnd = normalized.indexOf('\n```', endLine === -1 ? i + 3 : endLine)
      if (fenceEnd === -1) break
      const closeEnd = normalized.indexOf('\n', fenceEnd + 1)
      i = closeEnd === -1 ? normalized.length : closeEnd + 1
      continue
    }

    if (normalized.startsWith('$$', i)) {
      const end = normalized.indexOf('$$', i + 2)
      if (end === -1) break
      const startLine = normalized.slice(0, i).split('\n').length
      checkMathBody(normalized.slice(i + 2, end), startLine, { isDisplay: true })
      i = end + 2
      continue
    }

    if (normalized[i] === '$') {
      const prev = normalized[i - 1]
      if (prev !== '$' && prev !== '\\') {
        let end = i + 1
        while (end < normalized.length) {
          if (normalized[end] === '\n') break
          if (normalized[end] === '$' && normalized[end - 1] !== '\\') break
          end += 1
        }
        if (normalized[end] === '$') {
          const startLine = normalized.slice(0, i).split('\n').length
          checkMathBody(normalized.slice(i + 1, end), startLine, { isDisplay: false })
          i = end + 1
          continue
        }
      }
    }

    i += 1
  }

  return errors
}

const hasFencedCode = (raw: string): boolean => {
  FENCED_CODE_RE.lastIndex = 0
  return FENCED_CODE_RE.test(raw)
}

const countMatches = (raw: string, re: RegExp): number => {
  re.lastIndex = 0
  const count = raw.match(re)?.length ?? 0
  re.lastIndex = 0
  return count
}

const getSectionBody = (raw: string, heading: string): string => {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`)
  if (start < 0) return ''

  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) {
      end = i
      break
    }
  }

  return lines.slice(start + 1, end).join('\n').trim()
}

const stripMdxComments = (raw: string) => raw.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const getGeneratedConceptObjectRefs = (raw: string): Set<string> => {
  const refs = new Set<string>()
  const generatedSource = raw.replace(/\r\n/g, '\n').replace(FRONTMATTER_RE, '')
  const mathSource = stripMdxComments(getSectionBody(generatedSource, 'Math'))
  const codeSource = stripMdxComments(getSectionBody(generatedSource, 'Code'))
  const displayMathRe = /\$\$([\s\S]*?)\$\$/g
  const codeFenceRe = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g

  let match: RegExpExecArray | null
  let equationIndex = 0
  while ((match = displayMathRe.exec(mathSource)) && equationIndex < 3) {
    if (!match[1]?.trim()) continue
    equationIndex += 1
    refs.add(`#math-object-${equationIndex}`)
  }

  let codeIndex = 0
  while ((match = codeFenceRe.exec(codeSource)) && codeIndex < 1) {
    if (!match[2]?.trim()) continue
    codeIndex += 1
    refs.add(`#code-witness-${codeIndex}`)
  }

  return refs
}

const visibleWordCount = (raw: string): number => {
  const text = raw
    .replace(FENCED_CODE_RE, ' ')
    .replace(INLINE_CODE_RE, ' ')
    .replace(DISPLAY_MATH_RE, ' ')
    .replace(INLINE_MATH_RE, ' ')
    .replace(VIZ_PLACEHOLDER_RE, ' ')
    .replace(/[#[\]()*_>`$]/g, ' ')

  return text.split(/\s+/).filter(Boolean).length
}

const PLANNED_REF_PREFIX = 'planned:'

const getPlannedConceptId = (v: string): string | null => {
  if (!v.startsWith(PLANNED_REF_PREFIX)) return null
  return v.slice(PLANNED_REF_PREFIX.length).trim()
}

const isPlannedConceptRef = (v: string): boolean => getPlannedConceptId(v) !== null

const conceptRefExists = (v: string, contentConceptIds: Set<string>, legacyConceptIds: Set<string>): boolean => {
  const id = getPlannedConceptId(v) ?? v
  return contentConceptIds.has(id) || legacyConceptIds.has(id)
}

const isHttpUrl = (value: unknown): boolean => {
  if (typeof value !== 'string' || value.length > 260) return false

  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

const parseContentObjectKey = (value: unknown): { type: string; pathSegments: string[]; fragment?: string } | null => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 260 ||
    /[\u0000-\u001F\u007F\\\s]/.test(value) ||
    value.includes('//')
  ) {
    return null
  }

  const separator = value.indexOf(':')
  if (separator <= 0) return null

  const type = value.slice(0, separator)
  if (!CONTENT_OBJECT_TYPES.has(type)) return null

  const body = value.slice(separator + 1)
  if (!body || body.startsWith('/') || body.startsWith('#')) return null

  const hashIndex = body.indexOf('#')
  const pathPart = hashIndex >= 0 ? body.slice(0, hashIndex) : body
  const fragment = hashIndex >= 0 ? body.slice(hashIndex + 1) : undefined
  const pathSegments = pathPart.split('/')

  if (!pathSegments.length || pathSegments.length > 6 || !pathSegments.every((segment) => CONTENT_OBJECT_SEGMENT_RE.test(segment))) {
    return null
  }
  if (fragment !== undefined && !CONTENT_OBJECT_FRAGMENT_RE.test(fragment)) return null

  return { type, pathSegments, fragment }
}

const isContentObjectKey = (value: unknown): value is string => parseContentObjectKey(value) !== null

const buildContentObjectKey = (type: string, pathSegments: string[], fragment?: string): string | null => {
  if (
    !CONTENT_OBJECT_TYPES.has(type) ||
    !pathSegments.length ||
    pathSegments.length > 6 ||
    !pathSegments.every((segment) => CONTENT_OBJECT_SEGMENT_RE.test(segment)) ||
    (fragment !== undefined && !CONTENT_OBJECT_FRAGMENT_RE.test(fragment))
  ) {
    return null
  }

  return `${type}:${pathSegments.join('/')}${fragment ? `#${fragment}` : ''}`
}

const conceptContentObjectKey = (type: string, domain: string, conceptId: string, fragment?: string): string | null =>
  buildContentObjectKey(type, [domain, conceptId], fragment)

const contentObjectKeyForConceptObjectRef = (domain: string, conceptId: string, objectRef: string): string | null => {
  if (!objectRef.startsWith('#')) return null

  const fragment = objectRef.slice(1)
  if (MATH_OBJECT_REF_RE.test(objectRef)) return conceptContentObjectKey('equation', domain, conceptId, fragment)
  if (CODE_WITNESS_REF_RE.test(objectRef)) return conceptContentObjectKey('code', domain, conceptId, fragment)
  if (fragment === 'interactive-demo') return conceptContentObjectKey('demo', domain, conceptId, fragment)
  if (SOURCE_SPAN_REF_RE.test(objectRef)) {
    return conceptContentObjectKey('source-span', domain, conceptId, fragment.replace(/^source-span-/, ''))
  }

  return null
}

const requireManifestKey = (
  manifest: ContentObjectManifestContext,
  key: string | null,
  issues: Issue[],
  file: string,
  detail: string
) => {
  if (!key) {
    issues.push(ISSUE('error', 'CONTENT_OBJECT_KEY_INVALID', `Unable to build content object key for ${detail}`, file))
    return
  }

  manifest.expectedKeys.add(key)

  if (!manifest.keys.has(key)) {
    issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_MISSING', `Manifest missing ${detail}: ${key}`, file))
  }
}

const loadContentObjectManifest = (contentRoot: string, issues: Issue[]): ContentObjectManifestContext => {
  const manifestPath = path.join(contentRoot, '_generated', 'content-object-manifest.json')
  const keys = new Set<string>()
  const expectedKeys = new Set<string>()
  const objects: Record<string, unknown>[] = []

  if (!exists(manifestPath)) {
    issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_MISSING', `Missing generated content object manifest. Run npm run generate-object-manifest.`, manifestPath))
    return { path: manifestPath, keys, expectedKeys, objects }
  }

  let manifest: any
  try {
    manifest = JSON.parse(readFile(manifestPath))
  } catch (e: any) {
    issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_PARSE', `Failed to parse manifest JSON: ${e?.message ?? String(e)}`, manifestPath))
    return { path: manifestPath, keys, expectedKeys, objects }
  }

  if (!isObject(manifest)) {
    issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_SCHEMA', `Manifest must be an object`, manifestPath))
    return { path: manifestPath, keys, expectedKeys, objects }
  }

  if (manifest.version !== CONTENT_OBJECT_MANIFEST_VERSION) {
    issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_VERSION', `Manifest version must be ${CONTENT_OBJECT_MANIFEST_VERSION}`, manifestPath))
  }
  if (manifest.keyVersion !== CONTENT_OBJECT_KEY_VERSION) {
    issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_KEY_VERSION', `Manifest keyVersion must be ${CONTENT_OBJECT_KEY_VERSION}`, manifestPath))
  }
  if (!Array.isArray(manifest.objects)) {
    issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_OBJECTS', `Manifest objects must be a list`, manifestPath))
    return { path: manifestPath, keys, expectedKeys, objects }
  }

  let previousKey = ''
  for (const [index, object] of manifest.objects.entries()) {
    if (!isObject(object)) {
      issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_OBJECT', `Manifest object ${index} must be an object`, manifestPath))
      continue
    }
    objects.push(object)

    const key = (object as any).key
    const type = (object as any).type
    const parsedKey = parseContentObjectKey(key)

    if (!parsedKey) {
      issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_KEY', `Manifest object ${index} has invalid key`, manifestPath))
      continue
    }
    if (keys.has(key)) {
      issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_DUPLICATE', `Duplicate manifest object key: ${key}`, manifestPath))
    }
    if (previousKey && key.localeCompare(previousKey) < 0) {
      issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_SORT', `Manifest keys must be sorted: ${key} appears after ${previousKey}`, manifestPath))
    }
    previousKey = key
    keys.add(key)

    if (type !== parsedKey.type) {
      issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_TYPE', `Manifest type must match key type for ${key}`, manifestPath))
    }
    if (typeof (object as any).title !== 'string' || !(object as any).title.trim() || (object as any).title.length > 180) {
      issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_TITLE', `Manifest object ${key} needs a bounded title`, manifestPath))
    }
    if (typeof (object as any).stability !== 'string' || !CONTENT_OBJECT_STABILITIES.has((object as any).stability)) {
      issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_STABILITY', `Manifest object ${key} has invalid stability`, manifestPath))
    }
    if ((object as any).objectRefs !== undefined) {
      if (!Array.isArray((object as any).objectRefs) || !(object as any).objectRefs.every(isContentObjectKey)) {
        issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_OBJECT_REFS', `Manifest object ${key} has invalid objectRefs`, manifestPath))
      }
    }
  }

  for (const object of manifest.objects) {
    if (!isObject(object) || !Array.isArray((object as any).objectRefs)) continue
    for (const objectRef of (object as any).objectRefs) {
      if (isContentObjectKey(objectRef) && !keys.has(objectRef)) {
        issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_OBJECT_REF_MISSING', `Manifest object ${(object as any).key} references missing ${objectRef}`, manifestPath))
      }
    }
  }

  return { path: manifestPath, keys, expectedKeys, objects }
}

const loadClaimCheckHandoffValidator = (issues: Issue[]): ClaimCheckHandoffValidator | null => {
  try {
    require('ts-node').register({
      transpileOnly: true,
      compilerOptions: { module: 'commonjs' },
    })

    const modulePath = path.join(process.cwd(), 'lib', 'claimCheckHandoffIntegrity.ts')
    const mod = require(modulePath) as { validateClaimCheckHandoffIntegrity?: ClaimCheckHandoffValidator }
    if (typeof mod.validateClaimCheckHandoffIntegrity !== 'function') {
      issues.push(ISSUE('error', 'CLAIM_CHECK_HANDOFF_VALIDATOR_LOAD', `Claim-check handoff validator export is missing`, modulePath))
      return null
    }
    return mod.validateClaimCheckHandoffIntegrity
  } catch (e: any) {
    issues.push(
      ISSUE(
        'error',
        'CLAIM_CHECK_HANDOFF_VALIDATOR_LOAD',
        `Failed to load claim-check handoff validator: ${e?.message ?? String(e)}`,
        path.join(process.cwd(), 'lib', 'claimCheckHandoffIntegrity.ts')
      )
    )
    return null
  }
}

const loadClaimEvidenceReviewQueueModule = (
  issues: Issue[]
): {
  buildClaimEvidenceReviewQueueArtifact: ClaimEvidenceReviewQueueBuilder
  formatClaimEvidenceReviewQueueMarkdown: ClaimEvidenceReviewQueueMarkdownFormatter
} | null => {
  try {
    require('ts-node').register({
      transpileOnly: true,
      compilerOptions: { module: 'commonjs' },
    })

    const modulePath = path.join(process.cwd(), 'lib', 'claimEvidenceReviewQueue.ts')
    const mod = require(modulePath) as {
      buildClaimEvidenceReviewQueueArtifact?: ClaimEvidenceReviewQueueBuilder
      formatClaimEvidenceReviewQueueMarkdown?: ClaimEvidenceReviewQueueMarkdownFormatter
    }
    if (typeof mod.buildClaimEvidenceReviewQueueArtifact !== 'function') {
      issues.push(ISSUE('error', 'CLAIM_EVIDENCE_REVIEW_QUEUE_LOAD', `Claim evidence review queue export is missing`, modulePath))
      return null
    }
    if (typeof mod.formatClaimEvidenceReviewQueueMarkdown !== 'function') {
      issues.push(ISSUE('error', 'CLAIM_EVIDENCE_REVIEW_QUEUE_LOAD', `Claim evidence review queue markdown formatter export is missing`, modulePath))
      return null
    }
    return {
      buildClaimEvidenceReviewQueueArtifact: mod.buildClaimEvidenceReviewQueueArtifact,
      formatClaimEvidenceReviewQueueMarkdown: mod.formatClaimEvidenceReviewQueueMarkdown,
    }
  } catch (e: any) {
    issues.push(
      ISSUE(
        'error',
        'CLAIM_EVIDENCE_REVIEW_QUEUE_LOAD',
        `Failed to load claim evidence review queue builder: ${e?.message ?? String(e)}`,
        path.join(process.cwd(), 'lib', 'claimEvidenceReviewQueue.ts')
      )
    )
    return null
  }
}

const loadClaimEvidenceReviewSourceIdValidator = (issues: Issue[]): ClaimEvidenceReviewSourceIdValidator | null => {
  try {
    require('ts-node').register({
      transpileOnly: true,
      compilerOptions: { module: 'commonjs' },
    })

    const modulePath = path.join(process.cwd(), 'lib', 'claimEvidenceReview.ts')
    const mod = require(modulePath) as {
      validateSubstantiveEvidenceReviewSourceIds?: ClaimEvidenceReviewSourceIdValidator
    }
    if (typeof mod.validateSubstantiveEvidenceReviewSourceIds !== 'function') {
      issues.push(ISSUE('error', 'CLAIM_EVIDENCE_REVIEW_SOURCE_ID_VALIDATOR_LOAD', `Claim evidence review source-id validator export is missing`, modulePath))
      return null
    }
    return mod.validateSubstantiveEvidenceReviewSourceIds
  } catch (e: any) {
    issues.push(
      ISSUE(
        'error',
        'CLAIM_EVIDENCE_REVIEW_SOURCE_ID_VALIDATOR_LOAD',
        `Failed to load claim evidence review source-id validator: ${e?.message ?? String(e)}`,
        path.join(process.cwd(), 'lib', 'claimEvidenceReview.ts')
      )
    )
    return null
  }
}

const assertClaimEvidenceReviewSourceIdValidatorFixture = (
  claimEvidenceReviewSourceIdValidator: ClaimEvidenceReviewSourceIdValidator | null,
  issues: Issue[]
) => {
  if (!claimEvidenceReviewSourceIdValidator) return

  const fixturePath = path.join(process.cwd(), 'scripts', 'validate-content.ts')
  const knownSourceIds = new Set(['listed-source'])
  const tooLongSourceId = `source-${'x'.repeat(81)}`
  const fixtures: Array<{
    label: string
    value: unknown
    expectedCodes: string[]
  }> = [
    { label: 'valid listed source_id', value: ['listed-source'], expectedCodes: [] },
    { label: 'blank source_id', value: [' '], expectedCodes: ['ITEM', 'MISSING'] },
    { label: 'unlisted source_id', value: ['missing-source'], expectedCodes: ['MISSING', 'UNKNOWN'] },
    { label: 'non-string source_id', value: [123], expectedCodes: ['ITEM', 'MISSING'] },
    { label: 'too-long source_id', value: [tooLongSourceId], expectedCodes: ['ITEM', 'MISSING'] },
  ]
  const formatCodes = (codes: string[]) => (codes.length ? codes.join(', ') : 'none')

  for (const fixture of fixtures) {
    const actualCodes = claimEvidenceReviewSourceIdValidator(fixture.value, knownSourceIds)
      .map((issue) => issue.code)
      .sort()
    const expectedCodes = [...fixture.expectedCodes].sort()
    const matches =
      actualCodes.length === expectedCodes.length &&
      actualCodes.every((code, index) => code === expectedCodes[index])

    if (!matches) {
      issues.push(
        ISSUE(
          'error',
          'VALIDATE_CONTENT_SUBSTANTIVE_SOURCE_ID_FIXTURE',
          `source-id fixture '${fixture.label}' expected ${formatCodes(expectedCodes)} but got ${formatCodes(actualCodes)}`,
          fixturePath
        )
      )
    }
  }
}

const validateContentObjectManifestExactSet = (manifest: ContentObjectManifestContext, issues: Issue[]) => {
  for (const key of manifest.keys) {
    if (!manifest.expectedKeys.has(key)) {
      issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_STALE_EXTRA', `Manifest has stale or unexpected object key: ${key}`, manifest.path))
    }
  }

  for (const key of manifest.expectedKeys) {
    if (!manifest.keys.has(key)) {
      issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_MISSING_EXPECTED', `Manifest is missing expected object key: ${key}`, manifest.path))
    }
  }
}

const validateClaimEvidenceReviewQueue = (
  contentRoot: string,
  queueModule: {
    buildClaimEvidenceReviewQueueArtifact: ClaimEvidenceReviewQueueBuilder
    formatClaimEvidenceReviewQueueMarkdown: ClaimEvidenceReviewQueueMarkdownFormatter
  } | null,
  issues: Issue[]
) => {
  if (!queueModule) return

  const queuePath = path.join(contentRoot, '_generated', 'claim-evidence-review-queue.json')
  const queueMarkdownPath = path.join(contentRoot, '_agent', 'CLAIM_EVIDENCE_REVIEW_QUEUE.md')
  if (!exists(queuePath)) {
    issues.push(ISSUE('error', 'CLAIM_EVIDENCE_REVIEW_QUEUE_MISSING', `Missing generated claim evidence review queue. Run npm run generate-claim-evidence-review-queue.`, queuePath))
    return
  }
  if (!exists(queueMarkdownPath)) {
    issues.push(ISSUE('error', 'CLAIM_EVIDENCE_REVIEW_QUEUE_MARKDOWN_MISSING', `Missing generated claim evidence review markdown queue. Run npm run generate-claim-evidence-review-queue.`, queueMarkdownPath))
    return
  }

  try {
    const { loadConceptMetas } = require(path.join(process.cwd(), 'lib', 'contentLoader.ts')) as {
      loadConceptMetas: (contentRoot?: string) => Record<string, unknown>[]
    }
    const artifact = queueModule.buildClaimEvidenceReviewQueueArtifact(loadConceptMetas(contentRoot))
    const expected = `${JSON.stringify(artifact, null, 2)}\n`
    const actual = readFile(queuePath)
    if (actual !== expected) {
      issues.push(ISSUE('error', 'CLAIM_EVIDENCE_REVIEW_QUEUE_STALE', `Generated claim evidence review queue is stale. Run npm run generate-claim-evidence-review-queue.`, queuePath))
    }

    const expectedMarkdown = queueModule.formatClaimEvidenceReviewQueueMarkdown(artifact)
    const actualMarkdown = readFile(queueMarkdownPath)
    if (actualMarkdown !== expectedMarkdown) {
      issues.push(ISSUE('error', 'CLAIM_EVIDENCE_REVIEW_QUEUE_MARKDOWN_STALE', `Generated claim evidence review markdown queue is stale. Run npm run generate-claim-evidence-review-queue.`, queueMarkdownPath))
    }
  } catch (e: any) {
    issues.push(
      ISSUE(
        'error',
        'CLAIM_EVIDENCE_REVIEW_QUEUE_VALIDATE',
        `Failed to validate claim evidence review queue: ${e?.message ?? String(e)}`,
        queuePath
      )
    )
  }
}

const loadLegacyConceptIds = (): Set<string> => {
  // We avoid importing TS modules here to keep ts-node execution robust.
  const legacyPath = path.join(process.cwd(), 'data', 'foundationsData.ts')
  if (!exists(legacyPath)) return new Set()
  const text = readFile(legacyPath)
  const ids = new Set<string>()
  const re = /\bid:\s*'([^']+)'\s*,/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) ids.add(m[1])
  return ids
}

const loadQueuedConceptCoverage = (contentRoot: string, issues: Issue[]): Set<string> => {
  const todoPath = path.join(contentRoot, '_agent', 'TODO.yaml')
  const covered = new Set<string>()
  if (!exists(todoPath)) return covered

  const doc = parseYaml(todoPath, issues)
  if (!isObject(doc)) return covered

  const queue = (doc as any).queue
  if (!Array.isArray(queue)) return covered

  for (const item of queue) {
    if (!isObject(item)) continue

    const status = typeof (item as any).status === 'string' ? (item as any).status : ''
    if (status === 'done' || status === 'cancelled') continue

    const id = (item as any).id
    if (typeof id === 'string' && id.trim()) covered.add(id.trim())

    const covers = (item as any).covers
    if (Array.isArray(covers)) {
      for (const conceptId of covers) {
        if (typeof conceptId === 'string' && conceptId.trim()) covered.add(conceptId.trim())
      }
    }
  }

  return covered
}

const validateDomainYaml = (domainId: string, domainYamlPath: string, issues: Issue[]) => {
  const doc = parseYaml(domainYamlPath, issues)
  if (!isObject(doc)) {
    issues.push(ISSUE('error', 'DOMAIN_SCHEMA', `Domain metadata must be a YAML object`, domainYamlPath))
    return
  }

  const title = doc.title
  const description = doc.description
  const icon = doc.icon
  const color = doc.color
  const order = doc.order

  if (typeof title !== 'string' || !title.trim()) issues.push(ISSUE('error', 'DOMAIN_TITLE', `Missing/invalid title`, domainYamlPath))
  if (typeof description !== 'string' || !description.trim()) issues.push(ISSUE('error', 'DOMAIN_DESC', `Missing/invalid description`, domainYamlPath))
  if (typeof icon !== 'string' || !icon.trim()) issues.push(ISSUE('warn', 'DOMAIN_ICON', `Missing/invalid icon (lucide name recommended)`, domainYamlPath))
  if (typeof color !== 'string' || !HEX_RE.test(color)) issues.push(ISSUE('warn', 'DOMAIN_COLOR', `Missing/invalid color (expected #RRGGBB)`, domainYamlPath))
  if (typeof order !== 'number' || !Number.isFinite(order)) issues.push(ISSUE('warn', 'DOMAIN_ORDER', `Missing/invalid order (number)`, domainYamlPath))

  // Domain id is derived from folder name; we don't require it in YAML.
  if (domainId.includes(' ')) issues.push(ISSUE('warn', 'DOMAIN_ID', `Domain folder should be kebab-case (no spaces): ${domainId}`, domainYamlPath))
}

const normalizedConceptSources = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) return []

  return value
    .filter(isObject)
    .map((source) => ({
      id: typeof source.id === 'string' ? source.id : '',
      title: typeof source.title === 'string' ? source.title : '',
      authors: typeof source.authors === 'string' ? source.authors : undefined,
      year: typeof source.year === 'number' && Number.isFinite(source.year) ? source.year : undefined,
      kind: typeof source.kind === 'string' ? source.kind : undefined,
      url: typeof source.url === 'string' ? source.url : undefined,
      note: typeof source.note === 'string' ? source.note : undefined,
    }))
    .filter((source) => source.id && source.title)
}

const normalizedConceptClaimChecks = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) return []

  return value
    .filter(isObject)
    .map((claimCheck) => ({
      id: typeof claimCheck.id === 'string' ? claimCheck.id : '',
      claim: typeof claimCheck.claim === 'string' ? claimCheck.claim : '',
      status: typeof claimCheck.status === 'string' ? claimCheck.status : 'needs-review',
      source_ids: Array.isArray(claimCheck.source_ids) ? claimCheck.source_ids.map(String).filter(Boolean) : undefined,
      support: typeof claimCheck.support === 'string' ? claimCheck.support : undefined,
      caveat: typeof claimCheck.caveat === 'string' ? claimCheck.caveat : undefined,
      object_refs: Array.isArray(claimCheck.object_refs) ? claimCheck.object_refs.map(String).filter(Boolean) : undefined,
      evidence_review: isObject(claimCheck.evidence_review)
        ? {
            state: typeof claimCheck.evidence_review.state === 'string' ? claimCheck.evidence_review.state : 'source-linked',
            reviewed_at: typeof claimCheck.evidence_review.reviewed_at === 'string' ? claimCheck.evidence_review.reviewed_at : undefined,
            reviewer: typeof claimCheck.evidence_review.reviewer === 'string' ? claimCheck.evidence_review.reviewer : undefined,
            summary: typeof claimCheck.evidence_review.summary === 'string' ? claimCheck.evidence_review.summary : undefined,
          }
        : undefined,
    }))
    .filter((claimCheck) => claimCheck.id && claimCheck.claim)
}

const validateConceptYaml = (
  conceptDir: string,
  domainId: string,
  conceptYamlPath: string,
  contentMdxPath: string,
  issues: Issue[],
  contentConceptIds: Set<string>,
  legacyConceptIds: Set<string>,
  queuedConceptCoverage: Set<string>,
  contentObjectManifest: ContentObjectManifestContext,
  claimCheckHandoffValidator: ClaimCheckHandoffValidator | null,
  claimEvidenceReviewSourceIdValidator: ClaimEvidenceReviewSourceIdValidator | null
) => {
  const doc = parseYaml(conceptYamlPath, issues)
  if (!isObject(doc)) {
    issues.push(ISSUE('error', 'CONCEPT_SCHEMA', `Concept metadata must be a YAML object`, conceptYamlPath))
    return
  }
  const hasContentMdx = exists(contentMdxPath)
  const mdx = hasContentMdx ? readFile(contentMdxPath) : ''
  const generatedObjectRefs = getGeneratedConceptObjectRefs(mdx)

  const requiredString = (key: string) => {
    const v = (doc as any)[key]
    if (typeof v !== 'string' || !v.trim()) issues.push(ISSUE('error', 'CONCEPT_FIELD', `Missing/invalid ${key}`, conceptYamlPath))
    return v
  }

  const id = requiredString('id')
  const title = requiredString('title')
  const domain = requiredString('domain')
  const slug = requiredString('slug')

  const conceptFolder = path.basename(conceptDir)
  if (typeof id === 'string' && id !== conceptFolder) {
    issues.push(ISSUE('warn', 'CONCEPT_ID_FOLDER', `concept.yaml id (${id}) does not match folder name (${conceptFolder})`, conceptYamlPath))
  }

  if (typeof domain === 'string' && domain !== domainId) {
    issues.push(ISSUE('error', 'CONCEPT_DOMAIN', `concept.yaml domain (${domain}) must match domain folder (${domainId})`, conceptYamlPath))
  }

  if (typeof slug === 'string' && slug !== id) {
    issues.push(ISSUE('warn', 'CONCEPT_SLUG', `slug (${slug}) usually matches id (${id})`, conceptYamlPath))
  }

  const difficulty = (doc as any).difficulty
  if (typeof difficulty !== 'number' || difficulty < 1 || difficulty > 5) {
    issues.push(ISSUE('warn', 'CONCEPT_DIFFICULTY', `difficulty should be 1..5`, conceptYamlPath))
  }

  const status = (doc as any).status
  if (!oneOf(status, ['draft', 'review', 'published'] as const)) {
    issues.push(ISSUE('error', 'CONCEPT_STATUS', `status must be one of: draft | review | published`, conceptYamlPath))
  }

  const importance = (doc as any).importance
  if (!oneOf(importance, ['critical', 'important', 'supplementary', 'advanced'] as const)) {
    issues.push(ISSUE('warn', 'CONCEPT_IMPORTANCE', `importance should be one of: critical | important | supplementary | advanced`, conceptYamlPath))
  }

  const mathLevel = (doc as any).math_level
  if (!oneOf(mathLevel, ['intuitive', 'highschool', 'undergraduate', 'graduate', 'research'] as const)) {
    issues.push(ISSUE('warn', 'CONCEPT_MATH_LEVEL', `math_level should be one of: intuitive | highschool | undergraduate | graduate | research`, conceptYamlPath))
  }

  const shortDesc = (doc as any).short_description
  if (typeof shortDesc !== 'string' || shortDesc.trim().length < 10) {
    issues.push(ISSUE('warn', 'CONCEPT_SHORT_DESC', `short_description should be a helpful sentence (>= 10 chars)`, conceptYamlPath))
  }

  const author = (doc as any).author
  if (typeof author !== 'string' || !author.trim()) issues.push(ISSUE('warn', 'CONCEPT_AUTHOR', `Missing/invalid author`, conceptYamlPath))

  const created = (doc as any).created
  const updated = (doc as any).updated
  if (typeof created !== 'string' || !DATE_RE.test(created)) issues.push(ISSUE('warn', 'CONCEPT_CREATED', `created should be YYYY-MM-DD`, conceptYamlPath))
  if (typeof updated !== 'string' || !DATE_RE.test(updated)) issues.push(ISSUE('warn', 'CONCEPT_UPDATED', `updated should be YYYY-MM-DD`, conceptYamlPath))
  if (typeof created === 'string' && typeof updated === 'string' && DATE_RE.test(created) && DATE_RE.test(updated) && updated < created) {
    issues.push(ISSUE('warn', 'CONCEPT_DATE_ORDER', `updated (${updated}) is earlier than created (${created})`, conceptYamlPath))
  }

  const estimated = (doc as any).estimated_read_time
  if (typeof estimated !== 'number' || !Number.isFinite(estimated) || estimated <= 0) {
    issues.push(ISSUE('warn', 'CONCEPT_ERT', `estimated_read_time should be a positive number`, conceptYamlPath))
  }

  const prereqs = (doc as any).prerequisites
  if (!Array.isArray(prereqs)) {
    issues.push(ISSUE('error', 'CONCEPT_PREREQS', `prerequisites must be a list`, conceptYamlPath))
  } else {
    for (const p of prereqs) {
      if (typeof p !== 'string' || !p.trim()) {
        issues.push(ISSUE('error', 'CONCEPT_PREREQ_ITEM', `prerequisites must contain only strings`, conceptYamlPath))
        continue
      }

      const plannedPrereq = getPlannedConceptId(p)
      if (plannedPrereq !== null) {
        issues.push(ISSUE('error', 'CONCEPT_PREREQ_PLANNED', `Prerequisite '${p}' is planned; published prerequisites must be readable now`, conceptYamlPath))
        continue
      }

      const ok = contentConceptIds.has(p) || legacyConceptIds.has(p)
      if (!ok) {
        issues.push(ISSUE('error', 'CONCEPT_PREREQ_MISSING', `Prerequisite '${p}' does not exist (content/ or legacy foundationsData.ts)`, conceptYamlPath))
      }
    }
  }

  for (const field of ['leads_to', 'related'] as const) {
    const refs = (doc as any)[field]
    if (refs === undefined) continue
    if (!Array.isArray(refs)) {
      issues.push(ISSUE('warn', 'CONCEPT_LINKS', `${field} should be a list`, conceptYamlPath))
      continue
    }

    for (const ref of refs) {
      if (typeof ref !== 'string' || !ref.trim()) {
        issues.push(ISSUE('warn', 'CONCEPT_LINK_ITEM', `${field} must contain only strings`, conceptYamlPath))
        continue
      }

      const plannedId = getPlannedConceptId(ref)
      if (plannedId !== null) {
        const plannedSeverity: Severity = status === 'published' ? 'error' : 'warn'
        if (!plannedId) {
          issues.push(ISSUE(plannedSeverity, 'CONCEPT_PLANNED_EMPTY', `${field} has an empty planned concept reference`, conceptYamlPath))
          continue
        }
        if (contentConceptIds.has(plannedId) || legacyConceptIds.has(plannedId)) {
          issues.push(ISSUE(plannedSeverity, 'CONCEPT_PLANNED_EXISTS', `${field} concept '${ref}' is marked planned but already exists; link to '${plannedId}' directly`, conceptYamlPath))
        }
        if (!queuedConceptCoverage.has(plannedId)) {
          issues.push(ISSUE(plannedSeverity, 'CONCEPT_PLANNED_UNQUEUED', `${field} concept '${ref}' must be covered by a pending/in-progress TODO.yaml queue item`, conceptYamlPath))
        }
        continue
      }

      if (!conceptRefExists(ref, contentConceptIds, legacyConceptIds)) {
        const missingSeverity: Severity = status === 'published' ? 'error' : 'warn'
        issues.push(ISSUE(missingSeverity, 'CONCEPT_LINK_MISSING', `${field} concept '${ref}' does not exist; use planned:${ref} only when intentionally queued`, conceptYamlPath))
      }
    }
  }

  const hasVizFlag = (doc as any).has_visualization
  const hasVizFile = exists(path.join(conceptDir, 'viz.tsx'))
  if (typeof hasVizFlag === 'boolean' && hasVizFlag !== hasVizFile) {
    issues.push(ISSUE('warn', 'CONCEPT_VIZ_FLAG', `has_visualization=${hasVizFlag} but viz.tsx ${hasVizFile ? 'exists' : 'is missing'}`, conceptYamlPath))
  }

  const hasDemoFlag = (doc as any).has_interactive_demo
  if (typeof hasDemoFlag === 'boolean' && hasDemoFlag && !hasVizFile) {
    issues.push(ISSUE(status === 'published' ? 'error' : 'warn', 'CONCEPT_DEMO_FLAG', `has_interactive_demo=true but no viz.tsx found`, conceptYamlPath))
  }

  if (typeof domain === 'string' && typeof id === 'string') {
    requireManifestKey(contentObjectManifest, conceptContentObjectKey('concept', domain, id), issues, conceptYamlPath, 'concept object')
    requireManifestKey(contentObjectManifest, buildContentObjectKey('route', ['domains', domain, id]), issues, conceptYamlPath, 'concept route object')
    requireManifestKey(contentObjectManifest, conceptContentObjectKey('source', domain, id, 'sources'), issues, conceptYamlPath, 'source-grounding object')
    requireManifestKey(contentObjectManifest, conceptContentObjectKey('claim', domain, id, 'central-claim'), issues, conceptYamlPath, 'central-claim object')
    requireManifestKey(
      contentObjectManifest,
      conceptContentObjectKey('misconception', domain, id, 'likely-misconception'),
      issues,
      conceptYamlPath,
      'likely-misconception object'
    )

    const demoKey = conceptContentObjectKey('demo', domain, id, 'interactive-demo')
    if (hasDemoFlag === true && hasVizFile) {
      requireManifestKey(contentObjectManifest, demoKey, issues, conceptYamlPath, 'interactive demo object')
    } else if (demoKey && contentObjectManifest.keys.has(demoKey)) {
      issues.push(ISSUE('error', 'CONTENT_OBJECT_MANIFEST_UNEXPECTED_DEMO', `Manifest has demo object for a concept without a real interactive demo: ${demoKey}`, conceptYamlPath))
    }

    for (const objectRef of generatedObjectRefs) {
      if (MATH_OBJECT_REF_RE.test(objectRef)) {
        requireManifestKey(
          contentObjectManifest,
          conceptContentObjectKey('equation', domain, id, objectRef.slice(1)),
          issues,
          conceptYamlPath,
          `equation object ${objectRef.slice(1)}`
        )
      } else if (CODE_WITNESS_REF_RE.test(objectRef)) {
        requireManifestKey(
          contentObjectManifest,
          conceptContentObjectKey('code', domain, id, objectRef.slice(1)),
          issues,
          conceptYamlPath,
          `code object ${objectRef.slice(1)}`
        )
      }
    }
  }

  const hasCodeFlag = (doc as any).has_code_example
  if (hasCodeFlag !== undefined && typeof hasCodeFlag !== 'boolean') {
    issues.push(ISSUE('warn', 'CONCEPT_CODE_FLAG', `has_code_example should be a boolean`, conceptYamlPath))
  }

  const sources = (doc as any).sources
  const sourceIds = new Set<string>()
  const sourceSpanRefs = new Set<string>()
  if (sources !== undefined) {
    if (!Array.isArray(sources)) {
      issues.push(ISSUE('warn', 'CONCEPT_SOURCES', `sources should be a list`, conceptYamlPath))
    } else if (sources.length > 8) {
      issues.push(ISSUE('warn', 'CONCEPT_SOURCES_COUNT', `sources should stay compact (<= 8 items)`, conceptYamlPath))
    } else {
      for (const [sourceIndex, source] of sources.entries()) {
        if (!isObject(source)) {
          issues.push(ISSUE('warn', 'CONCEPT_SOURCE_ITEM', `sources must contain objects`, conceptYamlPath))
          continue
        }

        if (typeof source.id !== 'string' || !source.id.trim() || source.id.length > 80) {
          issues.push(ISSUE('warn', 'CONCEPT_SOURCE_ID', `source.id should be a short string`, conceptYamlPath))
        } else {
          sourceIds.add(source.id)
        }
        if (typeof source.title !== 'string' || !source.title.trim() || source.title.length > 180) {
          issues.push(ISSUE('warn', 'CONCEPT_SOURCE_TITLE', `source.title should be a useful title`, conceptYamlPath))
        }
        if (source.kind !== undefined && (typeof source.kind !== 'string' || !SOURCE_KINDS.has(source.kind))) {
          issues.push(ISSUE('warn', 'CONCEPT_SOURCE_KIND', `source.kind should be one of: ${Array.from(SOURCE_KINDS).join(' | ')}`, conceptYamlPath))
        }
        if (source.authors !== undefined && (typeof source.authors !== 'string' || source.authors.length > 160)) {
          issues.push(ISSUE('warn', 'CONCEPT_SOURCE_AUTHORS', `source.authors should be a compact string`, conceptYamlPath))
        }
        if (source.year !== undefined && (typeof source.year !== 'number' || source.year < 1800 || source.year > 2100)) {
          issues.push(ISSUE('warn', 'CONCEPT_SOURCE_YEAR', `source.year should be a plausible number`, conceptYamlPath))
        }
        if (source.url !== undefined && !isHttpUrl(source.url)) {
          issues.push(ISSUE('warn', 'CONCEPT_SOURCE_URL', `source.url should be http(s)`, conceptYamlPath))
        }
        if (source.note !== undefined && (typeof source.note !== 'string' || source.note.length > 240)) {
          issues.push(ISSUE('warn', 'CONCEPT_SOURCE_NOTE', `source.note should be a compact grounding note`, conceptYamlPath))
        }
        const sourceIdForManifest = typeof source.id === 'string' ? source.id : ''
        const sourceCanEmitManifestObject =
          Boolean(sourceIdForManifest.trim()) &&
          typeof source.title === 'string' &&
          Boolean(source.title.trim())
        if (typeof domain === 'string' && typeof id === 'string' && sourceCanEmitManifestObject) {
          const segment = SOURCE_SEGMENT_RE.test(sourceIdForManifest) ? sourceIdForManifest : `source-${sourceIndex + 1}`
          requireManifestKey(contentObjectManifest, conceptContentObjectKey('source', domain, id, segment), issues, conceptYamlPath, `source object '${segment}'`)
        }
        if (sourceCanEmitManifestObject && typeof source.note === 'string' && source.note.trim()) {
          const segment = SOURCE_SEGMENT_RE.test(sourceIdForManifest) ? sourceIdForManifest : `source-${sourceIndex + 1}`
          sourceSpanRefs.add(`#source-span-${segment}`)
          if (typeof domain === 'string' && typeof id === 'string') {
            requireManifestKey(
              contentObjectManifest,
              conceptContentObjectKey('source-span', domain, id, segment),
              issues,
              conceptYamlPath,
              `source-span object '${segment}'`
            )
          }
        }
      }
    }
  }

  const claimChecks = (doc as any).claim_checks
  if (claimChecks !== undefined) {
    if (!Array.isArray(claimChecks)) {
      issues.push(ISSUE('warn', 'CONCEPT_CLAIM_CHECKS', `claim_checks should be a list`, conceptYamlPath))
    } else if (claimChecks.length > 6) {
      issues.push(ISSUE('warn', 'CONCEPT_CLAIM_CHECKS_COUNT', `claim_checks should stay compact (<= 6 items)`, conceptYamlPath))
    } else {
      for (const claimCheck of claimChecks) {
        if (!isObject(claimCheck)) {
          issues.push(ISSUE('warn', 'CONCEPT_CLAIM_CHECK_ITEM', `claim_checks must contain objects`, conceptYamlPath))
          continue
        }

        if (typeof claimCheck.id !== 'string' || !SOURCE_SEGMENT_RE.test(claimCheck.id)) {
          issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_ID', `claim_check.id should be a lowercase discussion segment`, conceptYamlPath))
        } else if (typeof domain === 'string' && typeof id === 'string') {
          requireManifestKey(
            contentObjectManifest,
            conceptContentObjectKey('claim', domain, id, claimCheck.id),
            issues,
            conceptYamlPath,
            `claim_check object '${claimCheck.id}'`
          )
        }
        if (typeof claimCheck.claim !== 'string' || !claimCheck.claim.trim() || claimCheck.claim.length > 320) {
          issues.push(ISSUE('warn', 'CONCEPT_CLAIM_CHECK_CLAIM', `claim_check.claim should be a compact claim`, conceptYamlPath))
        }
        if (typeof claimCheck.status !== 'string' || !CLAIM_CHECK_STATUSES.has(claimCheck.status)) {
          issues.push(ISSUE('warn', 'CONCEPT_CLAIM_CHECK_STATUS', `claim_check.status should be one of: ${Array.from(CLAIM_CHECK_STATUSES).join(' | ')}`, conceptYamlPath))
        }
        if (claimCheck.support !== undefined && (typeof claimCheck.support !== 'string' || claimCheck.support.length > 420)) {
          issues.push(ISSUE('warn', 'CONCEPT_CLAIM_CHECK_SUPPORT', `claim_check.support should be a compact support note`, conceptYamlPath))
        }
        if (claimCheck.caveat !== undefined && (typeof claimCheck.caveat !== 'string' || claimCheck.caveat.length > 280)) {
          issues.push(ISSUE('warn', 'CONCEPT_CLAIM_CHECK_CAVEAT', `claim_check.caveat should be compact`, conceptYamlPath))
        }
        if (claimCheck.source_ids !== undefined) {
          if (!Array.isArray(claimCheck.source_ids) || claimCheck.source_ids.length > 6) {
            issues.push(ISSUE('warn', 'CONCEPT_CLAIM_CHECK_SOURCE_IDS', `claim_check.source_ids should be a compact list`, conceptYamlPath))
          } else {
            for (const sourceId of claimCheck.source_ids) {
              if (typeof sourceId !== 'string' || !sourceId.trim() || sourceId.length > 80) {
                issues.push(ISSUE('warn', 'CONCEPT_CLAIM_CHECK_SOURCE_ID', `claim_check.source_ids must contain short strings`, conceptYamlPath))
              } else if (!sourceIds.has(sourceId)) {
                issues.push(ISSUE('warn', 'CONCEPT_CLAIM_CHECK_SOURCE_MISSING', `claim_check source_id '${sourceId}' is not listed in sources`, conceptYamlPath))
              }
            }
          }
        }
        if (claimCheck.object_refs !== undefined) {
          if (!Array.isArray(claimCheck.object_refs) || claimCheck.object_refs.length > 8) {
            issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_OBJECT_REFS', `claim_check.object_refs should be a compact list`, conceptYamlPath))
          } else {
            for (const objectRef of claimCheck.object_refs) {
              if (typeof objectRef !== 'string' || objectRef.length > 120 || !objectRef.startsWith('#') || objectRef.includes(' ')) {
                issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_OBJECT_REF', `claim_check.object_refs should be fragment hrefs like #math-object-1`, conceptYamlPath))
                continue
              }

              const objectKey = typeof domain === 'string' && typeof id === 'string'
                ? contentObjectKeyForConceptObjectRef(domain, id, objectRef)
                : null
              if (!objectKey) {
                issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_OBJECT_REF_UNSUPPORTED', `claim_check.object_ref '${objectRef}' must map to a source-span, equation, code, or demo object`, conceptYamlPath))
                continue
              }

              let objectRefResolvesLocally = true
              if ((MATH_OBJECT_REF_RE.test(objectRef) || CODE_WITNESS_REF_RE.test(objectRef)) && !generatedObjectRefs.has(objectRef)) {
                objectRefResolvesLocally = false
                issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_OBJECT_REF_MISSING', `claim_check.object_ref '${objectRef}' does not match an extracted math/code object`, conceptYamlPath))
              } else if (objectRef.startsWith('#source-span-') && !sourceSpanRefs.has(objectRef)) {
                objectRefResolvesLocally = false
                issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_OBJECT_REF_MISSING', `claim_check.object_ref '${objectRef}' does not match a source note span`, conceptYamlPath))
              } else if (objectRef === '#interactive-demo' && !(hasDemoFlag === true && hasVizFile)) {
                objectRefResolvesLocally = false
                issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_OBJECT_REF_MISSING', `claim_check.object_ref '#interactive-demo' requires an interactive demo`, conceptYamlPath))
              }

              if (!objectRefResolvesLocally) continue

              requireManifestKey(contentObjectManifest, objectKey, issues, conceptYamlPath, `claim_check.object_ref '${objectRef}'`)
            }
          }
        }
        if (claimCheck.evidence_review !== undefined) {
          if (!isObject(claimCheck.evidence_review)) {
            issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_EVIDENCE_REVIEW', `claim_check.evidence_review must be an object when present`, conceptYamlPath))
          } else {
            const review = claimCheck.evidence_review as Record<string, unknown>
            const reviewState = review.state
            if (typeof reviewState !== 'string' || !CLAIM_EVIDENCE_REVIEW_STATES.has(reviewState)) {
              issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_EVIDENCE_REVIEW_STATE', `claim_check.evidence_review.state should be one of: ${Array.from(CLAIM_EVIDENCE_REVIEW_STATES).join(' | ')}`, conceptYamlPath))
            }
            if (review.reviewed_at !== undefined && (typeof review.reviewed_at !== 'string' || !DATE_RE.test(review.reviewed_at))) {
              issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_EVIDENCE_REVIEW_DATE', `claim_check.evidence_review.reviewed_at must be YYYY-MM-DD when present`, conceptYamlPath))
            }
            if (review.reviewer !== undefined && (typeof review.reviewer !== 'string' || !review.reviewer.trim() || review.reviewer.length > 80)) {
              issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_EVIDENCE_REVIEW_REVIEWER', `claim_check.evidence_review.reviewer must be a compact string when present`, conceptYamlPath))
            }
            if (review.summary !== undefined && (typeof review.summary !== 'string' || !review.summary.trim() || review.summary.length > 520)) {
              issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_EVIDENCE_REVIEW_SUMMARY', `claim_check.evidence_review.summary must be a bounded review note when present`, conceptYamlPath))
            }
            if (reviewState === 'substantive-reviewed') {
              if (typeof review.reviewed_at !== 'string' || !DATE_RE.test(review.reviewed_at)) {
                issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_SUBSTANTIVE_REVIEW_DATE', `substantive-reviewed claim_checks need evidence_review.reviewed_at`, conceptYamlPath))
              }
              if (typeof review.reviewer !== 'string' || !review.reviewer.trim()) {
                issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_SUBSTANTIVE_REVIEW_REVIEWER', `substantive-reviewed claim_checks need evidence_review.reviewer`, conceptYamlPath))
              }
              if (typeof review.summary !== 'string' || !review.summary.trim()) {
                issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_SUBSTANTIVE_REVIEW_SUMMARY', `substantive-reviewed claim_checks need evidence_review.summary`, conceptYamlPath))
              }
              const sourceIdIssues = claimEvidenceReviewSourceIdValidator
                ? claimEvidenceReviewSourceIdValidator(claimCheck.source_ids, sourceIds)
                : []
              for (const sourceIdIssue of sourceIdIssues) {
                issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_SUBSTANTIVE_REVIEW_SOURCE_IDS', sourceIdIssue.message, conceptYamlPath))
              }
              if (typeof claimCheck.support !== 'string' || !claimCheck.support.trim()) {
                issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_SUBSTANTIVE_REVIEW_SUPPORT', `substantive-reviewed claim_checks need support`, conceptYamlPath))
              }
              if (typeof claimCheck.caveat !== 'string' || !claimCheck.caveat.trim()) {
                issues.push(ISSUE('error', 'CONCEPT_CLAIM_CHECK_SUBSTANTIVE_REVIEW_CAVEAT', `substantive-reviewed claim_checks need caveat`, conceptYamlPath))
              }
            }
          }
        }
        if (claimCheck.status === 'source-checked' && (!Array.isArray(claimCheck.source_ids) || !claimCheck.source_ids.length || typeof claimCheck.support !== 'string' || !claimCheck.support.trim())) {
          issues.push(ISSUE('warn', 'CONCEPT_CLAIM_CHECK_SOURCE_CHECKED', `source-checked claim_checks need source_ids and support`, conceptYamlPath))
        }
      }
    }
  }

  if (
    claimCheckHandoffValidator &&
    contentObjectManifest.objects.length &&
    typeof id === 'string' &&
    typeof title === 'string' &&
    typeof domain === 'string' &&
    typeof slug === 'string' &&
    Array.isArray(claimChecks)
  ) {
    const handoffIssues = claimCheckHandoffValidator({
      concepts: [
        {
          id,
          title,
          domain,
          slug,
          short_description: typeof shortDesc === 'string' ? shortDesc : '',
          sources: normalizedConceptSources(sources),
          claim_checks: normalizedConceptClaimChecks(claimChecks),
          has_interactive_demo: hasDemoFlag === true,
          has_visualization: hasVizFlag === true,
          _vizPath: hasVizFile ? path.join(conceptDir, 'viz.tsx') : null,
        },
      ],
      manifestObjects: contentObjectManifest.objects,
    })

    for (const handoffIssue of handoffIssues) {
      const claimSuffix = handoffIssue.claimCheckId ? `#${handoffIssue.claimCheckId}` : ''
      issues.push(
        ISSUE(
          'error',
          handoffIssue.code,
          `${handoffIssue.conceptId}${claimSuffix}: ${handoffIssue.message}`,
          conceptYamlPath
        )
      )
    }
  }

  if (!hasContentMdx) {
    issues.push(ISSUE('error', 'CONCEPT_CONTENT_MISSING', `Missing content.mdx`, contentMdxPath))
  } else {
    const requiredSections = ['## Intuition', '## Math', '## Code', '## Interactive Demo']
    for (const h of requiredSections) {
      if (!mdx.includes(h)) issues.push(ISSUE('warn', 'MDX_SECTION', `content.mdx missing section heading: ${h}`, contentMdxPath))
    }
    if (!mdx.trimStart().startsWith('---')) {
      issues.push(ISSUE('warn', 'MDX_FRONTMATTER', `content.mdx should start with frontmatter (---)`, contentMdxPath))
    }
    if (typeof title === 'string' && !mdx.includes(`title: "${title}"`) && !mdx.includes(`title: '${title}'`) && !mdx.includes(`title: ${title}`)) {
      issues.push(ISSUE('warn', 'MDX_TITLE', `Frontmatter title in content.mdx may not match concept.yaml title`, contentMdxPath))
    }

    const mdxSafetyErrors = getContentMdxSafetyErrors(mdx)
    for (const message of mdxSafetyErrors) {
      issues.push(ISSUE('error', 'MDX_UNSAFE_SYNTAX', message, contentMdxPath))
    }

    const mdxMathRenderingErrors = getContentMdxMathRenderingErrors(mdx)
    for (const message of mdxMathRenderingErrors) {
      issues.push(ISSUE('error', 'MDX_MATH_RENDERING', message, contentMdxPath))
    }

    if (status === 'published') {
      const intuition = getSectionBody(mdx, 'Intuition')
      const math = getSectionBody(mdx, 'Math')
      const code = getSectionBody(mdx, 'Code')
      const demo = getSectionBody(mdx, 'Interactive Demo')

      if (!intuition) issues.push(ISSUE('warn', 'PUBLISHED_INTUITION_EMPTY', `published concept needs a non-empty Intuition section`, contentMdxPath))
      if (!math) issues.push(ISSUE('warn', 'PUBLISHED_MATH_EMPTY', `published concept needs a non-empty Math section`, contentMdxPath))
      if (!code) issues.push(ISSUE('warn', 'PUBLISHED_CODE_EMPTY', `published concept needs a non-empty Code section`, contentMdxPath))
      if (!demo) issues.push(ISSUE('warn', 'PUBLISHED_DEMO_EMPTY', `published concept needs a non-empty Interactive Demo section`, contentMdxPath))

      if (intuition && visibleWordCount(intuition) < 60) {
        issues.push(ISSUE('warn', 'PUBLISHED_INTUITION_THIN', `Intuition section looks thin for a published concept (< 60 visible words)`, contentMdxPath))
      }
      if (math && visibleWordCount(math) < 40) {
        issues.push(ISSUE('warn', 'PUBLISHED_MATH_THIN', `Math section looks thin for a published concept (< 40 visible words)`, contentMdxPath))
      }
      if (hasCodeFlag === true && !hasFencedCode(mdx)) {
        issues.push(ISSUE('warn', 'PUBLISHED_CODE_MISSING', `has_code_example=true but no fenced code block was found`, contentMdxPath))
      }
      if (PLACEHOLDER_TEXT_RE.test(mdx)) {
        issues.push(ISSUE('warn', 'PUBLISHED_PLACEHOLDER_TEXT', `published concept contains placeholder/planned text; use draft/review status until complete`, contentMdxPath))
      }
      if (NO_DEMO_TEXT_RE.test(mdx)) {
        issues.push(ISSUE('error', 'PUBLISHED_NO_DEMO_TEXT', `published concept contains no-demo/placeholder language`, contentMdxPath))
      }
    }
  }
}

const detectCycles = (edges: Map<string, string[]>, issues: Issue[]) => {
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const dfs = (node: string, stack: string[]) => {
    if (visited.has(node)) return
    if (visiting.has(node)) {
      const i = stack.indexOf(node)
      const cycle = i >= 0 ? stack.slice(i).concat(node) : stack.concat(node)
      issues.push(ISSUE('error', 'PREREQ_CYCLE', `Cycle detected: ${cycle.join(' -> ')}`))
      return
    }

    visiting.add(node)
    const next = edges.get(node) ?? []
    for (const n of next) dfs(n, stack.concat(node))
    visiting.delete(node)
    visited.add(node)
  }

  for (const k of edges.keys()) dfs(k, [])
}

const main = () => {
  const issues: Issue[] = []

  const contentRoot = path.join(process.cwd(), 'content')
  const domainsRoot = path.join(contentRoot, 'domains')

  if (!exists(contentRoot)) {
    issues.push(ISSUE('warn', 'CONTENT_MISSING', `No content/ directory found (expected at ${contentRoot}).`))
  }

  const legacyConceptIds = loadLegacyConceptIds()
  const queuedConceptCoverage = loadQueuedConceptCoverage(contentRoot, issues)
  const contentObjectManifest = loadContentObjectManifest(contentRoot, issues)
  const claimCheckHandoffValidator = loadClaimCheckHandoffValidator(issues)
  const claimEvidenceReviewQueueModule = loadClaimEvidenceReviewQueueModule(issues)
  const claimEvidenceReviewSourceIdValidator = loadClaimEvidenceReviewSourceIdValidator(issues)
  assertClaimEvidenceReviewSourceIdValidatorFixture(claimEvidenceReviewSourceIdValidator, issues)

  requireManifestKey(contentObjectManifest, buildContentObjectKey('route', ['paper-map']), issues, contentObjectManifest.path, 'paper-map route object')
  requireManifestKey(contentObjectManifest, buildContentObjectKey('route', ['graph']), issues, contentObjectManifest.path, 'graph route object')
  requireManifestKey(
    contentObjectManifest,
    buildContentObjectKey('route', ['paths', 'attention-serving']),
    issues,
    contentObjectManifest.path,
    'attention-serving route object'
  )

  const domainIds = listDirs(domainsRoot)
  const conceptIds = new Set<string>()

  // First pass: gather all content concept IDs for prereq validation.
  for (const domainId of domainIds) {
    const conceptsRoot = path.join(domainsRoot, domainId, 'concepts')
    for (const conceptFolder of listDirs(conceptsRoot)) {
      const conceptYamlPath = path.join(conceptsRoot, conceptFolder, 'concept.yaml')
      if (!exists(conceptYamlPath)) continue
      const doc = parseYaml(conceptYamlPath, issues)
      if (isObject(doc) && typeof (doc as any).id === 'string') {
        const id = (doc as any).id
        if (conceptIds.has(id)) {
          issues.push(ISSUE('error', 'CONCEPT_ID_DUP', `Duplicate concept id in content/: ${id}`, conceptYamlPath))
        }
        conceptIds.add(id)
      }
    }
  }

  // Second pass: validate domains + concepts.
  const prereqEdges = new Map<string, string[]>()

  for (const domainId of domainIds) {
    const domainDir = path.join(domainsRoot, domainId)
    const domainYamlPath = path.join(domainDir, '_domain.yaml')
    if (!exists(domainYamlPath)) {
      issues.push(ISSUE('warn', 'DOMAIN_YAML_MISSING', `Missing _domain.yaml for domain '${domainId}'`, domainYamlPath))
    } else {
      validateDomainYaml(domainId, domainYamlPath, issues)
    }

    const conceptsRoot = path.join(domainDir, 'concepts')
    for (const conceptFolder of listDirs(conceptsRoot)) {
      const conceptDir = path.join(conceptsRoot, conceptFolder)
      const conceptYamlPath = path.join(conceptDir, 'concept.yaml')
      const contentMdxPath = path.join(conceptDir, 'content.mdx')

      if (!exists(conceptYamlPath)) {
        issues.push(ISSUE('error', 'CONCEPT_YAML_MISSING', `Missing concept.yaml`, conceptYamlPath))
        continue
      }

      // For cycle detection we only consider prereqs that are in content/.
      const doc = parseYaml(conceptYamlPath, issues)
      if (isObject(doc) && typeof (doc as any).id === 'string' && Array.isArray((doc as any).prerequisites)) {
        const id = (doc as any).id
        const prereqs = (doc as any).prerequisites.filter((p: any) => typeof p === 'string' && conceptIds.has(p))
        prereqEdges.set(id, prereqs)
      }

      validateConceptYaml(
        conceptDir,
        domainId,
        conceptYamlPath,
        contentMdxPath,
        issues,
        conceptIds,
        legacyConceptIds,
        queuedConceptCoverage,
        contentObjectManifest,
        claimCheckHandoffValidator,
        claimEvidenceReviewSourceIdValidator
      )
    }
  }

  detectCycles(prereqEdges, issues)
  validateContentObjectManifestExactSet(contentObjectManifest, issues)
  validateClaimEvidenceReviewQueue(contentRoot, claimEvidenceReviewQueueModule, issues)

  const errors = issues.filter((i) => i.severity === 'error')
  const warns = issues.filter((i) => i.severity === 'warn')

  for (const i of issues) {
    const loc = i.file ? ` (${i.file})` : ''
    const tag = i.severity === 'error' ? 'ERROR' : 'WARN'
    console.log(`[${tag}] ${i.code}: ${i.message}${loc}`)
  }

  console.log('')
  console.log(`[validate-content] Domains: ${domainIds.length}`)
  console.log(`[validate-content] Concepts (content/): ${conceptIds.size}`)
  console.log(`[validate-content] Legacy concepts (data/foundationsData.ts): ${legacyConceptIds.size}`)
  console.log(`[validate-content] Content object manifest objects: ${contentObjectManifest.keys.size}`)
  console.log(`[validate-content] Warnings: ${warns.length}`)
  console.log(`[validate-content] Errors: ${errors.length}`)

  if (errors.length > 0) process.exit(1)
}

main()
})()
