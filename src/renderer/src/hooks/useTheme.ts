import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react'

export type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'feedwell-theme'
const validThemes: Theme[] = ['light', 'dark', 'system']

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', resolved)
}

export function useThemeProvider() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return validThemes.includes(stored as Theme) ? (stored as Theme) : 'system'
  })

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
    window.api.settings.set('theme', t)
  }, [])

  useEffect(() => {
    applyTheme(resolveTheme(theme))
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme(getSystemTheme())
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const value = useMemo(() => ({
    theme,
    setTheme,
    resolvedTheme: resolveTheme(theme),
  }), [theme, setTheme])

  return value
}

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void; resolvedTheme: ResolvedTheme }>({
  theme: 'system',
  setTheme: () => {},
  resolvedTheme: 'light'
})

export const ThemeProvider = ThemeContext.Provider

export function useTheme() {
  return useContext(ThemeContext)
}
