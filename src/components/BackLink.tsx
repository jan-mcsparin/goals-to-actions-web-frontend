import './BackLink.css'

type BackLinkProps = {
  to: string
  onBack: () => void
}

// "‹ Aspirations": the way back at the top of an opened screen.
export function BackLink({ to, onBack }: BackLinkProps) {
  return (
    <button type="button" className="back-link" aria-label={`Back to ${to}`} onClick={onBack}>
      ‹ {to}
    </button>
  )
}
