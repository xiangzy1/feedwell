import { useEffect, useRef, useState, useCallback } from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  scrollable?: boolean
  width?: number | string
  className?: string
  children: React.ReactNode
}

export default function Dialog({ open, onClose, title, scrollable, width, className, children }: DialogProps) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number | undefined>(undefined)

  const unmount = useCallback(() => {
    setVisible(false)
    setMounted(false)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
  }, [])

  const ANIMATION_MS = 300

  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(raf)
    } else if (mounted) {
      setVisible(false)
      const el = dialogRef.current
      if (el) {
        const handler = (e: TransitionEvent) => {
          if (e.target === el) unmount()
        }
        el.addEventListener('transitionend', handler, { once: true })
        timeoutRef.current = setTimeout(unmount, ANIMATION_MS)
        return () => {
          el.removeEventListener('transitionend', handler)
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
      } else {
        unmount()
      }
    }
  }, [open]) // mounted/unmount intentionally excluded to avoid re-triggering the lifecycle

  useEffect(() => {
    if (!mounted) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [mounted, onClose])

  if (!mounted) return null

  const dialogClasses = [
    'dialog',
    scrollable ? 'dialog-scrollable' : '',
    className || '',
  ].filter(Boolean).join(' ')

  return (
    <div className="dialog-overlay" data-state={visible ? 'open' : 'closed'} onClick={onClose}>
      <div
        ref={dialogRef}
        className={dialogClasses}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        style={width ? { width } : undefined}
      >
        {title && (
          <div className="dialog-header">
            <h3>{title}</h3>
            <button className="dialog-close" onClick={onClose}><X size={16} /></button>
          </div>
        )}
        {scrollable ? (
          <div className="dialog-scrollable-content">{children}</div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
