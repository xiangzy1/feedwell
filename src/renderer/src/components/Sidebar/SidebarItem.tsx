import { useState, useRef, useEffect, useCallback } from 'react'

interface Props {
  label: string
  count?: number
  selected: boolean
  active?: boolean
  feedId?: number
  onClick: () => void
  onDelete?: () => void
  onRefresh?: () => void
  onToggleBrowser?: () => void
  openInBrowser?: boolean
  feedUrl?: string
}

export default function SidebarItem({ label, count, selected, active, feedId, onClick, onDelete, onRefresh, onToggleBrowser, openInBrowser, feedUrl }: Props) {
  const [showMenu, setShowMenu] = useState(false)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const clickPos = useRef({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  const hasMenu = !!(onDelete || onRefresh || onToggleBrowser || feedUrl)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!hasMenu) return
    clickPos.current = { x: e.clientX, y: e.clientY }
    setMenuStyle({ left: e.clientX, top: e.clientY })
    setShowMenu(true)
  }, [hasMenu])

  const closeMenu = useCallback(() => setShowMenu(false), [])

  useEffect(() => {
    if (!showMenu || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const style: React.CSSProperties = { left: clickPos.current.x, top: clickPos.current.y }
    if (rect.bottom > window.innerHeight) {
      style.top = 'auto'
      style.bottom = window.innerHeight - clickPos.current.y
    }
    if (rect.right > window.innerWidth) {
      style.left = 'auto'
      style.right = window.innerWidth - clickPos.current.x
    }
    setMenuStyle(style)
  }, [showMenu])

  return (
    <>
      <div
        className={`sidebar-item ${selected ? 'selected' : ''} ${active ? 'active-feed' : ''}`}
        data-feed-id={feedId}
        onClick={() => { closeMenu(); onClick() }}
        onContextMenu={handleContextMenu}
      >
        <span className="sidebar-item-label">{label}</span>
        {openInBrowser ? <span className="sidebar-item-badge" title="Opens in browser">↗</span> : null}
        {count !== undefined && count > 0 && (
          <span className="sidebar-item-count">{count}</span>
        )}
        {onRefresh && (
          <button className="sidebar-item-action" onClick={(e) => { e.stopPropagation(); onRefresh() }}>↻</button>
        )}
      </div>

      {showMenu && (
        <>
          <div className="context-menu-overlay" onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu() }} />
          <div
            ref={menuRef}
            className="context-menu"
            style={menuStyle}
          >
            {onRefresh && (
              <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); onRefresh(); closeMenu() }}>
                Refresh
              </div>
            )}
            {onToggleBrowser && (
              <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); onToggleBrowser(); closeMenu() }}>
                {openInBrowser ? '✓ Open in Browser' : 'Open in Browser'}
              </div>
            )}
            {feedUrl && (
              <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(feedUrl); closeMenu() }}>
                Copy Feed URL
              </div>
            )}
            {onDelete && (
              <div className="context-menu-item danger" onClick={(e) => { e.stopPropagation(); onDelete(); closeMenu() }}>
                Delete
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
