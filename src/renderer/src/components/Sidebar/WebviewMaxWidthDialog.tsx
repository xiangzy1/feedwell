import { useState } from 'react'
import Dialog from '../Dialog'

interface Props {
  open: boolean
  feedId: number
  currentMaxWidth: number | null
  onSet: (feedId: number, width: number | null) => void
  onClose: () => void
}

export default function WebviewMaxWidthDialog({ open, feedId, currentMaxWidth, onSet, onClose }: Props) {
  const [customValue, setCustomValue] = useState(
    currentMaxWidth !== null ? String(currentMaxWidth) : ''
  )

  const handleSelect = (width: number | null) => {
    onSet(feedId, width)
    onClose()
  }

  const handleCustomChange = (value: string) => {
    setCustomValue(value)
  }

  const applyCustom = () => {
    const num = Number(customValue)
    if (customValue && num >= 400) onSet(feedId, num)
  }

  return (
    <Dialog open={open} onClose={onClose} title="Webview Max Width" width={280}>
      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
        <div
          className={`context-menu-item ${currentMaxWidth === null ? 'active' : ''}`}
          style={{ borderRadius: 4, margin: '2px 0' }}
          onClick={() => handleSelect(null)}
        >
          None (full width)
        </div>
        <div
          className={`context-menu-item ${currentMaxWidth === 800 ? 'active' : ''}`}
          style={{ borderRadius: 4, margin: '2px 0' }}
          onClick={() => handleSelect(800)}
        >
          800px
        </div>
        <div
          className="context-menu-item no-hover"
          style={{ borderRadius: 4, margin: '2px 0', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <input
            type="number"
            placeholder="Custom"
            value={customValue}
            onChange={e => handleCustomChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applyCustom() }}
            onBlur={applyCustom}
            onClick={e => e.stopPropagation()}
            className="webview-custom-input"
            min={400}
          />
          <span>px</span>
        </div>
      </div>
    </Dialog>
  )
}
