export type DemoBrief = {
  projectName: string
  product: string
  audience: string
  goal: string
  budget: string
  channels: string
  knownFacts?: string
  evidenceSources?: string
  marketContext?: string
  competitors?: string
  attachments?: Array<{ name: string; text: string; truncated: boolean }>
}

export type PlanSection = {
  id: string
  title: string
  content: string
  references?: PlanReference[]
}

export type PlanReference = {
  title: string
  url: string
  siteName?: string
  publishedAt?: string
}

export type DemoPlan = {
  mode: 'demo' | 'ai'
  sections: PlanSection[]
  assumptions: string[]
  createdAt: string
}

export const emptyBrief: DemoBrief = {
  projectName: '',
  product: '',
  audience: '',
  goal: '',
  budget: '',
  channels: '',
  marketContext: '',
  competitors: '',
  attachments: [],
}

export const exampleBrief: DemoBrief = {
  projectName: '轻醒咖啡｜办公室午后场景验证',
  product: '低糖冷萃咖啡，面向办公室场景，提供单瓶购买与团队拼单。',
  audience: '一二线城市、经常在下午工作时段购买饮品的办公室人群。',
  goal: '验证午后场景的内容吸引力，并获得首批购买意向。',
  budget: '首轮测试预算 5000 元，周期 4 周。',
  channels: '小红书、社群',
  knownFacts: '',
  evidenceSources: '',
  attachments: [],
  marketContext: '中国一二线城市办公室的日常午后场景；首轮为 4 周验证，不绑定节日。',
  competitors: '便利店现制咖啡、外卖咖啡及其他午后饮品是待比较的替代选择；尚未指定品牌。',
}

export const planGroups: ReadonlyArray<{ title: string; sections: ReadonlyArray<readonly [string, string]> }> = [
  { title: '前期分析', sections: [
    ['brief', '项目背景与目标'],
    ['pest', 'PEST 环境分析'],
    ['consumer', '消费者分析'],
    ['competitor', '竞品与替代选择'],
    ['swot', 'SWOT 与核心洞察'],
  ] },
  { title: '主体创意', sections: [
    ['strategy', '核心策略与主题'],
    ['creative', '创意内容与活动'],
    ['media', '媒介与 KOL 策略'],
    ['execution', '执行排期与效果评估'],
  ] },
  { title: '预算分配', sections: [
    ['budget', '预算明细与调整'],
  ] },
]

export function isLegacyPlan(plan: DemoPlan) {
  return plan.sections.some(section => !planGroups.some(group => group.sections.some(([id]) => id === section.id)))
}

export function planGroupTitle(id: string, plan?: DemoPlan) {
  if (plan && isLegacyPlan(plan)) return '旧版初稿'
  return planGroups.find(group => group.sections.some(([sectionId]) => sectionId === id))?.title || '旧版方案'
}

export function validateBrief(value: unknown): value is DemoBrief {
  if (!value || typeof value !== 'object') return false
  const brief = value as Record<string, unknown>
  return (['projectName', 'product', 'audience', 'goal', 'budget', 'channels'] as const)
    .every(key => typeof brief[key] === 'string' && brief[key].length <= 4000)
    && (['marketContext', 'competitors', 'knownFacts', 'evidenceSources'] as const).every(key => brief[key] === undefined || (typeof brief[key] === 'string' && brief[key].length <= 4000))
    && (brief.attachments === undefined || (Array.isArray(brief.attachments) && brief.attachments.length <= 4
      && brief.attachments.every((item: unknown) => {
        if (!item || typeof item !== 'object') return false
        const attachment = item as Record<string, unknown>
        return typeof attachment.name === 'string' && attachment.name.trim().length > 0 && attachment.name.length <= 180
          && typeof attachment.text === 'string' && attachment.text.trim().length > 0 && attachment.text.length <= 10_000
          && typeof attachment.truncated === 'boolean'
      })))
    && ['projectName', 'product', 'goal'].every(key => String(brief[key]).trim().length > 0)
}

