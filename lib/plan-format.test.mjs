import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePlanContent } from './plan-format.ts'

test('separates inline bracket headings and keeps the prose', () => {
  const input = '【核心洞察】用户想省时间。【策略主张】围绕午后三点做内容。'
  assert.deepEqual(parsePlanContent(input), [
    { type: 'heading', text: '核心洞察' },
    { type: 'paragraph', text: '用户想省时间。' },
    { type: 'heading', text: '策略主张' },
    { type: 'paragraph', text: '围绕午后三点做内容。' },
  ])
})

test('breaks dense prose into readable paragraphs without dropping sentences', () => {
  const sentence = '这是一句用于说明活动执行逻辑的较长描述，包含受众、渠道、动作以及验证方法。'
  const input = sentence.repeat(9)
  const blocks = parsePlanContent(input)
  assert.ok(blocks.length > 1)
  assert.ok(blocks.every(block => block.type === 'paragraph'))
  assert.equal(blocks.map(block => block.text).join(''), input)
})

test('keeps budget bullets separate from section headings', () => {
  const input = '【建议分配】\n• 内容制作：1,400 元\n• 渠道投放：1,200 元\n\n【依据】先测试，再追加。'
  assert.deepEqual(parsePlanContent(input), [
    { type: 'heading', text: '建议分配' },
    { type: 'list', text: '内容制作：1,400 元' },
    { type: 'list', text: '渠道投放：1,200 元' },
    { type: 'heading', text: '依据' },
    { type: 'paragraph', text: '先测试，再追加。' },
  ])
})

test('keeps evidence labels in their sentence instead of turning them into headings', () => {
  const input = '【S 内部优势（基于已知事实与推断）】\n一是产品属性具备可传播的差异点：低糖＋冷萃，但“低糖”是否牺牲口感需验证。\n二是团队拼单提供了结构性的传播单元：一次成交可能带来多人尝试，单位获客成本在模型上更优（【推断】，需实测）。\n三是预算与周期小，反而适合快速试错，决策链短。'
  const blocks = parsePlanContent(input)
  assert.deepEqual(blocks.filter(block => block.type === 'heading'), [
    { type: 'heading', text: 'S 内部优势（基于已知事实与推断）' },
  ])
  assert.ok(blocks.some(block => block.type === 'paragraph' && block.text.includes('更优（【推断】，需实测）。')))
})

test('keeps inline status markers within paragraphs and list items', () => {
  const input = '【竞品分析】\n这里是用户提供的信息【已知事实】，而平台数据【待核实】。下一步【假设】尝试 A/B 测试。\n• 测试口感（【推断】，需要访谈）后再调整卖点。'
  assert.deepEqual(parsePlanContent(input), [
    { type: 'heading', text: '竞品分析' },
    { type: 'paragraph', text: '这里是用户提供的信息【已知事实】，而平台数据【待核实】。下一步【假设】尝试 A/B 测试。' },
    { type: 'list', text: '测试口感（【推断】，需要访谈）后再调整卖点。' },
  ])
})

test('does not split a long paragraph inside parentheses', () => {
  const first = '先核验渠道效率、受众反馈与竞品信息，明确当前资料的来源和限制。'.repeat(6)
  const input = `${first}预算效率需要验证（一次成交可能带来多人尝试；这只是【推断】，仍需实测）。再制定投放计划。`
  const blocks = parsePlanContent(input)
  assert.ok(blocks.length > 1)
  assert.ok(blocks.every(block => block.type === 'paragraph'))
  assert.equal(blocks.map(block => block.text).join(''), input)
  assert.ok(blocks.some(block => block.text.includes('一次成交可能带来多人尝试；这只是【推断】，仍需实测）')))
})

test('starts a new paragraph after a top-level semicolon', () => {
  const input = '传播目标：提升联想；行为目标：带动到店和试用。现有证据缺口是无销量基线；需要补齐渠道数据。'
  assert.deepEqual(parsePlanContent(input), [
    { type: 'paragraph', text: '传播目标：提升联想；' },
    { type: 'paragraph', text: '行为目标：带动到店和试用。现有证据缺口是无销量基线；' },
    { type: 'paragraph', text: '需要补齐渠道数据。' },
  ])
})
