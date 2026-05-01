import { useThemeProvider } from './hooks/useTheme'
import { useStats } from './hooks/useStats'
import OverviewCards from './components/OverviewCards'
import MonthlyChart from './components/MonthlyChart'
import HealthTable from './components/HealthTable'
import AnomalyFilter from './components/AnomalyFilter'

export default function App() {
  useThemeProvider()
  const { monthly, health, overview } = useStats()

  return (
    <div className="stats-app">
      <h2>Subscription Statistics</h2>
      <OverviewCards overview={overview} />
      <MonthlyChart data={monthly} />
      <HealthTable feeds={health} />
      <AnomalyFilter feeds={health} />
    </div>
  )
}
