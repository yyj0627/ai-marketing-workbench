import { Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import PptxGenJS from 'pptxgenjs'
import { planGroupTitle, validateBrief, type DemoBrief, type DemoPlan } from './demo-planner.ts'
import { parsePlanContent, type PlanTextBlock } from './plan-format.ts'
import { publicWebUrl } from './plan-research.ts'

const INK = '203128'
const ACCENT = '28704B'
const MUTED = '63746A'
const PAPER = 'F8F9F6'
const FONT = 'Noto Sans CJK SC'

export type ExportPayload = { brief: DemoBrief; plan: DemoPlan; format: 'docx' | 'pptx' }

export function validateExportPayload(value: unknown): value is ExportPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  if (payload.format !== 'docx' && payload.format !== 'pptx') return false
  if (!validateBrief(payload.brief)) return false
  if (!payload.plan || typeof payload.plan !== 'object') return false
  const plan = payload.plan as Record<string, unknown>
  if (plan.mode !== 'ai' && plan.mode !== 'demo') return false
  if (typeof plan.createdAt !== 'string' || plan.createdAt.length > 100) return false
  if (!Array.isArray(plan.sections) || plan.sections.length < 1 || plan.sections.length > 20) return false
  if (!Array.isArray(plan.assumptions) || plan.assumptions.length > 30) return false
  if (!plan.assumptions.every(item => typeof item === 'string' && item.length <= 1000)) return false
  return plan.sections.every(section => section && typeof section === 'object'
    && typeof section.id === 'string' && section.id.length <= 80
    && typeof section.title === 'string' && section.title.length <= 120
    && typeof section.content === 'string' && section.content.length <= 20_000
    && (section.references === undefined || (Array.isArray(section.references) && section.references.length <= 8
      && section.references.every((reference: unknown) => {
        if (!reference || typeof reference !== 'object') return false
        const value = reference as Record<string, unknown>
        return typeof value.title === 'string' && value.title.length > 0 && value.title.length <= 180
          && typeof value.url === 'string' && Boolean(publicWebUrl(value.url))
          && (value.siteName === undefined || (typeof value.siteName === 'string' && value.siteName.length <= 80))
          && (value.publishedAt === undefined || (typeof value.publishedAt === 'string' && value.publishedAt.length <= 30))
      }))))
}

function sources(brief: DemoBrief): string[] {
  return brief.evidenceSources.trim()
    ? brief.evidenceSources.split('\n').map(item => item.trim()).filter(Boolean)
    : ['暂无；方案中的市场与用户判断仍需核验。']
}

function label(plan: DemoPlan): string {
  return plan.mode === 'ai' ? 'AI 辅助初稿 · 请核对事实后使用' : '演示初稿 · 不代表真实市场结论'
}

export async function createWordBuffer(brief: DemoBrief, plan: DemoPlan): Promise<Buffer> {
  const paragraphs: Paragraph[] = [
    new Paragraph({ text: brief.projectName.trim() || '营销方案', heading: HeadingLevel.TITLE, spacing: { after: 260 } }),
    new Paragraph({ children: [new TextRun({ text: '营销策划方案', color: ACCENT, bold: true, size: 26 })], spacing: { after: 160 } }),
    new Paragraph({ children: [new TextRun({ text: label(plan), color: MUTED, size: 18 })], spacing: { after: 540 } }),
    new Paragraph({ text: '已录入资料来源', heading: HeadingLevel.HEADING_2 }),
    ...sources(brief).map(item => new Paragraph({ text: item, bullet: { level: 0 } })),
  ]

  let previousGroup = ''
  for (const section of plan.sections) {
    const group = planGroupTitle(section.id, plan)
    if (group !== previousGroup) {
      paragraphs.push(new Paragraph({ text: group, heading: HeadingLevel.HEADING_1, pageBreakBefore: true }))
      previousGroup = group
    }
    paragraphs.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2, keepNext: true }))
    for (const block of parsePlanContent(section.content)) {
      if (block.type === 'heading') {
        paragraphs.push(new Paragraph({ text: block.text, heading: HeadingLevel.HEADING_3, keepNext: true }))
      } else if (block.type === 'list') {
        paragraphs.push(new Paragraph({ text: block.text, bullet: { level: 0 }, spacing: { after: 90, line: 330 } }))
      } else {
        paragraphs.push(new Paragraph({ text: block.text, spacing: { after: 150, line: 360 }, widowControl: true }))
      }
    }
    if (section.references?.length) {
      paragraphs.push(new Paragraph({ text: '参考资料', heading: HeadingLevel.HEADING_3, keepNext: true }))
      for (const reference of section.references) {
        paragraphs.push(new Paragraph({
          children: [new ExternalHyperlink({
            children: [new TextRun({ text: reference.title, color: ACCENT, underline: {} })],
            link: reference.url,
          }), new TextRun({ text: `  ${[reference.siteName, reference.publishedAt].filter(Boolean).join(' · ')}`, color: MUTED, size: 18 })],
          bullet: { level: 0 },
          spacing: { after: 100 },
        }))
      }
    }
  }

  if (plan.assumptions.length) {
    paragraphs.push(new Paragraph({ text: '待验证假设', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }))
    paragraphs.push(...plan.assumptions.map(item => new Paragraph({ text: item, bullet: { level: 0 } })))
  }

  const document = new Document({
    creator: '策划台',
    title: brief.projectName.trim() || '营销方案',
    styles: {
      default: {
        document: { run: { font: FONT, size: 22, color: INK }, paragraph: { spacing: { line: 340, after: 130 } } },
        title: { run: { font: FONT, size: 42, bold: true, color: INK }, paragraph: { spacing: { after: 220 } } },
        heading1: { run: { font: FONT, size: 32, bold: true, color: INK }, paragraph: { spacing: { before: 320, after: 220 } } },
        heading2: { run: { font: FONT, size: 26, bold: true, color: INK }, paragraph: { spacing: { before: 260, after: 150 } } },
        heading3: { run: { font: FONT, size: 23, bold: true, color: ACCENT }, paragraph: { spacing: { before: 170, after: 90 } } },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 1100, right: 1150, bottom: 1100, left: 1150 } } },
      children: paragraphs,
    }],
  })

  return Packer.toBuffer(document)
}

