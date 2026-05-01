import { Article } from '../../hooks/useArticles'

interface Props {
  article: Article
  selected: boolean
  onClick: () => void
}

export default function ArticleRow({ article, selected, onClick }: Props) {
  const timeStr = article.published_at
    ? formatRelativeTime(new Date(article.published_at))
    : ''

  return (
    <div
      className={`article-row ${selected ? 'selected' : ''} ${article.read ? 'read' : 'unread'}`}
      onClick={onClick}
    >
      <div className="article-row-title">
        <span className={`unread-dot${article.read ? ' read' : ''}`} />
        <span className="article-row-title-text">{article.title}</span>
      </div>
      <div className="article-row-meta">
        <span className="article-row-feed">{article.feed_title}</span>
        <span className="article-row-time">{timeStr}</span>
      </div>
    </div>
  )
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d`
  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString('en', sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' })
}
