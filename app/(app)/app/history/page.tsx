import { Portal } from '../../../../components/Portal'
import { getPlanHistoryForCurrentUser } from '@/lib/supabase/project-data'

export default async function HistoryPage() {
  const result = await getPlanHistoryForCurrentUser()

  return <Portal view="history" data={{ history: result.data, loadError: result.error }} />
}
