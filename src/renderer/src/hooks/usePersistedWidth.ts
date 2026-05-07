import { useState, useEffect, useCallback } from 'react'
import { clamp } from '../utils/clamp'

export function usePersistedWidth(storageKey: string, cssVar: string, defaultWidth: number, min: number, max: number) {
  const [width, setWidth] = useState(() => {
    const stored = Number(localStorage.getItem(storageKey))
    const w = clamp(stored || defaultWidth, min, max)
    document.documentElement.style.setProperty(cssVar, `${w}px`)
    return w
  })

  useEffect(() => {
    document.documentElement.style.setProperty(cssVar, `${width}px`)
    localStorage.setItem(storageKey, String(width))
  }, [storageKey, cssVar, width])

  const handleResize = useCallback((dx: number) => {
    setWidth(w => clamp(w + dx, min, max))
  }, [min, max])

  return { width, handleResize }
}
