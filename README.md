# AI 营销方案工作台

## 在自己的电脑上运行

```bash
git clone https://github.com/yyj0627/ai-marketing-workbench.git
cd ai-marketing-workbench
npm install
npm run dev
```

在运行上述命令的那台电脑上打开 `http://localhost:3000/`，先浏览首页，再点击“体验工作台”进入演示。`localhost` 始终指访问者自己的电脑，这不是公开网站地址。演示无需账号或 API Key，可体验需求录入、按“前期分析／主体创意／预算分配”组织的十模块方案初稿、逐模块编辑与修改建议、浏览器保存，以及 Word、PPT 导出。默认方案和修改建议由规则生成，页面会明确标记“规则演示”；不会冒充模型输出。

## 使用 DeepSeek

在 `/demo` 点击“模型设置”，选择“使用自己的 Key”，填入 DeepSeek API Key 和模型即可。Key 仅保存在当前浏览器标签页，关闭标签页后需要重新填写；不会写入方案草稿或导出文件。生成时，项目内容与 Key 会通过本站服务端发送到 DeepSeek。公开部署的站点也可以使用这个入口，每个人使用自己的 Key。访客不填 Key 时，默认使用不调用模型的演示模式。

AI 初稿分三次生成分析、创意和预算，输出包括 PEST、消费者、竞品、SWOT、主题创意、媒介排期与预算明细。没有提供证据的市场判断应作为待验证假设；预算金额是规划分配，并非供应商报价。

如果只在自己的电脑上使用，也可以在项目根目录创建 `.env.local`，填写服务端环境变量：

```text
AI_CHAT_COMPLETIONS_URL=https://api.deepseek.com/chat/completions
AI_MODEL=deepseek-flash
AI_API_KEY=你的 DeepSeek API Key
```

重启 `npm run dev` 后，本机工作台会默认使用这份配置。此时 Key 只由服务端读取，浏览器不会拿到它。若接口出错，页面会显示错误，不会悄悄把规则文本标成 AI 结果。

服务端配置只在开发环境、通过 localhost 或 127.0.0.1 访问时启用；生产环境不会把站点所有者的 Key 开放给访客。公开部署时不要配置 `AI_API_KEY`；如果想使用 AI，请让每位访客在“模型设置”里填写自己的 Key。用户填写的资料与来源不会被系统自动核验。

## 分享项目

GitHub 仓库用于分享源代码，本身不会运行 Next.js 网站。现在其他人只能按上面的步骤把项目下载到自己的电脑，运行后访问自己电脑的 `localhost:3000/`，从首页点击“体验工作台”。如果要让别人直接点开一个公开网址试用，还需要把项目部署到支持 Next.js 服务端接口的平台；部署时不需要填写你的 DeepSeek Key。

`.env.local` 已被 Git 忽略，只有不含真实密钥的 `.env.local.example` 会上传。请勿把真实 Key 写入源代码、截图或部署平台的公开环境变量。

原有 `/app` 项目页需要 Supabase 配置，参见 `.env.local.example`。演示工作台与原有项目页目前是两个独立流程；原有项目页还没有连接新方案生成接口。
