import { Article } from '../../hooks/useArticles'

interface Props {
  article: Article
}

export default function ArticleHeader({ article }: Props) {
  return (
    <div className="article-header">
      <h1 className="article-title">{article.title}</h1>
      <div className="article-meta">
        <span className="article-meta-feed">{article.feed_title}</span>
        {article.author && <span>by {article.author}</span>}
        <span className="article-meta-time">
          {article.published_at ? new Date(article.published_at).toLocaleString() : ''}
        </span>
      </div>
    </div>
  )
}
