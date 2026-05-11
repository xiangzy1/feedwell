import { useState, useCallback, useEffect, useMemo } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import ArticleList from './components/ArticleList/ArticleList'
import ArticleView from './components/ArticleView/ArticleView'
import AddFeedDialog from './components/Sidebar/AddFeedDialog'
import SettingsDialog from './components/Settings/SettingsDialog'
import StatsDialog from './components/Stats/StatsDialog'
import ResizeHandle from './components/ResizeHandle'
import { useArticles } from './hooks/useArticles'
import { useFeeds } from './hooks/useFeeds'
import { usePersistedWidth } from './hooks/usePersistedWidth'
import { useShortcuts } from './hooks/useShortcuts'
import { SortOrder } from './components/ArticleList/ArticleList'
import { useThemeProvider, ThemeProvider } from './hooks/useTheme'
import { useReadingSettingsProvider, ReadingSettingsProvider } from './hooks/useReadingSettings'
import { useTranslationSettingsProvider, TranslationSettingsProvider } from './hooks/useTranslationSettings'
import { PanelLeftClose, PanelLeft } from 'lucide-react'
import './styles/global.css'
import './styles/stats.css'

const SORT_STORAGE_KEY = 'feedwell-sort-order'
const SIDEBAR_COLLAPSED_KEY = 'feedwell-sidebar-collapsed'

export default function App() {
  const { handleResize: handleSidebarResize } = usePersistedWidth('feedwell-sidebar-width', '--sidebar-width', 220, 120, 500)
  const { handleResize: handleListResize } = usePersistedWidth('feedwell-list-width', '--list-width', 300, 200, 600)
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<string | null>('all')
  const [showAddFeed, setShowAddFeed] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
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
  const { feeds, reload: reloadFeeds } = useFeeds()
  const { articles, selectedId, setSelectedId, markRead, markStarred, markAllRead } = useArticles({
    feedId: selectedFeedId,
    filter: selectedFilter
  })
  const selectedArticle = articles.find(a => a.id === selectedId) || null
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
    selectedId,
    onSelectArticle: setSelectedId,
    onMarkRead: markRead,
    onToggleStar: markStarred,
    selectedArticle
  })

  useEffect(() => {
    return window.api.onMenuAddFeed(() => setShowAddFeed(true))
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
      <div className="app">
        <button className="sidebar-toggle" onClick={toggleSidebar}>
          {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <Sidebar
          className={sidebarCollapsed ? 'collapsed' : undefined}
          selectedFeedId={selectedFeedId}
          selectedFilter={selectedFilter}
          activeFeedId={activeFeedId}
          refreshProgress={refreshProgress}
          onSelectFeed={(id) => { setSelectedFeedId(id); setSelectedFilter(null) }}
          onSelectFilter={(filter) => { setSelectedFilter(filter); setSelectedFeedId(null) }}
          onShowAddFeed={() => setShowAddFeed(true)}
          onShowSettings={() => setShowSettings(true)}
          onShowStats={() => setShowStats(true)}
        />
        <ResizeHandle className={sidebarCollapsed ? 'hidden' : undefined} onResize={handleSidebarResize} />
        <ArticleList
          sortedArticles={sortedArticles}
          selectedId={selectedId}
          onSelect={(id) => { setSelectedId(id); markRead(id) }}
          onMarkAllRead={() => markAllRead(selectedFeedId || undefined)}
          filter={selectedFilter}
          sortOrder={sortOrder}
          onSortOrderChange={handleSortOrderChange}
        />
        <ResizeHandle onResize={handleListResize} />
        <ArticleView
          article={selectedArticle}
          onToggleStar={markStarred}
          onToggleRead={markRead}
          feeds={feeds}
        />
        {showAddFeed && (
          <AddFeedDialog onAdd={handleAddFeed} onClose={() => setShowAddFeed(false)} />
        )}
        {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
        {showStats && <StatsDialog onClose={() => setShowStats(false)} onSelectFeed={(id) => { setSelectedFeedId(id); setSelectedFilter(null) }} />}
      </div>
      </TranslationSettingsProvider>
      </ReadingSettingsProvider>
    </ThemeProvider>
  )
}
