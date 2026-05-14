import { useReducer, useEffect } from 'react'
import Dialog from '../Dialog'

interface Props {
  open: boolean
  onAdd: (url: string, folderId?: number) => void
  onClose: () => void
}

type State = {
  url: string
  loading: boolean
  error: string
  folders: { id: number; name: string }[]
  selectedFolderId: number | null
  showNewFolder: boolean
  newFolderName: string
}

export default function AddFeedDialog({ open, onAdd, onClose }: Props) {
  const [state, setState] = useReducer(
    (prev: State, next: Partial<State>) => ({ ...prev, ...next }),
    { url: '', loading: false, error: '', folders: [], selectedFolderId: null, showNewFolder: false, newFolderName: '' }
  )

  useEffect(() => {
    if (open) window.api.folders.list().then(folders => setState({ folders }))
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.url.trim()) return

    let folderId = state.selectedFolderId

    if (state.showNewFolder && state.newFolderName.trim()) {
      const result = await window.api.folders.create(state.newFolderName.trim())
      folderId = result.id
    }

    setState({ loading: true, error: '' })
    try {
      await onAdd(state.url.trim(), folderId || undefined)
    } catch (err: any) {
      setState({ error: err.message || 'Failed to add feed', loading: false })
    }
  }

  const handleFolderChange = (value: string) => {
    if (value === '__new__') {
      setState({ showNewFolder: true, selectedFolderId: null })
    } else if (value === '') {
      setState({ showNewFolder: false, selectedFolderId: null })
    } else {
      setState({ showNewFolder: false, selectedFolderId: Number(value) })
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add Feed">
      <form onSubmit={handleSubmit} style={{padding: '0px 20px 12px'}}>
        <input
          type="url"
          placeholder="Enter website or feed URL"
          value={state.url}
          onChange={e => setState({ url: e.target.value })}
          className="dialog-input"
        />
        <div style={{ marginTop: 10 }}>
          <select
            className="dialog-input"
            value={state.showNewFolder ? '__new__' : (state.selectedFolderId ?? '')}
            onChange={e => handleFolderChange(e.target.value)}
          >
            <option value="">No folder</option>
            {state.folders.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
            <option value="__new__">New folder…</option>
          </select>
        </div>
        {state.showNewFolder && (
          <input
            type="text"
            placeholder="Folder name"
            value={state.newFolderName}
            onChange={e => setState({ newFolderName: e.target.value })}
            className="dialog-input"
            style={{ marginTop: 8 }}
          />
        )}
        {state.error && <div className="dialog-error">{state.error}</div>}
        <div className="dialog-actions">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={state.loading || !state.url.trim() || (state.showNewFolder && !state.newFolderName.trim())} className="btn-primary">
            {state.loading ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
