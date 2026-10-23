import { isIP } from 'node:net'
import type { DemoBrief, PlanReference } from './demo-planner.ts'

export type ResearchTopic = 'environment' | 'consumer' | 'competitor' | 'channel'
export type ResearchQuery = { topic: ResearchTopic; query: string }
export type SearchResult = {
  title?: unknown
  url?: unknown
  summary?: unknown
  content?: unknown
  site_name?: unknown
  date?: unknown
}
export type ResearchSource = PlanReference & {
  id: string
  topic: ResearchTopic
  excerpt: string
}

function terms(value: string | undefined, limit: number) {
  return (value || '').replace(/[\r\n\t，。；：！？、]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, limit)
}

const exclusions = '-site:smzdm.com -site:taobao.com'
const topics: ResearchTopic[] = ['environment', 'consumer', 'competitor', 'channel']

function withExclusions(query: string) {
  const clean = query.replace(/\s+/gu, ' ').trim()
  return `${clean.slice(0, 127 - exclusions.length)} ${exclusions}`
}

export function buildResearchQueries(brief: DemoBrief): ResearchQuery[] {
  const product = terms(brief.product.split(/[，,。；;！!？?\n]/u)[0], 24)
  const market = terms(brief.marketContext?.split(/[，,。；;]/u)[0].split(/办公室|日常|场景|人群|用户/u)[0], 24)
  const audience = terms(brief.audience, 40)
  const competitors = terms(brief.competitors, 36)
  const channels = terms(brief.channels, 18)
  const years = `${new Date().getUTCFullYear() - 1} ${new Date().getUTCFullYear()}`
  const queries: ResearchQuery[] = [
    { topic: 'environment', query: `${market} ${product} 市场报告 行业趋势 统计 官方 ${years}` },
    { topic: 'consumer', query: `${market} ${product} ${audience} 消费者行为 调研报告 ${years}` },
    { topic: 'competitor', query: `${competitors || product} 品牌营销活动 具体案例 ${channels} ${years}` },
    { topic: 'channel', query: `${product} ${channels} 品牌营销活动 案例 官方 ${years}` },
  ]
  return queries.map(item => ({ ...item, query: withExclusions(item.query) }))
}

export function buildCompetitorCaseQuery(brief: DemoBrief): ResearchQuery {
  const product = terms(brief.product.split(/[，,。；;！!？?\n]/u)[0], 24)
  const market = terms(brief.marketContext?.split(/[，,。；;]/u)[0], 18)
  const years = `${new Date().getUTCFullYear() - 1} ${new Date().getUTCFullYear()}`
  return { topic: 'competitor', query: withExclusions(`${market} ${product} 同品类 替代品牌 创意营销活动 案例 联名 内容传播 ${years}`) }
}

export function normalizePlannedQueries(value: unknown, fallback: ResearchQuery[]): ResearchQuery[] {
  if (!Array.isArray(value)) return fallback
  const queries = topics.map(topic => {
    const found = value.find(item => item && typeof item === 'object' && item.topic === topic)
    const query = found && typeof found.query === 'string' ? found.query.replace(/-site:(?:smzdm\.com|taobao\.com)/gu, '').trim() : ''
    return query.length >= 4 ? { topic, query: withExclusions(query) } : null
  })
  return queries.every(Boolean) ? queries as ResearchQuery[] : fallback
}

export function publicWebUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    if (!url.hostname || url.hostname === 'localhost' || url.hostname.endsWith('.localhost')
      || isIP(url.hostname.replace(/^\[|\]$/gu, ''))) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

export function collectResearchSources(groups: Array<{ topic: ResearchTopic; results: SearchResult[] }>): ResearchSource[] {
  const sources: ResearchSource[] = []
  const seen = new Set<string>()
  const limits: Record<ResearchTopic, number> = { environment: 2, consumer: 2, competitor: 3, channel: 2 }
  for (const group of groups) {
    let added = 0
    for (const result of group.results) {
      if (added >= limits[group.topic]) break
      const url = publicWebUrl(result.url)
      const content = typeof result.content === 'string' ? result.content.trim() : ''
      if (!url || seen.has(url) || content.length < 100) continue
      if (/(?:^|\.)(?:smzdm\.com|taobao\.com|dealmoon\.cn|renrendoc\.com|book118\.com)$/u.test(new URL(url).hostname)) continue
      const title = typeof result.title === 'string' ? result.title.trim().slice(0, 180) : ''
      const summary = typeof result.summary === 'string' ? result.summary.trim().slice(0, 700) : ''
      if (!title) continue
      const siteName = typeof result.site_name === 'string' ? result.site_name.trim().slice(0, 80) : ''
      const publishedAt = typeof result.date === 'string' && !Number.isNaN(Date.parse(result.date))
        ? result.date.slice(0, 10) : ''
      seen.add(url)
      added += 1
      sources.push({
        id: `S${sources.length + 1}`,
        topic: group.topic,
        title,
        url,
        ...(siteName ? { siteName } : {}),
        ...(publishedAt ? { publishedAt } : {}),
        excerpt: `${summary}\n${content.slice(0, 2600)}`.trim(),
      })
    }
  }
  return sources
}

export function referencesForIds(ids: unknown, sources: ResearchSource[], limit = 3): PlanReference[] {
  if (!Array.isArray(ids)) return []
  const unique = new Set<string>()
  return ids.flatMap(item => {
    if (typeof item !== 'string' || unique.has(item)) return []
    unique.add(item)
    const source = sources.find(candidate => candidate.id === item)
    if (!source) return []
    return [{
      title: source.title,
      url: source.url,
      ...(source.siteName ? { siteName: source.siteName } : {}),
      ...(source.publishedAt ? { publishedAt: source.publishedAt } : {}),
    }]
  }).slice(0, Math.min(Math.max(limit, 0), 8))
}
