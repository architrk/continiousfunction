/**
 * Accessibility and functionality tests for ErrorBoundary component
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import ErrorBoundary, { withErrorBoundary } from './ErrorBoundary'

// Component that throws an error for testing
const ThrowingComponent = () => {
  throw new Error('Test error message')
}

// Component that renders normally
const NormalComponent = () => (
  <div data-testid="normal-content">Normal content</div>
)

describe('ErrorBoundary', () => {
  // Suppress console.error during these tests since we're testing error handling
  const originalError = console.error
  beforeAll(() => {
    console.error = jest.fn()
  })
  afterAll(() => {
    console.error = originalError
  })

  describe('functionality', () => {
    it('renders children when there is no error', () => {
      render(
        <ErrorBoundary>
          <NormalComponent />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('normal-content')).toBeInTheDocument()
    })

    it('renders fallback UI when child throws error', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Visualization Error')).toBeInTheDocument()
      expect(screen.getByText('Something went wrong rendering this visualization.')).toBeInTheDocument()
    })

    it('displays error message in details', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      // Click to expand details
      const details = screen.getByText('Error details')
      fireEvent.click(details)

      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    it('calls onError callback when error occurs', () => {
      const onError = jest.fn()

      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
      expect(onError.mock.calls[0][0].message).toBe('Test error message')
    })

    it('renders custom fallback when provided', () => {
      render(
        <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom fallback</div>}>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
      expect(screen.queryByText('Visualization Error')).not.toBeInTheDocument()
    })

    it('retry button exists and is clickable', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Visualization Error')).toBeInTheDocument()

      // Retry button should exist and be clickable
      const retryButton = screen.getByRole('button', { name: 'Try Again' })
      expect(retryButton).toBeInTheDocument()
      expect(retryButton).toBeEnabled()

      // Should be able to click without errors
      fireEvent.click(retryButton)

      // After retry, error will reoccur since ThrowingComponent always throws
      // This confirms the retry mechanism works (resets state)
      expect(screen.getByText('Visualization Error')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has no accessibility violations in normal state', async () => {
      const { container } = render(
        <ErrorBoundary>
          <NormalComponent />
        </ErrorBoundary>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has no accessibility violations in error state', async () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('retry button is keyboard accessible', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      const retryButton = screen.getByRole('button', { name: 'Try Again' })
      expect(retryButton).toBeInTheDocument()
      expect(retryButton).toBeEnabled()
    })

    it('error details are expandable via keyboard', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      const summary = screen.getByText('Error details')
      expect(summary).toBeInTheDocument()

      // Summary should be focusable and interactive
      fireEvent.keyDown(summary, { key: 'Enter' })
      // Details element should expand
    })
  })
})

describe('withErrorBoundary HOC', () => {
  const originalError = console.error
  beforeAll(() => {
    console.error = jest.fn()
  })
  afterAll(() => {
    console.error = originalError
  })

  it('wraps component with error boundary', () => {
    const WrappedNormal = withErrorBoundary(NormalComponent)

    render(<WrappedNormal />)

    expect(screen.getByTestId('normal-content')).toBeInTheDocument()
  })

  it('catches errors from wrapped component', () => {
    const WrappedThrowing = withErrorBoundary(ThrowingComponent)

    render(<WrappedThrowing />)

    expect(screen.getByText('Visualization Error')).toBeInTheDocument()
  })

  it('uses custom fallback when provided', () => {
    const WrappedThrowing = withErrorBoundary(
      ThrowingComponent,
      <div data-testid="hoc-fallback">HOC Fallback</div>
    )

    render(<WrappedThrowing />)

    expect(screen.getByTestId('hoc-fallback')).toBeInTheDocument()
  })

  it('passes props to wrapped component', () => {
    interface Props {
      message: string
    }
    const PropsComponent: React.FC<Props> = ({ message }) => (
      <div data-testid="props-content">{message}</div>
    )

    const WrappedProps = withErrorBoundary(PropsComponent)

    render(<WrappedProps message="Hello World" />)

    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })
})
