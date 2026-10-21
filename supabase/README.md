# AI 营销方案工作台数据库

## 执行顺序

在 Supabase Dashboard 的 **SQL Editor** 中，执行 [schema.sql](./schema.sql) 的完整内容。它包括登录阶段已经需要的 `profiles` 表、注册触发器、全部业务表、索引和 RLS 策略。

已有 `profiles` 的项目也可以直接执行。脚本会补上 `updated_at`、替换旧的 profile 策略，并保留既有用户资料。

## 表与字段说明

| 表 | 用途 | 关键字段 | 最小索引 |
| --- | --- | --- | --- |
| `profiles` | Auth 用户的应用资料、角色和套餐 | `id` 对应 `auth.users.id`，`email`，`display_name`，`role`，`plan` | `lower(email)` 唯一索引 |
| `projects` | 一个营销项目的结构化输入 | `user_id`，`name`，`type`，`product_description`，`target_audience`，`goals`，`selling_points`，`timeline`，`budget_range`，`channels`，`tone`，`status` | `(user_id, updated_at desc)`、`(user_id, status, updated_at desc)` |
| `plans` | 项目下的一份完整方案版本 | `project_id`，`user_id`，`version_number`，`title`，`generation_summary`，`status` | `(project_id, version_number desc)`、`(user_id, created_at desc)` |
| `plan_modules` | 方案的可编辑模块正文 | `plan_id`，`user_id`，`module_key`，`title`，`content`，`sort_order`，`status` | `(plan_id, sort_order)`，并约束同一方案内键和顺序唯一 |
| `plan_module_versions` | 每次模块保存、AI 修改或恢复后的不可变历史 | `module_id`，`user_id`，`content`，`change_note`，`source` | `(module_id, created_at desc)` |
| `ai_generation_records` | AI 生成和修改的审计、用量和失败日志 | `user_id`，`project_id`，`plan_id`，`module_id`，`action`，`instruction`，`status`，`model`，`input_tokens`，`output_tokens`，`error_message` | `(user_id, created_at desc)`、`(project_id, created_at desc)`、`(status, created_at desc)` |

`projects`、`plans`、`plan_modules` 和 `plan_module_versions` 的状态值使用页面上的中文业务状态。`ai_generation_records` 保留每次 AI 请求，不应在客户端修改或删除，因此用户只能追加和读取自己的日志。

## 数据归属与 RLS

每张业务表都保留 `user_id`，同时以外键连接项目、方案和模块。`plans`、`plan_modules`、`plan_module_versions` 的 `user_id` 会由数据库触发器从父对象自动写入，客户端不能借此把数据归到其他用户。

普通用户只能读写自己的项目、方案与模块，并只能读取或追加自己的版本和 AI 日志。`profiles.role = 'admin'` 的用户可以读取全量运营数据，但脚本没有赋予管理员修改他人数据的权限；管理员改角色、套餐或运营数据应走服务端管理接口或 Supabase Dashboard。

## 本地验证

1. 先完成登录接入，并在 `.env.local` 配置 Supabase。
2. 注册一个账号，确认邮箱后，在 Table Editor 中确认 `profiles` 多出 `role=user`、`plan=free` 的记录。
3. 打开 `/app/projects/new`，至少填写项目名称和项目类型后点击“保存草稿”。`app/actions/projects.ts` 会从服务器 Cookie 中取得当前用户，不接收 `user_id`。成功后，Table Editor 的 `projects` 会出现一条 `status=草稿` 的记录。
4. 打开 `/app/projects`，应只读到当前账号的项目，可用草稿、生成中、已生成、已导出、已归档筛选。点击一条项目后，在详情页点击“继续编辑项目”，会回到已填充的表单。
5. 为该项目插入 `plans` 的 `version_number=1` 记录，再依次插入 `plan_modules`。数据库会自动填充子表 `user_id`；读取模块时按 `sort_order` 升序，应得到方案目录和正文。
6. 保存模块内容时，先更新 `plan_modules.content`，再新增一条 `plan_module_versions`，`source` 设为 `手动编辑` 或 `AI 修改`。打开 `/app/history`，应同时看到完整方案版本和模块历史版本。
7. 用第二个普通账号登录后，项目、方案和日志查询应该为空，也无法通过已知 UUID 修改第一个账号的数据。将一个 profile 的 `role` 改为 `admin` 后重新登录，应能读取全量项目和生成日志。

## 前端与服务端文件

| 文件 | 责任 |
| --- | --- |
| `app/(app)/app/projects/new/page.tsx` | 编辑态读取已有项目，并传给表单 |
| `app/actions/projects.ts` | 保存草稿的 Server Action，从服务端登录会话取得用户 |
| `lib/supabase/project-data.ts` | 读取当前用户的项目列表、项目详情和方案历史 |
| `app/(app)/app/projects/page.tsx` | 项目工作台的服务端读取入口 |
| `app/(app)/app/projects/[projectId]/page.tsx` | 项目详情的服务端读取入口 |
| `app/(app)/app/history/page.tsx` | 方案版本和模块版本历史的服务端读取入口 |
| `components/Portal.tsx` | 保存中的反馈、草稿表单、项目列表、项目详情和历史展示 |
