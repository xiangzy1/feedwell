import { useCallback } from 'react'

interface Props {
  onResize: (deltaX: number) => void
}

export default function ResizeHandle({ onResize }: Props) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (e: MouseEvent) => {
      onResize(e.movementX)
    }

    const handleMouseUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [onResize])

  return <div className="resize-handle" onMouseDown={handleMouseDown} />
}
