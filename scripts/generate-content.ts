/* eslint-disable @typescript-eslint/no-var-requires */

// Generate small TS manifests from ./content for runtime wiring.
// Run via: npm run generate-content
//
// Keep this script CommonJS-friendly (no top-level `import`) so `ts-node` runs it
// without Node's ESM/module-type warnings.

;(() => {
  const fs = require('node:fs') as typeof import('node:fs')
  const path = require('node:path') as typeof import('node:path')

  let YAML: any
  try {
    YAML = require('yaml')
  } catch {
    // eslint-disable-next-line no-console
    console.error('[generate-content] Missing dependency: \"yaml\". Install with: npm i -D yaml')
    process.exit(1)
  }

type ConceptRow = {
  id: string
  importPath: string
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

  const readYaml = (p: string): any => YAML.parse(fs.readFileSync(p, 'utf8'))

  const toPosixImport = (fromDir: string, toFile: string): string => {
    // Create a relative import without extension and with POSIX separators.
    let rel = path.relative(fromDir, toFile)
    rel = rel.replace(/\\/g, '/')
    rel = rel.replace(/\.(tsx|ts|jsx|js)$/, '')
    if (!rel.startsWith('.')) rel = `./${rel}`
    return rel
  }

  const writeIfChanged = (filePath: string, next: string) => {
    const prev = exists(filePath) ? fs.readFileSync(filePath, 'utf8') : null
    if (prev === next) return
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, next)
  }

  const generateVizMap = (contentRoot: string): ConceptRow[] => {
    const domainsRoot = path.join(contentRoot, 'domains')
    const rows: ConceptRow[] = []

    for (const domainId of listDirs(domainsRoot)) {
      const conceptsRoot = path.join(domainsRoot, domainId, 'concepts')

      for (const conceptFolder of listDirs(conceptsRoot)) {
        const conceptDir = path.join(conceptsRoot, conceptFolder)
        const conceptYamlPath = path.join(conceptDir, 'concept.yaml')
        const vizPath = path.join(conceptDir, 'viz.tsx')

        if (!exists(conceptYamlPath) || !exists(vizPath)) continue

        const doc = readYaml(conceptYamlPath)
        const id = String(doc?.id ?? conceptFolder)

        rows.push({
          id,
          importPath: vizPath,
        })
      }
    }

    rows.sort((a, b) => a.id.localeCompare(b.id))
    return rows
  }

  const renderVizMapTs = (rows: ConceptRow[], generatedDir: string): string => {
    const lines: string[] = []

    lines.push('/*')
    lines.push(' * AUTO-GENERATED FILE. DO NOT EDIT BY HAND.')
    lines.push(' *')
    // Avoid writing the substring \"*/\" inside a block comment (it would terminate the comment early).
    lines.push(' * Source: content/domains/<domain>/concepts/<concept>/viz.tsx')
    lines.push(' * Generator: scripts/generate-content.ts')
    lines.push(' */')
    lines.push('')
    lines.push("import dynamic from 'next/dynamic'")
    lines.push("import type { ComponentType } from 'react'")
    lines.push('')
    lines.push('// eslint-disable-next-line @typescript-eslint/no-explicit-any -- concept demos are heterogeneous')
    lines.push('export type ContentVizComponent = ComponentType<any>')
    lines.push('')
    lines.push('// Map: concept id -> dynamically loaded viz component (client-only)')
    lines.push('// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic() typing is clunky for heterogeneous components')
    lines.push('export const contentConceptVizMap: Record<string, ContentVizComponent> = {')

    for (const r of rows) {
      const importPath = toPosixImport(generatedDir, r.importPath)
      lines.push(`  '${r.id}': dynamic(() => import('${importPath}'), { ssr: false }),`)
    }

    lines.push('}')
    lines.push('')
    lines.push('export const hasContentViz = (conceptId: string): boolean => Object.prototype.hasOwnProperty.call(contentConceptVizMap, conceptId)')
    lines.push('')

    return lines.join('\n') + '\n'
  }

  const main = () => {
    const repoRoot = process.cwd()
    const contentRoot = path.join(repoRoot, 'content')
    const generatedDir = path.join(contentRoot, '_generated')

    const vizRows = generateVizMap(contentRoot)
    const vizMapTs = renderVizMapTs(vizRows, generatedDir)

    writeIfChanged(path.join(generatedDir, 'vizMap.ts'), vizMapTs)

    // eslint-disable-next-line no-console
    console.log(`[generate-content] Wrote content/_generated/vizMap.ts (${vizRows.length} viz entries)`)
  }

  main()
})()
