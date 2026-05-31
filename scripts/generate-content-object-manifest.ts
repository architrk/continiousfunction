/* eslint-disable @typescript-eslint/no-var-requires */

// Generate a deterministic manifest of content objects that future account,
// note, evidence, and AI records can attach to without using URLs as identity.
// Run via: npm run generate-object-manifest

;(() => {
  const fs = require('node:fs') as typeof import('node:fs')
  const path = require('node:path') as typeof import('node:path')

  let YAML: any
  try {
    YAML = require('yaml')
  } catch {
    // eslint-disable-next-line no-console
    console.error('[generate-content-object-manifest] Missing dependency: "yaml". Install with: npm i -D yaml')
    process.exit(1)
  }

  const CONTENT_OBJECT_KEY_VERSION = 'cf-content-object-key-v1'
  const CONTENT_OBJECT_MANIFEST_VERSION = 'cf-content-object-manifest-v1'
  const segmentPattern = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/
  const sourceSegmentPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/
  const fragmentPattern = /^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/
  const mathObjectRefPattern = /^#math-object-[1-9]\d*$/
  const codeWitnessRefPattern = /^#code-witness-[1-9]\d*$/
  const sourceSpanRefPattern = /^#source-span-[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/
  const frontmatterRe = /^---\n[\s\S]*?\n---\n?/
  const mdxCommentRe = /\{\/\*[\s\S]*?\*\/\}/g

  type ContentObjectType =
    | 'concept'
    | 'route'
    | 'demo'
    | 'equation'
    | 'code'
    | 'source'
    | 'source-span'
    | 'claim'
    | 'misconception'
    | 'paper'

  type ContentObjectStability = 'canonical' | 'content-derived' | 'generated-span' | 'route-derived'

  type ManifestObject = {
    key: string
    type: ContentObjectType
    title: string
    href?: string
    domain?: string
    conceptId?: string
    status?: string
    stability: ContentObjectStability
    sourceIds?: string[]
    objectRefs?: string[]
    discussionAnchorId?: string
  }

  type Source = {
    id: string
    title: string
    note?: string
  }

  type ClaimCheck = {
    id: string
    claim: string
    status?: string
    source_ids?: string[]
    object_refs?: string[]
  }

  type ObjectSpan = {
    kind: 'equation' | 'code'
    fragment: string
    title: string
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
      .filter((d: any) => d.isDirectory())
      .map((d: any) => d.name)
      .sort((a: string, b: string) => a.localeCompare(b))
  }

  const readYaml = (p: string): any => YAML.parse(fs.readFileSync(p, 'utf8'))

  const compactText = (value: unknown, fallback: string, limit = 180) => {
    const text = String(value ?? fallback).replace(/\s+/g, ' ').trim() || fallback
    if (text.length <= limit) return text
    return `${text.slice(0, limit - 3).trimEnd()}...`
  }

  const isSegment = (value: string) => segmentPattern.test(value)
  const isFragment = (value: string) => fragmentPattern.test(value)

  const buildKey = (type: ContentObjectType, pathSegments: [string, ...string[]], fragment?: string): string => {
    if (!pathSegments.every(isSegment)) {
      throw new Error(`Invalid object-key path for ${type}: ${pathSegments.join('/')}`)
    }
    if (fragment !== undefined && !isFragment(fragment)) {
      throw new Error(`Invalid object-key fragment for ${type}: ${fragment}`)
    }
    return `${type}:${pathSegments.join('/')}${fragment ? `#${fragment}` : ''}`
  }

  const sourceSegment = (source: Source, index: number) =>
    sourceSegmentPattern.test(source.id) ? source.id : `source-${index + 1}`

  const claimCheckSegment = (claimCheck: ClaimCheck, conceptYamlPath: string) => {
    if (!sourceSegmentPattern.test(claimCheck.id)) {
      throw new Error(
        `Invalid claim_check id "${claimCheck.id}" in ${conceptYamlPath}; ids must be lowercase discussion segments.`
      )
    }

    return claimCheck.id
  }

  const sourceSpanFragmentFromDomRef = (fragment: string) => fragment.replace(/^source-span-/, '')

  const keyForConceptFragmentRef = (domain: string, conceptId: string, ref: string): string | null => {
    if (!ref.startsWith('#')) return null

    const fragment = ref.slice(1)
    if (mathObjectRefPattern.test(ref)) return buildKey('equation', [domain, conceptId], fragment)
    if (codeWitnessRefPattern.test(ref)) return buildKey('code', [domain, conceptId], fragment)
    if (fragment === 'interactive-demo') return buildKey('demo', [domain, conceptId], fragment)
    if (sourceSpanRefPattern.test(ref)) {
      return buildKey('source-span', [domain, conceptId], sourceSpanFragmentFromDomRef(fragment))
    }

    return null
  }

  const getSectionBody = (raw: string, heading: string): string => {
    const lines = raw.replace(/\r\n/g, '\n').replace(frontmatterRe, '').split('\n')
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

  const extractObjectSpans = (raw: string): ObjectSpan[] => {
    const mathSource = getSectionBody(raw, 'Math').replace(mdxCommentRe, '')
    const codeSource = getSectionBody(raw, 'Code').replace(mdxCommentRe, '')
    const spans: ObjectSpan[] = []
    const displayMathRe = /\$\$([\s\S]*?)\$\$/g
    const codeFenceRe = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g

    let match: RegExpExecArray | null
    let equationIndex = 0
    while ((match = displayMathRe.exec(mathSource)) && equationIndex < 3) {
      if (!match[1]?.trim()) continue
      equationIndex += 1
      spans.push({
        kind: 'equation',
        fragment: `math-object-${equationIndex}`,
        title: `Equation ${equationIndex}`,
      })
    }

    let codeIndex = 0
    while ((match = codeFenceRe.exec(codeSource)) && codeIndex < 1) {
      if (!match[2]?.trim()) continue
      codeIndex += 1
      spans.push({
        kind: 'code',
        fragment: `code-witness-${codeIndex}`,
        title: `Code witness ${codeIndex}`,
      })
    }

    return spans
  }

  const parseSources = (value: unknown): Source[] => {
    if (!Array.isArray(value)) return []
    return value
      .filter((source): source is Record<string, unknown> => Boolean(source) && typeof source === 'object')
      .map((source) => ({
        id: String(source.id ?? ''),
        title: String(source.title ?? ''),
        note: typeof source.note === 'string' ? source.note : undefined,
      }))
      .filter((source) => source.id && source.title)
  }

  const parseClaimChecks = (value: unknown): ClaimCheck[] => {
    if (!Array.isArray(value)) return []
    return value
      .filter((claimCheck): claimCheck is Record<string, unknown> => Boolean(claimCheck) && typeof claimCheck === 'object')
      .map((claimCheck) => ({
        id: String(claimCheck.id ?? ''),
        claim: String(claimCheck.claim ?? ''),
        status: typeof claimCheck.status === 'string' ? claimCheck.status : undefined,
        source_ids: Array.isArray(claimCheck.source_ids) ? claimCheck.source_ids.map(String).filter(Boolean) : undefined,
        object_refs: Array.isArray(claimCheck.object_refs) ? claimCheck.object_refs.map(String).filter(Boolean) : undefined,
      }))
      .filter((claimCheck) => claimCheck.id && claimCheck.claim)
  }

  const addObject = (objects: ManifestObject[], object: ManifestObject) => {
    objects.push({
      ...object,
      sourceIds: object.sourceIds?.length ? [...object.sourceIds] : undefined,
      objectRefs: object.objectRefs?.length ? [...object.objectRefs] : undefined,
    })
  }

  const addProductRoutes = (objects: ManifestObject[]) => {
    const routes = [
      { key: buildKey('route', ['paper-map']), title: 'Paper mapper route', href: '/paper-map/' },
      { key: buildKey('route', ['graph']), title: 'Learning graph route', href: '/graph/' },
      {
        key: buildKey('route', ['paths', 'attention-serving']),
        title: 'Attention serving learning path',
        href: '/paths/attention-serving/',
      },
    ]

    routes.forEach((route) =>
      addObject(objects, {
        ...route,
        type: 'route',
        stability: 'route-derived',
      })
    )
  }

  const buildManifestObjects = (contentRoot: string): ManifestObject[] => {
    const objects: ManifestObject[] = []
    const domainsRoot = path.join(contentRoot, 'domains')

    addProductRoutes(objects)

    for (const domainId of listDirs(domainsRoot)) {
      const conceptsRoot = path.join(domainsRoot, domainId, 'concepts')

      for (const conceptFolder of listDirs(conceptsRoot)) {
        const conceptDir = path.join(conceptsRoot, conceptFolder)
        const conceptYamlPath = path.join(conceptDir, 'concept.yaml')
        const contentMdxPath = path.join(conceptDir, 'content.mdx')
        const vizPath = path.join(conceptDir, 'viz.tsx')

        if (!exists(conceptYamlPath)) continue

        const doc = readYaml(conceptYamlPath)
        const conceptId = String(doc.id ?? conceptFolder)
        const domain = String(doc.domain ?? domainId)
        const slug = String(doc.slug ?? conceptId)
        const title = compactText(doc.title, conceptId)
        const status = typeof doc.status === 'string' ? doc.status : undefined
        const href = `/domains/${domain}/${slug}/`
        const sources = parseSources(doc.sources)
        const sourceIds = sources.map((source) => source.id).filter(Boolean)
        const contentMdx = exists(contentMdxPath) ? fs.readFileSync(contentMdxPath, 'utf8') : ''
        const objectSpans = extractObjectSpans(contentMdx)
        const claimChecks = parseClaimChecks(doc.claim_checks)
        const hasDemo = doc.has_interactive_demo === true && exists(vizPath)

        addObject(objects, {
          key: buildKey('concept', [domain, conceptId]),
          type: 'concept',
          title,
          href,
          domain,
          conceptId,
          status,
          stability: 'canonical',
          sourceIds,
          discussionAnchorId: `concept/concept-notebook/${domain}/${conceptId}`,
        })

        addObject(objects, {
          key: buildKey('route', ['domains', domain, conceptId]),
          type: 'route',
          title: `${title} concept route`,
          href,
          domain,
          conceptId,
          status,
          stability: 'route-derived',
        })

        if (hasDemo) {
          addObject(objects, {
            key: buildKey('demo', [domain, conceptId], 'interactive-demo'),
            type: 'demo',
            title: `${title} interactive demo`,
            href: `${href}#interactive-demo`,
            domain,
            conceptId,
            status,
            stability: 'content-derived',
            sourceIds,
            discussionAnchorId: `visualization/concept-notebook/${domain}/${conceptId}/interactive-demo`,
          })
        }

        for (const span of objectSpans) {
          addObject(objects, {
            key: buildKey(span.kind, [domain, conceptId], span.fragment),
            type: span.kind,
            title: `${title} ${span.title.toLowerCase()}`,
            href: `${href}#${span.fragment}`,
            domain,
            conceptId,
            status,
            stability: 'generated-span',
            sourceIds,
            discussionAnchorId:
              span.kind === 'equation'
                ? `equation/concept-notebook/${domain}/${conceptId}/math/equation-${span.fragment.split('-').at(-1)}`
                : `code-witness/concept-notebook/${domain}/${conceptId}/code/${span.fragment}`,
          })
        }

        addObject(objects, {
          key: buildKey('source', [domain, conceptId], 'sources'),
          type: 'source',
          title: `${title} source grounding`,
          href: `${href}#source-grounding`,
          domain,
          conceptId,
          status,
          stability: 'content-derived',
          sourceIds,
          discussionAnchorId: `source/concept-notebook/${domain}/${conceptId}/sources`,
        })

        sources.forEach((source, sourceIndex) => {
          const segment = sourceSegment(source, sourceIndex)
          addObject(objects, {
            key: buildKey('source', [domain, conceptId], segment),
            type: 'source',
            title: compactText(source.title, `${title} source ${sourceIndex + 1}`),
            href: `${href}#source-${segment}`,
            domain,
            conceptId,
            status,
            stability: 'content-derived',
            sourceIds: [source.id],
            discussionAnchorId: `source/concept-notebook/${domain}/${conceptId}/source/${segment}`,
          })

          if (source.note?.trim()) {
            addObject(objects, {
              key: buildKey('source-span', [domain, conceptId], segment),
              type: 'source-span',
              title: compactText(`${source.title} support span`, `${title} source span ${sourceIndex + 1}`),
              href: `${href}#source-span-${segment}`,
              domain,
              conceptId,
              status,
              stability: 'content-derived',
              sourceIds: [source.id],
              discussionAnchorId: `source/concept-notebook/${domain}/${conceptId}/source-span/${segment}`,
            })
          }
        })

        addObject(objects, {
          key: buildKey('claim', [domain, conceptId], 'central-claim'),
          type: 'claim',
          title: `${title} central claim`,
          href: `${href}#claim-review`,
          domain,
          conceptId,
          status,
          stability: 'content-derived',
          sourceIds,
          discussionAnchorId: `claim/concept-notebook/${domain}/${conceptId}/central-claim`,
        })

        claimChecks.forEach((claimCheck) => {
          const segment = claimCheckSegment(claimCheck, conceptYamlPath)
          const objectRefs = (claimCheck.object_refs ?? []).map((ref) => {
            const objectKey = keyForConceptFragmentRef(domain, conceptId, ref)
            if (!objectKey) {
              throw new Error(
                `Unsupported claim_check object_ref "${ref}" in ${conceptYamlPath}; refs must map to source-span, equation, code, or demo objects.`
              )
            }
            return objectKey
          })

          addObject(objects, {
            key: buildKey('claim', [domain, conceptId], claimCheck.id),
            type: 'claim',
            title: compactText(claimCheck.claim, `${title} claim`),
            href: `${href}#claim-check-${segment}`,
            domain,
            conceptId,
            status: claimCheck.status ?? status,
            stability: 'content-derived',
            sourceIds: claimCheck.source_ids,
            objectRefs,
            discussionAnchorId: `claim/concept-notebook/${domain}/${conceptId}/claim-check/${segment}`,
          })
        })

        addObject(objects, {
          key: buildKey('misconception', [domain, conceptId], 'likely-misconception'),
          type: 'misconception',
          title: `${title} likely misconception`,
          href: hasDemo ? `${href}#interactive-demo` : `${href}#math`,
          domain,
          conceptId,
          status,
          stability: 'route-derived',
          sourceIds,
          discussionAnchorId: `misconception/concept-notebook/${domain}/${conceptId}/likely-misconception`,
        })
      }
    }

    objects.sort((a, b) => a.key.localeCompare(b.key))

    const seen = new Set<string>()
    for (const object of objects) {
      if (seen.has(object.key)) {
        throw new Error(`Duplicate content object key generated: ${object.key}`)
      }
      seen.add(object.key)
    }

    return objects
  }

  const writeIfChanged = (filePath: string, next: string) => {
    const previous = exists(filePath) ? fs.readFileSync(filePath, 'utf8') : null
    if (previous === next) return
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, next)
  }

  const main = () => {
    const repoRoot = process.cwd()
    const contentRoot = path.join(repoRoot, 'content')
    const outputPath = path.join(contentRoot, '_generated', 'content-object-manifest.json')
    const objects = buildManifestObjects(contentRoot)
    const manifest = {
      version: CONTENT_OBJECT_MANIFEST_VERSION,
      keyVersion: CONTENT_OBJECT_KEY_VERSION,
      objects,
    }

    writeIfChanged(outputPath, `${JSON.stringify(manifest, null, 2)}\n`)

    // eslint-disable-next-line no-console
    console.log(`[generate-content-object-manifest] Wrote content/_generated/content-object-manifest.json (${objects.length} objects)`)
  }

  main()
})()
