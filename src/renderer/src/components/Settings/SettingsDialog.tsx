import { useState } from 'react'
import { useTheme, type Theme } from '../../hooks/useTheme'
import { useReadingSettings, type ReadingSettings } from '../../hooks/useReadingSettings'
import { useTranslationSettings, type TranslationSettings } from '../../hooks/useTranslationSettings'

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

const providerOptions: { value: TranslationSettings['provider']; label: string }[] = [
  { value: 'disabled', label: 'Disabled' },
  { value: 'ai', label: 'AI (OpenAI-compatible)' },
  { value: 'google', label: 'Google Translate' },
  { value: 'microsoft', label: 'Microsoft Translator' },
]

const languages = [
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
  { value: 'zh-TW', label: 'Chinese (Traditional)' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'ar', label: 'Arabic' },
  { value: 'it', label: 'Italian' },
]

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { theme, setTheme } = useTheme()
  const { settings, updateSettings, limits } = useReadingSettings()
  const { settings: tSettings, updateSettings: updateTSettings } = useTranslationSettings()
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState('')

  const handleTest = async () => {
    setTestStatus('testing')
    setTestError('')
    try {
      await window.api.translation.testConnection()
      setTestStatus('success')
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Connection failed')
      setTestStatus('error')
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog dialog-scrollable" onClick={e => e.stopPropagation()}>
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
        <div className="dialog-option-group">
          <div className="dialog-option-label">Translation</div>
          <div className="dialog-column">
            {providerOptions.map(opt => (
              <label key={opt.value} className="dialog-radio">
                <input
                  type="radio"
                  name="translation-provider"
                  checked={tSettings.provider === opt.value}
                  onChange={() => updateTSettings({ provider: opt.value })}
                />
                {opt.label}
              </label>
            ))}
            {tSettings.provider !== 'disabled' && (
              <>
                <div>
                  <label className="dialog-field-label">Target Language</label>
                  <select
                    className="dialog-input"
                    value={tSettings.targetLang}
                    onChange={e => updateTSettings({ targetLang: e.target.value })}
                  >
                    {languages.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
                {tSettings.provider === 'ai' && (
                  <>
                    <div>
                      <label className="dialog-field-label">Base URL</label>
                      <input
                        className="dialog-input"
                        placeholder="https://api.openai.com/v1"
                        value={tSettings.aiBaseUrl}
                        onChange={e => updateTSettings({ aiBaseUrl: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="dialog-field-label">API Key</label>
                      <input
                        className="dialog-input"
                        type="password"
                        placeholder="sk-..."
                        value={tSettings.aiApiKey}
                        onChange={e => updateTSettings({ aiApiKey: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="dialog-field-label">Model</label>
                      <input
                        className="dialog-input"
                        placeholder="gpt-4o-mini"
                        value={tSettings.aiModel}
                        onChange={e => updateTSettings({ aiModel: e.target.value })}
                      />
                    </div>
                  </>
                )}
                {tSettings.provider === 'google' && (
                  <div>
                    <label className="dialog-field-label">API Key</label>
                    <input
                      className="dialog-input"
                      type="password"
                      placeholder="Google API Key"
                      value={tSettings.googleApiKey}
                      onChange={e => updateTSettings({ googleApiKey: e.target.value })}
                    />
                  </div>
                )}
                {tSettings.provider === 'microsoft' && (
                  <>
                    <div>
                      <label className="dialog-field-label">API Key</label>
                      <input
                        className="dialog-input"
                        type="password"
                        placeholder="Microsoft API Key"
                        value={tSettings.microsoftApiKey}
                        onChange={e => updateTSettings({ microsoftApiKey: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="dialog-field-label">Region</label>
                      <input
                        className="dialog-input"
                        placeholder="e.g. eastus"
                        value={tSettings.microsoftRegion}
                        onChange={e => updateTSettings({ microsoftRegion: e.target.value })}
                      />
                    </div>
                  </>
                )}
                <div>
                  <button
                    className="dialog-test-btn"
                    onClick={handleTest}
                    disabled={testStatus === 'testing'}
                  >
                    {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                  </button>
                  {testStatus === 'success' && <span className="dialog-feedback success">Connected!</span>}
                  {testStatus === 'error' && <span className="dialog-feedback error">{testError}</span>}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="dialog-actions">
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
