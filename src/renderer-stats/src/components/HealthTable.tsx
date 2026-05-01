import { FeedHealth } from '../hooks/useStats'

interface Props {
  feeds: FeedHealth[]
}

export default function HealthTable({ feeds }: Props) {
  return (
    <div className="health-table">
      <h3>Feed Health</h3>
      <table>
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
          {feeds.map(feed => (
            <tr key={feed.id} className={`status-${feed.health_status}`}>
              <td>{feed.title}</td>
              <td>{feed.total_fetches > 0 ? Math.round(feed.success_count / feed.total_fetches * 100) : 0}%</td>
              <td>{Math.round(feed.avg_response_time || 0)}ms</td>
              <td>{feed.articles_last_30_days}</td>
              <td><span className={`badge badge-${feed.health_status}`}>{feed.health_status}</span></td>
              <td className="error-msg">{feed.last_error || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
