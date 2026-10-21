import { Portal } from '../../../../../components/Portal'
import { getProjectDetailForCurrentUser } from '@/lib/supabase/project-data'

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>
}) {
  const { projectId } = await searchParams
  const result = projectId ? await getProjectDetailForCurrentUser(projectId) : { data: null, error: null }

  return <Portal view="new-project" data={{ initialProject: result.data, loadError: result.error }} />
}
