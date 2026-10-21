import { Portal } from '../../../../../components/Portal'
import { getProjectDetailForCurrentUser } from '@/lib/supabase/project-data'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const result = await getProjectDetailForCurrentUser(projectId)

  return <Portal view="project" data={{ project: result.data, loadError: result.error }} />
}
