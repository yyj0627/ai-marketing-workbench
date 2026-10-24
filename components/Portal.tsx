'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowRight, ArrowUpRight, ArrowsClockwise, CaretDown, CaretRight, ChartBar, Check, CheckCircle, ClockCounterClockwise, Copy, CreditCard, DownloadSimple, FileArrowUp, FileText, FloppyDisk, GearSix, House, Lightning, ListBullets, LockKey, MagicWand, MagnifyingGlass, PaperPlaneTilt, Plus, Receipt, SignOut, Sparkle, SpinnerGap, SquaresFour, Target, UsersThree, WarningCircle, X } from '@phosphor-icons/react'
import { generations, modules, orders, projects, users } from '@/lib/mock-data'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { saveProjectDraft } from '@/app/actions/projects'
import type { PlanHistoryItem, ProjectDetail as ProjectDetailRecord, SavedProject } from '@/lib/project-types'

type View = 'home' | 'pricing' | 'faq' | 'login' | 'register' | 'projects' | 'new-project' | 'project' | 'editor' | 'history' | 'billing' | 'admin' | 'users' | 'generations' | 'orders'

const nav = { app: [['项目工作台', '/app/projects', 'projects'], ['历史记录', '/app/history', 'history'], ['体验说明', '/app/billing', 'billing']], admin: [['运营概览', '/admin', 'admin'], ['用户管理', '/admin/users', 'users'], ['生成记录', '/admin/generations', 'generations'], ['支付订单', '/admin/orders', 'orders']] }
const iconMap = { projects: SquaresFour, history: ClockCounterClockwise, billing: CreditCard, admin: ChartBar, users: UsersThree, generations: Sparkle, orders: Receipt }

type PortalData = {
  projects?: SavedProject[]
  project?: ProjectDetailRecord | null
  history?: PlanHistoryItem[]
  initialProject?: SavedProject | null
  loadError?: string | null
}

export function Portal({ view, data }: { view: View; data?: PortalData }) {
  if (['home', 'pricing', 'faq'].includes(view)) return <Marketing view={view} />
  if (['login', 'register'].includes(view)) return <Auth view={view} />
  if (['admin', 'users', 'generations', 'orders'].includes(view)) return <Admin view={view} />
  return <Workspace view={view} data={data} />
}

function Brand({ compact = false }: { compact?: boolean }) { return <Link className="brand" href="/"><span className="brand-mark"><Sparkle size={17} weight="fill" /></span>{!compact && <span>策划台</span>}</Link> }
function Status({ children }: { children: string }) { return <span className={`status status--${children === '失败' || children === '限额' ? 'alert' : children === '草稿' || children === '编辑中' ? 'draft' : 'good'}`}>{children}</span> }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function Button({ children, href, kind = 'primary', icon = true }: { children: React.ReactNode; href?: string; kind?: 'primary' | 'quiet' | 'outline'; icon?: boolean }) { const content = <>{children}{icon && <ArrowRight size={16} />}</>; return href ? <Link className={`button button--${kind}`} href={href}>{content}</Link> : <button className={`button button--${kind}`}>{content}</button> }

