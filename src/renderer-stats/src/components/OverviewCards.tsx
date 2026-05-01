import { Overview } from '../hooks/useStats'

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
    <div className="overview-cards">
      {cards.map(card => (
        <div key={card.label} className="overview-card">
          <div className="overview-card-value">{card.value}</div>
          <div className="overview-card-label">{card.label}</div>
        </div>
      ))}
    </div>
  )
}