function textWeight(text: string): number {
  return Array.from(text).reduce((sum, character) => sum + (character.charCodeAt(0) < 128 ? 0.55 : 1), 0)
}

function splitForSlide(text: string, maxWeight = 230): string[] {
  if (textWeight(text) <= maxWeight) return [text]
  const sentences = text.match(/[^。！？；]+[。！？；]?/gu) || [text]
  const chunks: string[] = []
  let current = ''
  const append = (part: string) => {
    if (current && textWeight(current + part) > maxWeight) {
      chunks.push(current)
      current = ''
    }
    if (textWeight(part) <= maxWeight) {
      current += part
      return
    }
    for (const character of Array.from(part)) {
      if (current && textWeight(current + character) > maxWeight) {
        chunks.push(current)
        current = ''
      }
      current += character
    }
  }
  for (const sentence of sentences) append(sentence)
  if (current) chunks.push(current)
  return chunks
}

type SlidePage = { blocks: PlanTextBlock[] }

function sectionPages(blocks: PlanTextBlock[]): SlidePage[] {
  const pages: SlidePage[] = []
  let current: PlanTextBlock[] = []
  let activeHeading = ''
  let used = 0
  const flush = () => {
    if (current.length) pages.push({ blocks: current })
    current = []
    used = 0
  }

  const expanded = blocks.flatMap(block => block.type === 'heading'
    ? [block]
    : splitForSlide(block.text).map(part => ({ type: block.type, text: part } as PlanTextBlock)))

  for (const [index, block] of expanded.entries()) {
    const cost = textWeight(block.text) + (block.type === 'heading' ? 28 : 16)
    const followingCost = block.type === 'heading' && expanded[index + 1]?.type !== 'heading'
      ? textWeight(expanded[index + 1].text) + 16
      : 0
    if (current.length && used + cost + followingCost > 345) flush()
    if (block.type !== 'heading' && current.length && used + cost > 345) {
      flush()
      if (activeHeading) {
        current.push({ type: 'heading', text: `${activeHeading}（续）` })
        used += textWeight(activeHeading) + 28
      }
    }
    current.push(block)
    used += cost
    if (block.type === 'heading') activeHeading = block.text
  }
  flush()
  return pages.length ? pages : [{ blocks: [{ type: 'paragraph', text: '本节暂无正文。' }] }]
}

function addSlideHeader(slide: PptxGenJS.Slide, pptx: PptxGenJS, group: string, section: string, page: number) {
  slide.background = { color: PAPER }
  slide.addShape(pptx.ShapeType.rect, { x: 0.68, y: 0.59, w: 0.08, h: 0.38, line: { color: ACCENT }, fill: { color: ACCENT } })
  slide.addText(group, { x: 0.92, y: 0.58, w: 4.7, h: 0.25, fontFace: FONT, fontSize: 10, bold: true, color: ACCENT, margin: 0, lang: 'zh-CN' })
  slide.addText(section, { x: 0.92, y: 0.92, w: 11.45, h: 0.54, fontFace: FONT, fontSize: 24, bold: true, color: INK, margin: 0, fit: 'shrink', lang: 'zh-CN' })
  slide.addShape(pptx.ShapeType.line, { x: 0.92, y: 1.62, w: 11.5, h: 0, line: { color: 'D7DFD8', width: 1 } })
  slide.addText(String(page).padStart(2, '0'), { x: 11.83, y: 7.06, w: 0.6, h: 0.2, fontFace: FONT, fontSize: 9, color: MUTED, align: 'right', margin: 0 })
}

