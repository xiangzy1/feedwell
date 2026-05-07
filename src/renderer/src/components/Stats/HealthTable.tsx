import { useState, useMemo } from 'react'
import { FeedHealth } from '../../hooks/useStats'

type SortKey = 'success_rate' | 'avg_response_time' | 'articles_last_30_days'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'healthy' | 'failed' | 'inactive'

interface Props {
  feeds: FeedHealth[]
  onSelectFeed: (feedId: number) => void
}

function getSuccessRate(feed: FeedHealth): number {
  return feed.total_fetches > 0 ? feed.success_count / feed.total_fetches : 0
}

function getSortValue(feed: FeedHealth, key: SortKey): number {
  switch (key) {
    case 'success_rate':
      return getSuccessRate(feed)
    case 'avg_response_time':
      return feed.avg_response_time || 0
    case 'articles_last_30_days':
      return feed.articles_last_30_days
  }
}

const SortArrow = ({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) => (
  <span className={`stats-sort-arrow ${sortKey === col ? 'active' : ''}`}>
    {sortKey === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ▽'}
  </span>
)

export default function HealthTable({ feeds, onSelectFeed }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const displayed = useMemo(() => {
    let list = statusFilter === 'all' ? feeds : feeds.filter(f => f.health_status === statusFilter)
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const va = getSortValue(a, sortKey)
        const vb = getSortValue(b, sortKey)
        return sortDir === 'asc' ? va - vb : vb - va
      })
    }
    return list
  }, [feeds, statusFilter, sortKey, sortDir])

  return (
    <div className="stats-section">
      <div className="stats-section-header">
        <h4>Feed Health</h4>
        <select
          className="stats-status-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">All</option>
          <option value="healthy">Healthy</option>
          <option value="failed">Failed</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Feed</th>
            <th className="stats-sortable" onClick={() => handleSort('success_rate')}>Success Rate<SortArrow col="success_rate" sortKey={sortKey} sortDir={sortDir} /></th>
            <th className="stats-sortable" onClick={() => handleSort('avg_response_time')}>Avg Response<SortArrow col="avg_response_time" sortKey={sortKey} sortDir={sortDir} /></th>
            <th className="stats-sortable" onClick={() => handleSort('articles_last_30_days')}>Articles (30d)<SortArrow col="articles_last_30_days" sortKey={sortKey} sortDir={sortDir} /></th>
            <th>Status</th>
            <th>Last Error</th>
          </tr>
        </thead>
        <tbody>
          {displayed.length > 0 ? displayed.map(feed => (
            <tr key={feed.id} className="stats-table-row-clickable" onClick={() => onSelectFeed(feed.id)}>
              <td>{feed.title}</td>
              <td>{Math.round(getSuccessRate(feed) * 100)}%</td>
              <td>{Math.round(feed.avg_response_time || 0)}ms</td>
              <td>{feed.articles_last_30_days}</td>
              <td><span className={`stats-badge stats-badge-${feed.health_status}`}>{feed.health_status}</span></td>
              <td className="stats-error-msg">{feed.health_status === 'failed' ? (feed.last_error || '-') : ''}</td>
            </tr>
          )) : (
            <tr><td colSpan={6} className="stats-table-empty">No feeds found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
