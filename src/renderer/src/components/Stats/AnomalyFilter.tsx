import { useState, useMemo } from 'react'
import { FeedHealth } from '../../hooks/useStats'

interface Props {
  feeds: FeedHealth[]
}

const LABELS: Record<string, string> = { all: 'All', failed: 'Failed (>3x)', inactive: 'Inactive (30d)' }

export default function AnomalyFilter({ feeds }: Props) {
  const [filter, setFilter] = useState<'all' | 'failed' | 'inactive'>('all')

  const counts = useMemo(() => {
    const c = { failed: 0, inactive: 0 }
    for (const f of feeds) {
      if (f.health_status === 'failed') c.failed++
      else if (f.health_status === 'inactive') c.inactive++
    }
    return c
  }, [feeds])

  const filtered = filter === 'all' ? feeds : feeds.filter(f => f.health_status === filter)

  return (
    <div className="stats-section">
      <div className="stats-filter-tabs">
        {(['all', 'failed', 'inactive'] as const).map(f => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {LABELS[f]}
            {f !== 'all' && <span className="stats-filter-count">{counts[f]}</span>}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="stats-empty">No feeds match this filter</div>
      ) : (
        <ul className="stats-filter-list">
          {filtered.map(f => (
            <li key={f.id} className="stats-filter-item">
              <span className="stats-filter-title">{f.title}</span>
              {f.last_error && <span className="stats-filter-error">{f.last_error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
