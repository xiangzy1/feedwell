import { useCallback, useRef } from 'react'

interface Props {
  className?: string
  onResize: (deltaX: number) => void
}

export default function ResizeHandle({ className, onResize }: Props) {
  const onResizeRef = useRef(onResize)
  onResizeRef.current = onResize
  const lastXRef = useRef(0)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    lastXRef.current = e.clientX
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const dx = e.clientX - lastXRef.current
    lastXRef.current = e.clientX
    if (dx !== 0) onResizeRef.current(dx)
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  return (
    <div
      className={`resize-handle${className ? ` ${className}` : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  )
}
