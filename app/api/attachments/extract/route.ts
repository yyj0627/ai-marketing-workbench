import { extractAttachmentText, MAX_ATTACHMENT_BYTES } from '@/lib/attachment-text'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length')) > MAX_ATTACHMENT_BYTES + 1_000_000) {
    return Response.json({ error: '单个附件不能超过 32 MB。' }, { status: 413 })
  }
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return Response.json({ error: '请选择要上传的文件。' }, { status: 400 })
    if (file.size > MAX_ATTACHMENT_BYTES) return Response.json({ error: '单个附件不能超过 32 MB。' }, { status: 413 })
    const name = file.name.split(/[\\/]/u).pop()?.trim().slice(0, 180) || ''
    if (!name) return Response.json({ error: '文件名无效。' }, { status: 400 })
    const { text, truncated } = await extractAttachmentText(name, Buffer.from(await file.arrayBuffer()))
    return Response.json({ attachment: { name, text, truncated } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/不能超过|目前支持|没有提取到文字/u.test(message)) {
      return Response.json({ error: message }, { status: 400 })
    }
    console.error('[attachment extraction]', error)
    return Response.json({ error: '文件暂时无法读取。请确认文件未损坏，并另存后重试。' }, { status: 400 })
  }
}
