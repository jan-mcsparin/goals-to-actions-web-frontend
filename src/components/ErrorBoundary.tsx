// If what it wraps fails while drawing (bad data, say), shows a calm message
// with a way out instead of a blank app. Only drawing errors land here: failed
// loads and saves have their own messages. The app keys it by the open screen,
// so moving to another screen starts fresh. A class, because only a class
// component can catch these in React.
import { Component, type ReactNode } from 'react'
import './ErrorBoundary.css'

type ErrorBoundaryProps = {
  children: ReactNode
  // The installed app has no browser reload, so the message offers one.
  reload?: () => void
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    const reload = this.props.reload ?? (() => window.location.reload())
    return (
      <main className="screen-failed">
        <h1>Something went wrong showing this.</h1>
        <p className="screen-failed-hint">Try another tab, or reload.</p>
        <button type="button" onClick={reload}>
          Reload
        </button>
      </main>
    )
  }
}
