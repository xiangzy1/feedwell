import { useState, useEffect } from 'react'

interface Props {
  onAdd: (url: string, folderId?: number) => void
  onClose: () => void
}

export default function AddFeedDialog({ onAdd, onClose }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [folders, setFolders] = useState<{ id: number; name: string }[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  useEffect(() => {
    window.api.folders.list().then(setFolders)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    let folderId = selectedFolderId

    if (showNewFolder && newFolderName.trim()) {
      const result = await window.api.folders.create(newFolderName.trim())
      folderId = result.id
    }

    setLoading(true)
    setError('')
    try {
      await onAdd(url.trim(), folderId || undefined)
    } catch (err: any) {
      setError(err.message || 'Failed to add feed')
      setLoading(false)
    }
  }

  const handleFolderChange = (value: string) => {
    if (value === '__new__') {
      setShowNewFolder(true)
      setSelectedFolderId(null)
    } else if (value === '') {
      setShowNewFolder(false)
      setSelectedFolderId(null)
    } else {
      setShowNewFolder(false)
      setSelectedFolderId(Number(value))
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
          <div style={{ marginTop: 10 }}>
            <select
              className="dialog-input"
              value={showNewFolder ? '__new__' : (selectedFolderId ?? '')}
              onChange={e => handleFolderChange(e.target.value)}
            >
              <option value="">No folder</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
              <option value="__new__">New folder...</option>
            </select>
          </div>
          {showNewFolder && (
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              className="dialog-input"
              style={{ marginTop: 8 }}
            />
          )}
          {error && <div className="dialog-error">{error}</div>}
          <div className="dialog-actions">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading || !url.trim() || (showNewFolder && !newFolderName.trim())} className="btn-primary">
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
