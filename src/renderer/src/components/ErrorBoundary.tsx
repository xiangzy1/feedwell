import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  name?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '2rem',
        color: 'var(--text-secondary)',
        gap: '1rem',
      }}>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
          {this.props.name ? `${this.props.name} crashed` : 'Something went wrong'}
        </p>
        <p style={{ fontSize: '0.85rem', margin: 0, maxWidth: '400px', textAlign: 'center' }}>
          {this.state.error?.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={() => location.reload()}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1.5rem',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Reload
        </button>
      </div>
    )
  }
}
