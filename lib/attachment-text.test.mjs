import { test } from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { Document, Packer, Paragraph } from 'docx'
import { extractAttachmentText, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_CHARS } from './attachment-text.ts'

test('plain text attachments keep useful line breaks and limit model context', async () => {
  const result = await extractAttachmentText('brief.txt', Buffer.from(`目标人群：大学生\n\n\n渠道：小红书\n${'内容'.repeat(MAX_ATTACHMENT_CHARS)}`))
  assert.ok(result.text.startsWith('目标人群：大学生\n\n渠道：小红书'))
  assert.equal(result.text.length, MAX_ATTACHMENT_CHARS)
  assert.equal(result.truncated, true)
})

test('Word attachments contribute their actual document text', async () => {
  const document = new Document({ sections: [{ children: [new Paragraph('产品卖点：低糖冷萃'), new Paragraph('目标：验证购买意向')] }] })
  const result = await extractAttachmentText('产品说明.docx', await Packer.toBuffer(document))
  assert.match(result.text, /产品卖点：低糖冷萃/u)
  assert.match(result.text, /目标：验证购买意向/u)
})

test('PowerPoint attachments collect slide text in order', async () => {
  const zip = new JSZip()
  zip.file('ppt/slides/slide2.xml', '<p:sld><a:t>第二页渠道：社群</a:t></p:sld>')
  zip.file('ppt/slides/slide1.xml', '<p:sld><a:t>第一页目标人群：学生</a:t><a:t>预算&amp;周期</a:t></p:sld>')
  const result = await extractAttachmentText('策划案.pptx', await zip.generateAsync({ type: 'nodebuffer' }))
  assert.ok(result.text.indexOf('第一页目标人群：学生') < result.text.indexOf('第二页渠道：社群'))
  assert.match(result.text, /预算&周期/u)
})

test('attachments reject unsupported, empty, and oversized files', async () => {
  await assert.rejects(() => extractAttachmentText('photo.png', Buffer.from('hello')), /支持/u)
  await assert.rejects(() => extractAttachmentText('empty.txt', Buffer.from(' \n ')), /文字/u)
  await assert.rejects(() => extractAttachmentText('huge.txt', Buffer.alloc(MAX_ATTACHMENT_BYTES + 1)), /32 MB/u)
})
