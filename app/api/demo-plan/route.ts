import { NextRequest, NextResponse } from 'next/server'
import { jsonrepair } from 'jsonrepair'
import {
  buildDemoPlan,
  buildDemoRevision,
  buildBudgetAllocation,
  planGroups,
  validateBrief,
  type DemoBrief,
  type DemoPlan,
  type BudgetAllocationItem,
  type PlanSection,
} from '@/lib/demo-planner'

export const runtime = 'nodejs'

type ModelResponse = {
  choices?: Array<{ message?: { content?: string } }>
}

type DeepSeekModel = 'deepseek-flash' | 'deepseek-v4-pro'
type ModelConfig = { apiKey: string; model: string; url: string }
const deepSeekUrl = 'https://api.deepseek.com/chat/completions'
const deepSeekModels: DeepSeekModel[] = ['deepseek-flash', 'deepseek-v4-pro']

function serverModelIsAvailable(request: NextRequest) {
  return process.env.NODE_ENV !== 'production'
    && ['localhost', '127.0.0.1', '::1'].includes(request.nextUrl.hostname)
    && Boolean(process.env.AI_API_KEY && process.env.AI_MODEL)
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    serverModelAvailable: serverModelIsAvailable(request),
    serverModel: serverModelIsAvailable(request) ? process.env.AI_MODEL : null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

async function callModel(
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  config: ModelConfig,
  jsonOutput = false,
  temperature = 0.4,
) {
  const response = await fetch(
    config.url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature,
        max_tokens: 8192,
        ...(jsonOutput && config.url === deepSeekUrl ? { response_format: { type: 'json_object' } } : {}),
      }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(90_000),
    },
  )

  if (!response.ok) {
    throw new Error(`模型接口返回 HTTP ${response.status}，请检查服务商、模型与密钥配置。`)
  }
  let data: ModelResponse
  try {
    data = (await response.json()) as ModelResponse
  } catch {
    throw new Error('模型接口返回了无法读取的内容，请稍后再试。')
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('模型没有返回可用内容。')
  return content
}

class ModelPlanFormatError extends Error {}

function parseGroup(content: string, expected: readonly (readonly [string, string])[]) {
  const clean = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let result: {
    sections?: Array<{ id?: string; content?: string }>
    assumptions?: unknown[]
    allocations?: Array<{ name?: unknown; percent?: unknown; purpose?: unknown }>
  }
  try {
    try {
      result = JSON.parse(clean)
    } catch {
      result = JSON.parse(jsonrepair(clean))
    }
  } catch {
    throw new ModelPlanFormatError('模型返回的方案格式不完整。')
  }
  if (!Array.isArray(result?.sections)) throw new ModelPlanFormatError('模型输出缺少方案模块。')
  const sections = expected.map(([id, title]) => {
    const raw = result.sections?.find(item => item.id === id)
    if (!raw || typeof raw.content !== 'string' || !raw.content.trim()) {
      throw new ModelPlanFormatError(`模型输出缺少“${title}”内容。`)
    }
    return { id, title, content: raw.content.trim().slice(0, 7000) }
  })
  const assumptions = (Array.isArray(result.assumptions) ? result.assumptions : [])
    .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    .map(item => item.trim().slice(0, 500))
    .slice(0, 8)
  const allocations: BudgetAllocationItem[] = (Array.isArray(result.allocations) ? result.allocations : [])
    .filter((item): item is { name: string; percent: number; purpose?: string } =>
      typeof item.name === 'string' && typeof item.percent === 'number' && Number.isFinite(item.percent) && item.percent >= 0)
    .map(item => ({
      name: item.name.replace(/[\r\n|]/g, ' ').trim().slice(0, 50),
      percent: item.percent,
      purpose: typeof item.purpose === 'string' ? item.purpose.replace(/[\r\n|]/g, ' ').trim().slice(0, 90) : undefined,
    }))
    .filter(item => item.name)
  return { sections, assumptions, allocations }
}

const baseGenerationRules = `你是一名资深整合营销策略策划，正在为客户写可执行的提案初稿。输出必须是 JSON 对象，格式为 {"sections":[{"id":"指定模块 ID","content":"正文"}],"assumptions":["待验证判断"]}，不要输出 JSON 之外的文字。
以用户 Brief 为唯一事实输入；用户提供的来源只能标记“用户提供，尚未核验”，绝不可冒称已查阅资料或引用具体报告、调研样本、市场数据、竞品动作、KOL 报价、效果数字。Brief 未明确给出的年龄、消费习惯、产品功效、保存方式、配送能力、平台流量机制和竞品特征，均不得写成已知事实；如要提出，须在同一句明确标注“假设”或“待核实”。区分【已知事实】【推断/策略假设】【待核实】，无法判断的地方写出具体调研问题、获取证据的方法和对决策的影响。用户的任务是得到有深度的提案，不是框架清单：每个模块使用清晰的小标题、具体推理和可执行内容，通常写 350—700 个汉字。排版要求：每个【小标题】独占一行，其后换行再写正文；不同小标题之间留一个空行；长段落每 2—3 句换行，不要整节挤成一段。不要空泛地重复 Brief，也不要靠堆砌术语增加篇幅。营销目标、创意、渠道、执行和预算之间必须能相互解释。`

