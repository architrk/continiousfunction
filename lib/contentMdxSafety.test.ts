import { assertSafeContentMdx, getContentMdxSafetyErrors, sanitizeContentMdxSource } from './contentMdxSafety'

describe('contentMdxSafety', () => {
  it('allows the documented content subset', () => {
    const mdx = `---
title: "Safe"
---

## Intuition

Text with [a secure link](https://example.com) and math $\\{x \\in \\mathbb R\\}$.

## Math

$$
f(x) = x^2
$$

## Code

\`\`\`python
print({"safe": True})
\`\`\`

## Interactive Demo

{/* viz.tsx component renders here if it exists */}
`

    expect(getContentMdxSafetyErrors(mdx)).toEqual([])
    expect(() => assertSafeContentMdx(mdx)).not.toThrow()
    expect(sanitizeContentMdxSource(mdx)).not.toContain('viz.tsx component renders here if it exists')
  })

  it('rejects raw HTML and JSX tags', () => {
    expect(getContentMdxSafetyErrors('## Intuition\n<img src="x" />')).toContain(
      'raw HTML/JSX is not allowed in content.mdx'
    )
  })

  it('rejects MDX expressions', () => {
    expect(getContentMdxSafetyErrors('## Intuition\n{1 + 1}')).toContain(
      'MDX expressions/comments are not allowed in content.mdx'
    )
  })

  it('rejects javascript links', () => {
    expect(getContentMdxSafetyErrors('## Intuition\n[bad](javascript:alert(1))')).toContain(
      'link target uses a disallowed protocol or relative form: javascript:alert(1'
    )
  })
})
