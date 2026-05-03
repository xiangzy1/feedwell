import { useState, useEffect, useCallback, useMemo } from 'react'
import SidebarItem from './SidebarItem'
import '../../styles/sidebar.css'

interface Feed {
  id: number
  title: string
  url: string
  folder_id: number | null
  folder_name: string | null
  unread_count: number
  open_in_browser: boolean
}

interface Props {
  selectedFeedId: number | null
  selectedFilter: string | null
  activeFeedId: number | null
  refreshProgress: { current: number; total: number } | null
  onSelectFeed: (feedId: number) => void
  onSelectFilter: (filter: string) => void
  onShowAddFeed: () => void
  onShowSettings: () => void
  onShowStats: () => void
}

export default function Sidebar({ selectedFeedId, selectedFilter, activeFeedId, refreshProgress, onSelectFeed, onSelectFilter, onShowAddFeed, onShowSettings, onShowStats }: Props) {
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [collapsedFolders, setCollapsedFolders] = useState<Set<number>>(new Set())

  const loadFeeds = useCallback(async () => {
    const feeds = await window.api.feeds.list()
    setFeeds(feeds)
    const total = feeds.reduce((sum: number, f: Feed) => sum + f.unread_count, 0)
    setUnreadCount(total)
  }, [])

  useEffect(() => {
    loadFeeds()
    return window.api.onFeedsUpdated(loadFeeds)
  }, [loadFeeds])

  const handleDelete = async (feedId: number) => {
    await window.api.feeds.remove(feedId)
    loadFeeds()
  }

  const handleToggleBrowser = async (feedId: number, currentValue: boolean) => {
    const newVal = currentValue ? 0 : 1
    await window.api.feeds.update(feedId, { open_in_browser: newVal })
    loadFeeds()
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
    return { groupedFeeds: grouped, folderNames: names }
  }, [feeds])

  const ungrouped = groupedFeeds[0] || []
  const folderIds = Object.keys(groupedFeeds).filter(k => k !== '0').map(Number)

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
      label={feed.title}
      count={feed.unread_count}
      selected={selectedFeedId === feed.id && !selectedFilter}
      active={activeFeedId === feed.id && !(selectedFeedId === feed.id && !selectedFilter)}
      feedId={feed.id}
      onClick={() => onSelectFeed(feed.id)}
      onDelete={() => handleDelete(feed.id)}
      onRefresh={() => window.api.feeds.refresh(feed.id)}
      onToggleBrowser={() => handleToggleBrowser(feed.id, feed.open_in_browser)}
      openInBrowser={feed.open_in_browser}
      feedUrl={feed.url}
    />
  )

  const progressPct = refreshProgress && refreshProgress.total > 0
    ? (refreshProgress.current / refreshProgress.total) * 100 : 0

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <SidebarItem
          label="All"
          selected={selectedFilter === 'all'}
          onClick={() => onSelectFilter('all')}
        />
        <SidebarItem
          label="Unread"
          count={unreadCount}
          selected={selectedFilter === 'unread'}
          onClick={() => onSelectFilter('unread')}
        />
        <SidebarItem
          label="Starred"
          selected={selectedFilter === 'starred'}
          onClick={() => onSelectFilter('starred')}
        />
      </div>

      <div className="sidebar-section sidebar-feeds">
        {folderIds.map(folderId => {
          const folderFeeds = groupedFeeds[folderId] || []
          return (
            <div key={folderId} className="sidebar-folder">
              <div
                className={`sidebar-folder-header ${effectivelyCollapsed.has(folderId) ? 'collapsed' : ''}`}
                onClick={() => toggleFolder(folderId)}
              >
                <span className="sidebar-folder-chevron">▾</span>
                {folderNames[folderId] || 'Folder'}
              </div>
              {!effectivelyCollapsed.has(folderId) && folderFeeds.map(feed => renderFeedItem(feed))}
            </div>
          )
        })}
        {ungrouped.map(feed => renderFeedItem(feed))}
      </div>

      {refreshProgress && (
        <div className="sidebar-progress">
          <div className="sidebar-progress-bar" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      <div className="sidebar-toolbar">
        <button onClick={onShowAddFeed} title="Add Feed">+</button>
        <button onClick={() => window.api.feeds.refresh()} title="Refresh All">↻</button>
        <button onClick={onShowStats} title="Statistics">☰</button>
        <button onClick={onShowSettings} title="Settings">⚙</button>
      </div>
    </aside>
  )
}