export async function createPresentationBuffer(brief: DemoBrief, plan: DemoPlan): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = '策划台'
  pptx.subject = '营销策划方案'
  pptx.title = brief.projectName.trim() || '营销方案'
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT }

  const cover = pptx.addSlide()
  cover.background = { color: PAPER }
  cover.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.25, w: 0.11, h: 1.08, line: { color: ACCENT }, fill: { color: ACCENT } })
  cover.addText('营销策划方案', { x: 1.15, y: 1.23, w: 9.5, h: 0.38, fontFace: FONT, fontSize: 15, bold: true, color: ACCENT, margin: 0, lang: 'zh-CN' })
  cover.addText(brief.projectName.trim() || '营销方案', { x: 1.12, y: 2.08, w: 11, h: 1.4, fontFace: FONT, fontSize: 36, bold: true, color: INK, fit: 'shrink', margin: 0, lang: 'zh-CN' })
  cover.addText(label(plan), { x: 1.15, y: 4.8, w: 9.6, h: 0.4, fontFace: FONT, fontSize: 14, color: MUTED, margin: 0, lang: 'zh-CN' })

  let slideNumber = 1
  let previousGroup = ''
  for (const section of plan.sections) {
    const group = planGroupTitle(section.id, plan)
    if (group !== previousGroup) {
      const divider = pptx.addSlide()
      slideNumber += 1
      divider.background = { color: ACCENT }
      divider.addText(String(slideNumber - 1).padStart(2, '0'), { x: 0.94, y: 0.86, w: 1.1, h: 0.4, fontFace: FONT, fontSize: 13, color: 'D8E9DD', margin: 0 })
      divider.addText(group, { x: 0.94, y: 2.48, w: 11.5, h: 1.05, fontFace: FONT, fontSize: 37, bold: true, color: 'FFFFFF', margin: 0, fit: 'shrink', lang: 'zh-CN' })
      previousGroup = group
    }
    const pages = sectionPages(parsePlanContent(section.content))
    for (const page of pages) {
      const slide = pptx.addSlide()
      slideNumber += 1
      addSlideHeader(slide, pptx, group, section.title, slideNumber)
      const runs = page.blocks.map((block, index) => ({
        text: `${block.type === 'list' ? '• ' : ''}${block.text}${index < page.blocks.length - 1 ? '\n\n' : ''}`,
        options: { bold: block.type === 'heading', color: block.type === 'heading' ? ACCENT : INK },
      }))
      slide.addText(runs, {
        x: 0.94, y: 1.98, w: 11.36, h: 4.72,
        fontFace: FONT, fontSize: 18, color: INK, margin: 0, valign: 'top',
        fit: 'shrink', lang: 'zh-CN', lineSpacingMultiple: 1.18,
      })
    }
    if (section.references?.length) {
      const slide = pptx.addSlide()
      slideNumber += 1
      addSlideHeader(slide, pptx, group, `${section.title} · 参考资料`, slideNumber)
      section.references.forEach((reference, index) => {
        const y = 1.95 + index * 0.83
        slide.addText(`${index + 1}. ${reference.title} ↗`, {
          x: 0.94, y, w: 11.4, h: 0.35, fontFace: FONT, fontSize: 16,
          color: ACCENT, bold: true, margin: 0, fit: 'shrink', lang: 'zh-CN',
          hyperlink: { url: reference.url },
        })
        slide.addText([reference.siteName, reference.publishedAt].filter(Boolean).join(' · '), {
          x: 1.24, y: y + 0.36, w: 10.8, h: 0.24, fontFace: FONT, fontSize: 10,
          color: MUTED, margin: 0, lang: 'zh-CN',
        })
      })
    }
  }

  const addAppendix = (title: string, items: string[]) => {
    for (const page of sectionPages(items.map(text => ({ type: 'list', text } as PlanTextBlock)))) {
      const slide = pptx.addSlide()
      slideNumber += 1
      addSlideHeader(slide, pptx, '附录', title, slideNumber)
      slide.addText(page.blocks.map(block => `• ${block.text}`).join('\n\n'), {
        x: 0.94, y: 2.18, w: 11.36, h: 4.38, fontFace: FONT, fontSize: 18,
        color: INK, margin: 0, valign: 'top', fit: 'shrink', lang: 'zh-CN', lineSpacingMultiple: 1.18,
      })
    }
  }
  addAppendix('已录入资料来源', sources(brief))
  if (plan.assumptions.length) addAppendix('待验证假设', plan.assumptions)

  const data = await pptx.write({ outputType: 'nodebuffer', compression: true })
  return Buffer.from(data as Uint8Array)
}
