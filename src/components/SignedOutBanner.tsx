import './SignedOutBanner.css'

type SignedOutBannerProps = {
  // Changes on the phone not yet sent.
  waiting: number
  busy?: boolean
  onSignIn: () => void
}

// After Not now on the session-ended sheet: a quiet line at the top of the
// screen until signed in again. Changes made meanwhile wait in the queue.
export function SignedOutBanner({ waiting, busy, onSignIn }: SignedOutBannerProps) {
  return (
    <div className="signed-out-banner" role="status">
      <span>{bannerLine(waiting)}</span>
      <button type="button" disabled={busy} onClick={onSignIn}>
        Sign in
      </button>
    </div>
  )
}

function bannerLine(waiting: number): string {
  if (waiting === 0) return 'Not signed in'
  return `Not signed in · ${waiting === 1 ? '1 change' : `${waiting} changes`} waiting`
}