function groupPrompt(groupTitle: string) {
  if (groupTitle === '前期分析') return `${baseGenerationRules}
本轮只写前期分析，按顺序完整输出 brief、pest、consumer、competitor、swot 五个 ID。
brief：明确产品/品牌、目标、受众、地区与节点、资源约束；把“想要的结果”拆成可观察的传播/行为目标，并写清现有证据与资料缺口。
pest：分别分析 P 政策监管、E 经济/价格、S 社会文化/场景、T 技术/平台机制。每维给“可能影响—需要核实什么—对本案的策略含义”；没有资料时不得虚构环境事实，也不必强行宣称每维都是机会。P 维度没有法规原文或审核规则资料时，只能列合规核对问题，不要断言某项法律或平台规则已经适用。
consumer：细分优先人群与次级人群，写使用场景、触发点、动机、障碍、替代行为、信息触点、决策旅程与可验证的洞察假设；模拟画像必须标注假设，不得冒充访谈发现。
competitor：先用用户给的竞品；没有品牌时，用直接竞品类型和替代行为建立比较维度。比较定位/主张、价格或购买门槛、内容与渠道、转化路径、可借鉴与可错位之处；具体品牌动态未知时写待查清单，不要编案例。
swot：S/W 内部、O/T 外部，要回扣前四节，提出 SO/WO/ST/WT 的取舍，并凝练一条“人群矛盾—品牌可提供的价值—传播切口”的核心洞察。SWOT 每格至少两点，避免把推测写成确定结论。
assumptions 列出 3—6 条最关键的待验证判断。`
  if (groupTitle === '主体创意') return `${baseGenerationRules}
本轮只写主体创意，按顺序完整输出 strategy、creative、media、execution 四个 ID。你会收到前期分析，将其用作本案推理依据，但其未证实内容仍是待验证假设。
strategy：给出一句清晰的核心策略与传播主题，并解释为何由洞察推导而来、承接什么产品价值；写传播目标、核心信息、目标受众与差异化表达。可给备选主题，但必须选出主推方向与取舍理由。
creative：至少设计一个主创意和两种配套内容/活动，写具体的参与流程、内容脚本或画面结构、示例文案/话题、用户行动入口、所需素材与交付物。选择适合本项目的形式，不要机械套用视频、海报、挑战赛或小游戏。
media：让渠道分工、内容形式和人群触点一一对应；如需要 KOL/KOC，说明筛选标准、角色、合作交付、审核与追踪口径，不编名单、粉丝量或报价。说明自有、合作与付费媒介如何衔接。
execution：分阶段或分周列出关键动作、负责人角色、交付物、依赖与审批；建立目标—指标—数据来源—复盘频率，无法估计的 KPI 用计算方式和待确认基线表达，不编数字。明确风险及备选方案。
assumptions 列出 2—4 条创意与执行依赖的待验证判断。`
  return `${baseGenerationRules}
本轮只写预算分配，只输出 budget 一个 ID，同时在 JSON 顶层增加 allocations 数组：[{"name":"费用项名称","percent":建议百分比数字,"purpose":"对应的交付或用途"}]。给出 4—7 项与本案创意/渠道吻合的费用项，百分比合计 100，必须有机动预留；不需要的费用项可不列，不要机械套固定比例。程序会根据百分比计算金额并插入正文前面，所以 budget 正文不要自写金额表或再次编造数字。正文写【分配依据】【各项交付与估价依据】【优先级与取舍】【执行监控与调整规则】【待询价/待确认项】；每项要对应前面的创意和渠道。百分比是规划建议，不是报价；不要自行新增无法核验的单价或供应商报价。如果总额未提供，只使用比例与变量，不编金额。assumptions 列出 1—3 条预算依赖。`
}

