# AI 营销方案工作台：Supabase 登录接入教程

这份教程按零基础操作编写。完成后，用户可以注册、确认邮箱、登录、退出，且未登录时不能直接进入工作台或后台。

## 第 1 步：安装依赖

**会修改的文件：** `package.json`、`package-lock.json`

项目已经安装了以下依赖：

```bash
npm install @supabase/supabase-js @supabase/ssr
```

`@supabase/supabase-js` 负责调用 Supabase Auth，`@supabase/ssr` 负责把登录状态保存在 Cookie 中，让 Next.js 服务端也能识别用户。

## 第 2 步：在 Supabase 控制台创建项目

**会修改的文件：** 无。这一步只在 Supabase 控制台操作。

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)，登录后点击 **New project**。
2. 选择组织，填写项目名称，例如 `ai-marketing-workbench`。
3. 设置数据库密码并妥善保存。它不是前端环境变量，不要填入本项目。
4. 选择离你较近的区域，点击 **Create new project**，等待项目初始化完成。
5. 打开项目的 **Connect** 面板，选择 **App Frameworks > Next.js**。
6. 复制 `Project URL` 和 `Publishable key`。只使用 Publishable key，绝不把 `service_role` 密钥放进前端。

## 第 3 步：创建本地环境变量

**会修改的文件：** `.env.local`

项目中已提供模板 [.env.local.example](../.env.local.example)。在项目根目录新建 `.env.local`，填入你刚刚复制的值：

```env
NEXT_PUBLIC_SUPABASE_URL=https://你的项目标识.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=你的PublishableKey
```

`.env.local` 已在 `.gitignore` 中，不会被提交到 Git。填完后需要重启本地开发服务器，环境变量才会生效。

## 第 4 步：创建 profiles 表和注册触发器

**会修改的文件：** 无。这一步只在 Supabase 控制台操作。

1. 打开 Supabase 项目的 **SQL Editor**。
2. 点击 **New query**。
3. 打开项目中的 [supabase/schema.sql](../supabase/schema.sql)，复制全部内容到 SQL Editor。
4. 点击 **Run**。
5. 打开 **Table Editor**，确认 `public.profiles`、`projects`、`plans`、`plan_modules`、`plan_module_versions`、`ai_generation_records` 已出现。

这段 SQL 会完成以下工作：

- 创建 `profiles` 表，包含 `email`、`display_name`、`role`、`plan`、`created_at`。
- 将 `role` 限定为 `user` 或 `admin`，默认 `user`。
- 将 `plan` 限定为 `free`、`pro` 或 `team`，默认 `free`。
- 开启 Row Level Security，普通用户只能读取和更新自己的 profile。
- 在 `auth.users` 插入用户后自动创建对应的 profile。

## 第 5 步：配置邮箱确认

**会修改的文件：** 无。这一步只在 Supabase 控制台操作。

1. 前往 **Authentication > URL Configuration**。
2. 将 `Site URL` 设为本地开发地址：`http://localhost:3001`。生产部署后改成正式域名。
3. 在 `Redirect URLs` 增加：`http://localhost:3001/auth/confirm`。
4. 前往 **Authentication > Email Templates**，打开 **Confirm signup**。
5. 将邮件模板中的 `{{ .ConfirmationURL }}` 改为：

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

这样用户点击确认邮件时，会经过本项目的 `/auth/confirm` 路由，将确认 token 换成登录会话，再跳转到项目工作台。

开发阶段也可以在 **Authentication > Providers > Email** 中临时关闭 `Confirm email`。关闭后，注册会立即登录并进入 `/app/projects`。正式环境建议保持开启。

## 第 6 步：代码中的 Supabase 客户端

**会修改的文件：**

- [lib/supabase/env.ts](../lib/supabase/env.ts)
- [lib/supabase/client.ts](../lib/supabase/client.ts)
- [lib/supabase/server.ts](../lib/supabase/server.ts)
- [app/auth/confirm/route.ts](../app/auth/confirm/route.ts)

浏览器组件通过 `client.ts` 调用注册、登录和退出。服务端的 `server.ts` 使用 Cookie 创建客户端，确认邮件回调在 `app/auth/confirm/route.ts` 中校验 token 并写入会话。

## 第 7 步：保护应用路由

**会修改的文件：** [proxy.ts](../proxy.ts)

`proxy.ts` 会在请求到达页面前调用 `supabase.auth.getClaims()` 验证登录 token，并保护以下路径：

- `/app/projects` 以及其子路径
- `/app/history`
- `/app/billing`
- `/admin` 以及其子路径

未登录访问时会被重定向到 `/app/login`。当前只验证“是否登录”，没有限制普通用户进入 `/admin`；`profiles.role` 已经为下一步的后台权限控制预留好。

## 第 8 步：接入登录、注册和退出界面

**会修改的文件：** [components/Portal.tsx](../components/Portal.tsx)

登录页调用 `signInWithPassword`，成功后跳转 `/app/projects`。注册页调用 `signUp`，并把显示名称作为 `display_name` 元数据传入，供数据库触发器写入 `profiles`。应用顶部的退出图标调用 `signOut` 后返回登录页。

## 第 9 步：本地验证

**会修改的文件：** 无。

1. 确认 `.env.local` 已填好，重启开发服务器：

```bash
npm run dev -- --port 3001
```

2. 打开 `http://localhost:3001/app/projects`。未登录时，应自动跳到 `/app/login`。
3. 打开 `http://localhost:3001/app/register`，使用一个新邮箱、至少 8 位密码和显示名称注册。
4. 若启用了邮箱确认，打开邮件并点击确认链接。随后应进入 `/app/projects`。
5. 在 Supabase **Table Editor > profiles** 中确认已生成一条记录，且 `email`、`display_name`、`role=user`、`plan=free`、`created_at` 都有值。
6. 点击右上角退出图标。页面应回到 `/app/login`。
7. 再分别访问 `/app/projects`、`/app/history`、`/app/billing`、`/admin`，都应跳转到 `/app/login`。
8. 回到登录页，用刚才注册的邮箱和密码登录，应进入 `/app/projects`。

## 常见问题

**页面提示 Supabase 未配置**：检查 `.env.local` 的变量名是否完全一致，并重启 `npm run dev`。

**注册成功但没有 profile**：确认第 4 步的 SQL 已完整执行，并在 Supabase 的 **Logs > Postgres Logs** 中查看触发器错误。

**确认邮件点击后回到登录页**：检查 Email Template 是否使用了 `token_hash` 模板，以及 `Redirect URLs` 是否包含本地 `/auth/confirm` 地址。

**登录一直失败**：确认 Authentication > Providers > Email 已启用，并使用已确认邮箱和正确密码。
