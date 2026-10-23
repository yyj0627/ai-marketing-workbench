import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCompetitorCaseQuery, buildResearchQueries, collectResearchSources, normalizePlannedQueries, referencesForIds } from './plan-research.ts'

const brief = {
  projectName: '午后咖啡',
  product: '低糖冷萃咖啡',
  audience: '办公室人群',
  goal: '获得购买意向',
  budget: '5000 元',
  channels: '小红书、社群',
  knownFacts: '',
  evidenceSources: '',
  marketContext: '中国一二线城市',
  competitors: '瑞幸咖啡、库迪咖啡',
}

test('research searches cover competitors and keep each query within the API limit', () => {
  const queries = buildResearchQueries(brief)
  assert.equal(queries.length, 4)
  assert.ok(queries.some(item => item.topic === 'competitor' && item.query.includes('瑞幸咖啡')))
  assert.ok(queries.every(item => item.query.includes('-site:smzdm.com')))
  assert.ok(queries.find(item => item.topic === 'competitor').query.includes('营销活动'))
  assert.ok(queries.every(item => item.query.length <= 128 && item.query.trim()))
})

test('a second competitor search covers distinct campaign cases', () => {
  const first = buildResearchQueries(brief).find(item => item.topic === 'competitor')
  const second = buildCompetitorCaseQuery(brief)
  assert.equal(second.topic, 'competitor')
  assert.notEqual(second.query, first.query)
  assert.match(second.query, /低糖冷萃咖啡/u)
  assert.match(second.query, /案例/u)
  assert.ok(second.query.length <= 128)
})

test('planned searches keep all four topics, exclude shopping pages, and reject incomplete plans', () => {
  const fallback = buildResearchQueries(brief)
  const planned = normalizePlannedQueries([
    { topic: 'environment', query: '中国 咖啡消费 市场数据 官方报告' },
    { topic: 'consumer', query: '办公室 咖啡 消费者行为 调研' },
    { topic: 'competitor', query: '瑞幸 库迪 品牌营销活动 具体案例' },
    { topic: 'channel', query: '咖啡品牌 小红书 营销活动 案例' },
  ], fallback)
  assert.equal(planned.length, 4)
  assert.ok(planned.every(item => item.query.includes('-site:smzdm.com') && item.query.length <= 128))
  assert.deepEqual(normalizePlannedQueries(planned.slice(0, 3), fallback), fallback)
})

test('only fetched public web pages can become linked sources', () => {
  const result = (url, content = '真实网页正文'.repeat(30)) => ({
    title: '品牌营销案例', url, content, summary: '该品牌发布了营销案例',
    site_name: '品牌官网', date: '2026-10-01T00:00:00Z',
  })
  const sources = collectResearchSources([
    { topic: 'competitor', results: [
      result('https://example.com/case#details'),
      result('https://example.com/case'),
      result('javascript:alert(1)'),
      result('http://127.0.0.1/private'),
      result('http://[::1]/private'),
      result('https://www.smzdm.com/offer'),
      result('https://example.com/empty', ''),
    ] },
  ])
  assert.equal(sources.length, 1)
  assert.equal(sources[0].url, 'https://example.com/case')
  assert.equal(sources[0].id, 'S1')
  assert.ok(sources[0].excerpt.includes('真实网页正文'))
})

test('references accept only source IDs returned by live research', () => {
  const sources = collectResearchSources([{ topic: 'consumer', results: [{
    title: '用户研究', url: 'https://example.com/study', content: '研究正文'.repeat(50),
    summary: '购买行为研究', site_name: '研究机构', date: null,
  }] }])
  assert.deepEqual(referencesForIds(['S1', 'S999', 'S1'], sources), [{
    title: '用户研究', url: 'https://example.com/study', siteName: '研究机构',
  }])
})

test('competitor sections can retain five verified case links', () => {
  const sources = collectResearchSources([
    { topic: 'competitor', results: Array.from({ length: 3 }, (_, index) => ({
      title: `案例 ${index + 1}`, url: `https://example.com/case-${index + 1}`, content: '活动正文'.repeat(50),
    })) },
    { topic: 'competitor', results: Array.from({ length: 3 }, (_, index) => ({
      title: `案例 ${index + 4}`, url: `https://example.com/case-${index + 4}`, content: '活动正文'.repeat(50),
    })) },
  ])
  assert.equal(sources.length, 6)
  assert.equal(referencesForIds(['S1', 'S2', 'S3', 'S4', 'S5'], sources, 5).length, 5)
})
