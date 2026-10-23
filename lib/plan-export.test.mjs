import { test } from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { createWordBuffer, createPresentationBuffer, validateExportPayload } from './plan-export.ts'

const brief = {
  projectName: '轻醒咖啡营销提案',
  product: '低糖冷萃咖啡',
  audience: '办公室人群',
  goal: '验证午后场景的内容吸引力',
  budget: '5000 元',
  channels: '小红书、社群',
  knownFacts: '支持团队拼单',
  evidenceSources: '产品说明书｜团队提供',
}

const plan = {
  mode: 'ai',
  createdAt: '2026-10-20T12:00:00.000Z',
  sections: [
    { id: 'brief', title: '项目背景与目标', content: '【已知事实】\n产品支持团队拼单。\n【核心洞察】\n这可能降低获客成本（【推断】，需实测）。' },
    { id: 'budget', title: '预算明细与调整', content: '【建议分配】\n• 内容制作：2,000 元\n• 测试投放：3,000 元' },
  ],
  assumptions: ['团队拼单是否能降低获客成本仍需验证。'],
}

test('Word export contains the complete plan in editable document paragraphs', async () => {
  const buffer = await createWordBuffer(brief, plan)
  assert.ok(buffer.length > 1000, '应生成 Word 文件')
  const zip = await JSZip.loadAsync(buffer)
  const xml = await zip.file('word/document.xml')?.async('string')

  assert.ok(Buffer.isBuffer(buffer))
  assert.ok(xml)
  for (const text of ['轻醒咖啡营销提案', '前期分析', '项目背景与目标', '核心洞察', '这可能降低获客成本（【推断】，需实测）。', '预算明细与调整', '内容制作：2,000 元', '产品说明书｜团队提供', '团队拼单是否能降低获客成本仍需验证。']) {
    assert.ok(xml.includes(text), `Word 缺少：${text}`)
  }
  assert.ok(xml.indexOf('项目背景与目标') < xml.indexOf('预算明细与调整'))
})

test('PPT export keeps all content and paginates long sections', async () => {
  const longSentence = '这是需要完整保留的正文。'
  const longPlan = {
    ...plan,
    sections: [{ ...plan.sections[0], content: `【核心洞察】\n${longSentence.repeat(90)}` }, plan.sections[1]],
  }
  const buffer = await createPresentationBuffer(brief, longPlan)
  assert.ok(buffer.length > 1000, '应生成 PPT 文件')
  const zip = await JSZip.loadAsync(buffer)
  const slideNames = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/u.test(name))
  const slides = await Promise.all(slideNames.map(name => zip.file(name)?.async('string')))
  const allSlideXml = slides.join('')

  assert.ok(Buffer.isBuffer(buffer))
  assert.ok(slideNames.length >= 5, '长正文应分到多页')
  for (const text of ['轻醒咖啡营销提案', '前期分析', '核心洞察', '预算明细与调整', '内容制作：2,000 元', '产品说明书｜团队提供', '团队拼单是否能降低获客成本仍需验证。']) {
    assert.ok(allSlideXml.includes(text), `PPT 缺少：${text}`)
  }
  assert.equal((allSlideXml.match(/这是需要完整保留的正文。/gu) || []).length, 90)
})

test('export rejects missing and oversized plan content', () => {
  assert.equal(validateExportPayload({ brief, plan, format: 'docx' }), true)
  assert.equal(validateExportPayload({ brief, plan, format: 'md' }), false)
  assert.equal(validateExportPayload({ brief, plan: { ...plan, sections: [] }, format: 'pptx' }), false)
  assert.equal(validateExportPayload({ brief, plan: { ...plan, sections: [{ id: 'brief', title: '过长', content: '文字'.repeat(12_000) }] }, format: 'docx' }), false)
})

test('PPT groups short subsections instead of making one mostly empty slide per heading', async () => {
  const compactPlan = {
    ...plan,
    sections: [{
      id: 'brief',
      title: '项目背景与目标',
      content: Array.from({ length: 4 }, (_, index) => `【方向 ${index + 1}】\n先验证受众的使用场景，再核对预算和执行责任。`).join('\n'),
    }],
  }
  const zip = await JSZip.loadAsync(await createPresentationBuffer(brief, compactPlan))
  const slideNames = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/u.test(name))
  assert.ok(slideNames.length <= 6, '四段短内容应合并到少量幻灯片')
})

test('Word and PPT export keep section references as clickable links', async () => {
  const linkedPlan = {
    ...plan,
    sections: [{ ...plan.sections[0], references: [{
      title: '品牌营销案例原文',
      url: 'https://example.com/brand-case',
      siteName: '品牌官网',
      publishedAt: '2026-10-01',
    }] }, plan.sections[1]],
  }
  const word = await JSZip.loadAsync(await createWordBuffer(brief, linkedPlan))
  const wordXml = await word.file('word/document.xml')?.async('string')
  const wordRels = await word.file('word/_rels/document.xml.rels')?.async('string')
  assert.ok(wordXml.includes('参考资料'))
  assert.ok(wordXml.includes('品牌营销案例原文'))
  assert.ok(wordRels.includes('https://example.com/brand-case'))

  const ppt = await JSZip.loadAsync(await createPresentationBuffer(brief, linkedPlan))
  const slideXml = (await Promise.all(Object.keys(ppt.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/u.test(name))
    .map(name => ppt.file(name)?.async('string')))).join('')
  const slideRels = (await Promise.all(Object.keys(ppt.files)
    .filter(name => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/u.test(name))
    .map(name => ppt.file(name)?.async('string')))).join('')
  assert.ok(slideXml.includes('品牌营销案例原文'))
  assert.ok(slideRels.includes('https://example.com/brand-case'))
})

test('export rejects unsafe reference links', () => {
  const badPlan = {
    ...plan,
    sections: [{ ...plan.sections[0], references: [{ title: '无效链接', url: 'javascript:alert(1)' }] }],
  }
  assert.equal(validateExportPayload({ brief, plan: badPlan, format: 'docx' }), false)
})
