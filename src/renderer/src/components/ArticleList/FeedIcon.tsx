import { useRef, useState, memo } from 'react'

interface Props {
  url: string | null | undefined
  cachedName?: string | null
  feedId?: number
  title: string
  className?: string
}

function FeedIcon({ url, cachedName, feedId, title, className }: Props) {
  const imgError = useRef(false)
  const [, forceUpdate] = useState(0)

  const iconSrc = cachedName ? `feedicon://${cachedName}` : url
  const letter = (title || '?')[0].toUpperCase()
  const hue = hashString(title || '') % 360
  const bgColor = `hsl(${hue}, 55%, 55%)`
  const cls = ['feed-icon', className].filter(Boolean).join(' ')

  if (iconSrc && !imgError.current) {
    return (
      <img
        className={cls}
        src={iconSrc}
        alt=""
        onError={() => {
          imgError.current = true
          forceUpdate(n => n + 1)
          if (cachedName && feedId != null) {
            window.api.feeds.clearFaviconCache(feedId)
          }
        }}
      />
    )
  }

  return (
    <div
      className={`${cls} feed-icon-placeholder`}
      style={{ backgroundColor: bgColor }}
    >
      {letter}
    </div>
  )
}

export default memo(FeedIcon)

function hashString(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}
