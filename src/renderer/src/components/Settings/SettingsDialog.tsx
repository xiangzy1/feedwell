import { useTheme, type Theme } from '../../hooks/useTheme'
import { useReadingSettings, type ReadingSettings } from '../../hooks/useReadingSettings'

const options: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const sliders: { key: keyof ReadingSettings; label: string; format: (v: number) => string }[] = [
  { key: 'fontSize', label: 'Font Size', format: v => `${v}px` },
  { key: 'lineSpacing', label: 'Line Spacing', format: v => v.toFixed(1) },
  { key: 'paragraphSpacing', label: 'Paragraph Spacing', format: v => `${v.toFixed(1)}em` },
]

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { theme, setTheme } = useTheme()
  const { settings, updateSettings, limits } = useReadingSettings()

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
        <div className="dialog-option-group">
          <div className="dialog-option-label">Reading</div>
          <div className="dialog-slider-group">
            {sliders.map(({ key, label, format }) => (
              <div key={key} className="dialog-slider-row">
                <div className="dialog-slider-header">
                  <span className="dialog-slider-label">{label}</span>
                  <span className="dialog-slider-value">{format(settings[key])}</span>
                </div>
                <input
                  type="range"
                  className="dialog-slider"
                  min={limits[key].min}
                  max={limits[key].max}
                  step={limits[key].step}
                  value={settings[key]}
                  onChange={e => updateSettings({ [key]: Number(e.target.value) })}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="dialog-actions">
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
