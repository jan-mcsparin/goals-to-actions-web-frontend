// Settings: the one dial, intensity, and the few other preferences, shown.
// Opened only when the person chooses; nothing here suggests a change.
import { BackLink } from '../components/BackLink.tsx'
import './Settings.css'

type SettingsProps = {
  onBack: () => void
}

export function Settings({ onBack }: SettingsProps) {
  return (
    <main className="settings">
      <header className="screen-top">
        <BackLink to="Aspirations" onBack={onBack} />
        <h1 className="screen-title">Settings</h1>
      </header>

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
    </main>
  )
}
