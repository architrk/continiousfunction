import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary component that catches JavaScript errors in child components,
 * logs them, and displays a fallback UI instead of crashing the whole app.
 *
 * Usage:
 * <ErrorBoundary fallback={<p>Something went wrong</p>}>
 *   <VisualizationComponent />
 * </ErrorBoundary>
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="error-boundary-fallback">
          <div className="error-icon">⚠</div>
          <h3>Visualization Error</h3>
          <p>Something went wrong rendering this visualization.</p>
          {this.state.error && (
            <details className="error-details">
              <summary>Error details</summary>
              <pre>{this.state.error.message}</pre>
            </details>
          )}
          <button onClick={this.handleRetry} className="retry-button">
            Try Again
          </button>
          <style jsx>{`
            .error-boundary-fallback {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 200px;
              padding: 2rem;
              background: var(--bg-surface, #0d1219);
              border: 1px solid var(--border-subtle, rgba(180, 160, 120, 0.15));
              border-radius: var(--radius-lg, 12px);
              text-align: center;
            }
            .error-icon {
              font-size: 2.5rem;
              margin-bottom: 1rem;
              color: var(--viz-negative, #ef4444);
            }
            h3 {
              margin: 0 0 0.5rem;
              font-family: var(--font-display, Georgia, serif);
              color: var(--text-primary, #f5f0e1);
            }
            p {
              margin: 0 0 1rem;
              color: var(--text-secondary, #b8b0a0);
              font-size: 0.9rem;
            }
            .error-details {
              margin-bottom: 1rem;
              text-align: left;
              max-width: 400px;
            }
            .error-details summary {
              cursor: pointer;
              color: var(--text-muted, #7a7468);
              font-size: 0.85rem;
            }
            .error-details pre {
              margin-top: 0.5rem;
              padding: 0.75rem;
              background: var(--bg-elevated, #131a24);
              border-radius: var(--radius-sm, 4px);
              font-size: 0.75rem;
              color: var(--viz-negative, #ef4444);
              overflow-x: auto;
              white-space: pre-wrap;
              word-break: break-word;
            }
            .retry-button {
              padding: 0.5rem 1.5rem;
              font-family: var(--font-mono, 'Fira Code', monospace);
              font-size: 0.85rem;
              background: var(--gradient-orange-dim, rgba(245, 158, 11, 0.15));
              border: 1px solid var(--gradient-orange, #f59e0b);
              border-radius: var(--radius-sm, 4px);
              color: var(--gradient-orange, #f59e0b);
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .retry-button:hover {
              background: var(--gradient-orange, #f59e0b);
              color: var(--bg-deep, #080c14);
            }
          `}</style>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook-friendly wrapper for error boundaries
 * Returns a component that wraps children with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }
}
