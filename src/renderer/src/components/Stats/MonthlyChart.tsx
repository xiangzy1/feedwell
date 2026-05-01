import { MonthlyData } from '../../hooks/useStats'

interface Props {
  data: MonthlyData[]
}

export default function MonthlyChart({ data }: Props) {
  const maxArticles = Math.max(...data.map(d => d.articles_count), 1)

  return (
    <div className="stats-section">
      <h4>Monthly Articles</h4>
      <div className="stats-chart-bars">
        {data.map(d => (
          <div key={d.month} className="stats-chart-group">
            <div className="stats-chart-bar" style={{ height: `${(d.articles_count / maxArticles) * 100}%` }} />
            <div className="stats-chart-label">{d.month.slice(5)}</div>
            <div className="stats-chart-value">{d.articles_count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