export function buildDemoPlan(brief: DemoBrief): DemoPlan {
  const withoutEnding = (value: string) => value.trim().replace(/[。.!！?？；;]+$/u, '')
  const channels = brief.channels.trim() || '待选择渠道'
  const audience = brief.audience.trim() || '待确认的目标用户'
  const budget = brief.budget.trim() || '预算与周期待确认'
  const market = brief.marketContext?.trim() || '尚未提供地区、行业与营销节点'
  const competitors = brief.competitors?.trim() || '尚未提供竞品或替代选择'
  return {
    mode: 'demo',
    createdAt: new Date().toISOString(),
    sections: [
      {
        id: 'brief',
        title: '项目背景与目标',
        content: `【项目界定】\n推广对象：${withoutEnding(brief.product)}。\n目标：${withoutEnding(brief.goal)}。\n市场与节点：${withoutEnding(market)}。\n资源边界：${withoutEnding(budget)}；优先考虑 ${channels}。\n\n【需要补齐】\n把目标写成可观察的用户行动，确定基线、统计口径与时间窗口。区分品牌认知、内容互动和购买意向，不要把曝光量直接当作销售成果。确认产品卖点、购买路径、可用素材和审批限制。`,
      },
      {
        id: 'pest',
        title: 'PEST 环境分析',
        content: `【P 政策】查目标市场的广告、平台、产品宣称及行业规则；目前没有资料，不能写成有利政策。\n【E 经济】核对目标人群的价格敏感度、替代品价格、消费频次与试购门槛。\n【S 社会】观察 ${audience} 在该场景中的习惯、情绪与分享动机。\n【T 技术】确认 ${channels} 的内容形式、投放能力、数据回传和转化链路。\n\n【策略影响】先筛出最可能影响本项目的两项外部因素，并记录证据来源、日期和对创意或预算的影响。`,
      },
      {
        id: 'consumer',
        title: '消费者分析',
        content: `【优先人群】${audience}。先写明使用或购买场景、触发时刻、决策障碍、常见替代方式和可能的内容触点。\n【待验证旅程】从看见内容、产生兴趣、比较选择，到表达意向或购买，每一步记录用户会问什么、品牌要给出什么证据。\n【调研办法】访谈不同购买频次的目标用户，复盘评论与搜索词，观察实际购买路径；记录样本来源和反例。不要把模拟画像写成真实访谈结论。`,
      },
      {
        id: 'competitor',
        title: '竞品与替代选择',
        content: `【比较对象】${competitors}。先选 2—3 个直接竞品或替代行为，不只比较同品类品牌。\n【比较维度】逐项记录定位与价格、核心卖点、主要场景、内容表达、渠道与转化入口、用户评价中反复出现的疑问。标明观察日期和链接。\n【可借鉴与可避开】找出被重复使用的表达和仍未被回答的用户问题；在没有实际资料前，只能列为调查方向，不把某品牌的表现写成事实。`,
      },
      {
        id: 'swot',
        title: 'SWOT 与核心洞察',
        content: `【S 优势】先从用户提供的产品描述中找可被证明的优势：${brief.product.trim()}。\n【W 劣势】检查品牌认知、渠道资源、价格与体验上的真实短板。\n【O 机会】从 PEST、消费者情境和竞品空白中筛选有证据的机会。\n【T 威胁】考虑同类替代、平台成本、效果不稳定及合规限制。\n\n【由分析到洞察】目前只能提出假设：目标人群在特定时刻可能需要一个更明确的选择理由。下一步要用访谈、评论和小规模内容测试验证，而不是直接把假设当结论。`,
      },
      {
        id: 'strategy',
        title: '核心策略与主题',
        content: `【策略主张】围绕“${withoutEnding(brief.goal)}”，暂以具体使用场景建立产品与人群的关联。把目标拆成“看见—理解—行动”三步，每一步只传递一个最重要的信息。\n【传播主题】先拟 2 个不同角度的主题：一个强调场景需求，一个强调产品差异。用用户反馈选择最终版本。主题必须能解释产品为什么适合这一时刻，不能只是一句好听的口号。\n【待核实】主题所依赖的受众动机和产品承诺，需要回到前期分析核对。`,
      },
      {
        id: 'creative',
        title: '创意内容与活动',
        content: `【主创意】设计一个能把产品放入真实使用场景的内容：开头呈现具体问题，中段展示使用过程，结尾给出清晰行动入口。\n【内容组合】准备一支主视频的分镜提纲、两组不同切角的短内容、可复用的静态图文和评论区答疑。逐项写明核心信息、素材规格、交付数量与负责人。\n【互动玩法】仅在与目标人群和预算匹配时加入话题挑战或线下活动，明确参与步骤、奖品成本、审核与风险。不要为了“完整”堆叠不必要的玩法。`,
      },
      {
        id: 'media',
        title: '媒介与 KOL 策略',
        content: `【渠道分工】优先测试 ${channels}。为每个渠道定义任务：种草、答疑、引流或转化，避免同一内容无差别分发。\n【合作对象】如使用 KOL/KOC，先按受众匹配、内容可信度、历史互动质量和报价选择；名单、报价与效果都要单独核实。\n【投放与回收】为每条内容加可区分的链接或口令，记录发布时间、素材版本、花费和用户行动。小预算先做少量测试，达到预设信号后再追加。`,
      },
      {
        id: 'execution',
        title: '执行排期与效果评估',
        content: `【准备期】核对产品和市场资料，确认主题、素材需求、审批人、追踪方式和预算上限。\n【上线期】先发布小样本内容，记录各渠道实际触达、互动、有效咨询与购买意向，逐周复盘。\n【优化期】一次只调整一个主要变量，保留旧素材与数据口径；没有随机分流时称为对比观察。\n【结果判断】对照“${withoutEnding(brief.goal)}”选择主指标，另设成本与内容质量指标。所有 KPI 应在拿到基线和渠道报价后再定数字。`,
      },
      {
        id: 'budget',
        title: '预算明细与调整',
        content: `${buildBudgetAllocation(brief.budget)}\n\n【支出依据】每一项都需要对应具体交付物、数量、单价或估算依据，并注明是否含税。未拿到报价前，这只是建议分配，不是采购价格。\n【调整规则】先保留测试和机动空间；若主指标未达预设阈值，暂停追加投放，优先修改素材或入口。结案时对照计划与实际金额，解释差额及效果。`,
      },
    ],
    assumptions: [
      '目标人群是否真的有这个需求，还需要用资料或访谈验证。',
      '渠道是否合适，需要用实际发布或投放数据观察。',
      '这里不会自动核验你填写的资料，也没有足够数据预测转化效果。',
    ],
  }
}

