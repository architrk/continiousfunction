import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'fs'
import path from 'path'
import { DEMO_STATE_EVENT, type DemoStateEventDetail, type DemoStateSummary } from '@/lib/demoState'
import VAEsDemo from '@/content/domains/generative-models/concepts/vaes/viz'
import DemoPredictionCheckpoint from './DemoPredictionCheckpoint'

describe('VAEsDemo ELBO gap reveal', () => {
  it('hides posterior and ELBO diagnostics before reveal and requires a prediction', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<VAEsDemo />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))

      expect(observed).toHaveLength(0)
      expect(screen.getByText('predict the inference gap')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal ELBO gap/ })).toBeDisabled()
      expect(screen.queryByText('posterior p(z|x)')).not.toBeInTheDocument()
      expect(screen.queryByText('KL(q || posterior)')).not.toBeInTheDocument()
      expect(screen.queryByText('E_q[log p_theta(x|z)]')).not.toBeInTheDocument()
      expect(screen.queryByText('match posterior')).not.toBeInTheDocument()
      expect(screen.queryByText('choose +sqrt(x)')).not.toBeInTheDocument()
      expect(screen.queryByText('choose -sqrt(x)')).not.toBeInTheDocument()
      expect(screen.getAllByText('hidden').length).toBeGreaterThanOrEqual(6)

      fireEvent.click(screen.getByRole('button', { name: /Shift or scale mismatch/ }))
      expect(screen.getByRole('button', { name: /Reveal ELBO gap/ })).toBeEnabled()
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('reveals the quadratic family-mismatch diagnosis and emits measured state', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<VAEsDemo />)

      fireEvent.click(screen.getByRole('button', { name: 'quadratic decoder' }))
      const choices = within(screen.getByRole('group', { name: 'ELBO gap diagnostic choices' }))
      expect(choices.queryByRole('button', { name: /positive cause wins/i })).not.toBeInTheDocument()
      expect(choices.queryByRole('button', { name: /negative cause wins/i })).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Family mismatch/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal ELBO gap/ }))

      expect(screen.getByText('posterior p(z|x)')).toBeInTheDocument()
      expect(screen.getByText('KL(q || posterior)')).toBeInTheDocument()
      expect(screen.getByText('E_q[log p_theta(x|z)]')).toBeInTheDocument()
      expect(document.body.textContent ?? '').toContain('Positive x has two separated plausible latent causes')

      await waitFor(() => {
        expect(observed.some((state) => state.conceptId === 'vaes')).toBe(true)
      })

      const latest = observed[observed.length - 1]
      expect(latest.label).toBe('VAE ELBO gap reveal')
      expect(latest.summary).toContain('decoder=two-causes')
      expect(latest.summary).toContain('prediction=family-mismatch; actual=family-mismatch; correct=yes')
      expect(latest.summary).toContain('KL(q||posterior)')
      expect(latest.values).toEqual(
        expect.arrayContaining([
          'decoder=two-causes',
          'prediction=family-mismatch',
          'actual diagnostic=family-mismatch',
          'prediction correct=yes',
          'posterior shape=quadratic-two-cause',
          expect.stringMatching(/^ELBO=/),
          expect.stringMatching(/^log p\(x\)=/),
          expect.stringMatching(/^gap=/),
          expect.stringMatching(/^KL\(q\|\|posterior\)=/),
        ])
      )
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('uses the emitted shift-scale diagnosis for merged quadratic causes', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<VAEsDemo />)

      fireEvent.click(screen.getByRole('button', { name: 'quadratic decoder' }))
      fireEvent.change(screen.getByLabelText(/observed x/i), { target: { value: '0.6' } })
      fireEvent.click(screen.getByRole('button', { name: /Shift or scale mismatch/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal ELBO gap/ }))

      expect(screen.getByText(/Actual diagnosis: Shift or scale mismatch/)).toBeInTheDocument()
      expect(document.body.textContent ?? '').toContain('not separated enough for family mismatch')
      expect(document.body.textContent ?? '').not.toContain('two separated plausible latent causes')

      await waitFor(() => {
        expect(observed.some((state) => state.summary.includes('actual=shift-scale'))).toBe(true)
      })
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('uses the emitted tight diagnosis for a linear near-tight ELBO gap', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<VAEsDemo />)

      fireEvent.change(screen.getByLabelText(/q mean/i), { target: { value: '1' } })
      fireEvent.change(screen.getByLabelText(/q std/i), { target: { value: String(Math.log(0.5)) } })
      fireEvent.click(screen.getByRole('button', { name: /Tight bound/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal ELBO gap/ }))

      expect(screen.getByText(/Actual diagnosis: Tight bound/)).toBeInTheDocument()
      expect(document.body.textContent ?? '').toContain('ELBO is nearly tight')
      expect(document.body.textContent ?? '').not.toContain('Move q toward the posterior')

      await waitFor(() => {
        expect(observed.some((state) => state.summary.includes('actual=tight'))).toBe(true)
      })
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('clears stale measured state from the checkpoint when q changes after reveal', async () => {
    const onReveal = jest.fn()

    render(
      <>
        <VAEsDemo />
        <DemoPredictionCheckpoint
          conceptId="vaes"
          conceptTitle="Variational Autoencoders"
          demoPrompt="Predict the ELBO gap diagnosis before saving the demo state."
          onReveal={onReveal}
        />
      </>
    )

    fireEvent.click(screen.getByRole('button', { name: 'quadratic decoder' }))
    fireEvent.click(screen.getByRole('button', { name: /Family mismatch/ }))
    fireEvent.click(screen.getByRole('button', { name: /Reveal ELBO gap/ }))

    expect(await screen.findByText('Current demo state')).toBeInTheDocument()
    expect(screen.getByText(/prediction=family-mismatch; actual=family-mismatch/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/q mean/i), { target: { value: '0.36' } })

    await waitFor(() => {
      expect(screen.queryByText(/prediction=family-mismatch; actual=family-mismatch/)).not.toBeInTheDocument()
    })
    expect(screen.queryByText('posterior p(z|x)')).not.toBeInTheDocument()
    expect(screen.queryByText('KL(q || posterior)')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reveal check' }))
    expect(onReveal).toHaveBeenCalledWith(expect.not.objectContaining({ demoState: expect.anything() }))
  })

  it('keeps the Interactive Demo copy from pre-announcing the VAE answer', () => {
    const mdx = readFileSync(
      path.join(process.cwd(), 'content/domains/generative-models/concepts/vaes/content.mdx'),
      'utf8'
    )
    const interactiveDemo = mdx.split('## Interactive Demo')[1]

    expect(interactiveDemo).toBeTruthy()
    expect(interactiveDemo).not.toContain('match posterior')
    expect(interactiveDemo).not.toContain('gap remains visible')
    expect(interactiveDemo).not.toContain('cannot cover both modes')
    expect(interactiveDemo).not.toContain('choose +sqrt')
    expect(interactiveDemo).not.toContain('choose -sqrt')
  })

  it('keeps the code witness anchored to ELBO gap and pathwise gradient checks', () => {
    const mdx = readFileSync(
      path.join(process.cwd(), 'content/domains/generative-models/concepts/vaes/content.mdx'),
      'utf8'
    )
    const codeWitness = mdx.split('```python')[1]?.split('```')[0] ?? ''

    expect(codeWitness).toContain('gap = log_px - elbo')
    expect(codeWitness).toContain('assert abs(gap - kl_post) < 1e-10')
    expect(codeWitness).toContain('z = mu + sigma * eps')
    expect(codeWitness).toContain('path_logvar = dloglik_dz * 0.5 * sigma * eps')
    expect(codeWitness).toContain('assert abs(path_logvar - fd_logvar) < 1e-7')
  })
})
