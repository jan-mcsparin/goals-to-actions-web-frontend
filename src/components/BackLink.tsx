import './BackLink.css'

type BackLinkProps = {
  // Where back goes, when its name is known: "‹ Aspirations". Without it, "‹ Back".
  to?: string
  onBack: () => void
}

// The way back at the top of an opened screen.
export function BackLink({ to, onBack }: BackLinkProps) {
  return (
    <button type="button" className="back-link" aria-label={to ? `Back to ${to}` : 'Back'} onClick={onBack}>
      ‹ {to ?? 'Back'}
    </button>
  )
}
