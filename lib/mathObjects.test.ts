import {
  safeNumber,
  lerp,
  lerpPoint2D,
  clamp,
  mapRange,
  generateGrid2D,
  numericalGradient,
  softmax,
  matmul,
  frobeniusNorm,
  Point2D,
} from './mathObjects'

describe('safeNumber', () => {
  it('returns finite numbers unchanged', () => {
    expect(safeNumber(5)).toBe(5)
    expect(safeNumber(-3.14)).toBe(-3.14)
    expect(safeNumber(0)).toBe(0)
  })

  it('returns fallback for NaN', () => {
    expect(safeNumber(NaN)).toBe(0)
    expect(safeNumber(NaN, 42)).toBe(42)
  })

  it('returns fallback for Infinity', () => {
    expect(safeNumber(Infinity)).toBe(0)
    expect(safeNumber(-Infinity, -1)).toBe(-1)
  })
})

describe('lerp', () => {
  it('interpolates at t=0', () => {
    expect(lerp(0, 10, 0)).toBe(0)
  })

  it('interpolates at t=1', () => {
    expect(lerp(0, 10, 1)).toBe(10)
  })

  it('interpolates at t=0.5', () => {
    expect(lerp(0, 10, 0.5)).toBe(5)
  })

  it('extrapolates beyond range', () => {
    expect(lerp(0, 10, 1.5)).toBe(15)
    expect(lerp(0, 10, -0.5)).toBe(-5)
  })

  it('handles negative ranges', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0)
  })
})

describe('lerpPoint2D', () => {
  it('interpolates 2D points', () => {
    const a: Point2D = [0, 0]
    const b: Point2D = [10, 20]
    const result = lerpPoint2D(a, b, 0.5)
    expect(result).toEqual([5, 10])
  })

  it('returns start point at t=0', () => {
    const a: Point2D = [1, 2]
    const b: Point2D = [5, 6]
    expect(lerpPoint2D(a, b, 0)).toEqual([1, 2])
  })

  it('returns end point at t=1', () => {
    const a: Point2D = [1, 2]
    const b: Point2D = [5, 6]
    expect(lerpPoint2D(a, b, 1)).toEqual([5, 6])
  })
})

