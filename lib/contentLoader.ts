import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import {
  normalizeClaimEvidenceReview,
  type ClaimEvidenceReview,
} from './claimEvidenceReview'

export type ConceptStatus = 'draft' | 'review' | 'published'
export type ConceptImportance = 'critical' | 'important' | 'supplementary' | 'advanced'
export type MathLevel = 'intuitive' | 'highschool' | 'undergraduate' | 'graduate' | 'research'
export type ConceptSourceKind = 'paper' | 'book' | 'article' | 'documentation' | 'course-notes' | 'reference'
export type ConceptClaimCheckStatus = 'source-checked' | 'needs-review' | 'weakened'

export type ConceptSource = {
  id: string
  title: string
  authors?: string
  year?: number
  kind?: ConceptSourceKind
  url?: string
  note?: string
}

export type ConceptClaimCheck = {
  id: string
  claim: string
  status: ConceptClaimCheckStatus
  source_ids?: string[]
  support?: string
  caveat?: string
  object_refs?: string[]
  evidence_review?: ClaimEvidenceReview
}

export type DomainMeta = {
  id: string
  title: string
  description: string
  icon: string
  color: string
  order: number
  _filePath: string
}

export type ConceptMeta = {
  id: string
  title: string
  domain: string
  slug: string

  difficulty: number
  status: ConceptStatus
  importance: ConceptImportance

  prerequisites: string[]
  leads_to: string[]
  related: string[]
  tags: string[]

  has_visualization: boolean
  has_interactive_demo: boolean
  has_code_example: boolean
  math_level: MathLevel
  sources: ConceptSource[]
  claim_checks: ConceptClaimCheck[]

  short_description: string
  author: string
  created: string
  updated: string
  estimated_read_time: number

  _dirPath: string
  _conceptYamlPath: string
  _contentMdxPath: string
  _vizPath: string | null
}

export type LoadedConcept = {
  meta: ConceptMeta
  mdx: string
}

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
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}

const readYamlFile = <T>(filePath: string): T => {
  const raw = fs.readFileSync(filePath, 'utf8')
  return YAML.parse(raw) as T
}

const parseConceptSources = (value: unknown): ConceptSource[] => {
  if (!Array.isArray(value)) return []

  return value
    .filter((source): source is Record<string, unknown> => Boolean(source) && typeof source === 'object')
    .map((source) => ({
      id: String(source.id ?? ''),
      title: String(source.title ?? ''),
      authors: typeof source.authors === 'string' ? source.authors : undefined,
      year: typeof source.year === 'number' && Number.isFinite(source.year) ? source.year : undefined,
      kind: typeof source.kind === 'string' ? (source.kind as ConceptSourceKind) : undefined,
      url: typeof source.url === 'string' ? source.url : undefined,
      note: typeof source.note === 'string' ? source.note : undefined,
    }))
    .filter((source) => source.id && source.title)
}

const parseConceptClaimChecks = (value: unknown): ConceptClaimCheck[] => {
  if (!Array.isArray(value)) return []

  return value
    .filter((claimCheck): claimCheck is Record<string, unknown> => Boolean(claimCheck) && typeof claimCheck === 'object')
    .map((claimCheck) => ({
      id: String(claimCheck.id ?? ''),
      claim: String(claimCheck.claim ?? ''),
      status: (typeof claimCheck.status === 'string' ? claimCheck.status : 'needs-review') as ConceptClaimCheckStatus,
      source_ids: Array.isArray(claimCheck.source_ids) ? claimCheck.source_ids.map(String).filter(Boolean) : undefined,
      support: typeof claimCheck.support === 'string' ? claimCheck.support : undefined,
      caveat: typeof claimCheck.caveat === 'string' ? claimCheck.caveat : undefined,
      object_refs: Array.isArray(claimCheck.object_refs) ? claimCheck.object_refs.map(String).filter(Boolean) : undefined,
      evidence_review: normalizeClaimEvidenceReview(claimCheck.evidence_review),
    }))
    .filter((claimCheck) => claimCheck.id && claimCheck.claim)
}

