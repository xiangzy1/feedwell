import { useState } from 'react'

interface Props {
  url: string | null | undefined
  title: string
}

export default function FeedIcon({ url, title }: Props) {
  const [imgError, setImgError] = useState(false)

  const letter = (title || '?')[0].toUpperCase()
  const hue = hashString(title || '') % 360
  const bgColor = `hsl(${hue}, 55%, 55%)`

  if (url && !imgError) {
    return (
      <img
        className="feed-icon"
        src={url}
        alt=""
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div
      className="feed-icon feed-icon-placeholder"
      style={{ backgroundColor: bgColor }}
    >
      {letter}
    </div>
  )
}

function hashString(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}
