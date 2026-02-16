/* eslint-disable @typescript-eslint/no-var-requires */

// Validation script for filesystem-driven content under ./content
// Designed to run via: npx ts-node scripts/validate-content.ts
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

const oneOf = <T extends string>(v: any, allowed: readonly T[]): v is T => typeof v === 'string' && allowed.includes(v as T)

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

const validateConceptYaml = (
  conceptDir: string,
  domainId: string,
  conceptYamlPath: string,
  contentMdxPath: string,
  issues: Issue[],
  contentConceptIds: Set<string>,
  legacyConceptIds: Set<string>
) => {
  const doc = parseYaml(conceptYamlPath, issues)
  if (!isObject(doc)) {
    issues.push(ISSUE('error', 'CONCEPT_SCHEMA', `Concept metadata must be a YAML object`, conceptYamlPath))
    return
  }

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
      const ok = contentConceptIds.has(p) || legacyConceptIds.has(p)
      if (!ok) {
        issues.push(ISSUE('error', 'CONCEPT_PREREQ_MISSING', `Prerequisite '${p}' does not exist (content/ or legacy foundationsData.ts)`, conceptYamlPath))
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
    issues.push(ISSUE('warn', 'CONCEPT_DEMO_FLAG', `has_interactive_demo=true but no viz.tsx found`, conceptYamlPath))
  }

  if (!exists(contentMdxPath)) {
    issues.push(ISSUE('error', 'CONCEPT_CONTENT_MISSING', `Missing content.mdx`, contentMdxPath))
  } else {
    const mdx = readFile(contentMdxPath)
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

      validateConceptYaml(conceptDir, domainId, conceptYamlPath, contentMdxPath, issues, conceptIds, legacyConceptIds)
    }
  }

  detectCycles(prereqEdges, issues)

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
  console.log(`[validate-content] Warnings: ${warns.length}`)
  console.log(`[validate-content] Errors: ${errors.length}`)

  if (errors.length > 0) process.exit(1)
}

main()
})()
