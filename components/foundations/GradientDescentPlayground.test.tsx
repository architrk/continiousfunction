/**
 * Smoke tests for GradientDescentPlayground component
 * Verifies component renders without crashing
 */

import React from 'react'
import { render } from '@testing-library/react'

describe('GradientDescentPlayground', () => {
  it('renders without crashing', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const GradientDescentPlayground = require('./GradientDescentPlayground').default
    expect(() => render(<GradientDescentPlayground />)).not.toThrow()
  })
})
