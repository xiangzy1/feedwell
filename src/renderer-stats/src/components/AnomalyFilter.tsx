import { useState } from 'react'
import { FeedHealth } from '../hooks/useStats'

interface Props {
  feeds: FeedHealth[]
}

export default function AnomalyFilter({ feeds }: Props) {
  const [filter, setFilter] = useState<'all' | 'failed' | 'inactive'>('all')

  const filtered = filter === 'all' ? feeds : feeds.filter(f => f.health_status === filter)

  return (
    <div className="anomaly-filter">
      <div className="filter-tabs">
        {(['all', 'failed', 'inactive'] as const).map(f => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'failed' ? 'Failed (>3x)' : 'Inactive (30d)'}
            {f !== 'all' && <span className="filter-count">{feeds.filter(x => x.health_status === f).length}</span>}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="filter-empty">No feeds match this filter</div>
      ) : (
        <ul className="filter-list">
          {filtered.map(f => (
            <li key={f.id} className={`filter-item status-${f.health_status}`}>
              <span className="filter-item-title">{f.title}</span>
              {f.last_error && <span className="filter-item-error">{f.last_error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