export const defaultContentRoot = (): string => path.join(process.cwd(), 'content')

export const loadDomains = (contentRoot: string = defaultContentRoot()): DomainMeta[] => {
  const domainsRoot = path.join(contentRoot, 'domains')

  const domains: DomainMeta[] = []
  for (const domainId of listDirs(domainsRoot)) {
    const domainYamlPath = path.join(domainsRoot, domainId, '_domain.yaml')
    if (!exists(domainYamlPath)) continue
    const doc = readYamlFile<Record<string, unknown>>(domainYamlPath)

    domains.push({
      id: domainId,
      title: String(doc.title ?? domainId),
      description: String(doc.description ?? ''),
      icon: String(doc.icon ?? ''),
      color: String(doc.color ?? ''),
      order: Number(doc.order ?? 999),
      _filePath: domainYamlPath,
    })
  }

  domains.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
  return domains
}

export const loadConceptMetas = (contentRoot: string = defaultContentRoot()): ConceptMeta[] => {
  const domainsRoot = path.join(contentRoot, 'domains')

  const concepts: ConceptMeta[] = []

  for (const domainId of listDirs(domainsRoot)) {
    const conceptsRoot = path.join(domainsRoot, domainId, 'concepts')

    for (const conceptFolder of listDirs(conceptsRoot)) {
      const conceptDir = path.join(conceptsRoot, conceptFolder)
      const conceptYamlPath = path.join(conceptDir, 'concept.yaml')
      const contentMdxPath = path.join(conceptDir, 'content.mdx')
      const vizPath = path.join(conceptDir, 'viz.tsx')

      if (!exists(conceptYamlPath)) continue

      const doc = readYamlFile<Record<string, unknown>>(conceptYamlPath)
      const id = String(doc.id ?? conceptFolder)

      concepts.push({
        id,
        title: String(doc.title ?? id),
        domain: String(doc.domain ?? domainId),
        slug: String(doc.slug ?? id),

        difficulty: Number(doc.difficulty ?? 3),
        status: doc.status as ConceptStatus,
        importance: doc.importance as ConceptImportance,

        prerequisites: Array.isArray(doc.prerequisites) ? (doc.prerequisites as unknown[]).map(String) : [],
        leads_to: Array.isArray(doc.leads_to) ? (doc.leads_to as unknown[]).map(String) : [],
        related: Array.isArray(doc.related) ? (doc.related as unknown[]).map(String) : [],
        tags: Array.isArray(doc.tags) ? (doc.tags as unknown[]).map(String) : [],

        has_visualization: Boolean(doc.has_visualization ?? exists(vizPath)),
        has_interactive_demo: Boolean(doc.has_interactive_demo ?? false),
        has_code_example: Boolean(doc.has_code_example ?? false),
        math_level: doc.math_level as MathLevel,
        sources: parseConceptSources(doc.sources),
        claim_checks: parseConceptClaimChecks(doc.claim_checks),

        short_description: String(doc.short_description ?? ''),
        author: String(doc.author ?? ''),
        created: String(doc.created ?? ''),
        updated: String(doc.updated ?? ''),
        estimated_read_time: Number(doc.estimated_read_time ?? 0),

        _dirPath: conceptDir,
        _conceptYamlPath: conceptYamlPath,
        _contentMdxPath: contentMdxPath,
        _vizPath: exists(vizPath) ? vizPath : null,
      })
    }
  }

  // Stable ordering for UI lists.
  concepts.sort((a, b) => a.domain.localeCompare(b.domain) || a.title.localeCompare(b.title))
  return concepts
}

export const loadConcept = (conceptId: string, contentRoot: string = defaultContentRoot()): LoadedConcept | null => {
  const metas = loadConceptMetas(contentRoot)
  const meta = metas.find((m) => m.id === conceptId || m.slug === conceptId)
  if (!meta) return null

  const mdx = exists(meta._contentMdxPath) ? fs.readFileSync(meta._contentMdxPath, 'utf8') : ''
  return { meta, mdx }
}
