import JSZip from 'jszip'
import mammoth from 'mammoth'

export const MAX_ATTACHMENT_BYTES = 32 * 1024 * 1024
export const MAX_ATTACHMENT_CHARS = 10_000
export const MAX_ATTACHMENTS = 4
export const ATTACHMENT_EXTENSIONS = ['pdf', 'docx', 'pptx', 'txt', 'md'] as const

function decodeXmlText(value: string) {
  return value.replace(/&#(?:x([0-9a-f]+)|([0-9]+));|&(amp|lt|gt|quot|apos);/giu, (token, hex: string | undefined, decimal: string | undefined, named: string | undefined) => {
    if (hex || decimal) {
      const code = Number.parseInt(hex || decimal || '', hex ? 16 : 10)
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : token
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[named || ''] || token
  })
}

async function powerpointText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const slides = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/u.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)/u)?.[1]) - Number(b.match(/slide(\d+)/u)?.[1]))
    .slice(0, 30)
  const pages = await Promise.all(slides.map(async name => {
    const xml = await zip.file(name)?.async('string') || ''
    return Array.from(xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/gu), match => decodeXmlText(match[1])).join(' ')
  }))
  return pages.filter(Boolean).join('\n\n')
}

function cleanText(value: string) {
  return value.replace(/\r\n?/gu, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/gu, '')
    .replace(/[ \t]+/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
}

export async function extractAttachmentText(name: string, input: Buffer): Promise<{ text: string; truncated: boolean }> {
  if (input.length > MAX_ATTACHMENT_BYTES) throw new Error('单个附件不能超过 32 MB。')
  const extension = name.split('.').pop()?.toLowerCase()
  if (!extension || !ATTACHMENT_EXTENSIONS.includes(extension as typeof ATTACHMENT_EXTENSIONS[number])) {
    throw new Error('目前支持 PDF、Word、PPT、TXT 和 Markdown 文件。')
  }
  let raw = ''
  if (extension === 'txt' || extension === 'md') {
    raw = new TextDecoder('utf-8').decode(input)
  } else if (extension === 'docx') {
    raw = (await mammoth.extractRawText({ buffer: input })).value
  } else if (extension === 'pptx') {
    raw = await powerpointText(input)
  } else {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(input) })
    try {
      raw = (await parser.getText({ first: 1, last: 30 })).text
    } finally {
      await parser.destroy()
    }
  }
  const text = cleanText(raw)
  if (!text) throw new Error('没有提取到文字。扫描版 PDF 或纯图片暂不支持，请上传可选中文字的文件。')
  return { text: text.slice(0, MAX_ATTACHMENT_CHARS), truncated: text.length > MAX_ATTACHMENT_CHARS }
}
