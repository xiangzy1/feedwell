import { MonthlyData } from '../hooks/useStats'

interface Props {
  data: MonthlyData[]
}

export default function MonthlyChart({ data }: Props) {
  const maxArticles = Math.max(...data.map(d => d.articles_count), 1)

  return (
    <div className="monthly-chart">
      <h3>Monthly Articles</h3>
      <div className="chart-bars">
        {data.map(d => (
          <div key={d.month} className="chart-bar-group">
            <div className="chart-bar" style={{ height: `${(d.articles_count / maxArticles) * 100}%` }} />
            <div className="chart-bar-label">{d.month.slice(5)}</div>
            <div className="chart-bar-value">{d.articles_count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
