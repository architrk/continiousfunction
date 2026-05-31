import { readFileSync } from 'fs'
import path from 'path'

describe('Double Descent concept witnesses', () => {
  const mdxPath = path.join(process.cwd(), 'content/domains/scaling/concepts/double-descent/content.mdx')

  it('keeps the math objects scoped to least-squares and minimum-norm interpolation', () => {
    const mdx = readFileSync(mdxPath, 'utf8')
    const mathSection = mdx.split('## Math')[1]?.split('## Code')[0] ?? ''
    const mathObjects = [...mathSection.matchAll(/\$\$([\s\S]*?)\$\$/g)].map(match => match[1])

    expect(mathObjects[0]).toContain('\\hat w = \\arg\\min_w \\|Xw - y\\|_2^2')
    expect(mathObjects[1]).toContain('\\hat w_{\\min\\,\\|w\\|} = X^\\top (XX^\\top)^{-1} y')
  })

  it('keeps the code witness focused on a fixed task and interpolation spike', () => {
    const mdx = readFileSync(mdxPath, 'utf8')
    const codeWitness = mdx.split('```python')[1]?.split('```')[0] ?? ''

    expect(codeWitness).toContain('n_train, n_test, max_d = 80, 2000, 300')
    expect(codeWitness).toContain('def fit_linear(X, y):')
    expect(codeWitness).toContain('np.linalg.lstsq(X, y, rcond=None)[0]')
    expect(codeWitness).toContain('X.T @ np.linalg.solve(X @ X.T + 1e-8 * np.eye(n), y)')
    expect(codeWitness).toContain('curve.append((d, train_mse, test_mse))')
    expect(codeWitness).toContain('assert by_d[80][0] < 1e-6')
    expect(codeWitness).toContain('assert by_d[80][1] > by_d[60][1] and by_d[80][1] > by_d[100][1]')
    expect(codeWitness).toContain('assert by_d[300][1] < by_d[80][1]')
  })
})