function Marketing({ view }: { view: View }) {
  const faqs = [
    ['资料还没准备齐，可以先开始吗？', '可以。先填项目名称、产品或服务，以及这次想达成的目标。受众、预算和渠道不确定时可以先留空，之后再补。'],
    ['初稿出来后，能自己改吗？', '能。每一段都可以直接编辑；你也可以写下想改的地方，先看修改建议，再决定要不要采用。'],
    ['它会自动查资料、验证数据吗？', '目前不会。你填写的资料来源会和方案一起保留，但系统不会替你核验市场数据或用户结论。'],
    ['现在生成的是 AI 内容吗？', '看工作台顶部的生成方式：演示模式由规则生成；选择本机 DeepSeek 或填入自己的 Key 后，才会调用模型。初稿会标明生成方式。'],
    ['方案保存在哪里？', '点击“保存到浏览器”后，需求和方案会留在当前浏览器。清除浏览器数据可能会删除它，建议下载一份备用。'],
    ['可以把方案下载下来吗？', '可以下载 Word 或 PPT 文件，继续修改和分享。'],
  ]
  const features = [
    { Icon: Target, title: '围绕真实项目', description: '从产品、目标用户和营销目标出发，明确方案的背景与边界。' },
    { Icon: MagicWand, title: '生成结构化初稿', description: '从前期分析、主体创意到预算分配，逐段搭起完整提案。' },
    { Icon: ClockCounterClockwise, title: '逐模块打磨', description: '直接编辑各部分内容，按需获取修改方向。' },
    { Icon: DownloadSimple, title: '保存与导出', description: '保存到当前浏览器，或下载 Word、PPT 文件继续编辑。' },
  ]
  return <div className="site-shell">
    <header className="site-nav">
      <Brand />
      <nav><Link className={view === 'home' ? 'active' : ''} href="/">产品</Link><Link href="/demo">体验工作台</Link><Link className={view === 'faq' ? 'active' : ''} href="/www/faq">FAQ</Link></nav>
      <div className="nav-actions">{isSupabaseConfigured() && <Link href="/app/login">登录</Link>}<Button href="/demo" icon={false}>打开演示</Button></div>
    </header>
    {view === 'home' && <>
      <main className="hero">
        <div className="hero-copy">
          <p className="kicker">AI 营销方案工作台</p>
          <h1>从营销需求到完整方案</h1>
          <p>整理项目背景，生成策略、渠道、执行与复盘的结构化初稿，再逐模块打磨。你可以直接体验，无需注册。</p>
          <div className="hero-actions"><Button href="/demo">体验可交互工作台</Button><Button href="/www/faq" kind="outline" icon={false}>了解工作方式</Button></div>
        </div>
        <div className="hero-media"><Image priority src="/images/product-demo-v2.png" alt="策划台工作台的方案编辑界面" fill sizes="(max-width: 900px) 100vw, 50vw" /></div>
      </main>
      <section className="marketing-section intro-grid">
        <div><p className="kicker">让方案有结构</p><h2>方案每一步都有迹可循</h2></div>
        <div className="feature-list">{features.map(({ Icon, title, description }) => <div key={title}><Icon size={22} /><h3>{title}</h3><p>{description}</p></div>)}</div>
      </section>
    </>}
    {view === 'pricing' && <MarketingPage title="先试一份方案" description="工作台目前开放免费演示，不需要选套餐。"><div className="pricing-note"><h2>现在就能体验</h2><p>填写项目需求、生成演示初稿、逐段修改，并下载 Word 或 PPT 文件。默认内容会标明是演示生成。</p><Button href="/demo">打开工作台</Button></div></MarketingPage>}
    {view === 'faq' && <MarketingPage title="常见问题" description="开始之前，你可能想知道这些。"><div className="faq-list">{faqs.map(([q,a]) => <details key={q}><summary>{q}<CaretRight size={18}/></summary><p>{a}</p></details>)}</div></MarketingPage>}
  </div>
}
function MarketingPage({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <main className="marketing-page"><p className="kicker">策划台</p><h1>{title}</h1><p className="lead">{description}</p>{children}</main> }
function Auth({ view }: { view: View }) {
  const router = useRouter()
  const login = view === 'login'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const configured = isSupabaseConfigured()

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!configured) {
      setError('请先在项目根目录的 .env.local 中填写 Supabase URL 和 Publishable Key。')
      return
    }

    setSubmitting(true)
    const supabase = createClient()

    if (login) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        setError(signInError.message)
        setSubmitting(false)
        return
      }

      router.replace('/app/projects')
      router.refresh()
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/app/projects`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setSubmitting(false)
      return
    }

    if (data.session) {
      router.replace('/app/projects')
      router.refresh()
      return
    }

    setNotice('注册成功。请查收确认邮件，完成验证后会自动进入项目工作台。')
    setSubmitting(false)
  }

  return <main className="auth-page"><div className="auth-side"><Brand /><div><p className="kicker">一个项目，一份方案</p><h1>把营销想法<br />慢慢写成方案。</h1><p>先写下手头的信息，再回来接着改。</p></div></div><section className="auth-card"><Link className="back-link" href="/">返回官网</Link><h2>{login ? '欢迎回来' : '创建你的账号'}</h2><p>{login ? '登录后继续编辑你的营销项目。' : '先从一个营销项目开始。'}</p><form onSubmit={submit}><label>邮箱<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@company.com" autoComplete="email" required /></label><label>密码<input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="至少 8 个字符" autoComplete={login ? 'current-password' : 'new-password'} minLength={8} required /></label>{!login && <label>显示名称<input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="你的称呼" autoComplete="name" required /></label>}<button className="button button--primary auth-submit" type="submit" disabled={submitting || !configured}>{submitting ? '正在处理...' : login ? '登录' : '注册并开始'}</button></form>{!configured && <div className="auth-setup-note">账号登录尚未配置。你可以先<Link href="/demo">直接体验工作台</Link>，无需注册。</div>}{error && <p className="form-note" role="alert">{error}</p>}{notice && <p className="form-note" role="status">{notice}</p>}<p className="form-note">{login ? '还没有账号？' : '已有账号？'} <Link href={login ? '/app/register' : '/app/login'}>{login ? '注册' : '登录'}</Link></p></section></main>
}

function Workspace({ view, data }: { view: View; data?: PortalData }) { if (view === 'editor') return <EnhancedPlanEditor /> ; const titles: Record<string, [string,string]> = { projects: ['项目工作台','把项目资料和方案放在一起，方便回来继续改。'], 'new-project': [data?.initialProject ? '编辑营销项目' : '创建营销项目', data?.initialProject ? '修改项目资料后，保存到你的项目工作台。' : '补充项目信息并保存项目草稿；方案生成请先体验演示工作台。'], project: [data?.project?.name ?? '项目详情', data?.project ? `${data.project.type} | 最近更新于 ${formatDate(data.project.updatedAt)}` : '查看项目资料和方案版本。'], history: ['历史记录','保存过的方案和修改记录会出现在这里。'], billing: ['体验说明','这里还没有开放付费套餐。你可以先试用演示工作台。'] }; return <div className="product-shell"><Side kind="app" active={view}/><main className="product-main"><ProductTop /><header className="page-heading"><div><p className="kicker">App</p><h1>{titles[view][0]}</h1><p>{titles[view][1]}</p></div>{view === 'projects' && <Button href="/app/projects/new"><Plus size={16}/>新建项目</Button>}</header>{view === 'projects' && <ProjectWorkspace savedProjects={data?.projects ?? []} loadError={data?.loadError ?? null} />}{view === 'new-project' && <NewProject initialProject={data?.initialProject ?? null} />}{view === 'project' && <ProjectDetail project={data?.project ?? null} loadError={data?.loadError ?? null} />}{view === 'history' && <VersionHistory items={data?.history ?? []} loadError={data?.loadError ?? null} />}{view === 'billing' && <Billing />}</main></div> }
function ProductTop() {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const signOut = async () => {
    if (!isSupabaseConfigured()) return
    setSigningOut(true)
    await createClient().auth.signOut()
    router.replace('/app/login')
    router.refresh()
  }

  return <div className="product-top"><button title="搜索" className="icon-button"><MagnifyingGlass size={19}/></button><div className="avatar">林</div><button title="退出登录" aria-label="退出登录" className="icon-button" onClick={signOut} disabled={signingOut}><SignOut size={19}/></button></div>
}
function Side({ kind, active }: { kind: 'app' | 'admin'; active: View }) { return <aside className="side"><Brand /><nav>{nav[kind].map(([label,href,key]) => { const Icon = iconMap[key as keyof typeof iconMap]; return <Link key={key} className={active === key ? 'side-active' : ''} href={href}><Icon size={18}/><span>{label}</span></Link> })}</nav><div className="side-bottom"><Link href="/"><House size={18}/><span>前往官网</span></Link><button><GearSix size={18}/><span>设置</span></button></div></aside> }
function Projects() { return <><div className="quick-grid"><Link href="/app/projects/new"><Plus size={20}/><span>从空白项目开始</span><small>自定义完整营销需求</small></Link><Link href="/app/projects/new"><Lightning size={20}/><span>新品上市</span><small>面向产品推广与首发</small></Link><Link href="/app/projects/new"><UsersThree size={20}/><span>节日活动</span><small>规划主题、节奏和转化</small></Link></div><section className="panel"><div className="panel-head"><h2>最近项目</h2><button className="text-button">查看全部</button></div><div className="project-list">{projects.map(p => <Link href={`/app/projects/${p.id}`} key={p.id} className="project-row"><span className="project-initial">{p.name.slice(0,1)}</span><div><strong>{p.name}</strong><small>{p.type} | {p.updated}</small></div><span className="project-progress">{p.progress}%</span><Status>{p.status}</Status><CaretRight size={18}/></Link>)}</div></section><section className="empty-strip"><FileText size={22}/><div><strong>暂无归档项目</strong><p>完成并导出方案后，项目可以归档到这里。</p></div></section></> }
function NewProject({ initialProject }: { initialProject: SavedProject | null }) {
  const router = useRouter()
  const sample = { name: '轻醒咖啡新品上市', type: '新品上市', description: '一款面向办公室人群的低糖冷萃咖啡，提供午后轻提神与办公室订阅配送。', audience: '一二线城市 25-34 岁知识工作者。午后注意力下降，但不愿承担传统咖啡带来的晚间失眠风险。', goals: ['曝光', '转化'], points: ['低糖配方，减少负担', '午后轻提神，不影响晚间休息', '办公室订阅配送，降低首次购买门槛'], period: '2026 年 8 月，4 周', budget: '中预算', channels: ['小红书', '视频号', '社群'], tone: '增长导向', note: '希望优先验证小红书内容种草与办公室拼单的转化效率。' }
  const empty = { name: '', type: '', description: '', audience: '', goals: [] as string[], points: ['', '', ''], period: '', budget: '', channels: [] as string[], tone: '', note: '' }
  const initialForm = initialProject ? { name: initialProject.name, type: initialProject.type, description: initialProject.productDescription, audience: initialProject.targetAudience, goals: initialProject.goals, points: initialProject.sellingPoints.length ? initialProject.sellingPoints : ['', '', ''], period: initialProject.timeline ?? '', budget: initialProject.budgetRange ?? '', channels: initialProject.channels, tone: initialProject.tone ?? '', note: '' } : empty
  const [form, setForm] = useState(initialForm)
  const [draftId, setDraftId] = useState(initialProject?.id ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')
  const [checking, setChecking] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const update = (key: keyof typeof empty, value: string | string[]) => setForm(current => ({ ...current, [key]: value }))
  const toggle = (key: 'goals' | 'channels', value: string) => update(key, form[key].includes(value) ? form[key].filter(item => item !== value) : [...form[key], value])
  const validate = () => {
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = '请填写项目名称。'
    if (!form.type) next.type = '请选择项目类型。'
    if (!form.description.trim()) next.description = '请介绍产品或服务。'
    if (!form.audience.trim()) next.audience = '请描述目标用户。'
    if (!form.goals.length) next.goals = '至少选择一个营销目标。'
    const pointCount = form.points.filter(point => point.trim()).length
    if (pointCount < 3 || pointCount > 5) next.points = '请填写 3-5 条核心卖点。'
    setErrors(next)
    return Object.keys(next).length === 0
  }
  const validateDraft = () => {
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = '请填写项目名称后再保存草稿。'
    if (!form.type) next.type = '请选择项目类型后再保存草稿。'
    setErrors(next)
    return Object.keys(next).length === 0
  }
  const persistDraft = async () => {
    setSaveState('saving')
    setNotice('正在保存项目草稿...')
    const result = await saveProjectDraft({ projectId: draftId || undefined, name: form.name, type: form.type, productDescription: form.description, targetAudience: form.audience, goals: form.goals, sellingPoints: form.points, timeline: form.period, budgetRange: form.budget, channels: form.channels, tone: form.tone })
    if (!result.ok) {
      setSaveState('error')
      setNotice(`保存失败：${result.error}`)
      return null
    }
    setDraftId(result.projectId)
    setSaveState('success')
    setNotice(`草稿已保存于 ${formatDate(result.updatedAt)}。`)
    router.refresh()
    return result.projectId
  }
  const saveDraft = async () => { if (!validateDraft()) { setSaveState('error'); setNotice('请先补充项目名称和项目类型。'); return }; await persistDraft() }
  const generate = async (event: React.FormEvent) => { event.preventDefault(); if (!validate()) { setSaveState('error'); setNotice('请先补全标记为必填的信息。'); return }; setGenerating(true); const projectId = await persistDraft(); if (projectId) router.push(`/app/projects/${projectId}`); setGenerating(false) }
  const complete = [form.name, form.type, form.description, form.audience].filter(Boolean).length + (form.goals.length ? 1 : 0) + (form.points.filter(Boolean).length >= 3 ? 1 : 0)
  const goalOptions = ['曝光', '获客', '转化', '留存', '招商', '品牌认知']
  const channelOptions = ['小红书', '抖音', '公众号', '视频号', '社群', '线下活动', '广告投放']
  return <form className="project-form project-form--rich" onSubmit={generate} noValidate>
    <section className="form-block"><div className="form-block__head"><span className="form-step">项目基础</span><p>先写清楚这次要推广什么。</p></div><label>项目名称 <b>*</b><input value={form.name} onChange={event => update('name', event.target.value)} placeholder="例如：轻醒咖啡新品上市" aria-invalid={Boolean(errors.name)} />{errors.name && <em className="form-error"><WarningCircle size={15}/>{errors.name}</em>}</label><label>项目类型 <b>*</b><select value={form.type} onChange={event => update('type', event.target.value)} aria-invalid={Boolean(errors.type)}><option value="">请选择项目类型</option>{['新品上市', '活动推广', '品牌传播', '渠道增长', '线下活动'].map(option => <option key={option}>{option}</option>)}</select>{errors.type && <em className="form-error"><WarningCircle size={15}/>{errors.type}</em>}</label><label>产品或服务介绍 <b>*</b><textarea value={form.description} onChange={event => update('description', event.target.value)} placeholder="它是什么，为谁解决什么问题？" aria-invalid={Boolean(errors.description)} />{errors.description && <em className="form-error"><WarningCircle size={15}/>{errors.description}</em>}</label></section>
    <section className="form-block"><div className="form-block__head"><span className="form-step">营销判断</span><p>写下你了解的用户，以及这次最想达成的事。</p></div><label>目标用户 <b>*</b><textarea value={form.audience} onChange={event => update('audience', event.target.value)} placeholder="描述人群、场景和核心痛点" aria-invalid={Boolean(errors.audience)} />{errors.audience && <em className="form-error"><WarningCircle size={15}/>{errors.audience}</em>}</label><fieldset className={errors.goals ? 'field-error' : ''}><legend>营销目标 <b>*</b></legend><div className="choice-grid">{goalOptions.map(option => <button type="button" className={form.goals.includes(option) ? 'choice-active' : ''} onClick={() => toggle('goals', option)} key={option}>{form.goals.includes(option) && <Check size={14} weight="bold" />}{option}</button>)}</div>{errors.goals && <em className="form-error"><WarningCircle size={15}/>{errors.goals}</em>}</fieldset></section>
    <section className="form-block form-block--wide"><div className="form-block__head"><span className="form-step">方案边界</span><p>预算、时间和渠道没定下来，可以先留空。</p></div><div className="form-split"><label>活动周期<input value={form.period} onChange={event => update('period', event.target.value)} placeholder="例如：4 周或 2026 年 8 月" /></label><label>预算范围<select value={form.budget} onChange={event => update('budget', event.target.value)}><option value="">暂不设定</option>{['低预算', '中预算', '高预算', '待定'].map(option => <option key={option}>{option}</option>)}</select></label><label>风格偏好<select value={form.tone} onChange={event => update('tone', event.target.value)}><option value="">暂不设定</option>{['专业', '年轻', '增长导向', '温暖', '高端'].map(option => <option key={option}>{option}</option>)}</select></label></div><fieldset><legend>渠道偏好</legend><div className="choice-grid choice-grid--channels">{channelOptions.map(option => <button type="button" className={form.channels.includes(option) ? 'choice-active' : ''} onClick={() => toggle('channels', option)} key={option}>{form.channels.includes(option) && <Check size={14} weight="bold" />}{option}</button>)}</div></fieldset></section>
    <section className="form-block form-block--wide"><div className="form-block__head"><span className="form-step">核心卖点</span><p>先写 3—5 个你最想让人记住的点。</p></div><div className={errors.points ? 'selling-points field-error' : 'selling-points'}>{form.points.map((point, index) => <label key={index}>卖点 {index + 1}<input value={point} onChange={event => update('points', form.points.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder="例如：低糖配方，减少午后负担" />{form.points.length > 3 && <button title="删除卖点" type="button" className="remove-point" onClick={() => update('points', form.points.filter((_, itemIndex) => itemIndex !== index))}><X size={15}/></button>}</label>)}</div>{form.points.length < 5 && <button type="button" className="add-point" onClick={() => update('points', [...form.points, ''])}><Plus size={15}/>添加卖点</button>}{errors.points && <em className="form-error"><WarningCircle size={15}/>{errors.points}</em>}</section>
    <section className="form-block form-block--wide"><div className="form-block__head"><span className="form-step">补充资料</span><p>当前为视觉占位，不会上传或读取任何文件。</p></div><div className="upload-placeholder"><span><FileArrowUp size={22}/></span><div><strong>产品资料、竞品资料或旧方案</strong><small>文件上传将在接入存储服务后开放</small></div><button type="button" className="button button--outline">选择文件</button></div><label>文字备注<textarea value={form.note} onChange={event => update('note', event.target.value)} placeholder="补充已有判断、不可触碰的限制或其他背景信息" /></label></section>
    <section className="preflight form-block--wide"><button type="button" className="preflight-toggle" onClick={() => setChecking(!checking)}><span><CheckCircle size={18} weight="fill" />生成前检查</span><span>{complete}/6 项必填已完成 <CaretDown size={17} className={checking ? 'caret-open' : ''}/></span></button>{checking && <div className="preflight-body">{[['项目名称', Boolean(form.name)], ['项目类型', Boolean(form.type)], ['产品或服务介绍', Boolean(form.description)], ['目标用户', Boolean(form.audience)], ['营销目标', Boolean(form.goals.length)], ['3-5 条核心卖点', form.points.filter(point => point.trim()).length >= 3]].map(([label, done]) => <div key={String(label)} className={done ? 'check-done' : 'check-pending'}>{done ? <Check size={15} weight="bold"/> : <span />}{label}<small>{done ? '已填写' : '待补充'}</small></div>)}</div>}</section>
    <div className="form-actions form-actions--rich"><span aria-live="polite" className={`form-action-notice form-action-notice--${saveState}`}>{notice || '必填信息完整后，可保存项目草稿。'}</span><button className="button button--outline" type="button" onClick={() => { setForm(sample); setSaveState('idle'); setNotice('已填入示例项目，可继续修改后保存。') }} disabled={saveState === 'saving' || generating}>填入示例项目</button><button className="button button--outline" type="button" onClick={saveDraft} disabled={saveState === 'saving' || generating}>{saveState === 'saving' && !generating ? <><SpinnerGap className="spin" size={16}/>正在保存</> : '保存草稿'}</button><button className="button button--primary" type="submit" disabled={generating || saveState === 'saving'}>{generating ? <><SpinnerGap className="spin" size={17}/>正在保存项目</> : <>保存并查看项目<ArrowRight size={16}/></>}</button></div>
  </form>
}
function ProjectDetail({ project, loadError }: { project: ProjectDetailRecord | null; loadError: string | null }) {
  if (loadError) return <section className="workspace-no-result"><WarningCircle size={24}/><strong>项目读取失败</strong><p>{loadError}</p><Link className="button button--outline" href="/app/projects">返回项目工作台</Link></section>
  if (!project) return <section className="workspace-no-result"><FileText size={24}/><strong>找不到这个项目</strong><p>它可能已被删除，或不属于当前登录账号。</p><Link className="button button--outline" href="/app/projects">返回项目工作台</Link></section>

  return <><section className="project-summary"><div><span className="project-initial">{project.name.slice(0, 1)}</span><h2>{project.name}</h2><p>{project.productDescription || '尚未补充产品或服务介绍。'}</p></div><Status>{project.status}</Status></section><section className="panel"><div className="panel-head"><h2>方案版本</h2><Link className="button button--outline" href={`/app/projects/new?projectId=${project.id}`}>继续编辑项目<ArrowRight size={16}/></Link></div>{project.plans.length ? project.plans.map(plan => <Link href={`/app/projects/${project.id}/plans/${plan.id}`} className="version-row" key={plan.id}><div><strong>V{plan.versionNumber} {plan.title}</strong><small>{formatDate(plan.createdAt)} | {plan.status}</small></div><span>{plan.moduleCount} 个模块</span><CaretRight size={18}/></Link>) : <div className="workspace-no-result"><FileText size={24}/><strong>这个项目还没有方案版本</strong><p>项目资料已经保存。想先试着写方案，可以打开演示工作台。</p><Link className="button button--outline" href="/demo">打开演示工作台</Link></div>}</section></>
}
function History() { return <section className="panel"><div className="panel-head"><h2>最近版本</h2><button className="text-button">筛选</button></div><div className="history-list">{[['轻醒咖啡新品上市','V1 初始方案','今天 10:24','AI 生成'],['秋日会员增长活动','V3 渠道策略调整','昨天 16:40','手动修改'],['云栖办公品牌焕新','V1 草稿','7 月 12 日','项目创建']].map(row => <div key={row[0]}><FileText size={19}/><span><strong>{row[0]}</strong><small>{row[1]} | {row[3]}</small></span><time>{row[2]}</time><button title="复制版本" className="icon-button"><Copy size={17}/></button></div>)}</div></section> }
function Billing() { return <section className="usage-panel"><div><p className="kicker">当前开放</p><h2>免费演示</h2><p>现在可以在演示工作台写初稿、修改并下载。付费套餐尚未开放。</p></div><Button href="/demo">打开工作台</Button></section> }
function PlanEditor() { const [selected, setSelected] = useState(2); const [items, setItems] = useState(modules.map(([key,title,content]) => ({key,title,content}))); const [instruction, setInstruction] = useState('补充低预算执行动作，并让表达更具体。'); const [suggestion, setSuggestion] = useState(''); const [loading, setLoading] = useState(false); const current = items[selected]; const generate = () => { setLoading(true); setTimeout(() => { setSuggestion(`${current.content || '围绕当前项目，建议先补充真实的落地动作。'} 建议增加“办公室午后补给”内容主题：以 10 人拼单作为首批转化入口，由小红书职场博主发布真实饮用场景，再同步企业微信群内的限时补贴。`); setLoading(false) }, 650) }; const apply = () => { setItems(items.map((i,idx) => idx === selected ? {...i, content: suggestion} : i)); setSuggestion('') }; return <div className="editor-shell"><aside className="editor-outline"><Link className="editor-back" href="/app/projects/qingxing"><CaretRight size={16}/>轻醒咖啡新品上市</Link><h2>营销方案</h2>{items.map((item, index) => <button className={selected === index ? 'module-active' : ''} onClick={() => {setSelected(index);setSuggestion('')}} key={item.key}><span>{item.content ? <Check size={15} weight="bold"/> : <span className="module-number">{index + 1}</span>}</span>{item.title}</button>)}</aside><main className="editor-content"><header><div><p className="kicker">方案模块</p><h1>{current.title}</h1></div><button className="icon-button" title="复制模块"><Copy size={18}/></button></header>{current.content ? <textarea value={current.content} onChange={e => setItems(items.map((i,idx) => idx === selected ? {...i,content:e.target.value} : i))} /> : <div className="module-empty"><FileText size={28}/><h2>这个模块还没有内容</h2><p>可直接生成，也可以先补充你的判断。</p><button className="button button--primary" onClick={generate}>生成此模块<ArrowRight size={16}/></button></div>}<footer><span>本地 mock 已保存</span><button className="button button--outline">保存版本</button></footer></main><aside className="ai-panel"><div><span className="ai-icon"><MagicWand size={19}/></span><h2>AI 修改</h2><p>基于当前项目上下文，只修改这个模块。</p></div><div className="quick-prompts">{['更具体','扩写','压缩','补充执行细节'].map(p => <button key={p} onClick={() => setInstruction(p)}>{p}</button>)}</div><label>修改指令<textarea value={instruction} onChange={e => setInstruction(e.target.value)} /></label><button className="button button--primary ai-submit" onClick={generate} disabled={loading || !instruction}>{loading ? <><SpinnerGap className="spin" size={17}/>正在生成</> : <><PaperPlaneTilt size={17}/>生成建议</>}</button>{suggestion && <div className="suggestion"><span>修改建议</span><p>{suggestion}</p><div><button className="button button--outline" onClick={() => setSuggestion('')}>保留原文</button><button className="button button--primary" onClick={apply}>应用建议</button></div></div>}</aside></div> }

function ProjectWorkspace({ savedProjects, loadError }: { savedProjects: SavedProject[]; loadError: string | null }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('全部')
  const [notice, setNotice] = useState('')
  const filters = ['全部', '草稿', '生成中', '已生成', '已导出', '已归档']
  const visible = savedProjects.filter(project => (status === '全部' || project.status === status) && `${project.name}${project.type}${project.latestPlan?.title ?? ''}`.includes(query.trim()))
  const starters = [
    { title: '新品上市', description: '规划首发认知与转化', Icon: Lightning },
    { title: '节日活动', description: '梳理主题、节奏与转化', Icon: UsersThree },
    { title: '社媒传播', description: '建立内容方向与渠道打法', Icon: Sparkle },
    { title: '线下引流', description: '组织现场触达与后续留资', Icon: Target },
  ]
  return <><div className="starter-grid">{starters.map(({ title, description, Icon }) => <Link href="/app/projects/new" key={title}><span><Icon size={18}/></span><strong>{title}</strong><small>{description}</small></Link>)}</div><section className="workspace-panel"><div className="workspace-tools"><label className="workspace-search"><MagnifyingGlass size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索项目名称、类型或方案版本" /></label><div className="status-filters">{filters.map(filter => <button type="button" className={status === filter ? 'filter-active' : ''} onClick={() => setStatus(filter)} key={filter}>{filter}</button>)}</div></div><div className="project-table"><div className="project-table__head"><span>项目</span><span>当前方案版本</span><span>状态</span><span>最后更新</span><span /></div>{loadError ? <div className="workspace-no-result"><WarningCircle size={24}/><strong>项目读取失败</strong><p>{loadError}</p></div> : visible.map(project => <Link href={`/app/projects/${project.id}`} key={project.id} className="project-table__row"><span className="project-table__name"><i>{project.name.slice(0,1)}</i><b>{project.name}<small>{project.type}</small></b></span><span className="project-version">{project.latestPlan ? `V${project.latestPlan.versionNumber} ${project.latestPlan.title}` : '尚未生成方案'}</span><Status>{project.status}</Status><time>{formatDate(project.updatedAt)}</time><CaretRight size={17}/></Link>)}{!loadError && visible.length === 0 && <div className="workspace-no-result"><FileText size={24}/><strong>{savedProjects.length ? '没有符合条件的项目' : '还没有保存的营销项目'}</strong><p>{savedProjects.length ? '试着调整筛选条件，或者清空搜索关键词。' : '先建一个项目，把产品和目标记下来，以后随时接着改。'}</p>{savedProjects.length ? <button className="button button--outline" onClick={() => { setQuery(''); setStatus('全部') }}>查看全部项目</button> : <Link className="button button--primary" href="/app/projects/new">创建第一个项目<ArrowRight size={16}/></Link>}</div>}</div></section><section className="starter-empty"><div><span><FileText size={20}/></span><div><strong>第一次使用？先建个项目。</strong><p>填写产品、目标用户和营销目标，保存后可以随时继续编辑。</p></div></div><Link className="button button--outline" href="/app/projects/new">新建营销项目<ArrowRight size={16}/></Link></section>{notice && <p className="workspace-notice">{notice}</p>}</>
}

function VersionHistory({ items, loadError }: { items: PlanHistoryItem[]; loadError: string | null }) {
  const router = useRouter()
  const [notice, setNotice] = useState('')
  return <><section className="history-panel"><div className="history-panel__head"><div><h2>最近编辑的方案</h2><p>保存过的方案和修改记录，都可以在这里找回。</p></div><button className="button button--outline" onClick={() => setNotice('当前记录已按最近修改时间排序。')}>最近修改<ArrowsClockwise size={16}/></button></div><div className="version-table"><div className="version-table__head"><span>项目与方案版本</span><span>修改说明</span><span>生成时间</span><span>生成方式</span><span>操作</span></div>{loadError ? <div className="workspace-no-result"><WarningCircle size={24}/><strong>历史记录读取失败</strong><p>{loadError}</p></div> : items.map(item => <div className="version-table__row" key={item.id}><span className="version-name"><i><FileText size={18}/></i><b>{item.projectName}<small>{item.versionLabel}</small></b></span><p>{item.note}</p><time>{formatDate(item.time)}</time><span className="version-source">{item.source}</span><div className="version-actions"><button type="button" onClick={() => router.push(`/app/projects/${item.projectId}/plans/${item.planId}`)}>打开方案</button><button type="button" onClick={() => router.push(`/app/projects/${item.projectId}`)}>查看项目</button></div></div>)}{!loadError && items.length === 0 && <div className="workspace-no-result"><ClockCounterClockwise size={24}/><strong>还没有可查看的方案历史</strong><p>保存方案或修改过的内容后，记录会出现在这里。</p><Link className="button button--outline" href="/app/projects">返回项目工作台</Link></div>}</div></section>{notice && <p className="workspace-notice">{notice}</p>}</>
}

function EnhancedPlanEditor() {
  const [items, setItems] = useState(modules.map(([key, title, content]) => ({ key, title, content })))
  const [selected, setSelected] = useState(3)
  const [instruction, setInstruction] = useState('补充低预算执行动作，并让表达更具体。')
  const [suggestion, setSuggestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('V1 初始方案')
  const [versionCount, setVersionCount] = useState(1)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const current = items[selected]
  const completed = items.filter(item => item.content.trim()).length
  const selectModule = (index: number) => { setSelected(index); setSuggestion(''); setOutlineOpen(false); setAiOpen(false) }
  const requestSuggestion = () => {
    if (!instruction.trim()) return
    setLoading(true)
    window.setTimeout(() => {
      const base = current.content || `围绕“${current.title}”，建议先明确执行判断。`
      setSuggestion(`${base} 建议围绕“下午不掉线”补充一组低预算动作：小红书职场内容先建立使用场景，办公室拼单作为首轮转化入口，再以社群限时补贴承接复购。`)
      setLoading(false)
    }, 700)
  }
  const generateModule = () => {
    setLoading(true)
    window.setTimeout(() => {
      const content = `围绕轻醒咖啡新品上市，本模块建议从“下午不掉线”的用户场景切入。先明确该模块要解决的营销问题，再给出低预算可执行动作、责任渠道和复盘判断。`
      setItems(currentItems => currentItems.map((item, index) => index === selected ? { ...item, content } : item))
      setVersionCount(count => count + 1)
      setMessage(`V${versionCount + 1} 已生成 ${current.title}`)
      setLoading(false)
    }, 700)
  }
  const applySuggestion = () => {
    setItems(currentItems => currentItems.map((item, index) => index === selected ? { ...item, content: suggestion } : item))
    setSuggestion('')
    setVersionCount(count => count + 1)
    setMessage(`V${versionCount + 1} 已保存模块修改`)
  }
  const save = () => { setSaving(true); window.setTimeout(() => { setVersionCount(count => count + 1); setMessage(`V${versionCount + 1} 已保存`); setSaving(false) }, 400) }
  const copy = () => { if (current.content) navigator.clipboard?.writeText(current.content); setMessage('模块内容已复制到剪贴板') }
  return <div className={`editor-v2 ${outlineOpen ? 'editor-v2--outline-open' : ''} ${aiOpen ? 'editor-v2--ai-open' : ''}`}>
    <aside className="editor-v2__outline"><div className="editor-v2__outline-head"><Link href="/app/projects/qingxing"><CaretRight size={16}/>轻醒咖啡新品上市</Link><button title="关闭目录" onClick={() => setOutlineOpen(false)}><X size={18}/></button></div><div className="plan-progress"><div><span>方案完成度</span><strong>{completed}/11</strong></div><div className="plan-progress__bar"><span style={{ width: `${Math.round(completed / 11 * 100)}%` }} /></div></div><nav>{items.map((item, index) => <button key={item.key} className={selected === index ? 'module-active' : ''} onClick={() => selectModule(index)}><span className={item.content ? 'module-state module-state--done' : 'module-state'}>{item.content ? <Check size={13} weight="bold"/> : index + 1}</span><span>{item.title}<small>{item.content ? '已完成' : '待生成'}</small></span></button>)}</nav></aside>
    <main className="editor-v2__content"><header><div><p className="kicker">轻醒咖啡新品上市</p><h1>{current.title}</h1><small>{message}</small></div><div className="editor-v2__actions"><button className="icon-button" title="复制模块内容" onClick={copy}><Copy size={18}/></button><button className="button button--outline" onClick={generateModule} disabled={loading}><ArrowsClockwise size={16}/>重新生成</button><button className="button button--primary" onClick={save} disabled={saving}>{saving ? <SpinnerGap className="spin" size={16}/> : <FloppyDisk size={16}/>}保存</button></div></header><div className="editor-v2__mobile-actions"><button onClick={() => setOutlineOpen(true)}><ListBullets size={18}/>方案目录</button><button onClick={() => setAiOpen(true)}><MagicWand size={18}/>AI 修改</button></div>{current.content ? <textarea aria-label={`${current.title}正文`} value={current.content} onChange={event => setItems(currentItems => currentItems.map((item, index) => index === selected ? { ...item, content: event.target.value } : item))} /> : <section className="module-empty module-empty--v2"><FileText size={28}/><h2>{current.title}尚未生成</h2><p>先生成该模块，或在右侧输入修改方向后让 AI 协助起草。</p><button className="button button--primary" onClick={generateModule} disabled={loading}>{loading ? <><SpinnerGap className="spin" size={17}/>正在生成</> : <>生成此模块<ArrowRight size={16}/></>}</button></section>}<footer><span>所有修改仅保留在当前浏览器的 mock 状态中。</span><strong>{completed} 个模块已完成</strong></footer></main>
    <aside className="editor-v2__ai"><div className="editor-v2__ai-head"><div><span className="ai-icon"><MagicWand size={19}/></span><h2>AI 修改</h2><p>只基于当前模块和项目上下文生成建议。</p></div><button title="关闭 AI 面板" onClick={() => setAiOpen(false)}><X size={18}/></button></div><div className="quick-prompts">{['更具体', '扩写', '压缩', '换一种表达', '补充执行细节'].map(prompt => <button key={prompt} onClick={() => setInstruction(prompt)}>{prompt}</button>)}</div><label>修改指令<textarea value={instruction} onChange={event => setInstruction(event.target.value)} placeholder="例如：补充低预算的执行动作" /></label><button className="button button--primary ai-submit" onClick={requestSuggestion} disabled={loading || !instruction.trim()}>{loading ? <><SpinnerGap className="spin" size={17}/>正在生成</> : <><PaperPlaneTilt size={17}/>让 AI 修改</>}</button>{suggestion && <section className="suggestion"><span>修改建议</span><p>{suggestion}</p><div><button className="button button--outline" onClick={() => setSuggestion('')}>保留原文</button><button className="button button--primary" onClick={applySuggestion}>应用建议</button></div></section>}</aside>
  </div>
}

function Admin({ view }: { view: View }) { const data = view === 'users' ? users : view === 'generations' ? generations : view === 'orders' ? orders : null; const headings: Record<string,[string,string]> = { admin:['运营概览','所有数据均为前端演示数据。'], users:['用户管理','查看用户角色、套餐和用量状态。'], generations:['项目与生成记录','跟踪完整方案生成和模块修改。'], orders:['支付订单','支付接入前仅展示 mock 订单。'] }; return <div className="product-shell"><Side kind="admin" active={view}/><main className="product-main"><ProductTop /><header className="page-heading"><div><p className="kicker">Admin</p><h1>{headings[view][0]}</h1><p>{headings[view][1]}</p></div>{view !== 'admin' && <button className="button button--outline"><DownloadSimple size={16}/>导出</button>}</header>{view === 'admin' ? <AdminOverview /> : <section className="panel data-panel"><div className="panel-head"><h2>{view === 'users' ? '全部用户' : view === 'generations' ? '全部记录' : '订单列表'}</h2><button className="text-button">筛选条件</button></div><div className="table-wrap"><table><thead><tr>{(view === 'users' ? ['用户','套餐','用量','状态','注册时间'] : view === 'generations' ? ['编号','用户','动作','项目','模型','时间','状态'] : ['订单号','客户','套餐','金额','创建时间','状态']).map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{data!.map((row, index) => <tr key={index}>{row.map((cell,cellIndex) => <td key={cellIndex}>{cellIndex === row.length - 1 ? <Status>{cell}</Status> : cell}</td>)}</tr>)}</tbody></table></div></section>}</main></div> }
function AdminOverview() { const stats = [['注册用户','1,284','本月新增 86'],['营销项目','3,672','近 7 日创建 214'],['完整方案','8,406','成功率 97.8%'],['模型用量','12.6M','仅演示统计']]; return <><div className="stat-grid">{stats.map(s => <div key={s[0]}><span>{s[0]}</span><strong>{s[1]}</strong><small>{s[2]}</small></div>)}</div><section className="panel activity-panel"><div className="panel-head"><h2>近期生成</h2><Link href="/admin/generations">查看记录</Link></div>{generations.slice(0,3).map(row => <div className="activity-row" key={row[0]}><span className="activity-icon"><Sparkle size={17}/></span><div><strong>{row[2]}</strong><small>{row[1]} | {row[3]}</small></div><time>{row[5]}</time><Status>{row[6]}</Status></div>)}</section></> }
