/**
 * Smoke tests for SelfAttentionViz component
 * Verifies component renders without crashing
 */

import React from 'react'
import { render } from '@testing-library/react'

// SelfAttentionViz imports `d3` (ESM). Jest in this repo doesn't transform ESM
// dependencies in node_modules, so we provide a minimal mock that supports the
// selection chain used by the component.
jest.mock('d3', () => {
  type SelectionStub = {
    attr: (...args: unknown[]) => SelectionStub
    style: (...args: unknown[]) => SelectionStub
    selectAll: (...args: unknown[]) => SelectionStub
    remove: (...args: unknown[]) => SelectionStub
    append: (...args: unknown[]) => SelectionStub
    text: (...args: unknown[]) => SelectionStub
    data: (...args: unknown[]) => SelectionStub
    join: (...args: unknown[]) => SelectionStub
    on: (...args: unknown[]) => SelectionStub
    call: (...args: unknown[]) => SelectionStub
    transition: (...args: unknown[]) => SelectionStub
    duration: (...args: unknown[]) => SelectionStub
  }

  const makeSelection = () => {
    const selection = {} as SelectionStub
    selection.attr = () => selection
    selection.style = () => selection
    selection.selectAll = () => selection
    selection.remove = () => selection
    selection.append = () => selection
    selection.text = () => selection
    selection.data = () => selection
    selection.join = () => selection
    selection.on = () => selection
    selection.call = () => selection
    selection.transition = () => selection
    selection.duration = () => selection
    return selection
  }

  const scaleLinear = () => {
    let rangeVals: [string, string] = ['#000000', '#ffffff']
    type ScaleLinearStub = ((x: number) => string) & {
      domain: (...args: unknown[]) => ScaleLinearStub
      range: (r: [string, string]) => ScaleLinearStub
    }

    const scale = ((_: number) => rangeVals[0]) as ScaleLinearStub
    scale.domain = () => scale
    scale.range = (r) => {
      rangeVals = r
      return scale
    }
    return scale
  }

  const max = <T,>(arr: T[], accessor?: (d: T) => number): number | undefined => {
    if (!arr?.length) return undefined
    let best = -Infinity
    for (const d of arr) {
      const v = accessor ? accessor(d) : d
      if (typeof v === 'number' && v > best) best = v
    }
    return best === -Infinity ? undefined : best
  }

  return {
    select: () => makeSelection(),
    scaleLinear,
    max,
  }
})

describe('SelfAttentionViz', () => {
  it('renders without crashing', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SelfAttentionViz = require('./SelfAttentionViz').default
    expect(() => render(<SelfAttentionViz />)).not.toThrow()
  })
})
