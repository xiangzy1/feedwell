import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Circle, CircleDot, ArrowUpDown, Check, Search, X } from 'lucide-react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import ArticleRow from './ArticleRow'
import { Article } from '../../hooks/useArticles'
import '../../styles/article-list.css'

export type SortOrder = 'newest' | 'oldest'

interface Props {
  sortedArticles: Article[]
  selectedId: number | null
  onSelect: (article: Article) => void
  onMarkAllRead: () => void
  filter: string | null
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  scrollKey?: string | number
}

export default function ArticleList({ sortedArticles, selectedId, onSelect, onMarkAllRead, filter, sortOrder, onSortOrderChange, searchQuery, onSearchChange, scrollKey }: Props) {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const [unreadSnapshot, setUnreadSnapshot] = useState<Set<number>>(new Set())
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const prevIdKey = useRef<string>('')

  const idKey = useMemo(() => sortedArticles.map(a => a.id).sort((a, b) => a - b).join(','), [sortedArticles])

  useEffect(() => {
    if (!unreadOnly) return
    if (idKey !== prevIdKey.current) {
      prevIdKey.current = idKey
      setUnreadSnapshot(new Set(sortedArticles.filter(a => !a.read).map(a => a.id)))
    }
  }, [idKey, sortedArticles, unreadOnly])

  const toggleUnreadOnly = useCallback(() => {
    setUnreadOnly(prev => {
      const next = !prev
      if (next) {
        const snapshot = new Set(sortedArticles.filter(a => !a.read).map(a => a.id))
        setUnreadSnapshot(snapshot)
        prevIdKey.current = idKey
      }
      return next
    })
  }, [sortedArticles, idKey])

  const sorted = useMemo(() => {
    return unreadOnly ? sortedArticles.filter(a => unreadSnapshot.has(a.id)) : sortedArticles
  }, [sortedArticles, unreadOnly, unreadSnapshot])

  const hasUnread = sortedArticles.some(a => !a.read)

  const toggleSearch = useCallback(() => {
    setSearchOpen(prev => {
      if (prev) {
        onSearchChange('')
      } else {
        setTimeout(() => searchRef.current?.focus(), 0)
      }
      return !prev
    })
  }, [onSearchChange])

  useEffect(() => {
    if (!virtuosoRef.current) return
    virtuosoRef.current.scrollToIndex({ index: 0, behavior: 'instant' })
  }, [scrollKey])

  useEffect(() => {
    if (selectedId == null || !virtuosoRef.current) return
    const idx = sorted.findIndex(a => a.id === selectedId)
    if (idx >= 0) {
      virtuosoRef.current.scrollIntoView({ index: idx, behavior: 'instant', align: 'nearest' } as any)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  return (
    <div className="article-list-col">
      <div className="article-list-toolbar">
        {searchOpen && (
          <div className="article-search">
            <Search size={13} />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search articles..."
              onKeyDown={e => { if (e.key === 'Escape') toggleSearch() }}
            />
            <button className="toolbar-btn-icon" onClick={toggleSearch}><X size={13} /></button>
          </div>
        )}
        {!searchOpen && !filter && (
          <button
            className={`toolbar-btn ${unreadOnly ? 'active' : ''}`}
            onClick={toggleUnreadOnly}
            title={unreadOnly ? 'Show all' : 'Show unread only'}
          >
            {unreadOnly ? <><CircleDot size={13} /> Unread</> : <><Circle size={13} /> All</>}
          </button>
        )}
        <button
          className="toolbar-btn"
          onClick={() => onSortOrderChange(sortOrder === 'newest' ? 'oldest' : 'newest')}
          title={sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
        >
          <><ArrowUpDown size={13} /> {sortOrder === 'newest' ? 'Newest' : 'Oldest'}</>
        </button>
        {hasUnread && (
          <button className="toolbar-btn" onClick={onMarkAllRead} title="Mark all as read">
            <><Check size={13} /> All read</>
          </button>
        )}
        {!searchOpen && (
          <button className={`toolbar-btn ${searchQuery ? 'active' : ''}`} onClick={toggleSearch} title="Search articles">
            <Search size={13} />
          </button>
        )}
      </div>
      <div className="article-list">
        <Virtuoso
          ref={virtuosoRef}
          key={`${sortOrder}-${unreadOnly}`}
          data={sorted}
          itemContent={(_, article) => (
            <ArticleRow
              article={article}
              selected={article.id === selectedId}
              onClick={() => onSelect(article)}
            />
          )}
        />
      </div>
    </div>
  )
}
