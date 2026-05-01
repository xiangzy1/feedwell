import { useState } from 'react'

interface Props {
  onAdd: (url: string) => void
  onClose: () => void
}

export default function AddFeedDialog({ onAdd, onClose }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError('')
    try {
      await onAdd(url.trim())
    } catch (err: any) {
      setError(err.message || 'Failed to add feed')
      setLoading(false)
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>Add Feed</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="url"
            placeholder="Enter website or feed URL"
            value={url}
            onChange={e => setUrl(e.target.value)}
            autoFocus
            className="dialog-input"
          />
          {error && <div className="dialog-error">{error}</div>}
          <div className="dialog-actions">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading || !url.trim()} className="btn-primary">
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
