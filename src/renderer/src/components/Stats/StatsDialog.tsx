import { X } from 'lucide-react'
import { useStats } from '../../hooks/useStats'
import OverviewCards from './OverviewCards'
import MonthlyChart from './MonthlyChart'
import HealthTable from './HealthTable'

interface Props {
  onClose: () => void
  onSelectFeed: (feedId: number) => void
}

export default function StatsDialog({ onClose, onSelectFeed }: Props) {
  const { monthly, health, overview } = useStats()

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="stats-dialog" onClick={e => e.stopPropagation()}>
        <div className="stats-dialog-header">
          <h3>Subscription Statistics</h3>
          <button className="stats-dialog-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="stats-dialog-body">
          <OverviewCards overview={overview} />
          <MonthlyChart data={monthly} />
          <HealthTable feeds={health} onSelectFeed={feedId => { onSelectFeed(feedId); onClose() }} />
        </div>
      </div>
    </div>
  )
}
