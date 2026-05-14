import { Overview } from '../../hooks/useStats'

interface Props {
  overview: Overview
}

export default function OverviewCards({ overview }: Props) {
  const cards = [
    { label: 'Total Feeds', value: overview.total_feeds },
    { label: 'Articles This Month', value: overview.articles_this_month },
    { label: 'Active Feeds', value: overview.active_feeds },
    { label: 'Failed Feeds', value: overview.failed_feeds }
  ]

  return (
    <div className="stats-section stats-overview-cards">
      {cards.map(card => (
        <div key={card.label} className="stats-card">
          <div className="stats-card-value">{card.value}</div>
          <div className="stats-card-label">{card.label}</div>
        </div>
      ))}
    </div>
  )
}
