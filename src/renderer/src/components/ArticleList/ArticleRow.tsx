import { Article } from '../../hooks/useArticles'

interface Props {
  article: Article
  selected: boolean
  onClick: () => void
}

export default function ArticleRow({ article, selected, onClick }: Props) {
  const timeStr = article.published_at
    ? formatTime(new Date(article.published_at))
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

function formatTime(date: Date): string {
  const now = new Date()
  const isToday = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  if (isToday) {
    return date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString('en', sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' })
}
