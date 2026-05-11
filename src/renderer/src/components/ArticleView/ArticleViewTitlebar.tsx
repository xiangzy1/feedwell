import { Star, Circle, Compass, Languages } from 'lucide-react'
import { Article } from '../../hooks/useArticles'

interface Props {
  article: Article | null
  onToggleRead: () => void
  onToggleStar: () => void
  onOpenExternal: () => void
  translationEnabled?: boolean
  onToggleTranslation?: () => void
  isWebview?: boolean
}

export default function ArticleViewTitlebar({ article, onToggleRead, onToggleStar, onOpenExternal, translationEnabled, onToggleTranslation, isWebview }: Props) {
  return (
    <div className="article-view-titlebar">
      <div className="article-view-titlebar-actions">
        <button className="titlebar-btn-read" onClick={onToggleRead} title={article?.read ? 'Mark as unread' : 'Mark as read'} disabled={!article}>
          <Circle size={13} fill={article?.read ? 'none' : 'currentColor'} />
        </button>
        <button onClick={onToggleStar} title="Toggle star" disabled={!article}>
          <Star size={14} fill={article?.starred ? 'currentColor' : 'none'} />
        </button>
        {onToggleTranslation && (
          <button
            onClick={onToggleTranslation}
            title={translationEnabled ? 'Hide translation' : 'Translate article'}
            disabled={!article}
            className={translationEnabled ? 'titlebar-btn-active' : undefined}
          >
            <Languages size={14} />
          </button>
        )}
        <button onClick={onOpenExternal} title="Open in browser" disabled={!article}>
          <Compass size={14} />
        </button>
      </div>
    </div>
  )
}
