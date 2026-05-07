# dengche-finance — 项目损益账本

老板和合伙人按项目记账、看清每个项目赚没赚、谁该收/付多少的内部网站。

详细需求看 `../REQUIREMENTS.md`，详细执行设计看 `../.claude/memory/workspace/finance/s1/EXECUTION.md`。

---

## 技术栈

- **Framework**: Next.js 16 (App Router) + TypeScript
- **UI**: shadcn/ui + Tailwind CSS 4
- **ORM**: Prisma 7（datasource URL 从 `prisma.config.ts` 读取）
- **DB**: PostgreSQL（生产用 Neon）
- **Auth**: NextAuth v5 (Credentials Provider，邮箱+密码，老板独占注册权)
- **图片存储**: Cloudflare R2（S3 兼容，预签名 URL 直传）
- **包管理**: pnpm

## 信任三锚（设计原则）

1. **强制证据** — 每条流水必须附凭证图片
2. **同步审核** — 老板未审 ≠ 进总账（pending 不计盈亏/趋势）
3. **immutable log** — 不可删/改，错了走"反向冲销"，原条留痕

## 本地开发

```bash
# 1. 装依赖
pnpm install

# 2. 准备环境变量（复制 .env.example 到 .env，填实际值）
cp .env.example .env

# 3. 生成 Prisma client
pnpm prisma generate

# 4. 跑数据库 migration
pnpm prisma migrate dev --name init

# 5. 启动开发服务器
pnpm dev
# → http://localhost:3000
```

## 部署

Vercel 自动部署：`git push` 即触发。

环境变量在 Vercel Dashboard 的 Project Settings → Environment Variables 配置（同 `.env.example`）。

---

## 协作模式

- **dengche** (Claude)：架构、跨文件推理、关键决策、PR review
- **Codex**：批量代码生成、模板代码、UI 组件
- 通过 GitHub PR 异步协同，按 `../dengche/.claude/rules/codex-collaboration.md`

*建档：2026-05-08*
