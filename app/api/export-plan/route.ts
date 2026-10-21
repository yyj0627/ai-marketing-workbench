import { createPresentationBuffer, createWordBuffer, validateExportPayload } from '@/lib/plan-export'

export const runtime = 'nodejs'

const MAX_BODY_LENGTH = 500_000

export async function POST(request: Request) {
  try {
    const raw = await request.text()
    if (raw.length > MAX_BODY_LENGTH) {
      return Response.json({ error: '方案内容太长，暂时无法导出。' }, { status: 413 })
    }
    const payload: unknown = JSON.parse(raw)
    if (!validateExportPayload(payload)) {
      return Response.json({ error: '方案数据不完整，请刷新页面后再试。' }, { status: 400 })
    }

    const { brief, plan, format } = payload
    const buffer = format === 'docx'
      ? await createWordBuffer(brief, plan)
      : await createPresentationBuffer(brief, plan)
    const name = (brief.projectName.trim() || '营销方案').replace(/[\\/:*?"<>|\r\n]/gu, '-').slice(0, 80)
    const filename = `${name}.${format}`
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': format === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="marketing-plan.${format}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return Response.json({ error: '文件生成失败，请稍后再试。' }, { status: 500 })
  }
}
