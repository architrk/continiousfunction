export type ConceptObjectSpan = {
  kind: 'equation' | 'code-witness'
  domId: string
  snippet: string
  latex?: string
  language?: string
}

type ConceptObjectSpanSections = {
  math: string
  code: string
}

const maxEquationSpans = 3
const maxCodeSpans = 1

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function boundedSnippet(value: string, limit = 96) {
  const text = compactWhitespace(value)
  if (text.length <= limit) return text
  return `${text.slice(0, limit - 3).trimEnd()}...`
}

function equationSnippet(value: string) {
  return boundedSnippet(
    value
      .replace(/\\begin\{array\}\{[^}]*\}/g, '')
      .replace(/\\begin\{(?:aligned|gathered|split|cases)\}/g, '')
      .replace(/\\end\{(?:aligned|gathered|split|array|cases)\}/g, '')
      .replace(/\\text\{([^}]*)\}/g, '$1')
      .replace(/\\mathrm\{([^}]*)\}/g, '$1')
      .replace(/\\left|\\right/g, '')
      .replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)')
      .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
      .replace(/\\[!,;:]/g, ' ')
      .replace(/\\le/g, '<=')
      .replace(/\\ge/g, '>=')
      .replace(/\\infty/g, 'infinity')
      .replace(/\\top/g, '^T')
      .replace(/\^\^/g, '^')
      .replace(/\\{2,}\s*;?/g, '; ')
      .replace(/\\\\(?=\s|$|[,;])/g, '; ')
      .replace(/,\s*;\s*/g, '; ')
      .replace(/&/g, '')
  )
}

function stripMdxComments(value: string) {
  return value.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
}

export function conceptObjectSpanSectionId(span: ConceptObjectSpan) {
  return span.kind === 'equation' ? 'math' : 'code'
}

export function conceptObjectSpanNumber(span: ConceptObjectSpan) {
  const match = span.domId.match(/-(\d+)$/)
  return match ? Number(match[1]) : 1
}

export function conceptObjectSpanLabel(span: ConceptObjectSpan) {
  const spanNumber = conceptObjectSpanNumber(span)
  return span.kind === 'equation' ? `Equation ${spanNumber}` : `Code witness ${spanNumber}`
}

export function extractConceptObjectSpans(sections: ConceptObjectSpanSections): ConceptObjectSpan[] {
  const spans: ConceptObjectSpan[] = []
  const mathSource = stripMdxComments(sections.math)
  const codeSource = stripMdxComments(sections.code)
  const displayMathRe = /\$\$([\s\S]*?)\$\$/g
  const codeFenceRe = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g

  let match: RegExpExecArray | null
  let equationIndex = 0
  while ((match = displayMathRe.exec(mathSource)) && equationIndex < maxEquationSpans) {
    const snippet = equationSnippet(match[1])
    if (!snippet) continue

    equationIndex += 1
    spans.push({
      kind: 'equation',
      domId: `math-object-${equationIndex}`,
      snippet,
      latex: match[1].trim(),
    })
  }

  let codeIndex = 0
  while ((match = codeFenceRe.exec(codeSource)) && codeIndex < maxCodeSpans) {
    const snippet = boundedSnippet(match[2])
    if (!snippet) continue

    codeIndex += 1
    const language = match[1]?.trim() || undefined
    spans.push({
      kind: 'code-witness',
      domId: `code-witness-${codeIndex}`,
      snippet,
      language,
    })
  }

  return spans
}
