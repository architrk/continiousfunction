import { extractConceptObjectSpans } from './conceptObjectSpans'

describe('concept object span extraction', () => {
  it('extracts bounded display equations and fenced code witnesses from MDX sections', () => {
    const spans = extractConceptObjectSpans({
      math: [
        '$$a_t = b_t + c_t$$',
        '',
        '$$',
        '\\\\mathrm{Attn}(Q,K,V)=\\\\mathrm{softmax}(QK^\\\\top)V',
        '$$',
      ].join('\n'),
      code: [
        '```python',
        'def route(tokens, experts):',
        '    return tokens @ experts.T',
        '```',
      ].join('\n'),
    })

    expect(spans).toEqual([
      {
        kind: 'equation',
        domId: 'math-object-1',
        snippet: 'a_t = b_t + c_t',
        latex: 'a_t = b_t + c_t',
      },
      {
        kind: 'equation',
        domId: 'math-object-2',
        snippet: 'Attn(Q,K,V)=softmax(QK^T)V',
        latex: '\\\\mathrm{Attn}(Q,K,V)=\\\\mathrm{softmax}(QK^\\\\top)V',
      },
      {
        kind: 'code-witness',
        domId: 'code-witness-1',
        snippet: 'def route(tokens, experts): return tokens @ experts.T',
        language: 'python',
      },
    ])
  })

  it('caps extracted objects and ignores empty spans', () => {
    const spans = extractConceptObjectSpans({
      math: Array.from({ length: 6 }, (_, index) => `$$x_${index}=y_${index}$$`).join('\n'),
      code: Array.from({ length: 5 }, (_, index) => ['```ts', `const value${index} = ${index}`, '```'].join('\n')).join('\n'),
    })

    expect(spans.filter((span) => span.kind === 'equation')).toHaveLength(3)
    expect(spans.filter((span) => span.kind === 'code-witness')).toHaveLength(1)
    expect(spans.every((span) => span.snippet.length <= 96)).toBe(true)
  })

  it('strips display-layout wrappers from equation snippets', () => {
    const spans = extractConceptObjectSpans({
      math: [
        '$$',
        String.raw`\begin{aligned}`,
        String.raw`\Delta_\rho(w) &:= \max_{\|\epsilon\|_2 \le \rho} L(w+\epsilon),\\`,
        String.raw`L_{\mathrm{SAM}}(w) &:= \max_{\|\epsilon\|_2 \le \rho} L(w+\epsilon)`,
        String.raw`\end{aligned}`,
        '$$',
      ].join('\n'),
      code: '',
    })

    expect(spans[0]).toMatchObject({
      kind: 'equation',
      domId: 'math-object-1',
      snippet: String.raw`\Delta_\rho(w) := \max_{\|\epsilon\|_2 <= \rho} L(w+\epsilon); L_{SAM}(w) := \max_{\|\epsilon...`,
    })
    expect(spans[0]?.snippet).not.toContain(String.raw`\begin`)
    expect(spans[0]?.latex).toContain(String.raw`\begin{aligned}`)
  })
})
