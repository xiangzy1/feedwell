import { useState, useEffect } from 'react'
import Dialog from '../Dialog'

interface Props {
  open: boolean
  feedId: number
  currentFolderId: number | null
  onMove: (feedId: number, folderId: number | null) => void
  onClose: () => void
}

export default function MoveToFolderDialog({ open, feedId, currentFolderId, onMove, onClose }: Props) {
  const [folders, setFolders] = useState<{ id: number; name: string }[]>([])
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  useEffect(() => {
    if (open) window.api.folders.list().then(setFolders)
  }, [open])

  const handleSelect = async (folderId: number | null) => {
    onMove(feedId, folderId)
    onClose()
  }

  const handleCreateAndMove = async () => {
    if (!newFolderName.trim()) return
    const result = await window.api.folders.create(newFolderName.trim())
    onMove(feedId, result.id)
    onClose()
  }

  const handleKeyDown = (action: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); action() }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Move to Folder" width={280}>
      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
        <div
          role="button"
          tabIndex={0}
          className={`context-menu-item ${currentFolderId === null ? 'active' : ''}`}
          style={{ borderRadius: 4, margin: '2px 0' }}
          onClick={() => handleSelect(null)}
          onKeyDown={handleKeyDown(() => handleSelect(null))}
        >
          No folder
        </div>
        {folders.map(f => (
          <div
            key={f.id}
            role="button"
            tabIndex={0}
            className={`context-menu-item ${currentFolderId === f.id ? 'active' : ''}`}
            style={{ borderRadius: 4, margin: '2px 0' }}
            onClick={() => handleSelect(f.id)}
            onKeyDown={handleKeyDown(() => handleSelect(f.id))}
          >
            {f.name}
          </div>
        ))}
      </div>
      {!showNewFolder ? (
        <button
          className="btn-secondary"
          style={{ width: '100%', marginTop: 8 }}
          onClick={() => setShowNewFolder(true)}
        >
          New folder…
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input
            type="text"
            placeholder="Folder name"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateAndMove() }}
            autoFocus
            className="dialog-input"
            style={{ flex: 1 }}
          />
          <button
            className="btn-primary"
            onClick={handleCreateAndMove}
            disabled={!newFolderName.trim()}
          >
            Create
          </button>
        </div>
      )}
    </Dialog>
  )
}
