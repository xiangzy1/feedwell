import { Star, ExternalLink, Circle } from 'lucide-react'
import { Article } from '../../hooks/useArticles'

interface Props {
  article: Article | null
  onToggleRead: () => void
  onToggleStar: () => void
  onOpenExternal: () => void
}

export default function ArticleViewTitlebar({ article, onToggleRead, onToggleStar, onOpenExternal }: Props) {
  return (
    <div className="article-view-titlebar">
      <div className="article-view-titlebar-actions">
        <button className="titlebar-btn-read" onClick={onToggleRead} title={article?.read ? 'Mark as unread' : 'Mark as read'} disabled={!article}>
          <Circle size={14} fill={article?.read ? 'none' : 'currentColor'} />
        </button>
        <button onClick={onToggleStar} title="Toggle star" disabled={!article}>
          <Star size={14} fill={article?.starred ? 'currentColor' : 'none'} />
        </button>
        <button onClick={onOpenExternal} title="Open in browser" disabled={!article}>
          <ExternalLink size={14} />
        </button>
      </div>
    </div>
  )
}