describe('clamp', () => {
  it('clamps value below min', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('clamps value above max', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('returns value within range unchanged', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('handles edge cases', () => {
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })
})

describe('mapRange', () => {
  it('maps from [0,1] to [0,100]', () => {
    expect(mapRange(0.5, 0, 1, 0, 100)).toBe(50)
  })

  it('maps at boundaries', () => {
    expect(mapRange(0, 0, 1, 0, 100)).toBe(0)
    expect(mapRange(1, 0, 1, 0, 100)).toBe(100)
  })

  it('handles inverted output range', () => {
    expect(mapRange(0.5, 0, 1, 100, 0)).toBe(50)
  })

  it('handles zero input range gracefully', () => {
    expect(mapRange(5, 5, 5, 0, 100)).toBe(0) // Returns outMin
  })

  it('maps negative ranges', () => {
    expect(mapRange(-5, -10, 0, 0, 100)).toBe(50)
  })
})

describe('generateGrid2D', () => {
  it('generates correct number of points', () => {
    const domain = { x: [0, 1] as [number, number], y: [0, 1] as [number, number] }
    const points = generateGrid2D(domain, 2)
    // (resolution + 1)^2 = 3^2 = 9 points
    expect(points.length).toBe(9)
  })

  it('generates points within domain', () => {
    const domain = { x: [-1, 1] as [number, number], y: [-1, 1] as [number, number] }
    const points = generateGrid2D(domain, 4)

    points.forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(-1)
      expect(x).toBeLessThanOrEqual(1)
      expect(y).toBeGreaterThanOrEqual(-1)
      expect(y).toBeLessThanOrEqual(1)
    })
  })

  it('includes corner points', () => {
    const domain = { x: [0, 2] as [number, number], y: [0, 2] as [number, number] }
    const points = generateGrid2D(domain, 2)

    expect(points).toContainEqual([0, 0])
    expect(points).toContainEqual([2, 0])
    expect(points).toContainEqual([0, 2])
    expect(points).toContainEqual([2, 2])
  })
})

describe('numericalGradient', () => {
  it('computes gradient of x^2 + y^2', () => {
    const f = (x: number, y: number) => x * x + y * y
    const [dfdx, dfdy] = numericalGradient(f, 1, 1)
    // Gradient should be [2x, 2y] = [2, 2] at (1,1)
    expect(dfdx).toBeCloseTo(2, 4)
    expect(dfdy).toBeCloseTo(2, 4)
  })

  it('computes gradient at origin', () => {
    const f = (x: number, y: number) => x * x + y * y
    const [dfdx, dfdy] = numericalGradient(f, 0, 0)
    expect(dfdx).toBeCloseTo(0, 4)
    expect(dfdy).toBeCloseTo(0, 4)
  })

  it('handles linear functions', () => {
    const f = (x: number, y: number) => 3 * x + 2 * y
    const [dfdx, dfdy] = numericalGradient(f, 5, 5)
    expect(dfdx).toBeCloseTo(3, 4)
    expect(dfdy).toBeCloseTo(2, 4)
  })
})

describe('softmax', () => {
  it('returns empty array for empty input', () => {
    expect(softmax([])).toEqual([])
  })

  it('sums to 1', () => {
    const result = softmax([1, 2, 3, 4])
    const sum = result.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 10)
  })

  it('preserves relative ordering', () => {
    const result = softmax([1, 2, 3])
    expect(result[2]).toBeGreaterThan(result[1])
    expect(result[1]).toBeGreaterThan(result[0])
  })

  it('handles large values without overflow', () => {
    const result = softmax([1000, 1001, 1002])
    expect(result.every(v => Number.isFinite(v))).toBe(true)
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })

  it('handles uniform input', () => {
    const result = softmax([5, 5, 5, 5])
    result.forEach(v => expect(v).toBeCloseTo(0.25, 10))
  })
})

describe('matmul', () => {
  it('multiplies 2x2 identity', () => {
    const identity = [[1, 0], [0, 1]]
    const a = [[1, 2], [3, 4]]
    expect(matmul(a, identity)).toEqual(a)
    expect(matmul(identity, a)).toEqual(a)
  })

  it('multiplies 2x2 matrices', () => {
    const a = [[1, 2], [3, 4]]
    const b = [[5, 6], [7, 8]]
    // [1*5+2*7, 1*6+2*8] = [19, 22]
    // [3*5+4*7, 3*6+4*8] = [43, 50]
    expect(matmul(a, b)).toEqual([[19, 22], [43, 50]])
  })

  it('handles rectangular matrices', () => {
    const a = [[1, 2, 3]]  // 1x3
    const b = [[4], [5], [6]]  // 3x1
    expect(matmul(a, b)).toEqual([[32]])  // 1*4 + 2*5 + 3*6 = 32
  })
})

describe('frobeniusNorm', () => {
  it('returns 0 for identical matrices', () => {
    const a = [[1, 2], [3, 4]]
    expect(frobeniusNorm(a, a)).toBe(0)
  })

  it('computes correct norm for simple difference', () => {
    const a = [[1, 0], [0, 0]]
    const b = [[0, 0], [0, 0]]
    expect(frobeniusNorm(a, b)).toBe(1)
  })

  it('is symmetric', () => {
    const a = [[1, 2], [3, 4]]
    const b = [[5, 6], [7, 8]]
    expect(frobeniusNorm(a, b)).toBe(frobeniusNorm(b, a))
  })

  it('computes correct norm for known case', () => {
    // diff = [[3, 3], [3, 3]], sum of squares = 36, sqrt = 6
    const a = [[1, 2], [3, 4]]
    const b = [[4, 5], [6, 7]]
    expect(frobeniusNorm(a, b)).toBeCloseTo(6, 10)
  })
})
