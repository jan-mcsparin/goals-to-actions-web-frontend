// Settings: the one dial, intensity, and the few other preferences, shown.
// Opened only when the person chooses; nothing here suggests a change. Sign
// out sits at the bottom, under Account, and asks once.
import { useState } from 'react'
import { BackLink } from '../components/BackLink.tsx'
import { ScreenMessage } from '../components/ScreenMessage.tsx'
import { SignOutSheet } from '../components/SignOutSheet.tsx'
import { INTENSITIES } from '../domain/settings.ts'
import { useFleetingMessage } from '../hooks/useFleetingMessage.ts'
import { useSettings } from '../hooks/useSettings.ts'
import './Settings.css'

type SettingsProps = {
  onBack: () => void
  onSignOut: () => void
  signingOut?: boolean
  // Changes signing out couldn't send (useSession).
  unsent?: number
  onCancelSignOut?: () => void
}

export function Settings({ onBack, onSignOut, signingOut, unsent, onCancelSignOut }: SettingsProps) {
  const [askingToSignOut, setAskingToSignOut] = useState(false)
  const { loaded, intensity, chooseIntensity, exportData, message } = useSettings()
  // With nothing loaded, the message stays.
  const shownMessage = useFleetingMessage(message, { sticky: !loaded })

  return (
    <main className="settings" aria-busy={!loaded && !message}>
      <header className="screen-top">
        <BackLink to="Aspirations" onBack={onBack} />
        <h1 className="screen-title">Settings</h1>
      </header>

      {loaded && (
        <section className="settings-intensity" aria-labelledby="intensity-heading">
          <h2 id="intensity-heading">Intensity</h2>
          {/* Native radios: arrow keys move the choice, and each move saves. */}
          <div
            className="intensity-choice"
            role="radiogroup"
            aria-labelledby="intensity-heading"
            aria-describedby="intensity-note"
          >
            {INTENSITIES.map((choice) => (
              <label key={choice.value}>
                <input
                  type="radio"
                  name="intensity"
                  value={choice.value}
                  checked={intensity === choice.value}
                  onChange={() => chooseIntensity(choice.value)}
                />
                {choice.label}
              </label>
            ))}
          </div>
          <p id="intensity-note" className="settings-note">
            Sets how full days are and how much is free.
          </p>
        </section>
      )}

      <dl className="settings-rows">
        <div className="settings-row">
          <dt>Week starts</dt>
          <dd>Monday</dd>
        </div>
        <div className="settings-row">
          <dt>Notifications</dt>
          <dd>Off</dd>
        </div>
      </dl>

      {loaded && (
        <button type="button" className="settings-row settings-export" onClick={exportData}>
          Export my data
        </button>
      )}

      <section className="settings-account" aria-labelledby="account-heading">
        <h2 id="account-heading">Account</h2>
        <button type="button" className="settings-row settings-sign-out" onClick={() => setAskingToSignOut(true)}>
          Sign out
        </button>
      </section>

      <SignOutSheet
        open={askingToSignOut}
        busy={signingOut}
        unsent={unsent}
        onSignOut={onSignOut}
        onClose={() => {
          setAskingToSignOut(false)
          onCancelSignOut?.()
        }}
      />
      <ScreenMessage message={shownMessage.shown} onDismiss={shownMessage.dismiss} />
    </main>
  )
}
