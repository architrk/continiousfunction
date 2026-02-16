import fs from 'fs'
import path from 'path'

import { conceptRelations, foundationsConcepts, studyOrder } from '../data/foundationsData'
import { conceptVisualizationMap } from '../data/visualizationMappings'

function sorted<T>(arr: T[]): T[] {
  return [...arr].sort()
}

describe('foundationsData integrity', () => {
  it('has 100 concepts with unique ids and sequential numbers', () => {
    expect(foundationsConcepts.length).toBe(100)

    const ids = foundationsConcepts.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)

    const nums = foundationsConcepts.map(c => c.number).sort((a, b) => a - b)
    expect(nums[0]).toBe(1)
    expect(nums[nums.length - 1]).toBe(100)
    for (let i = 0; i < nums.length; i++) {
      expect(nums[i]).toBe(i + 1)
    }
  })

  it('all prereqs reference existing concept ids', () => {
    const idSet = new Set(foundationsConcepts.map(c => c.id))
    for (const c of foundationsConcepts) {
      for (const prereqId of c.prereqs) {
        expect(idSet.has(prereqId)).toBe(true)
      }
    }
  })

  it('all semantic relations reference existing concept ids', () => {
    const idSet = new Set(foundationsConcepts.map(c => c.id))
    for (const rel of conceptRelations) {
      expect(idSet.has(rel.from)).toBe(true)
      expect(idSet.has(rel.to)).toBe(true)
      expect(rel.from).not.toBe(rel.to)
    }
  })

  it('studyOrder covers each concept exactly once', () => {
    const conceptIds = foundationsConcepts.map(c => c.id)
    const studyIds = studyOrder.flatMap(p => p.concepts)

    expect(new Set(studyIds).size).toBe(studyIds.length)
    expect(sorted(studyIds)).toEqual(sorted(conceptIds))
  })

  it('all hardcoded /foundations/<id> links in pages/components reference real concept ids', () => {
    const conceptIdSet = new Set(foundationsConcepts.map(c => c.id))
    const repoRoot = process.cwd()

    const files: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (full.endsWith('.ts') || full.endsWith('.tsx')) files.push(full)
      }
    }

    walk(path.join(repoRoot, 'pages'))
    walk(path.join(repoRoot, 'components'))

    // Only check hardcoded string literals, not template strings.
    const foundationsRoute = /['"]\/foundations\/([a-z0-9-]+)(?:\/)?(?:#[^'"]+)?['"]/g

    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8')
      const matches = [...src.matchAll(foundationsRoute)]
      for (const m of matches) {
        const conceptId = m[1]
        expect(conceptIdSet.has(conceptId)).toBe(true)
      }
    }
  })

  it('visualization mappings reference valid concepts and registered viz names', () => {
    const conceptIdSet = new Set(foundationsConcepts.map(c => c.id))

    const conceptMapKeys = Object.keys(conceptVisualizationMap)
    for (const conceptId of conceptMapKeys) {
      expect(conceptIdSet.has(conceptId)).toBe(true)
    }

    // Ensure every mapped visualization name is registered in the page-level vizMap.
    const conceptPagePath = path.join(process.cwd(), 'pages', 'foundations', '[id].tsx')
    const conceptPageSrc = fs.readFileSync(conceptPagePath, 'utf8')

    const vizMapStart = conceptPageSrc.indexOf('const vizMap')
    expect(vizMapStart).toBeGreaterThan(-1)

    const vizMapEnd = conceptPageSrc.indexOf('// Escape HTML entities', vizMapStart)
    expect(vizMapEnd).toBeGreaterThan(vizMapStart)

    const vizMapSrc = conceptPageSrc.slice(vizMapStart, vizMapEnd)
    const vizNameMatches = [...vizMapSrc.matchAll(/^\s*'([^']+)':/gm)]
    const registeredVizNames = new Set(vizNameMatches.map(m => m[1]))

    for (const vizNames of Object.values(conceptVisualizationMap)) {
      for (const vizName of vizNames) {
        expect(registeredVizNames.has(vizName)).toBe(true)

        const vizFile = path.join(process.cwd(), 'components', 'foundations', `${vizName}.tsx`)
        expect(fs.existsSync(vizFile)).toBe(true)
      }
    }
  })
})