export type BudgetAllocationItem = { name: string; percent: number; purpose?: string }

export function buildBudgetAllocation(input: string, proposed?: BudgetAllocationItem[]) {
  const match = input.match(/(?:预算[^\d]{0,12})?(\d+(?:\.\d+)?)\s*(万)?\s*元/u)
  const amount = match ? Math.round(Number(match[1]) * (match[2] ? 10_000 : 1)) : null
  const fallback: BudgetAllocationItem[] = [
    { name: '前期调研与验证', percent: 10 },
    { name: '创意与内容制作', percent: 25 },
    { name: 'KOL/KOC 与合作', percent: 25 },
    { name: '媒介投放与渠道执行', percent: 30 },
    { name: '机动与风险预留', percent: 10 },
  ]
  const valid = proposed?.filter(item => item.name.trim() && Number.isFinite(item.percent) && item.percent >= 0)
  const source = valid && valid.length >= 3 && valid.length <= 8 && valid.some(item => item.percent > 0) ? valid : fallback
  const totalWeight = source.reduce((sum, item) => sum + item.percent, 0)
  const rawPercentages = source.map(item => item.percent / totalWeight * 100)
  const percentages = rawPercentages.map(value => Math.floor(value))
  let remainder = 100 - percentages.reduce((sum, value) => sum + value, 0)
  const byFraction = rawPercentages.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction)
  for (const item of byFraction) {
    if (remainder-- <= 0) break
    percentages[item.index]++
  }
  const allocations = source.map((item, index) => ({ ...item, percent: percentages[index] }))
  if (!amount || amount <= 0) {
    return `【建议分配｜总预算待确认】\n${allocations.map(item => `• ${item.name}：${item.percent}%${item.purpose ? `｜${item.purpose}` : ''}`).join('\n')}\n先确定总预算、报价和资源可用性，再换算金额。`
  }
  let allocated = 0
  const lines = allocations.map((item, index) => {
    const { name, percent } = item
    const value = index === allocations.length - 1 ? amount - allocated : Math.round(amount * percent / 100)
    allocated += value
    return `• ${name}：${value.toLocaleString('zh-CN')} 元（${percent}%）${item.purpose ? `｜${item.purpose}` : ''}`
  })
  return `【建议分配｜总额 ${amount.toLocaleString('zh-CN')} 元】\n${lines.join('\n')}\n合计：${allocated.toLocaleString('zh-CN')} 元。以上是规划额度，不代表供应商报价。`
}

export function buildDemoRevision(section: PlanSection, instruction: string, brief: DemoBrief) {
  return `你想调整的是：${instruction.trim().replace(/[。.!！?？；;]+$/u, '')}。\n可以补上具体动作、负责人、完成时间，以及判断是否达到“${brief.goal.trim().replace(/[。.!！?？；;]+$/u, '')}”的指标。涉及用户需求或效果的说法，先找到证据再写成结论。`
}
