// Settings: the one dial, intensity, and the few other preferences, shown.
// Opened only when the person chooses; nothing here suggests a change.
import { BackLink } from '../components/BackLink.tsx'
import { ScreenMessage } from '../components/ScreenMessage.tsx'
import { INTENSITIES } from '../domain/settings.ts'
import { useFleetingMessage } from '../hooks/useFleetingMessage.ts'
import { useSettings } from '../hooks/useSettings.ts'
import './Settings.css'

type SettingsProps = {
  onBack: () => void
}

export function Settings({ onBack }: SettingsProps) {
  const { intensity, chooseIntensity, exportData, message } = useSettings()
  // With nothing loaded, the message stays.
  const shownMessage = useFleetingMessage(message, { sticky: !intensity })

  return (
    <main className="settings" aria-busy={!intensity && !message}>
      <header className="screen-top">
        <BackLink to="Aspirations" onBack={onBack} />
        <h1 className="screen-title">Settings</h1>
      </header>

      {intensity && (
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

      {intensity && (
        <button type="button" className="settings-row settings-export" onClick={exportData}>
          Export my data
        </button>
      )}

      <ScreenMessage message={shownMessage.shown} onDismiss={shownMessage.dismiss} />
    </main>
  )
}
