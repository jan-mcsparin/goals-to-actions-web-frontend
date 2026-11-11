// A screen's save or load message, pinned just above the tab bar so it's seen
// wherever the page is scrolled. Tapping it lets it go; when it goes on its
// own is up to useFleetingMessage.
import './ScreenMessage.css'

type ScreenMessageProps = {
  message?: string
  onDismiss: () => void
}

export function ScreenMessage({ message, onDismiss }: ScreenMessageProps) {
  if (!message) return null
  return (
    <div className="screen-message" role="status">
      <button type="button" onClick={onDismiss}>
        {message}
      </button>
    </div>
  )
}
