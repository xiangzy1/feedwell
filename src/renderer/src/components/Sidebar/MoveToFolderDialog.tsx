import { useState, useEffect } from 'react'

interface Props {
  feedId: number
  currentFolderId: number | null
  onMove: (feedId: number, folderId: number | null) => void
  onClose: () => void
}

export default function MoveToFolderDialog({ feedId, currentFolderId, onMove, onClose }: Props) {
  const [folders, setFolders] = useState<{ id: number; name: string }[]>([])
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  useEffect(() => {
    window.api.folders.list().then(setFolders)
  }, [])

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

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()} style={{ width: 280 }}>
        <h3>Move to Folder</h3>
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          <div
            className={`context-menu-item ${currentFolderId === null ? 'active' : ''}`}
            style={{ borderRadius: 4, margin: '2px 0' }}
            onClick={() => handleSelect(null)}
          >
            No folder
          </div>
          {folders.map(f => (
            <div
              key={f.id}
              className={`context-menu-item ${currentFolderId === f.id ? 'active' : ''}`}
              style={{ borderRadius: 4, margin: '2px 0' }}
              onClick={() => handleSelect(f.id)}
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
            New folder...
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
      </div>
    </div>
  )
}
