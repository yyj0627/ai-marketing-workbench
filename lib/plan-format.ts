export type PlanTextBlock = { type: 'heading' | 'paragraph' | 'list'; text: string }

const EVIDENCE_LABEL = /^(?:已知事实|事实|推断|推断\/策略假设|策略假设|假设|待核实|待验证|需验证|用户提供，尚未核验)$/u

export function readableSourceMarkers(content: string): string {
  return content.replace(/[ \t]*[（(]\s*S\d+(?:\s*[,，、;；]\s*S\d+)*\s*[）)]/giu, '（见本节参考资料）')
}

function separateHeadings(content: string): string {
  return content.replace(/【([^】\n]{1,50})】/gu, (token, label: string, offset: number, source: string) => {
    const lineStart = source.lastIndexOf('\n', offset - 1) + 1
    const before = source.slice(lineStart, offset)
    const atLineStart = before.trim() === ''
    const afterSentence = /[。！？；]\s*$/u.test(before)

    // Evidence labels are prose when they appear inside a sentence, even after punctuation.
    if (!atLineStart && (!afterSentence || EVIDENCE_LABEL.test(label.trim()))) return token
    return `\n\n${token}\n`
  })
}

function sentenceChunks(text: string): string[] {
  const chunks: string[] = []
  let start = 0
  let parenthesesDepth = 0

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '（' || character === '(') parenthesesDepth += 1
    if (character === '）' || character === ')') parenthesesDepth = Math.max(0, parenthesesDepth - 1)
    if (!/[。！？；]/u.test(character) || parenthesesDepth > 0) continue

    while (/[”’"']/.test(text[index + 1] || '')) index += 1
    chunks.push(text.slice(start, index + 1))
    start = index + 1
  }

  if (start < text.length) chunks.push(text.slice(start))
  return chunks.length ? chunks : [text]
}

function splitLongParagraph(text: string): string[] {
  if (text.length <= 180) return [text]
  const sentences = sentenceChunks(text)
  const paragraphs: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > 180) {
      paragraphs.push(current)
      current = ''
    }
    current += sentence
  }
  if (current) paragraphs.push(current)
  return paragraphs
}

function splitAtSemicolons(text: string): string[] {
  const parts: string[] = []
  let start = 0
  let depth = 0
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '（' || character === '(') depth += 1
    if (character === '）' || character === ')') depth = Math.max(0, depth - 1)
    if ((character === '；' || character === ';') && depth === 0) {
      parts.push(text.slice(start, index + 1))
      start = index + 1
    }
  }
  if (start < text.length) parts.push(text.slice(start))
  return parts
}

export function parsePlanContent(content: string): PlanTextBlock[] {
  const normalized = separateHeadings(readableSourceMarkers(content.replace(/\r\n?/g, '\n')))
  const blocks: PlanTextBlock[] = []
  for (const originalLine of normalized.split('\n')) {
    const line = originalLine.trim()
    if (!line) continue
    const bracketHeading = line.match(/^【([^】]+)】$/u)
    const markdownHeading = line.match(/^#{1,5}\s+(.+)$/u)
    if (bracketHeading || markdownHeading) {
      blocks.push({ type: 'heading', text: (bracketHeading?.[1] || markdownHeading?.[1] || '').trim() })
      continue
    }
    const bullet = line.match(/^(?:[•·*\-]|\d+[.、)])\s*(.+)$/u)
    if (bullet) {
      blocks.push({ type: 'list', text: bullet[1].trim() })
      continue
    }
    for (const clause of splitAtSemicolons(line)) {
      for (const paragraph of splitLongParagraph(clause.trim())) {
        blocks.push({ type: 'paragraph', text: paragraph })
      }
    }
  }
  return blocks
}
