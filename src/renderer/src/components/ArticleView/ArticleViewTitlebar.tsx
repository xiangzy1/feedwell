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
      <div className="article-view-titlebar-spacer" />
      <div className="article-view-titlebar-actions">
        <button className="titlebar-btn-read" onClick={onToggleRead} title={article?.read ? 'Mark as unread' : 'Mark as read'} disabled={!article}>
          <span className={`titlebar-read-dot${article?.read ? ' read' : ''}`} />
        </button>
        <button onClick={onToggleStar} title="Toggle star" disabled={!article}>
          {article?.starred ? '★' : '☆'}
        </button>
        <button onClick={onOpenExternal} title="Open in browser" disabled={!article}>
          ↗
        </button>
      </div>
    </div>
  )
}
