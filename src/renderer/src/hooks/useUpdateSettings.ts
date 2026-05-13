import { useState, useCallback, useMemo, useEffect, createContext, use } from 'react'

export interface UpdateSettings {
  autoCheck: boolean
}

const DEFAULTS: UpdateSettings = {
  autoCheck: true,
}

const STORAGE_KEY = 'feedwell-update-settings'

function loadSettings(): UpdateSettings {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

function persistSettings(s: UpdateSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  window.api.updater.setAutoCheck(s.autoCheck)
}

export function useUpdateSettingsProvider() {
  const [settings, setSettings] = useState<UpdateSettings>(loadSettings)

  useEffect(() => {
    persistSettings(settings)
  }, [settings])

  const updateSettings = useCallback((partial: Partial<UpdateSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }))
  }, [])

  return useMemo(() => ({ settings, updateSettings }), [settings, updateSettings])
}

interface UpdateSettingsContextValue {
  settings: UpdateSettings
  updateSettings: (partial: Partial<UpdateSettings>) => void
}

const UpdateSettingsContext = createContext<UpdateSettingsContextValue | null>(null)

export const UpdateSettingsProvider = UpdateSettingsContext.Provider

export function useUpdateSettings() {
  const ctx = use(UpdateSettingsContext)
  if (!ctx) throw new Error('useUpdateSettings must be used within UpdateSettingsProvider')
  return ctx
}
