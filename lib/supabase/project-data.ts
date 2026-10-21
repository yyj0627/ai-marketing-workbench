import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import type { PlanHistoryItem, ProjectDetail, ProjectQueryResult, SavedProject } from '@/lib/project-types'

type ProjectRow = {
  id: string
  name: string
  type: string
  product_description: string
  target_audience: string
  goals: string[] | null
  selling_points: string[] | null
  timeline: string | null
  budget_range: string | null
  channels: string[] | null
  tone: string | null
  status: string
  created_at: string
  updated_at: string
}

type PlanRow = {
  id: string
  project_id: string
  version_number: number
  title: string
  generation_summary: string | null
  status: string
  created_at: string
}

function asSavedProject(project: ProjectRow, plan: PlanRow | undefined): SavedProject {
  return {
    id: project.id,
    name: project.name,
    type: project.type,
    productDescription: project.product_description,
    targetAudience: project.target_audience,
    goals: project.goals ?? [],
    sellingPoints: project.selling_points ?? [],
    timeline: project.timeline,
    budgetRange: project.budget_range,
    channels: project.channels ?? [],
    tone: project.tone,
    status: project.status,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    latestPlan: plan ? { id: plan.id, versionNumber: plan.version_number, title: plan.title } : null,
  }
}

async function getAuthenticatedClient() {
  if (!isSupabaseConfigured()) {
    return { supabase: null, userId: null, error: 'Supabase 尚未配置。' }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { supabase: null, userId: null, error: '登录状态已失效，请重新登录。' }
  }

  return { supabase, userId: user.id, error: null }
}

export async function getProjectsForCurrentUser(): Promise<ProjectQueryResult<SavedProject[]>> {
  const session = await getAuthenticatedClient()
  if (!session.supabase || !session.userId) return { data: [], error: session.error }

  const { data: projectRows, error: projectError } = await session.supabase
    .from('projects')
    .select('id, name, type, product_description, target_audience, goals, selling_points, timeline, budget_range, channels, tone, status, created_at, updated_at')
    .eq('user_id', session.userId)
    .order('updated_at', { ascending: false })

  if (projectError) return { data: [], error: projectError.message }

  const { data: planRows, error: planError } = await session.supabase
    .from('plans')
    .select('id, project_id, version_number, title, generation_summary, status, created_at')
    .eq('user_id', session.userId)
    .order('version_number', { ascending: false })

  if (planError) return { data: [], error: planError.message }

  const latestPlanByProject = new Map<string, PlanRow>()
  for (const plan of (planRows ?? []) as PlanRow[]) {
    if (!latestPlanByProject.has(plan.project_id)) latestPlanByProject.set(plan.project_id, plan)
  }

  return {
    data: ((projectRows ?? []) as ProjectRow[]).map(project =>
      asSavedProject(project, latestPlanByProject.get(project.id)),
    ),
    error: null,
  }
}

export async function getProjectDetailForCurrentUser(projectId: string): Promise<ProjectQueryResult<ProjectDetail | null>> {
  const session = await getAuthenticatedClient()
  if (!session.supabase || !session.userId) return { data: null, error: session.error }

  const { data: projectRow, error: projectError } = await session.supabase
    .from('projects')
    .select('id, name, type, product_description, target_audience, goals, selling_points, timeline, budget_range, channels, tone, status, created_at, updated_at')
    .eq('id', projectId)
    .eq('user_id', session.userId)
    .maybeSingle()

  if (projectError) return { data: null, error: projectError.message }
  if (!projectRow) return { data: null, error: null }

  const { data: planRows, error: planError } = await session.supabase
    .from('plans')
    .select('id, project_id, version_number, title, generation_summary, status, created_at')
    .eq('project_id', projectId)
    .eq('user_id', session.userId)
    .order('version_number', { ascending: false })

  if (planError) return { data: null, error: planError.message }

  const planIds = (planRows ?? []).map(plan => plan.id)
  let moduleCounts = new Map<string, number>()

  if (planIds.length) {
    const { data: modules, error: moduleError } = await session.supabase
      .from('plan_modules')
      .select('plan_id')
      .eq('user_id', session.userId)
      .in('plan_id', planIds)

    if (moduleError) return { data: null, error: moduleError.message }
    moduleCounts = (modules ?? []).reduce((counts, module) => {
      counts.set(module.plan_id, (counts.get(module.plan_id) ?? 0) + 1)
      return counts
    }, new Map<string, number>())
  }

  const plans = (planRows ?? []) as PlanRow[]
  const latestPlan = plans[0]
  const project = asSavedProject(projectRow as ProjectRow, latestPlan)

  return {
    data: {
      ...project,
      plans: plans.map(plan => ({
        id: plan.id,
        versionNumber: plan.version_number,
        title: plan.title,
        generationSummary: plan.generation_summary,
        status: plan.status,
        createdAt: plan.created_at,
        moduleCount: moduleCounts.get(plan.id) ?? 0,
      })),
    },
    error: null,
  }
}

export async function getPlanHistoryForCurrentUser(): Promise<ProjectQueryResult<PlanHistoryItem[]>> {
  const session = await getAuthenticatedClient()
  if (!session.supabase || !session.userId) return { data: [], error: session.error }

  const [{ data: projectRows, error: projectError }, { data: planRows, error: planError }, { data: moduleRows, error: moduleError }, { data: versionRows, error: versionError }] = await Promise.all([
    session.supabase.from('projects').select('id, name').eq('user_id', session.userId),
    session.supabase.from('plans').select('id, project_id, version_number, title, generation_summary, created_at').eq('user_id', session.userId),
    session.supabase.from('plan_modules').select('id, plan_id, title').eq('user_id', session.userId),
    session.supabase.from('plan_module_versions').select('id, module_id, change_note, source, created_at').eq('user_id', session.userId),
  ])

  const error = projectError ?? planError ?? moduleError ?? versionError
  if (error) return { data: [], error: error.message }

  const projectsById = new Map((projectRows ?? []).map(project => [project.id, project.name]))
  const plansById = new Map((planRows ?? []).map(plan => [plan.id, plan]))
  const modulesById = new Map((moduleRows ?? []).map(module => [module.id, module]))

  const planHistory: PlanHistoryItem[] = (planRows ?? []).map(plan => ({
    id: `plan-${plan.id}`,
    kind: 'plan',
    projectId: plan.project_id,
    planId: plan.id,
    projectName: projectsById.get(plan.project_id) ?? '已删除项目',
    versionLabel: `V${plan.version_number} ${plan.title}`,
    time: plan.created_at,
    note: plan.generation_summary || '已创建方案版本，等待继续编辑或生成模块。',
    source: '创建方案版本',
  }))

  const moduleHistory: PlanHistoryItem[] = (versionRows ?? []).flatMap(version => {
    const module = modulesById.get(version.module_id)
    if (!module) return []
    const plan = plansById.get(module.plan_id)
    if (!plan) return []

    return [{
      id: `module-${version.id}`,
      kind: 'module' as const,
      projectId: plan.project_id,
      planId: plan.id,
      projectName: projectsById.get(plan.project_id) ?? '已删除项目',
      versionLabel: `V${plan.version_number} ${module.title}`,
      time: version.created_at,
      note: version.change_note || `${module.title} 已保存一条历史版本。`,
      source: version.source,
    }]
  })

  return {
    data: [...planHistory, ...moduleHistory].sort(
      (left, right) => new Date(right.time).getTime() - new Date(left.time).getTime(),
    ),
    error: null,
  }
}
