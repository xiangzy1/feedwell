import { useState } from 'react'
import { FeedHealth } from '../../hooks/useStats'

interface Props {
  feeds: FeedHealth[]
  onSelectFeed: (feedId: number) => void
}

export default function HealthTable({ feeds, onSelectFeed }: Props) {
  const [showFailedOnly, setShowFailedOnly] = useState(false)
  const displayed = showFailedOnly ? feeds.filter(f => f.health_status === 'failed') : feeds

  return (
    <div className="stats-section">
      <div className="stats-section-header">
        <h4>Feed Health</h4>
        <button
          className={`stats-toggle-btn ${showFailedOnly ? 'active' : ''}`}
          onClick={() => setShowFailedOnly(!showFailedOnly)}
        >
          Failed Only
        </button>
      </div>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Feed</th>
            <th>Success Rate</th>
            <th>Avg Response</th>
            <th>Articles (30d)</th>
            <th>Status</th>
            <th>Last Error</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map(feed => (
            <tr key={feed.id} className="stats-table-row-clickable" onClick={() => onSelectFeed(feed.id)}>
              <td>{feed.title}</td>
              <td>{feed.total_fetches > 0 ? Math.round(feed.success_count / feed.total_fetches * 100) : 0}%</td>
              <td>{Math.round(feed.avg_response_time || 0)}ms</td>
              <td>{feed.articles_last_30_days}</td>
              <td><span className={`stats-badge stats-badge-${feed.health_status}`}>{feed.health_status}</span></td>
              <td className="stats-error-msg">{feed.last_error || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
