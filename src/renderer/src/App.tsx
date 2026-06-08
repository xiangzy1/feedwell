import { useState, useCallback, useEffect, useMemo } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import ArticleList from './components/ArticleList/ArticleList'
import ArticleView from './components/ArticleView/ArticleView'
import AddFeedDialog from './components/Sidebar/AddFeedDialog'
import SettingsDialog from './components/Settings/SettingsDialog'
import StatsDialog from './components/Stats/StatsDialog'
import ResizeHandle from './components/ResizeHandle'
import ErrorBoundary from './components/ErrorBoundary'
import { useArticles } from './hooks/useArticles'
import { useFeeds } from './hooks/useFeeds'
import { usePersistedWidth } from './hooks/usePersistedWidth'
import { useShortcuts } from './hooks/useShortcuts'
import { SortOrder } from './components/ArticleList/ArticleList'
import { useThemeProvider, ThemeProvider } from './hooks/useTheme'
import { useReadingSettingsProvider, ReadingSettingsProvider } from './hooks/useReadingSettings'
import { useTranslationSettingsProvider, TranslationSettingsProvider } from './hooks/useTranslationSettings'
import { useRefreshSettingsProvider, RefreshSettingsProvider } from './hooks/useRefreshSettings'
import { useUpdateSettingsProvider, UpdateSettingsProvider } from './hooks/useUpdateSettings'
import { useCacheSettingsProvider, CacheSettingsProvider } from './hooks/useCacheSettings'
import { PanelLeftClose, PanelLeft } from 'lucide-react'
import './styles/global.css'
import './styles/dialog.css'
import './styles/stats.css'

const SORT_STORAGE_KEY = 'feedwell-sort-order'
const SIDEBAR_COLLAPSED_KEY = 'feedwell-sidebar-collapsed'

