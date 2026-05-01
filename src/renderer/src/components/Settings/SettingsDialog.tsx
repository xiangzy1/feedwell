import { useTheme, type Theme } from '../../hooks/useTheme'

const options: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { theme, setTheme } = useTheme()

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>Settings</h3>
        <div className="dialog-option-group">
          <div className="dialog-option-label">Appearance</div>
          {options.map(opt => (
            <label key={opt.value} className="dialog-radio">
              <input
                type="radio"
                name="theme"
                checked={theme === opt.value}
                onChange={() => setTheme(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
        <div className="dialog-actions">
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
