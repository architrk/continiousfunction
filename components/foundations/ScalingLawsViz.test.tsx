/**
 * Smoke tests for ScalingLawsViz component
 * Verifies component renders without crashing
 */

import React from 'react'
import { render } from '@testing-library/react'

describe('ScalingLawsViz', () => {
  it('renders without crashing', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ScalingLawsViz = require('./ScalingLawsViz').default
    expect(() => render(<ScalingLawsViz />)).not.toThrow()
  })
})
