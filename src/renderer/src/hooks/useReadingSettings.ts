import { useState, useEffect, useCallback, useMemo, useRef, createContext, use } from 'react'
import { clamp } from '../utils/clamp'

export interface ReadingSettings {
  fontSize: number
  lineSpacing: number
  paragraphSpacing: number
}

export const LIMITS = {
  fontSize: { min: 13, max: 22, step: 1 },
  lineSpacing: { min: 1.4, max: 2.4, step: 0.1 },
  paragraphSpacing: { min: 0.5, max: 2.0, step: 0.1 },
} as const

const DEFAULTS: ReadingSettings = {
  fontSize: 15,
  lineSpacing: 1.8,
  paragraphSpacing: 1.0,
}

const STORAGE_KEYS: Record<keyof ReadingSettings, string> = {
  fontSize: 'feedwell-font-size',
  lineSpacing: 'feedwell-line-spacing',
  paragraphSpacing: 'feedwell-paragraph-spacing',
}

function loadSetting<K extends keyof ReadingSettings>(key: K): ReadingSettings[K] {
  const raw = localStorage.getItem(STORAGE_KEYS[key])
  if (raw == null) return DEFAULTS[key]
  const num = Number(raw)
  if (isNaN(num)) return DEFAULTS[key]
  const { min, max } = LIMITS[key]
  return clamp(num, min, max) as ReadingSettings[K]
}

function applySettings(s: ReadingSettings) {
  const root = document.documentElement
  root.style.setProperty('--article-font-size', `${s.fontSize}px`)
  root.style.setProperty('--article-line-height', String(s.lineSpacing))
  root.style.setProperty('--article-paragraph-gap', `${s.paragraphSpacing}em`)
}

function persistSettings(s: ReadingSettings) {
  for (const key of Object.keys(STORAGE_KEYS) as (keyof ReadingSettings)[]) {
    localStorage.setItem(STORAGE_KEYS[key], String(s[key]))
    window.api.settings.set(STORAGE_KEYS[key], s[key])
  }
}

export function useReadingSettingsProvider() {
  const [settings, setSettings] = useState<ReadingSettings>(() => ({
    fontSize: loadSetting('fontSize'),
    lineSpacing: loadSetting('lineSpacing'),
    paragraphSpacing: loadSetting('paragraphSpacing'),
  }))

  const persistRef = useRef((s: ReadingSettings) => persistSettings(s))
  useEffect(() => {
    applySettings(settings)
    persistRef.current(settings)
  }, [settings])

  const updateSettings = useCallback((partial: Partial<ReadingSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }))
  }, [])

  return useMemo(() => ({ settings, updateSettings, limits: LIMITS }), [settings, updateSettings])
}

interface ReadingSettingsContextValue {
  settings: ReadingSettings
  updateSettings: (partial: Partial<ReadingSettings>) => void
  limits: typeof LIMITS
}

const ReadingSettingsContext = createContext<ReadingSettingsContextValue | null>(null)

export const ReadingSettingsProvider = ReadingSettingsContext.Provider

export function useReadingSettings() {
  const ctx = use(ReadingSettingsContext)
  if (!ctx) throw new Error('useReadingSettings must be used within ReadingSettingsProvider')
  return ctx
}
