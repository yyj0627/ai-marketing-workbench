'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  DownloadSimple,
  FloppyDisk,
  GearSix,
  MagicWand,
  Paperclip,
  Sparkle,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import {
  buildDemoPlan,
  emptyBrief,
  exampleBrief,
  isLegacyPlan,
  planGroupTitle,
  type DemoBrief,
  type DemoPlan,
} from '@/lib/demo-planner'
import { parsePlanContent, readableSourceMarkers } from '@/lib/plan-format'

const storageKey = 'marketing-workbench-demo-v1'
const modelStorageKey = 'marketing-workbench-deepseek-session-v1'
const modeStorageKey = 'marketing-workbench-model-mode-v1'
type StoredDraft = { brief: DemoBrief; plan: DemoPlan | null }
type AiMode = 'demo' | 'server' | 'personal'
type DeepSeekModel = 'deepseek-flash' | 'deepseek-v4-pro'

export function DemoWorkbench() {
  const [brief, setBrief] = useState<DemoBrief>(emptyBrief)
  const [plan, setPlan] = useState<DemoPlan | null>(null)
  const [selected, setSelected] = useState('brief')
  const [editingSection, setEditingSection] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [suggestionMode, setSuggestionMode] = useState<'demo' | 'ai'>('demo')
  const [busy, setBusy] = useState<'generate' | 'revise' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState<'docx' | 'pptx' | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [aiMode, setAiMode] = useState<AiMode>('demo')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState<DeepSeekModel>('deepseek-flash')
  const [serverAvailable, setServerAvailable] = useState(false)
  const [serverModel, setServerModel] = useState('')
  const [modelReady, setModelReady] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsMode, setSettingsMode] = useState<AiMode>('demo')
  const [settingsKey, setSettingsKey] = useState('')
  const [settingsModel, setSettingsModel] = useState<DeepSeekModel>('deepseek-flash')
  const [settingsError, setSettingsError] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (!saved) return
      const parsed = JSON.parse(saved) as StoredDraft
      if (parsed.brief && typeof parsed.brief.projectName === 'string') {
        const exampleFields = ['projectName', 'product', 'audience', 'goal', 'budget', 'channels', 'marketContext', 'competitors'] as const
        const isExample = exampleFields.every(key => parsed.brief[key] === exampleBrief[key]) && !parsed.brief.attachments?.length
        const untouchedDemo = !parsed.plan || (parsed.plan.mode === 'demo' && Array.isArray(parsed.plan.sections)
          && JSON.stringify(parsed.plan.sections) === JSON.stringify(buildDemoPlan(exampleBrief).sections))
        if (isExample && untouchedDemo) {
          localStorage.removeItem(storageKey)
          return
        }
        setBrief({ ...emptyBrief, ...parsed.brief, knownFacts: '', evidenceSources: '', attachments: Array.isArray(parsed.brief.attachments) ? parsed.brief.attachments : [] })
      }
      if (parsed.plan && Array.isArray(parsed.plan.sections)) setPlan({
        ...parsed.plan,
        sections: parsed.plan.sections.map(section => ({ ...section, content: readableSourceMarkers(section.content) })),
      })
      setNotice('上次保存的方案已经打开。')
    } catch {
      // A damaged local draft must not prevent a blank project from opening.
    }
  }, [])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 5000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    let hasPersonalKey = false
    const savedMode = sessionStorage.getItem(modeStorageKey)
    try {
      const saved = sessionStorage.getItem(modelStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as { apiKey?: string; model?: DeepSeekModel }
        if (typeof parsed.apiKey === 'string' && parsed.apiKey.length >= 16) {
          hasPersonalKey = true
          setApiKey(parsed.apiKey)
          setModel(parsed.model === 'deepseek-v4-pro' ? 'deepseek-v4-pro' : 'deepseek-flash')
          setAiMode('personal')
        }
      }
    } catch {
      sessionStorage.removeItem(modelStorageKey)
    }
    fetch('/api/demo-plan', { cache: 'no-store' })
      .then(response => response.json())
      .then((status: { serverModelAvailable?: boolean; serverModel?: string }) => {
        setServerAvailable(Boolean(status.serverModelAvailable))
        setServerModel(status.serverModel || '')
        if (!hasPersonalKey && status.serverModelAvailable && savedMode !== 'demo') setAiMode('server')
      })
      .catch(() => {})
      .finally(() => setModelReady(true))
  }, [])

  const openSettings = () => {
    setSettingsMode(aiMode)
    setSettingsKey(apiKey)
    setSettingsModel(model)
    setSettingsError('')
    setSettingsOpen(true)
  }

  const closeSettings = () => {
    setSettingsOpen(false)
    setSettingsKey('')
    setSettingsError('')
  }

  const saveSettings = () => {
    if (settingsMode === 'personal') {
      const key = settingsKey.trim()
      if (key.length < 16 || key.length > 512) {
        setSettingsError('请填写完整的 DeepSeek API Key。')
        return
      }
      sessionStorage.setItem(modelStorageKey, JSON.stringify({ apiKey: key, model: settingsModel }))
      setApiKey(key)
      setModel(settingsModel)
    } else {
      sessionStorage.removeItem(modelStorageKey)
      setApiKey('')
    }
    sessionStorage.setItem(modeStorageKey, settingsMode)
    setAiMode(settingsMode)
    setSettingsOpen(false)
    setSettingsKey('')
    setNotice(settingsMode === 'demo' ? '已切换到演示模式。' : settingsMode === 'server' ? '已切换到本机 DeepSeek。' : '已保存你的 DeepSeek 配置。')
  }

  const current = plan?.sections.find(section => section.id === selected) ?? plan?.sections[0]
  const change = (key: keyof DemoBrief, value: string) => {
    setBrief(previous => ({ ...previous, [key]: value }))
    setDirty(true)
    if (plan) setNotice('项目背景改好了。右边的旧初稿不会自动变化，你可以手动改，或重新生成。')
  }

  const uploadAttachments = async (files: FileList | null) => {
    if (!files?.length) return
    setError('')
    const selectedFiles = Array.from(files)
    const currentFiles = brief.attachments || []
    if (currentFiles.length + selectedFiles.length > 4) {
      setError('最多上传 4 个附件。')
      return
    }
    if (selectedFiles.some(file => file.size > 32 * 1024 * 1024)) {
      setError('单个附件不能超过 32 MB。')
      return
    }
    if (new Set([...currentFiles.map(item => item.name), ...selectedFiles.map(file => file.name)]).size !== currentFiles.length + selectedFiles.length) {
      setError('同名文件已上传。请先移除旧文件，或给新文件换个名称。')
      return
    }
    setUploading(true)
    try {
      for (const file of selectedFiles) {
        const data = new FormData()
        data.append('file', file)
        const response = await fetch('/api/attachments/extract', { method: 'POST', body: data })
        const result = await response.json() as { attachment?: NonNullable<DemoBrief['attachments']>[number]; error?: string }
        if (!response.ok || !result.attachment) throw new Error(`${file.name}：${result.error || '未能读取文件。'}`)
        setBrief(previous => ({ ...previous, attachments: [...(previous.attachments || []), result.attachment!] }))
        setDirty(true)
      }
      setNotice('附件文字已提取。重新生成初稿后，AI 会结合这些资料撰写。')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '文件上传失败，请重试。')
    } finally {
      setUploading(false)
    }
  }

  const removeAttachment = (name: string) => {
    setBrief(previous => ({ ...previous, attachments: (previous.attachments || []).filter(item => item.name !== name) }))
    setDirty(true)
    if (plan) setNotice('附件已移除。右边的旧初稿不会自动变化，请重新生成。')
  }

  async function requestPlan(
    action: 'generate' | 'revise',
    section?: typeof current,
  ) {
    setError('')
    setNotice('')
    setBusy(action)
    try {
      const response = await fetch('/api/demo-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action, brief, section, instruction,
          ai: aiMode === 'personal'
            ? { mode: 'personal', apiKey, model }
            : { mode: aiMode },
        }),
      })
      const result = await response.json() as {
        plan?: DemoPlan
        suggestion?: string
        mode?: 'demo' | 'ai'
        error?: string
      }
      if (!response.ok) throw new Error(result.error || '这次没成功，再试一次吧。')
      if (action === 'generate' && result.plan) {
        setPlan(result.plan)
        setSelected(result.plan.sections[0]?.id || 'brief')
        setEditingSection(false)
        setSuggestion('')
        setDirty(true)
        setNotice(result.plan.mode === 'ai'
          ? '初稿出来了。先核对事实，再挑需要修改的部分。'
          : '演示初稿出来了。它展示工作流程，不代表真实市场结论。')
      } else if (action === 'revise' && result.suggestion) {
        setSuggestion(readableSourceMarkers(result.suggestion))
        setSuggestionMode(result.mode || 'demo')
      } else {
        throw new Error('没有拿到可用内容，再试一次吧。')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '这次没成功，再试一次吧。')
    } finally {
      setBusy(null)
    }
  }

  const editSection = (content: string) => {
    setPlan(previous => previous && ({
      ...previous,
      sections: previous.sections.map(section =>
        section.id === selected ? { ...section, content } : section),
    }))
    setDirty(true)
  }

  const applySuggestion = () => {
    if (!suggestion) return
    editSection(suggestionMode === 'ai' ? suggestion : `${current?.content.trim() || ''}\n\n修改方向（演示）\n${suggestion}`)
    setEditingSection(false)
    setSuggestion('')
    setNotice(suggestionMode === 'ai' ? '已经换成这版了。看看是否符合你的想法，记得保存。' : '修改方向已加到正文。你可以继续补细节，记得保存。')
  }

  const save = () => {
    localStorage.setItem(storageKey, JSON.stringify({ brief, plan } satisfies StoredDraft))
    setDirty(false)
    setNotice('保存好了，下次在这个浏览器打开还能继续改。')
  }

  const exportFile = async (format: 'docx' | 'pptx') => {
    if (!plan) return
    setError('')
    setNotice('')
    setExporting(format)
    try {
      const response = await fetch('/api/export-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, plan, format }),
      })
      if (!response.ok) {
        const result = await response.json() as { error?: string }
        throw new Error(result.error || '文件生成失败，请稍后再试。')
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `${(brief.projectName.trim() || '营销方案').replace(/[\\/:*?"<>|\r\n]/gu, '-').slice(0, 80)}.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      setNotice(`${format === 'docx' ? 'Word' : 'PPT'} 已下载，可以继续编辑。`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '文件生成失败，请稍后再试。')
    } finally {
      setExporting(null)
    }
  }

  return (
    <main className="demo-shell">
      <header className="demo-topbar">
        <Link href="/" className="demo-brand"><span><Sparkle size={17} weight="fill" /></span>策划台</Link>
        <span className="demo-topbar-label">{!modelReady ? '正在检测模型' : aiMode === 'demo' ? '演示模式' : aiMode === 'server' ? '本机 DeepSeek' : '我的 DeepSeek'}</span>
        <button type="button" className="demo-settings-trigger" onClick={openSettings}><GearSix size={17} />模型设置</button>
        <Link href="/" className="demo-home-link">返回首页</Link>
      </header>

      <div className="demo-heading">
        <div>
          <p className="kicker">一份方案，从这里开始</p>
          <h1>写一份营销方案</h1>
          <p>先写你已经知道的。初稿出来后，可以逐段检查、自己修改，或者看看修改方向。</p>
        </div>
        <div className="demo-heading-actions">
          <button type="button" className="button button--outline" onClick={save}>
            <FloppyDisk size={17} />{dirty ? '保存修改' : '保存到浏览器'}
          </button>
          <button type="button" className="button button--outline" onClick={() => exportFile('docx')} disabled={!plan || Boolean(exporting)}>
            <DownloadSimple size={17} />{exporting === 'docx' ? '正在生成 Word…' : '下载 Word'}
          </button>
          <button type="button" className="button button--outline" onClick={() => exportFile('pptx')} disabled={!plan || Boolean(exporting)}>
            <DownloadSimple size={17} />{exporting === 'pptx' ? '正在生成 PPT…' : '下载 PPT'}
          </button>
        </div>
      </div>

      <div className="demo-grid">
        <section className="demo-panel demo-brief">
          <div className="demo-panel-head">
            <span className="demo-step">01</span>
            <div><h2>你的项目</h2></div>
          </div>
          <div className="demo-upload">
            <div className="demo-upload-heading"><Paperclip size={18} /><strong>上传附件</strong><span>选填</span></div>
            <p>有产品资料、调研或旧方案，可以先上传。AI 生成时会参考提取出的文字。</p>
            <label className="demo-upload-button">
              {uploading ? '正在读取附件…' : '选择文件'}
              <input type="file" accept=".pdf,.docx,.pptx,.txt,.md" multiple disabled={uploading} onChange={event => { void uploadAttachments(event.target.files); event.target.value = '' }} />
            </label>
            <small>PDF、Word、PPT、TXT、Markdown；最多 4 个，单个不超过 32 MB。</small>
            {!!brief.attachments?.length && <ul className="demo-upload-list">{brief.attachments.map(item =>
              <li key={item.name}>
                <div><strong>{item.name}</strong><small>已提取 {item.text.length.toLocaleString()} 字{item.truncated ? ' · 内容已截取前 1 万字' : ''}</small></div>
                <button type="button" onClick={() => removeAttachment(item.name)} aria-label={`移除 ${item.name}`}><Trash size={16} /></button>
              </li>,
            )}</ul>}
          </div>
          <div className="demo-fields">
            <label><span>项目名称 <strong>*</strong></span>
              <input value={brief.projectName} onChange={event => change('projectName', event.target.value)} />
            </label>
            <label><span>你要推广什么 <strong>*</strong></span>
              <textarea value={brief.product} onChange={event => change('product', event.target.value)} />
            </label>
            <label>目标人群
              <textarea value={brief.audience} onChange={event => change('audience', event.target.value)} placeholder="描述你希望触达的人群；未确定可留空" />
            </label>
            <label>市场、地区与营销节点
              <textarea value={brief.marketContext || ''} onChange={event => change('marketContext', event.target.value)} placeholder="填写市场、地区和营销节点；未确定可留空" />
            </label>
            <label>主要竞品或替代选择
              <textarea value={brief.competitors || ''} onChange={event => change('competitors', event.target.value)} placeholder="填写已知品牌、品类或替代做法；不了解可留空" />
            </label>
            <label><span>目标 <strong>*</strong></span>
              <textarea value={brief.goal} onChange={event => change('goal', event.target.value)} />
            </label>
            <label>预算和时间
              <input value={brief.budget} onChange={event => change('budget', event.target.value)} placeholder="填写预算与周期；未确定可留空" />
            </label>
            <label>渠道
              <input value={brief.channels} onChange={event => change('channels', event.target.value)} placeholder="填写计划使用的渠道；未确定可留空" />
            </label>
          </div>
          <button
            type="button"
            className="button button--primary demo-generate"
            onClick={() => requestPlan('generate')}
            disabled={!modelReady || Boolean(busy) || uploading || !brief.projectName.trim() || !brief.product.trim() || !brief.goal.trim()}
          >
            <MagicWand size={18} />{!modelReady ? '正在连接模型…' : busy === 'generate' ? '正在撰写完整提案…' : plan ? '重新生成初稿' : '生成初稿'}<ArrowRight size={17} />
          </button>
          <p className="demo-privacy">{busy === 'generate' && aiMode !== 'demo' ? '正在联网查找资料，并依次完成前期分析、主体创意和预算分配，请稍等。' : '点击保存后，方案和提取出的附件文字只留在这个浏览器。'}{aiMode !== 'demo' ? 'AI 模式会把项目内容和附件文字发送给 DeepSeek，并联网检索网页；请核对结论与参考链接。' : '演示模式不会联网或调用模型，也不会分析附件。'}附件原文件仅用于本次提取文字，本站不会保存副本。</p>
        </section>

        <section className="demo-panel demo-output">
          <div className="demo-panel-head">
            <span className="demo-step">02</span>
            <div><h2>你的方案</h2><p>一段段看。不合适的地方，直接改。</p></div>
            {plan && <span className="demo-mode">{isLegacyPlan(plan) ? '旧版初稿 · 重新生成可升级' : plan.mode === 'ai' ? 'AI 初稿' : '演示初稿 · 未接 AI'}</span>}
          </div>
          {!plan ? (
            <div className="demo-empty">
              <span><MagicWand size={27} /></span>
              <h3>初稿会出现在这里</h3>
              <p>在左侧填写项目名称、推广内容和目标，初稿就会出现在这里。</p>
            </div>
          ) : (
            <>
              <div className="demo-plan-layout">
                <nav className="demo-section-nav" aria-label="方案模块">
                  {plan.sections.map((section, index) => (
                    <div className="demo-nav-item" key={section.id}>
                      {(index === 0 || planGroupTitle(plan.sections[index - 1].id, plan) !== planGroupTitle(section.id, plan)) &&
                        <p className="demo-nav-group">{planGroupTitle(section.id, plan)}</p>}
                      <button
                        type="button"
                        className={selected === section.id ? 'is-active' : ''}
                        onClick={() => { setSelected(section.id); setSuggestion(''); setEditingSection(false) }}
                      >
                        <span>{String(index + 1).padStart(2, '0')}</span>{section.title}
                      </button>
                    </div>
                  ))}
                </nav>
                <div className="demo-section-body">
                  <div className="demo-section-title">
                    <div><small>{current ? planGroupTitle(current.id, plan) : ''}</small><h3>{current?.title}</h3></div>
                    <button type="button" className="demo-edit-toggle" onClick={() => setEditingSection(value => !value)}>
                      {editingSection ? '完成编辑' : '编辑正文'}
                    </button>
                  </div>
                  {editingSection ? <textarea
                      aria-label={`${current?.title || '方案模块'}正文`}
                      value={current?.content || ''}
                      onChange={event => editSection(event.target.value)}
                    /> : <PlanReadableContent content={current?.content || ''} />}
                  {current && plan.mode === 'ai' && (
                    <div className="demo-references">
                      <h4>本节参考资料</h4>
                      {current.references?.length ? <ol>
                        {current.references.map(reference => <li key={reference.url}>
                          <a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.title} <span aria-hidden="true">↗</span></a>
                          <small>{[reference.siteName, reference.publishedAt].filter(Boolean).join(' · ')}</small>
                        </li>)}
                      </ol> : <p>本节没有可直接引用的网页资料；具体判断请按待核实处理。</p>}
                      <p className="demo-references-note">点击标题可打开原网页，核对发布时间、案例细节和适用范围。修改正文后，也请检查资料是否仍支持对应判断。</p>
                    </div>
                  )}
                  <div className="demo-revise">
                    <label>想怎么改？
                      <input value={instruction} onChange={event => setInstruction(event.target.value)} placeholder="比如：把低预算执行动作写具体一点" />
                    </label>
                    <button type="button" className="button button--outline" disabled={Boolean(busy) || !instruction.trim()} onClick={() => requestPlan('revise', current)}>
                      {busy === 'revise' ? '正在整理建议…' : plan.mode === 'demo' ? '看看修改方向' : '给我一个修改建议'}
                    </button>
                  </div>
                  {suggestion && <div className="demo-suggestion">
                    <div><strong>{suggestionMode === 'ai' ? 'AI 修改建议' : '修改方向（演示）'}</strong><span>先看看，再决定要不要用</span></div>
                    <PlanReadableContent content={suggestion} compact />
                    <div className="demo-suggestion-actions">
                      <button type="button" onClick={() => setSuggestion('')}>保留原文</button>
                      <button type="button" className="button button--primary" onClick={applySuggestion}>{suggestionMode === 'ai' ? '用这版' : '加到正文'}</button>
                    </div>
                  </div>}
                </div>
              </div>
              <div className="demo-assumptions">
                <h3><WarningCircle size={18} />这些判断还需要核实</h3>
                <ul>{plan.assumptions.map(item => <li key={item}>{item}</li>)}</ul>
              </div>
              <div className="demo-evidence">
                <h3>项目附件 <span>用户提供 · 尚未核实</span></h3>
                {brief.attachments?.length
                  ? <ul>{brief.attachments.map(item => <li key={item.name}>{item.name}</li>)}</ul>
                  : <p>尚未上传附件。需要引用外部事实时，请核对对应章节的参考资料。</p>}
              </div>
            </>
          )}
        </section>
      </div>
      {settingsOpen && <div className="demo-settings-backdrop">
        <section className="demo-settings" role="dialog" aria-modal="true" aria-labelledby="demo-settings-title">
          <div className="demo-settings-head">
            <div><p className="kicker">生成方式</p><h2 id="demo-settings-title">模型设置</h2></div>
            <button type="button" className="demo-settings-close" onClick={closeSettings} aria-label="关闭模型设置"><X size={19} /></button>
          </div>
          <p className="demo-settings-intro">选一种方式生成方案。你可以随时切换，已有的方案不会被自动改动。</p>
          <div className="demo-settings-options">
            <button type="button" className={settingsMode === 'demo' ? 'is-selected' : ''} onClick={() => { setSettingsMode('demo'); setSettingsError('') }}>
              <strong>演示模式</strong><small>不用 Key，查看完整操作流程</small>
            </button>
            {serverAvailable && <button type="button" className={settingsMode === 'server' ? 'is-selected' : ''} onClick={() => { setSettingsMode('server'); setSettingsError('') }}>
              <strong>本机 DeepSeek</strong><small>使用这台电脑已配置的 {serverModel || 'DeepSeek'} 模型</small>
            </button>}
            <button type="button" className={settingsMode === 'personal' ? 'is-selected' : ''} onClick={() => { setSettingsMode('personal'); setSettingsError('') }}>
              <strong>使用自己的 Key</strong><small>连接你自己的 DeepSeek 账户</small>
            </button>
          </div>
          {settingsMode === 'personal' && <div className="demo-settings-fields">
            <label>DeepSeek API Key
              <input type="password" value={settingsKey} onChange={event => setSettingsKey(event.target.value)} placeholder="sk-…" autoComplete="off" spellCheck={false} maxLength={512} />
            </label>
            <label>模型
              <select value={settingsModel} onChange={event => setSettingsModel(event.target.value as DeepSeekModel)}>
                <option value="deepseek-flash">DeepSeek Flash</option>
                <option value="deepseek-v4-pro">DeepSeek V4 Pro</option>
              </select>
            </label>
            <p>Key 只保存在当前浏览器标签页，不会写进方案或下载文件。关闭标签页后需要重新填写；生成时会通过本站服务端调用 DeepSeek 的搜索和模型接口，费用由提供 Key 的账户承担。</p>
          </div>}
          {settingsError && <p className="demo-settings-error" role="alert">{settingsError}</p>}
          <div className="demo-settings-actions"><button type="button" className="button button--outline" onClick={closeSettings}>取消</button><button type="button" className="button button--primary" onClick={saveSettings}>保存设置</button></div>
        </section>
      </div>}
      {(notice || error) && <p className={error ? 'demo-toast demo-toast--error' : 'demo-toast'} role={error ? 'alert' : 'status'}>{error || notice}</p>}
    </main>
  )
}

function PlanReadableContent({ content, compact = false }: { content: string; compact?: boolean }) {
  const blocks = parsePlanContent(content)
  return <div className={compact ? 'demo-reader demo-reader--compact' : 'demo-reader'}>
    {blocks.length ? blocks.map((block, index) => block.type === 'heading'
      ? <h4 key={index}>{block.text}</h4>
      : block.type === 'list'
        ? <p className="demo-reader-item" key={index}>{block.text}</p>
        : <p key={index}>{block.text}</p>)
      : <p className="demo-reader-empty">这个章节还没有正文。点「编辑正文」开始写。</p>}
  </div>
}
