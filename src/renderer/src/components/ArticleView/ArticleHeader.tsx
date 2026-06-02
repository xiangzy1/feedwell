import { Article } from '../../hooks/useArticles'
import PodcastPlayer from './PodcastPlayer'

interface Props {
  article: Article
}

function isAudioEnclosure(article: Article | null): string | null {
  if (!article?.enclosure_url) return null
  const type = article.enclosure_type || ''
  // Accept audio types, or if no type is specified but URL looks like audio
  if (type.startsWith('audio/')) return article.enclosure_url
  if (!type && /\.(mp3|m4a|ogg|opus|wav|aac|flac)(\?|$)/i.test(article.enclosure_url)) return article.enclosure_url
  return null
}

export default function ArticleHeader({ article }: Props) {
  const audioUrl = isAudioEnclosure(article)

  return (
    <div className="article-header">
      <h1 className="article-title">{article.title}</h1>
      <div className="article-meta">
        <div className="article-meta-left">
          <span className="article-meta-feed">{article.feed_title}</span>
          {article.author && <span>by {article.author}</span>}
          <span className="article-meta-time">
            {article.published_at ? new Date(article.published_at).toLocaleString() : ''}
          </span>
        </div>
        {audioUrl && <PodcastPlayer url={audioUrl} />}
      </div>
    </div>
  )
}