export default function App() {
  const { handleResize: handleSidebarResize } = usePersistedWidth('feedwell-sidebar-width', '--sidebar-width', 220, 120, 500)
  const { handleResize: handleListResize } = usePersistedWidth('feedwell-list-width', '--list-width', 300, 200, 600)
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(() => {
    const stored = localStorage.getItem('feedwell-selected-feed-id')
    return stored ? Number(stored) : null
  })
  const [selectedFilter, setSelectedFilter] = useState<string | null>(() => {
    const storedFilter = localStorage.getItem('feedwell-selected-filter')
    const storedFeedId = localStorage.getItem('feedwell-selected-feed-id')
    const storedFolderId = localStorage.getItem('feedwell-selected-folder-id')
    if (storedFilter) return storedFilter
    if (storedFeedId || storedFolderId) return null
    return 'all'
  })
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(() => {
    const stored = localStorage.getItem('feedwell-selected-folder-id')
    return stored ? Number(stored) : null
  })

  useEffect(() => {
    if (selectedFeedId !== null) {
      localStorage.setItem('feedwell-selected-feed-id', String(selectedFeedId))
      localStorage.removeItem('feedwell-selected-filter')
      localStorage.removeItem('feedwell-selected-folder-id')
    } else if (selectedFolderId !== null) {
      localStorage.setItem('feedwell-selected-folder-id', String(selectedFolderId))
      localStorage.removeItem('feedwell-selected-filter')
      localStorage.removeItem('feedwell-selected-feed-id')
    } else if (selectedFilter !== null) {
      localStorage.setItem('feedwell-selected-filter', selectedFilter)
      localStorage.removeItem('feedwell-selected-feed-id')
      localStorage.removeItem('feedwell-selected-folder-id')
    }
  }, [selectedFeedId, selectedFilter, selectedFolderId])
  const [showAddFeed, setShowAddFeed] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'general' | 'appearance' | 'reading' | 'translation' | 'api' | 'storage' | undefined>(undefined)
  const [showStats, setShowStats] = useState(false)
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const stored = localStorage.getItem(SORT_STORAGE_KEY)
    return stored === 'oldest' ? 'oldest' : 'newest'
  })
  const handleSortOrderChange = useCallback((order: SortOrder) => {
    setSortOrder(order)
    localStorage.setItem(SORT_STORAGE_KEY, order)
    window.api.settings.set(SORT_STORAGE_KEY, order)
  }, [])
  const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 250)
    return () => clearTimeout(t)
  }, [searchQuery])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true')
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }, [])
  const themeCtx = useThemeProvider()
  const readingCtx = useReadingSettingsProvider()
  const translationCtx = useTranslationSettingsProvider()
  const refreshCtx = useRefreshSettingsProvider()
  const updateCtx = useUpdateSettingsProvider()
  const cacheCtx = useCacheSettingsProvider()
  const { feeds, reload: reloadFeeds } = useFeeds()
  const { articles, selectedArticle, setSelectedArticle, markRead, markStarred, markAllRead } = useArticles({
    feedId: selectedFeedId,
    filter: selectedFilter,
    folderId: selectedFolderId ?? undefined,
    searchQuery: debouncedSearch
  })
  const unreadCount = useMemo(() => feeds.reduce((sum, f) => sum + f.unread_count, 0), [feeds])

  const activeFeedId = selectedArticle?.feed_id ?? selectedFeedId

  // Report currently viewed article to main process (used for favicon caching etc.)
  useEffect(() => {
    window.api.setCurrentArticle(
      selectedArticle?.feed_id ?? null,
      selectedArticle?.id ?? null
    )
  }, [selectedArticle?.id, selectedArticle?.feed_id])

  const sortedArticles = useMemo(() => (
    sortOrder === 'newest' ? articles : [...articles].reverse()
  ), [articles, sortOrder])

  useShortcuts({
    articles: sortedArticles,
    selectedArticle,
    onSelectArticle: (article) => {
      setSelectedArticle(article)
    },
    onMarkRead: markRead,
    onToggleStar: markStarred,
  })

  useEffect(() => {
    return window.api.onMenuAddFeed(() => setShowAddFeed(true))
  }, [])

  useEffect(() => {
    return window.api.onMenuSettings(() => { setSettingsTab(undefined); setShowSettings(true) })
  }, [])

  useEffect(() => {
    return window.api.onMenuCheckUpdates(() => { setSettingsTab('general'); setShowSettings(true) })
  }, [])

  useEffect(() => {
    return window.api.onMenuImportOpml(async () => {
      await window.api.opml.import()
      await window.api.feeds.refresh()
      reloadFeeds()
    })
  }, [reloadFeeds])

  useEffect(() => {
    return window.api.onMenuExportOpml(() => window.api.opml.export())
  }, [])

  useEffect(() => {
    const unsubProgress = window.api.onRefreshProgress((p) => setRefreshProgress(p))
    const unsubDone = window.api.onRefreshDone(() => setRefreshProgress(null))
    window.api.isColdStart().then((cold) => { if (cold) window.api.feeds.refreshStale() })
    return () => { unsubProgress(); unsubDone() }
  }, [])

  const handleAddFeed = useCallback(async (url: string, folderId?: number) => {
    const result = await window.api.feeds.add(url, folderId)
    if (result && result.error) {
      throw new Error(result.error)
    }
    setShowAddFeed(false)
    reloadFeeds()
  }, [reloadFeeds])

  return (
    <ThemeProvider value={themeCtx}>
      <ReadingSettingsProvider value={readingCtx}>
      <TranslationSettingsProvider value={translationCtx}>
      <RefreshSettingsProvider value={refreshCtx}>
      <UpdateSettingsProvider value={updateCtx}>
      <CacheSettingsProvider value={cacheCtx}>
      <ErrorBoundary name="Feedwell">
      <div className="app">
        <button className="sidebar-toggle" onClick={toggleSidebar}>
          {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <Sidebar
          className={sidebarCollapsed ? 'collapsed' : undefined}
          feeds={feeds}
          unreadCount={unreadCount}
          selectedFeedId={selectedFeedId}
          selectedFilter={selectedFilter}
          selectedFolderId={selectedFolderId}
          activeFeedId={activeFeedId}
          refreshProgress={refreshProgress}
          onSelectFeed={(id) => { setSelectedFeedId(id); setSelectedFilter(null); setSelectedFolderId(null); setSelectedArticle(null) }}
          onSelectFilter={(filter) => { setSelectedFilter(filter); setSelectedFeedId(null); setSelectedFolderId(null); setSelectedArticle(null) }}
          onSelectFolder={(id) => { setSelectedFolderId(id); setSelectedFeedId(null); setSelectedFilter(null); setSelectedArticle(null) }}
          onShowAddFeed={() => setShowAddFeed(true)}
          onShowSettings={() => setShowSettings(true)}
          onShowStats={() => setShowStats(true)}
        />
        <ResizeHandle className={sidebarCollapsed ? 'hidden' : undefined} onResize={handleSidebarResize} />
        <ArticleList
          sortedArticles={sortedArticles}
          selectedId={selectedArticle?.id ?? null}
          onSelect={(article) => {
            setSelectedArticle(article)
            markRead(article.id)
          }}
          onMarkAllRead={() => markAllRead(selectedFeedId || undefined, selectedFolderId || undefined)}
          filter={selectedFilter}
          sortOrder={sortOrder}
          onSortOrderChange={handleSortOrderChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          scrollKey={selectedFeedId ?? selectedFolderId ?? selectedFilter}
        />
        <ResizeHandle onResize={handleListResize} />
        <ErrorBoundary name="Article View">
          <ArticleView
            key={selectedArticle?.id ?? 'empty'}
            article={selectedArticle}
            onToggleStar={markStarred}
            onToggleRead={markRead}
            feeds={feeds}
          />
        </ErrorBoundary>
        <AddFeedDialog open={showAddFeed} onAdd={handleAddFeed} onClose={() => setShowAddFeed(false)} />
        <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} initialTab={settingsTab} />
        <StatsDialog open={showStats} onClose={() => setShowStats(false)} onSelectFeed={(id) => { setSelectedFeedId(id); setSelectedFilter(null) }} />
      </div>
      </ErrorBoundary>
      </CacheSettingsProvider>
      </UpdateSettingsProvider>
      </RefreshSettingsProvider>
      </TranslationSettingsProvider>
      </ReadingSettingsProvider>
    </ThemeProvider>
  )
}
