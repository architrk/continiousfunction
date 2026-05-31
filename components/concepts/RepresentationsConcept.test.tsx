import { readFileSync } from 'fs'
import path from 'path'

describe('Representations concept witnesses', () => {
  it('keeps the first math object anchored to useful factors and contextual ELMo', () => {
    const mdx = readFileSync(
      path.join(process.cwd(), 'content/domains/representation-learning/concepts/representations/content.mdx'),
      'utf8'
    )
    const mathSection = mdx.split('## Math')[1]?.split('## Code')[0] ?? ''
    const firstMathObject = mathSection.match(/\$\$([\s\S]*?)\$\$/)?.[1] ?? ''

    expect(firstMathObject).toContain('z &= f_\\theta(x)')
    expect(firstMathObject).toContain('\\hat a = g_\\psi(z)')
    expect(firstMathObject).toContain('\\operatorname{ELMo}^{\\mathrm{task}}_k')
    expect(firstMathObject).toContain('h^{\\mathrm{LM}}_{k,j}(t_1,\\ldots,t_N)')
  })

  it('keeps the code witness focused on contextual token movement', () => {
    const mdx = readFileSync(
      path.join(process.cwd(), 'content/domains/representation-learning/concepts/representations/content.mdx'),
      'utf8'
    )
    const codeWitness = mdx.split('```python')[1]?.split('```')[0] ?? ''

    expect(codeWitness).toContain('def contextual(left, token, right):')
    expect(codeWitness).toContain('static_bank = unit(feat["bank"])')
    expect(codeWitness).toContain('river_bank = contextual("river", "bank", "shore")')
    expect(codeWitness).toContain('money_bank = contextual("money", "bank", "loan")')
    expect(codeWitness).toContain('assert water_score(river_bank) > water_score(static_bank) > water_score(money_bank)')
  })
})
