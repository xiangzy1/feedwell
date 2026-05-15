import { useState, useEffect, useMemo } from 'react'
import { Plus, RefreshCw, BarChart3, Settings, ChevronDown, Inbox, BookOpen, Star, Folder } from 'lucide-react'
import SidebarItem from './SidebarItem'
import MoveToFolderDialog from './MoveToFolderDialog'
import WebviewMaxWidthDialog from './WebviewMaxWidthDialog'
import '../../styles/sidebar.css'
import { Feed } from '../../hooks/useFeeds'

interface Props {
  className?: string
  feeds: Feed[]
  unreadCount: number
  selectedFeedId: number | null
  selectedFilter: string | null
  selectedFolderId: number | null
  activeFeedId: number | null
  refreshProgress: { current: number; total: number } | null
  onSelectFeed: (feedId: number) => void
  onSelectFilter: (filter: string) => void
  onSelectFolder: (folderId: number) => void
  onShowAddFeed: () => void
  onShowSettings: () => void
  onShowStats: () => void
}

export default function Sidebar({ className, feeds, unreadCount, selectedFeedId, selectedFilter, selectedFolderId, activeFeedId, refreshProgress, onSelectFeed, onSelectFilter, onSelectFolder, onShowAddFeed, onShowSettings, onShowStats }: Props) {
  const [collapsedFolders, setCollapsedFolders] = useState<Set<number>>(new Set())
  const [moveToFolderFeed, setMoveToFolderFeed] = useState<Feed | null>(null)
  const [webviewMaxWidthFeed, setWebviewMaxWidthFeed] = useState<Feed | null>(null)

  const handleDelete = async (feedId: number) => {
    await window.api.feeds.remove(feedId)
  }

  const handleToggleBrowser = async (feedId: number, currentValue: boolean) => {
    const newVal = currentValue ? 0 : 1
    await window.api.feeds.update(feedId, { open_in_browser: newVal })
  }

  const handleMoveToFolder = async (feedId: number, folderId: number | null) => {
    await window.api.feeds.update(feedId, { folder_id: folderId })
  }

  const handleSetWebviewMaxWidth = async (feedId: number, width: number | null) => {
    await window.api.feeds.update(feedId, { webview_max_width: width })
    setWebviewMaxWidthFeed(prev => {
      if (!prev) return null
      return { ...prev, webview_max_width: width }
    })
  }

  const { groupedFeeds, folderNames } = useMemo(() => {
    const grouped: Record<number, Feed[]> = {}
    const names: Record<number, string> = {}
    for (const f of feeds) {
      const key = f.folder_id || 0
      grouped[key] = grouped[key] || []
      grouped[key].push(f)
      if (f.folder_id && f.folder_name) names[f.folder_id] = f.folder_name
    }
    for (const key of Object.keys(grouped)) {
      grouped[Number(key)].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
    }
    return { groupedFeeds: grouped, folderNames: names }
  }, [feeds])

  const ungrouped = groupedFeeds[0] || []
  const folderIds = Object.keys(groupedFeeds).filter(k => k !== '0').map(Number)

  const folderUnreadCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const fid of folderIds) {
      counts[fid] = (groupedFeeds[fid] || []).reduce((sum, f) => sum + f.unread_count, 0)
    }
    return counts
  }, [groupedFeeds, folderIds])

  const toggleFolder = (folderId: number) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const activeFeedFolderId = activeFeedId
    ? feeds.find(f => f.id === activeFeedId)?.folder_id ?? null
    : null
  const effectivelyCollapsed = activeFeedFolderId
    ? new Set([...collapsedFolders].filter(id => id !== activeFeedFolderId))
    : collapsedFolders

  useEffect(() => {
    if (!activeFeedId) return
    const el = document.querySelector(`[data-feed-id="${activeFeedId}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [activeFeedId])

  const renderFeedItem = (feed: Feed) => (
    <SidebarItem
      key={feed.id}
      feed={feed}
      label={feed.title}
      count={feed.unread_count}
      selected={selectedFeedId === feed.id && !selectedFilter}
      active={activeFeedId === feed.id && !(selectedFeedId === feed.id && !selectedFilter)}
      onClick={() => onSelectFeed(feed.id)}
      onDelete={() => handleDelete(feed.id)}
      onRefresh={() => window.api.feeds.refresh(feed.id)}
      onToggleBrowser={() => handleToggleBrowser(feed.id, feed.open_in_browser)}
      onOpenFeedUrl={() => window.api.openExternal(feed.url)}
      onMoveToFolder={() => setMoveToFolderFeed(feed)}
      onSetWebviewMaxWidth={() => setWebviewMaxWidthFeed(feed)}
    />
  )

  const progressPct = refreshProgress && refreshProgress.total > 0
    ? (refreshProgress.current / refreshProgress.total) * 100 : 0

  return (
    <aside className={`sidebar${className ? ` ${className}` : ''}`}>
      <div className="sidebar-section">
        <SidebarItem
          label="All"
          selected={selectedFilter === 'all'}
          onClick={() => onSelectFilter('all')}
          icon={<Inbox size={14} />}
        />
        <SidebarItem
          label="Unread"
          count={unreadCount}
          selected={selectedFilter === 'unread'}
          onClick={() => onSelectFilter('unread')}
          icon={<BookOpen size={14} />}
        />
        <SidebarItem
          label="Starred"
          selected={selectedFilter === 'starred'}
          onClick={() => onSelectFilter('starred')}
          icon={<Star size={14} />}
        />
      </div>

      <div className="sidebar-section sidebar-feeds">
        {ungrouped.map(feed => renderFeedItem(feed))}
        {folderIds.map(folderId => {
          const folderFeeds = groupedFeeds[folderId] || []
          return (
            <div key={folderId} className="sidebar-folder">
              <div
                className={`sidebar-folder-header ${effectivelyCollapsed.has(folderId) ? 'collapsed' : ''} ${selectedFolderId === folderId && !selectedFilter && !selectedFeedId ? 'selected' : ''}`}
                onClick={() => onSelectFolder(folderId)}
              >
                <span className="sidebar-folder-chevron" onClick={(e) => { e.stopPropagation(); toggleFolder(folderId) }}><ChevronDown size={10} /></span>
                <span className="sidebar-item-icon sidebar-folder-icon"><Folder size={12} /></span>
                <span className="sidebar-folder-label">{folderNames[folderId] || 'Folder'}</span>
                {folderUnreadCounts[folderId] > 0 && <span className="sidebar-item-count">{folderUnreadCounts[folderId]}</span>}
              </div>
              {!effectivelyCollapsed.has(folderId) && folderFeeds.map(feed => renderFeedItem(feed))}
            </div>
          )
        })}
      </div>

      {refreshProgress && (
        <div className="sidebar-progress">
          <div className="sidebar-progress-bar" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      <div className="sidebar-toolbar">
        <button onClick={onShowAddFeed} title="Add Feed"><Plus size={15} /></button>
        <button onClick={() => window.api.feeds.refresh()} title="Refresh All"><RefreshCw size={15} /></button>
        <button onClick={onShowStats} title="Statistics"><BarChart3 size={15} /></button>
        <button onClick={onShowSettings} title="Settings"><Settings size={15} /></button>
      </div>

      <MoveToFolderDialog
        open={!!moveToFolderFeed}
        feedId={moveToFolderFeed?.id ?? 0}
        currentFolderId={moveToFolderFeed?.folder_id ?? null}
        onMove={handleMoveToFolder}
        onClose={() => setMoveToFolderFeed(null)}
      />
      <WebviewMaxWidthDialog
        open={!!webviewMaxWidthFeed}
        feedId={webviewMaxWidthFeed?.id ?? 0}
        currentMaxWidth={webviewMaxWidthFeed?.webview_max_width ?? null}
        onSet={handleSetWebviewMaxWidth}
        onClose={() => setWebviewMaxWidthFeed(null)}
      />
    </aside>
  )
}
