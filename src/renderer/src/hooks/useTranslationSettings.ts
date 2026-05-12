import { useState, useCallback, useMemo, useEffect, createContext, use } from 'react'

export interface TranslationSettings {
  provider: 'disabled' | 'ai' | 'google' | 'microsoft'
  targetLang: string
  aiBaseUrl: string
  aiApiKey: string
  aiModel: string
  googleApiKey: string
  microsoftApiKey: string
  microsoftRegion: string
}

const DEFAULTS: TranslationSettings = {
  provider: 'disabled',
  targetLang: 'zh-CN',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  googleApiKey: '',
  microsoftApiKey: '',
  microsoftRegion: '',
}

const STORAGE_KEY = 'feedwell-translation-settings'

function loadSettings(): TranslationSettings {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

function persistSettings(s: TranslationSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  window.api.settings.set(STORAGE_KEY, s)
}

export function useTranslationSettingsProvider() {
  const [settings, setSettings] = useState<TranslationSettings>(loadSettings)

  useEffect(() => {
    persistSettings(settings)
  }, [settings])

  const updateSettings = useCallback((partial: Partial<TranslationSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }))
  }, [])

  return useMemo(() => ({ settings, updateSettings }), [settings, updateSettings])
}

interface TranslationSettingsContextValue {
  settings: TranslationSettings
  updateSettings: (partial: Partial<TranslationSettings>) => void
}

const TranslationSettingsContext = createContext<TranslationSettingsContextValue | null>(null)

export const TranslationSettingsProvider = TranslationSettingsContext.Provider

export function useTranslationSettings() {
  const ctx = use(TranslationSettingsContext)
  if (!ctx) throw new Error('useTranslationSettings must be used within TranslationSettingsProvider')
  return ctx
}
