'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'

type ProjectDraftInput = {
  projectId?: string
  name: string
  type: string
  productDescription: string
  targetAudience: string
  goals: string[]
  sellingPoints: string[]
  timeline: string
  budgetRange: string
  channels: string[]
  tone: string
}

export type SaveProjectResult =
  | { ok: true; projectId: string; updatedAt: string }
  | { ok: false; error: string }

const projectTypes = new Set(['新品上市', '活动推广', '品牌传播', '渠道增长', '线下活动'])
const budgetRanges = new Set(['低预算', '中预算', '高预算', '待定'])
const tones = new Set(['专业', '年轻', '增长导向', '温暖', '高端'])

function normalizeList(values: string[]) {
  return values.map(value => value.trim()).filter(Boolean)
}

export async function saveProjectDraft(input: ProjectDraftInput): Promise<SaveProjectResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Supabase 尚未配置，无法保存项目。' }
  if (!input.name.trim()) return { ok: false, error: '请填写项目名称后再保存草稿。' }
  if (!projectTypes.has(input.type)) return { ok: false, error: '请选择有效的项目类型后再保存草稿。' }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { ok: false, error: '登录状态已失效，请重新登录后再保存。' }

  const payload = {
    name: input.name.trim(),
    type: input.type,
    product_description: input.productDescription.trim(),
    target_audience: input.targetAudience.trim(),
    goals: normalizeList(input.goals),
    selling_points: normalizeList(input.sellingPoints),
    timeline: input.timeline.trim() || null,
    budget_range: budgetRanges.has(input.budgetRange) ? input.budgetRange : null,
    channels: normalizeList(input.channels),
    tone: tones.has(input.tone) ? input.tone : null,
    status: '草稿',
  }

  const query = input.projectId
    ? supabase.from('projects').update(payload).eq('id', input.projectId).select('id, updated_at').maybeSingle()
    : supabase.from('projects').insert(payload).select('id, updated_at').single()
  const { data, error } = await query

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: '未找到可保存的项目，可能已被删除或你没有权限。' }

  revalidatePath('/app/projects')
  revalidatePath('/app/history')
  revalidatePath(`/app/projects/${data.id}`)

  return { ok: true, projectId: data.id, updatedAt: data.updated_at }
}
