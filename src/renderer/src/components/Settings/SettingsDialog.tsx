import { useState, useEffect, useCallback } from 'react'
import Dialog from '../Dialog'
import { useTheme, type Theme } from '../../hooks/useTheme'
import { useReadingSettings, type ReadingSettings } from '../../hooks/useReadingSettings'
import { useTranslationSettings, type TranslationSettings } from '../../hooks/useTranslationSettings'
import { useRefreshSettings, type RefreshInterval } from '../../hooks/useRefreshSettings'
import { useUpdateSettings } from '../../hooks/useUpdateSettings'
import './SettingsDialog.css'

const themeOptions: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const readingFields: { key: keyof ReadingSettings; label: string }[] = [
  { key: 'fontSize', label: 'Font Size' },
  { key: 'lineSpacing', label: 'Line Spacing' },
  { key: 'paragraphSpacing', label: 'Paragraph Spacing' },
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

const refreshIntervalOptions: { value: RefreshInterval; label: string }[] = [
  { value: 0, label: 'Manual' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every hour' },
  { value: 120, label: 'Every 2 hours' },
  { value: 240, label: 'Every 4 hours' },
  { value: 480, label: 'Every 8 hours' },
]

type Tab = 'general' | 'appearance' | 'reading' | 'translation' | 'api'

const tabs: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'reading', label: 'Reading' },
  { id: 'translation', label: 'Translation' },
  { id: 'api', label: 'API' },
]

interface Props {
  open: boolean
  onClose: () => void
  initialTab?: Tab
}

export default function SettingsDialog({ open, onClose, initialTab }: Props) {
  const { theme, setTheme } = useTheme()
  const { settings, updateSettings, limits } = useReadingSettings()
  const { settings: tSettings, updateSettings: updateTSettings } = useTranslationSettings()
  const { settings: rSettings, updateSettings: updateRSettings } = useRefreshSettings()
  const { settings: uSettings, updateSettings: updateUSettings } = useUpdateSettings()
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'general')

  useEffect(() => {
    if (open && initialTab) setActiveTab(initialTab)
  }, [open, initialTab])

  // Update state machine
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateProgress, setUpdateProgress] = useState(0)
  const [updateError, setUpdateError] = useState('')

  useEffect(() => {
    if (!open) return
    const unsubs = [
      window.api.updater.onChecking(() => setUpdateState('checking')),
      window.api.updater.onAvailable((data) => { setUpdateVersion(data.version); setUpdateState('available') }),
      window.api.updater.onNotAvailable(() => setUpdateState('not-available')),
      window.api.updater.onProgress((data) => { setUpdateProgress(data.percent); setUpdateState('downloading') }),
      window.api.updater.onDownloaded(() => setUpdateState('downloaded')),
      window.api.updater.onError((data) => { setUpdateError(data.message); setUpdateState('error') }),
    ]
    return () => unsubs.forEach(fn => fn())
  }, [open])

  const handleCheckUpdate = useCallback(() => {
    setUpdateState('checking')
    setUpdateError('')
    window.api.updater.check().catch(() => {})
  }, [])

  const handleDownloadUpdate = useCallback(() => {
    setUpdateState('downloading')
    setUpdateProgress(0)
    window.api.updater.download().catch(() => {})
  }, [])

  const handleInstallUpdate = useCallback(() => {
    window.api.updater.install()
  }, [])

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
    <Dialog open={open} onClose={onClose} title="Settings" scrollable width={640} className="settings-dialog">
      <div className="settings-layout">
        <nav className="settings-nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {activeTab === 'general' && (
            <div className="settings-panel" key="general">
              <div className="dialog-column">
                <label className="dialog-radio">
                  <input
                    type="checkbox"
                    checked={uSettings.autoCheck}
                    onChange={e => updateUSettings({ autoCheck: e.target.checked })}
                  />
                  Automatically check for updates
                </label>
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {updateState === 'idle' && (
                      <button className="dialog-test-btn" onClick={handleCheckUpdate}>Check for Updates</button>
                    )}
                    {updateState === 'checking' && (
                      <button className="dialog-test-btn" disabled>Checking...</button>
                    )}
                    {updateState === 'available' && (
                      <button className="dialog-test-btn" onClick={handleDownloadUpdate}>Download v{updateVersion}</button>
                    )}
                    {updateState === 'downloading' && (
                      <div className="update-progress-container">
                        <div className="update-progress-bar" style={{ width: `${updateProgress}%` }} />
                        <span className="update-progress-text">{updateProgress}%</span>
                      </div>
                    )}
                    {updateState === 'downloaded' && (
                      <button className="dialog-test-btn" onClick={handleInstallUpdate}>Restart to Update</button>
                    )}
                    {updateState === 'not-available' && (
                      <>
                        <button className="dialog-test-btn" onClick={handleCheckUpdate}>Check for Updates</button>
                        <span className="dialog-feedback success">You&apos;re up to date!</span>
                      </>
                    )}
                    {updateState === 'error' && (
                      <>
                        <button className="dialog-test-btn" onClick={handleCheckUpdate}>Check for Updates</button>
                        <span className="dialog-feedback error">{updateError}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="settings-panel" key="appearance">
              <div className="dialog-option-group">
                {themeOptions.map(opt => (
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
            </div>
          )}

          {activeTab === 'reading' && (
            <div className="settings-panel" key="reading">
              <div className="settings-number-group">
                {readingFields.map(({ key, label }) => (
                  <label key={key} className="settings-number-row">
                    <span className="settings-number-label">{label}</span>
                    <input
                      type="number"
                      className="settings-number-input"
                      min={limits[key].min}
                      max={limits[key].max}
                      step={limits[key].step}
                      value={settings[key]}
                      onChange={e => updateSettings({ [key]: Number(e.target.value) })}
                    />
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <label className="dialog-field-label">Feed Refresh</label>
                <select
                  className="dialog-input"
                  value={rSettings.interval}
                  onChange={e => updateRSettings({ interval: Number(e.target.value) as RefreshInterval })}
                >
                  {refreshIntervalOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeTab === 'translation' && (
            <div className="settings-panel" key="translation">
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
          )}

          {activeTab === 'api' && (
            <div className="settings-panel" key="api">
              <div className="dialog-column">
                <div className="settings-fieldset-label">OpenAI Compatible</div>
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

                <div className="settings-fieldset-divider" />
                <div className="settings-fieldset-label">Google Translate</div>
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

                <div className="settings-fieldset-divider" />
                <div className="settings-fieldset-label">Microsoft Translator</div>
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

              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
