import { useState, useCallback, useMemo, useEffect, createContext, use } from 'react'

export type RefreshInterval = 0 | 30 | 60 | 120 | 240 | 480

export interface RefreshSettings {
  interval: RefreshInterval
}

const DEFAULTS: RefreshSettings = {
  interval: 30,
}

const STORAGE_KEY = 'feedwell-refresh-settings'

function loadSettings(): RefreshSettings {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

function persistSettings(s: RefreshSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  window.api.settings.set(STORAGE_KEY, s)
  window.api.scheduler.reschedule()
}

export function useRefreshSettingsProvider() {
  const [settings, setSettings] = useState<RefreshSettings>(loadSettings)

  useEffect(() => {
    persistSettings(settings)
  }, [settings])

  const updateSettings = useCallback((partial: Partial<RefreshSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }))
  }, [])

  return useMemo(() => ({ settings, updateSettings }), [settings, updateSettings])
}

interface RefreshSettingsContextValue {
  settings: RefreshSettings
  updateSettings: (partial: Partial<RefreshSettings>) => void
}

const RefreshSettingsContext = createContext<RefreshSettingsContextValue | null>(null)

export const RefreshSettingsProvider = RefreshSettingsContext.Provider

export function useRefreshSettings() {
  const ctx = use(RefreshSettingsContext)
  if (!ctx) throw new Error('useRefreshSettings must be used within RefreshSettingsProvider')
  return ctx
}
