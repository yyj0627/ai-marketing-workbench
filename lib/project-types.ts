export type SavedProject = {
  id: string
  name: string
  type: string
  productDescription: string
  targetAudience: string
  goals: string[]
  sellingPoints: string[]
  timeline: string | null
  budgetRange: string | null
  channels: string[]
  tone: string | null
  status: string
  createdAt: string
  updatedAt: string
  latestPlan: {
    id: string
    versionNumber: number
    title: string
  } | null
}

export type ProjectDetail = SavedProject & {
  plans: Array<{
    id: string
    versionNumber: number
    title: string
    generationSummary: string | null
    status: string
    createdAt: string
    moduleCount: number
  }>
}

export type PlanHistoryItem = {
  id: string
  kind: 'plan' | 'module'
  projectId: string
  planId: string
  projectName: string
  versionLabel: string
  time: string
  note: string
  source: string
}

export type ProjectQueryResult<T> = {
  data: T
  error: string | null
}
