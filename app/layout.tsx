import type { Metadata } from 'next'
import './globals.css'
import './project-form.css'
import './plan-editor.css'
import './workspace-lists.css'
import './supabase-data.css'
import './demo.css'
import './neatly-theme.css'

export const metadata: Metadata = {
  title: 'AI 营销方案工作台',
  description: '写下项目目标，生成一份可以继续修改的营销方案初稿。',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
