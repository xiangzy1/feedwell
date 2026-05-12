import { useState } from 'react'

interface Props {
  feedId: number
  currentMaxWidth: number | null
  onSet: (feedId: number, width: number | null) => void
  onClose: () => void
}

export default function WebviewMaxWidthDialog({ feedId, currentMaxWidth, onSet, onClose }: Props) {
  const presets = [800, 1024, 1280]
  const isPreset = currentMaxWidth !== null && presets.includes(currentMaxWidth)
  const [showCustom, setShowCustom] = useState(currentMaxWidth !== null && !isPreset)
  const [customValue, setCustomValue] = useState(isPreset ? '' : String(currentMaxWidth ?? ''))

  const handleSelect = (width: number | null) => {
    onSet(feedId, width)
    onClose()
  }

  const handleCustom = () => {
    const val = Number(customValue)
    if (!customValue || val < 400) return
    onSet(feedId, val)
    onClose()
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()} style={{ width: 280 }}>
        <h3>Webview Max Width</h3>
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          <div
            className={`context-menu-item ${currentMaxWidth === null ? 'active' : ''}`}
            style={{ borderRadius: 4, margin: '2px 0' }}
            onClick={() => handleSelect(null)}
          >
            None (full width)
          </div>
          {presets.map(w => (
            <div
              key={w}
              className={`context-menu-item ${currentMaxWidth === w ? 'active' : ''}`}
              style={{ borderRadius: 4, margin: '2px 0' }}
              onClick={() => handleSelect(w)}
            >
              {w}px
            </div>
          ))}
          {!isPreset && currentMaxWidth !== null && (
            <div
              className="context-menu-item active"
              style={{ borderRadius: 4, margin: '2px 0' }}
              onClick={() => { setShowCustom(true); setCustomValue(String(currentMaxWidth)) }}
            >
              {currentMaxWidth}px (custom)
            </div>
          )}
        </div>
        {!showCustom ? (
          <button
            className="btn-secondary"
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => setShowCustom(true)}
          >
            Custom…
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              type="number"
              placeholder="Width in px"
              value={customValue}
              onChange={e => setCustomValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCustom() }}
              autoFocus
              className="dialog-input"
              style={{ flex: 1 }}
              min={400}
            />
            <button
              className="btn-primary"
              onClick={handleCustom}
              disabled={!customValue || Number(customValue) < 400}
            >
              Set
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
