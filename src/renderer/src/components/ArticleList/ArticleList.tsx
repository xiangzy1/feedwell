import { useState, useMemo, useRef, useEffect } from 'react'
import { Circle, CircleDot, ArrowUpDown, Check } from 'lucide-react'
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
}

export default function ArticleList({ sortedArticles, selectedId, onSelect, onMarkAllRead, filter, sortOrder, onSortOrderChange }: Props) {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const virtuosoRef = useRef<VirtuosoHandle>(null)

  const sorted = useMemo(() => {
    return unreadOnly ? sortedArticles.filter(a => !a.read) : sortedArticles
  }, [sortedArticles, unreadOnly])

  const hasUnread = sortedArticles.some(a => !a.read)

  useEffect(() => {
    if (selectedId == null || !virtuosoRef.current) return
    const idx = sorted.findIndex(a => a.id === selectedId)
    if (idx >= 0) {
      virtuosoRef.current.scrollIntoView({ index: idx, behavior: 'smooth', align: 'nearest' } as any)
    }
    // Only scroll on explicit selection, not when sorted list changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  return (
    <div className="article-list-col">
      <div className="article-list-toolbar">
        {!filter && (
          <button
            className={`toolbar-btn ${unreadOnly ? 'active' : ''}`}
            onClick={() => setUnreadOnly(v => !v)}
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
