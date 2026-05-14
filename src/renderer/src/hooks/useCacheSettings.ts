import { useState, useCallback, useMemo, useEffect, useRef, createContext, use } from 'react'

export interface CacheSettings {
  maxSizeMB: number // 0 = unlimited
}

const DEFAULTS: CacheSettings = {
  maxSizeMB: 0,
}

const STORAGE_KEY = 'feedwell-cache-settings'

function loadSettings(): CacheSettings {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

function persistSettings(s: CacheSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  window.api.settings.set(STORAGE_KEY, s)
}

export function useCacheSettingsProvider() {
  const [settings, setSettings] = useState<CacheSettings>(loadSettings)
  const prevMaxSizeMB = useRef(settings.maxSizeMB)

  useEffect(() => {
    persistSettings(settings)
    if (settings.maxSizeMB > 0 && prevMaxSizeMB.current !== settings.maxSizeMB) {
      window.api.cache.cleanup().catch(() => {})
    }
    prevMaxSizeMB.current = settings.maxSizeMB
  }, [settings])

  const updateSettings = useCallback((partial: Partial<CacheSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }))
  }, [])

  return useMemo(() => ({ settings, updateSettings }), [settings, updateSettings])
}

interface CacheSettingsContextValue {
  settings: CacheSettings
  updateSettings: (partial: Partial<CacheSettings>) => void
}

const CacheSettingsContext = createContext<CacheSettingsContextValue | null>(null)

export const CacheSettingsProvider = CacheSettingsContext.Provider

export function useCacheSettings() {
  const ctx = use(CacheSettingsContext)
  if (!ctx) throw new Error('useCacheSettings must be used within CacheSettingsProvider')
  return ctx
}
