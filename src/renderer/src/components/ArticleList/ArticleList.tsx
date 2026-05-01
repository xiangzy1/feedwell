import { useState, useMemo, useRef, useEffect } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import ArticleRow from './ArticleRow'
import { Article } from '../../hooks/useArticles'
import '../../styles/article-list.css'

type SortOrder = 'newest' | 'oldest'

interface Props {
  articles: Article[]
  selectedId: number | null
  onSelect: (id: number) => void
  onMarkAllRead: () => void
  filter: string | null
}

export default function ArticleList({ articles, selectedId, onSelect, onMarkAllRead, filter }: Props) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const virtuosoRef = useRef<VirtuosoHandle>(null)

  const sorted = useMemo(() => {
    const filtered = unreadOnly ? articles.filter(a => !a.read) : articles
    return sortOrder === 'newest' ? filtered : filtered.reverse()
  }, [articles, unreadOnly, sortOrder])

  const hasUnread = articles.some(a => !a.read)

  useEffect(() => {
    if (selectedId == null || !virtuosoRef.current) return
    const idx = sorted.findIndex(a => a.id === selectedId)
    if (idx >= 0) {
      virtuosoRef.current.scrollIntoView({ index: idx, behavior: 'smooth', align: 'nearest' })
    }
  }, [selectedId, sorted])

  return (
    <div className="article-list-col">
      <div className="article-list-toolbar">
        {!filter && (
          <button
            className={`toolbar-btn ${unreadOnly ? 'active' : ''}`}
            onClick={() => setUnreadOnly(v => !v)}
            title={unreadOnly ? 'Show all' : 'Show unread only'}
          >
            {unreadOnly ? '◉ Unread' : '○ All'}
          </button>
        )}
        <button
          className="toolbar-btn"
          onClick={() => setSortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
          title={sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
        >
          {sortOrder === 'newest' ? '↕ Newest' : '↕ Oldest'}
        </button>
        {hasUnread && (
          <button className="toolbar-btn" onClick={onMarkAllRead} title="Mark all as read">
            ✓ All read
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
              onClick={() => onSelect(article.id)}
            />
          )}
        />
      </div>
    </div>
  )
}
