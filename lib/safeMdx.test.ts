import fs from 'node:fs'
import path from 'node:path'
import { parseConceptMdxSections, sanitizeRenderedHtml } from './safeMdx'

describe('safe MDX rendering', () => {
  it('parses the expected concept content sections', () => {
    const sections = parseConceptMdxSections(`---
title: "Example"
---

## Intuition
Feel it first.

## Math
$x + y$

## Code
\`\`\`python
print("ok")
\`\`\`

## Interactive Demo
Drag the point.
`)

    expect(sections).toEqual({
      intuition: 'Feel it first.',
      math: '$x + y$',
      code: '```python\nprint("ok")\n```',
      demo: 'Drag the point.',
    })
  })

  it('keeps the renderer in inert markdown mode instead of executable MDX mode', () => {
    const source = fs.readFileSync(path.join(__dirname, 'safeMdx.ts'), 'utf8')

    expect(source).toContain("format: 'md'")
    expect(source).not.toContain('providerImportSource')
    expect(source).not.toContain('useMDXComponents')
  })

  it('strips script-capable HTML from rendered content', () => {
    const html = sanitizeRenderedHtml(`
<p>This expression should stay inert: {process.env.CF_VALIDATION_SECRET}</p>
<script>window.CFPOC=1</script>
<img src="x" onerror="alert(1)">
<a href="javascript:alert(2)">click me</a>
<button onclick="alert(3)">bad</button>
`)

    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/onerror|onclick/i)
    expect(html).not.toMatch(/javascript:/i)
    expect(html).not.toMatch(/<button/i)
    expect(html).toContain('process.env.CF_VALIDATION_SECRET')
    expect(html).toContain('click me')
  })
})
