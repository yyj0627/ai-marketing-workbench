import { Portal } from '../../../../components/Portal'
import { getProjectsForCurrentUser } from '@/lib/supabase/project-data'

export default async function ProjectsPage() {
  const result = await getProjectsForCurrentUser()

  return <Portal view="projects" data={{ projects: result.data, loadError: result.error }} />
}
