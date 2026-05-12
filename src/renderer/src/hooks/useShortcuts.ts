import { useEffect } from 'react'
import { Article } from './useArticles'

interface Props {
  articles: Article[]
  selectedId: number | null
  onSelectArticle: (article: Article) => void
  onMarkRead: (id: number) => void
  onToggleStar: (id: number, starred: boolean) => void
  selectedArticle: Article | null
}

export function useShortcuts({ articles, selectedId, onSelectArticle, onMarkRead, onToggleStar, selectedArticle }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const currentIndex = articles.findIndex(a => a.id === selectedId)

      switch (e.key) {
        case 'j':
        case 'ArrowDown': {
          e.preventDefault()
          const next = currentIndex < articles.length - 1 ? currentIndex + 1 : currentIndex
          if (articles[next]) {
            onSelectArticle(articles[next])
            onMarkRead(articles[next].id)
          }
          break
        }
        case 'k':
        case 'ArrowUp': {
          e.preventDefault()
          const prev = currentIndex > 0 ? currentIndex - 1 : 0
          if (articles[prev]) onSelectArticle(articles[prev])
          break
        }
        case 'r': {
          e.preventDefault()
          if (selectedArticle && !selectedArticle.read) onMarkRead(selectedArticle.id)
          break
        }
        case 's': {
          e.preventDefault()
          if (selectedArticle) onToggleStar(selectedArticle.id, !selectedArticle.starred)
          break
        }
        case 'Enter': {
          e.preventDefault()
          if (selectedArticle?.url) window.api.openExternal(selectedArticle.url)
          break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [articles, selectedId, selectedArticle, onSelectArticle, onMarkRead, onToggleStar])
}