async function generateDetailedPlan(brief: DemoBrief, config: ModelConfig): Promise<Pick<DemoPlan, 'sections' | 'assumptions'>> {
  const sections: PlanSection[] = []
  const assumptions: string[] = []
  let allocation: BudgetAllocationItem[] = []
  for (const group of planGroups) {
    const context = group.title === '前期分析'
      ? { brief }
      : group.title === '主体创意'
        ? { brief, analysis: sections }
        : { brief, analysisAndCreative: sections }
    let result: ReturnType<typeof parseGroup> | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      const retryInstruction = attempt
        ? '\n上次输出无法完整解析。本次务必输出一个可解析的 JSON 对象：所有正文中的英文双引号必须转义，换行使用 \\n，不要在 JSON 对象外添加文字。每节控制在 300—550 汉字，保留具体分析和动作。'
        : ''
      const content = await callModel([
        { role: 'system', content: groupPrompt(group.title) + retryInstruction },
        { role: 'user', content: JSON.stringify(context) },
      ], config, true, attempt ? 0.1 : 0.4)
      try {
        result = parseGroup(content, group.sections)
        break
      } catch (error) {
        if (!(error instanceof ModelPlanFormatError)) throw error
        if (attempt === 1) throw new Error(`“${group.title}”连续两次未能生成完整内容，请重新生成。`)
      }
    }
    if (!result) throw new Error(`“${group.title}”未能生成完整内容，请重新生成。`)
    sections.push(...result.sections)
    assumptions.push(...result.assumptions)
    if (group.title === '预算分配') allocation = result.allocations
  }
  const budget = sections.find(section => section.id === 'budget')
  if (budget) budget.content = `${buildBudgetAllocation(brief.budget, allocation)}\n\n${budget.content}`
  return {
    sections,
    assumptions: [...new Set(assumptions)].slice(0, 8).concat(assumptions.length ? [] : ['市场、人群、竞品和费用判断需补充可核验资料，再用于正式提案。']),
  }
}

export async function POST(request: NextRequest) {
  if (Number(request.headers.get('content-length')) > 100_000) {
    return NextResponse.json({ error: '项目内容太长，请精简后再试。' }, { status: 413 })
  }
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: '请求格式无效。' }, { status: 400 })
  }
  if (!validateBrief(body.brief)) {
    return NextResponse.json({ error: '先填好项目名称、要推广的内容和这次的目标。' }, { status: 400 })
  }
  const brief: DemoBrief = body.brief
  const action = body.action
  if (action !== 'generate' && action !== 'revise') {
    return NextResponse.json({ error: '不支持的操作。' }, { status: 400 })
  }

  const ai = body.ai && typeof body.ai === 'object' ? body.ai as Record<string, unknown> : null
  const mode = ai?.mode ?? (serverModelIsAvailable(request) ? 'server' : 'demo')
  let config: ModelConfig | null = null
  if (mode === 'personal') {
    const apiKey = typeof ai?.apiKey === 'string' ? ai.apiKey.trim() : ''
    const model = ai?.model
    if (apiKey.length < 16 || apiKey.length > 512 || typeof model !== 'string' || !deepSeekModels.includes(model as DeepSeekModel)) {
      return NextResponse.json({ error: '请在模型设置里填写有效的 DeepSeek Key 和模型。' }, { status: 400 })
    }
    config = { apiKey, model, url: deepSeekUrl }
  } else if (mode === 'server') {
    if (!serverModelIsAvailable(request)) {
      return NextResponse.json({ error: '本机模型未配置。请填写自己的 DeepSeek Key，或切回演示模式。' }, { status: 400 })
    }
    config = {
      apiKey: process.env.AI_API_KEY!,
      model: process.env.AI_MODEL!,
      url: process.env.AI_CHAT_COMPLETIONS_URL || deepSeekUrl,
    }
  } else if (mode !== 'demo') {
    return NextResponse.json({ error: '不支持的模型模式。' }, { status: 400 })
  }

  if (!config) {
    if (action === 'generate') return NextResponse.json({ plan: buildDemoPlan(brief) })
    const section = body.section as PlanSection | undefined
    const instruction = body.instruction
    if (!section || typeof section.content !== 'string' || typeof instruction !== 'string' || !instruction.trim()) {
      return NextResponse.json({ error: '请选择模块并填写修改要求。' }, { status: 400 })
    }
    return NextResponse.json({ suggestion: buildDemoRevision(section, instruction, brief), mode: 'demo' })
  }

  try {
    if (action === 'generate') {
      const parsed = await generateDetailedPlan(brief, config)
      return NextResponse.json({
        plan: { ...parsed, mode: 'ai', createdAt: new Date().toISOString() } satisfies DemoPlan,
      })
    }
    const section = body.section as PlanSection | undefined
    const instruction = body.instruction
    if (!section || typeof section.content !== 'string' || typeof instruction !== 'string' || !instruction.trim()) {
      return NextResponse.json({ error: '请选择模块并填写修改要求。' }, { status: 400 })
    }
    const suggestion = await callModel([
      {
        role: 'system',
        content: '你是资深营销方案编辑。只修改指定模块，遵循用户的修改要求，同时保留“分析依据—策略判断—具体动作”的逻辑和原有必要细节。不得添加未经证实的市场事实、调研样本、效果数字、竞品动态、KOL 报价或来源；把不确定内容标为待核实。若修改预算模块，保证各项金额合计与用户给定总额一致。只输出修改后的模块正文，不要解释。',
      },
      {
        role: 'user',
        content: JSON.stringify({
          project: brief,
          module: { title: section.title, content: section.content.slice(0, 6000) },
          instruction: instruction.slice(0, 1000),
        }),
      },
    ], config)
    return NextResponse.json({ suggestion: suggestion.trim().slice(0, 7000), mode: 'ai' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成失败，请稍后重试。' },
      { status: 502 },
    )
  }
}
