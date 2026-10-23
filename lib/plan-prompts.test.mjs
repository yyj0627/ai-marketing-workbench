import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planGroups } from './demo-planner.ts'
import { buildModuleContext, modulePrompt, sectionIds } from './plan-prompts.ts'

const brief = {
  projectName: '轻醒咖啡｜午后场景', product: '低糖冷萃咖啡', audience: '办公室人群',
  goal: '获得购买意向', budget: '5000 元', channels: '小红书、社群',
}
const sources = ['environment', 'consumer', 'competitor', 'channel'].map((topic, index) => ({
  id: `S${index + 1}`, topic, title: `${topic} 来源`, url: `https://example.com/${topic}`, excerpt: '网页正文',
}))

test('all ten plan sections receive distinct, module-specific system prompts', () => {
  const displayedIds = planGroups.flatMap(group => group.sections.map(([id]) => id))
  assert.deepEqual(sectionIds, displayedIds)
  const prompts = sectionIds.map(id => modulePrompt(id))
  assert.equal(new Set(prompts).size, 10)
  for (const [index, prompt] of prompts.entries()) {
    assert.match(prompt, new RegExp(`只输出 ${sectionIds[index]} 一个模块`))
    assert.match(prompt, /只引用实际取得的资料/u)
  }
  assert.match(modulePrompt('competitor'), /本项目品牌.*不能.*竞品案例/u)
  assert.match(modulePrompt('budget'), /allocations/u)
})

test('later module context uses its prerequisites and relevant research instead of every earlier section', () => {
  const previous = sectionIds.map(id => ({ id, title: id, content: `${id} 正文` }))
  const competitor = buildModuleContext('competitor', brief, '轻醒咖啡', sources, previous)
  assert.deepEqual(competitor.previousSections.map(section => section.id), ['brief', 'consumer'])
  assert.deepEqual(competitor.researchSources.map(source => source.topic), ['competitor'])
  const swot = buildModuleContext('swot', brief, '轻醒咖啡', sources, previous)
  assert.deepEqual(swot.previousSections.map(section => section.id), ['brief', 'pest', 'consumer', 'competitor'])
  const budget = buildModuleContext('budget', brief, '轻醒咖啡', sources, previous)
  assert.deepEqual(budget.previousSections.map(section => section.id), ['strategy', 'creative', 'media', 'execution'])
  assert.deepEqual(budget.researchSources, [])
})
