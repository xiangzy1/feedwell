import Dialog from '../Dialog'
import { useStats } from '../../hooks/useStats'
import OverviewCards from './OverviewCards'
import MonthlyChart from './MonthlyChart'
import HealthTable from './HealthTable'

interface Props {
  open: boolean
  onClose: () => void
  onSelectFeed: (feedId: number) => void
}

export default function StatsDialog({ open, onClose, onSelectFeed }: Props) {
  const { monthly, health, overview } = useStats()

  return (
    <Dialog open={open} onClose={onClose} title="Subscription Statistics" width={860} className="stats-dialog" scrollable>
      <OverviewCards overview={overview} />
      <MonthlyChart data={monthly} />
      <HealthTable feeds={health} onSelectFeed={feedId => { onSelectFeed(feedId); onClose() }} />
    </Dialog>
  )
}
