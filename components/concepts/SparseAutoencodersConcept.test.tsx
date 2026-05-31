import { readFileSync } from 'fs'
import path from 'path'

describe('Sparse Autoencoders concept witnesses', () => {
  const mdxPath = path.join(
    process.cwd(),
    'content/domains/representation-learning/concepts/sparse-autoencoders/content.mdx'
  )

  it('keeps the first math object anchored to SAE encode/decode dictionary structure', () => {
    const mdx = readFileSync(mdxPath, 'utf8')
    const mathSection = mdx.split('## Math')[1]?.split('## Code')[0] ?? ''
    const firstMathObject = mathSection.match(/\$\$([\s\S]*?)\$\$/)?.[1] ?? ''

    expect(firstMathObject).toContain('z = \\mathrm{ReLU}(W_{\\text{enc}}')
    expect(firstMathObject).toContain('\\hat x = W_{\\text{dec}} z + b_{\\text{pre}}')
  })

  it('keeps the second math object anchored to reconstruction plus L1 sparsity', () => {
    const mdx = readFileSync(mdxPath, 'utf8')
    const mathSection = mdx.split('## Math')[1]?.split('## Code')[0] ?? ''
    const mathObjects = [...mathSection.matchAll(/\$\$([\s\S]*?)\$\$/g)].map(match => match[1])

    expect(mathObjects[1]).toContain('\\lVert x - \\hat x \\rVert_2^2')
    expect(mathObjects[1]).toContain('\\lambda \\lVert z \\rVert_1')
  })

  it('keeps the code witness focused on learned decoder dictionaries and the sparsity tradeoff', () => {
    const mdx = readFileSync(mdxPath, 'utf8')
    const codeWitness = mdx.split('```python')[1]?.split('```')[0] ?? ''

    expect(codeWitness).toContain('def train_sae(lam')
    expect(codeWitness).toContain('W_enc, W_dec')
    expect(codeWitness).toContain('X_hat = Z @ W_dec.T')
    expect(codeWitness).toContain('grad_dec = err.T @ Z')
    expect(codeWitness).toContain('grad_z = err @ W_dec + lam * (Z > 0) / n')
    expect(codeWitness).toContain('sparse = train_sae(lam=0.30)')
    expect(codeWitness).toContain('assert sparse[1] < faithful[1] and sparse[0] > faithful[0]')
  })
})
