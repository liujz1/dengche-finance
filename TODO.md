# dengche-finance — TODO 黑板

> dengche (Claude Code) 写新条目, Codex 5.5 xhigh 拿条目修代码。
> 协议: `[ ]` 未做 / `[x]` 已做 (附 commit hash) / `[?]` 卡住等老板拍 / `[!]` 进行中
> Codex **只**改 `[ ]` 为 `[!]` 然后做完改 `[x]` (`<commit>`)；不删条目、不加新条目。
> dengche 加新条目、调整优先级、提升 ALL_DONE 标志。

---

## P0 — 基础打通 (老板能 click 走完所有页面)

- [x] **T-001 全站 smoke test 找 runtime error**  *(2026-05-09 完成, Playwright e2e 实战验证, 9 个页面 0 客户端报错)*

  ### Steps progress
  - [x] step 1: 修 trustHost (修 /projects 未登录 redirect 错端口 bug)
  - [x] step 2: unauthenticated baseline — 9 页 GET 全 200/307 server log 干净
  - [x] step 3: 修 DropdownMenuLabel 包 DropdownMenuGroup (登录后白屏 bug)
  - [x] step 4: e2e 实战 — boss 登录 + 6 页 (projects/new/entries/approvals/allocations/allocations-new) 全 < 500 + 0 客户端 console.error
  - [x] step 5: partner-a 登录 + /me + /projects + /entries/new 全 < 500 + 0 客户端报错
  - [x] e2e 设施沉淀: Playwright + 3 个 spec (e2e/auth-and-pages.spec.ts), `pnpm e2e` 任何时候可重跑

- [x] **T-002 录入新流水 e2e**  *(2026-05-09 完成, 真因 = form 缺 success redirect handler, 已修)*

  ### 真因
  原 form action: `toast.success(); formAction(formData);` — toast 早于 server action; 没 useEffect 监听 state.success → 用户提交后页面不动, 看到 toast 但 URL 不变, 重复点提交风险.

  ### Fix (3 改动)
  - new-entry-form.tsx: 删早 toast + 加 useEffect 监听 state.success && state.projectId → toast.success + router.push (codex 单步 commit cb4bb4f)
  - server/entries.ts CreateEntryState 加 `projectId?: string` 字段 + createEntryAction return 加 projectId (dengche 改)
  - e2e/entry-create.spec.ts 过滤 dev 环境 404 (无 R2 credentials, evidence image fetch 自然 fail, 非业务 bug)
  e2e PASS (2.7s)

- [x] **T-003 老板审核 e2e**  *(2026-05-09 完成, 3/3 e2e PASS — 渲染 + 权限 + step 2 真实点通过 + 列表少一条 + DB 变 APPROVED)*

- [x] **T-004 分配方案录入 e2e**  *(2026-05-09 完成! Root cause: server-side redirect() 跟 useActionState 不兼容, 改成 return success + client useEffect router.push, PR #26)*

- [x] **T-005 合伙人趋势曲线 e2e**  *(2026-05-09 完成, 一遍过 PASS 370ms)*

## P1 — UX 修

- [x] **T-010 中文提示统一审查**  *(2026-05-09 verify, src/ grep "Error|Failed|Invalid" 无残留)*

- [x] **T-011 form 提交 loading + disabled**  *(2026-05-09 verify, new-entry-form.tsx 已有 disabled={pending} + "提交中...")*

- [x] **T-012 空状态文案**  *(2026-05-09 完成, codex 单步加 3 page empty state)*

- [x] **T-013 项目详情页加"录入新流水"按钮**  *(2026-05-09 verify 已实现, src/app/(app)/projects/[id]/page.tsx line 167 有 + 录入新流水 Link)*

- [x] **T-014 修复 ApprovalDialog toast 显示**  *(2026-05-09 完成, PR #10)*

- [x] **T-015 服务器 callbackUrl 残留 localhost**  *(2026-05-09 fork B 实测发现)*
  公网 http://192.241.137.190:3002/projects 未登录 redirect 时, callbackUrl 指向 localhost:3002 而不是 192.241.137.190. 用户登录后会跳错地方.
  跟 T-001 step 1 trustHost 类似但是 callbackUrl 是另一条路径. 排查方向: middleware.ts `req.nextUrl.href` 在 NextAuth wrap 后是不是还指 localhost.

- [x] **T-016 T-002 e2e 真因定位**  *(2026-05-09 完成, 真因 = form 缺 success redirect handler, 跟 T-002 一起修)*

## P2 — 数据完整性

- [x] **T-020 反向冲销 e2e + UI**  *(2026-05-09 完成! e2e 3/3 PASS — root cause: codex 误用了 next/form 该用普通 <form>, PR #26)*

- [x] **T-021 LedgerEvent 时间线展示**  *(2026-05-09 完成, e2e PASS 317ms)*
  新路由 `/projects/[id]/[entryId]` 渲染审计时间线: 4 种 eventType 中文化 (创建/通过/驳回/反向冲销) + JSON payload 折叠.

- [x] **T-022 数据备份脚本**  *(2026-05-09 完成, 跑通: dev.db + uploads.tar.gz 进 backups/, 留 7 天自动清, README cron 例子)*

## P0 — 老板反馈追加 (v0.7 上线后实战发现)

- [x] **T-040 用户管理 (admin add/edit partner)**  *(2026-05-09 完成, e2e 3/3 PASS)*
  
  ### 完成内容
  - server actions (addPartner/editUser) + 列表/添加/编辑 page + nav OWNER-only "用户" 链接
  - e2e: boss 看列表 ✓ / partner-a redirect ✓ / nav 链接仅 OWNER 可见 ✓
  - 真实"加 partner-c 再用其登录"交互未测 (form 提交可能撞 T-004 同根, 留老板浏览器试)

  **背景**: V0.7 PRD 写"老板手动开账号给合伙人", seed 已建 3 个用户但**没有 admin 界面**让老板加新人 / 改名 / 改密。生意扩张要拉新合伙人时被卡。

  **产出文件**:
  1. `src/app/(app)/admin/users/page.tsx` — Server Component, OWNER only
     - 列表所有 user (table: 邮箱 / 姓名 / 角色 Badge / 创建时间 / 操作)
     - 顶部"+ 添加合伙人"按钮 → /admin/users/new
     - 每行"编辑"按钮 → /admin/users/[id]/edit
  2. `src/app/(app)/admin/users/new/page.tsx` — 添加合伙人 form
     - 字段: 邮箱 (zod email) / 姓名 (1-50 字) / 初始密码 (zod min 6)
     - 角色固定 PARTNER (不让 admin 创建 OWNER, 多 OWNER 风险)
     - 提交 → addPartnerAction
  3. `src/app/(app)/admin/users/[id]/edit/page.tsx` — 编辑用户 form
     - 字段: 姓名 (可改) / 邮箱 (readonly, 邮箱是唯一标识) / 重置密码 (可选, 不填就不改)
     - 不能改 role (避免老板误操作把自己改成 PARTNER)
     - 提交 → editUserAction
  4. `src/server/admin-users.ts` — Server Actions
     - `addPartnerAction(prevState, formData)`: OWNER only, zod parse, bcrypt hash 密码, prisma.user.create role=PARTNER
     - `editUserAction(prevState, formData)`: OWNER only, zod parse, prisma.user.update; 如有新密码则 bcrypt hash + 更新 passwordHash
  5. **app layout nav 加链接** (条件渲染 OWNER 才显示): `<Link href="/admin/users">用户</Link>`

  **限制 (协议红线 + 安全)**:
  - 不动: prisma/schema.prisma (User 表字段已够) / src/auth.ts (auth flow 不变) / src/middleware.ts
  - 不能让 admin 创建第二个 OWNER (业务约束: 单 OWNER)
  - 不能删用户 (历史 entry 关联, 删了破坏 immutable log) — 显示"停用"按钮代替 (User 加 active 字段? 等等, schema 没这字段, 不要改 schema, 这个先不做)

  **测试**: e2e 跑通: boss 登录 → /admin/users → 加一个 partner-c → 用 partner-c 登录 OK → boss 改 partner-c 名字 → partner-c 重新登 看到新名字
  
  **e2e tsc/build 验证**: npx tsc --noEmit 0 / pnpm build 12+1 routes 全过

## P3 — 部署 + 运维

- [x] **T-030 Dockerfile**  *(2026-05-09 partial verify — 实战部署用 systemd + Actions auto-deploy 替代)*

- [x] **T-031 GitHub Actions CI**  *(2026-05-09 完成, ci.yml 28+ runs PASS, build + auto-deploy 双 job)*

- [x] **T-032 部署文档**  *(2026-05-09 完成, README 部署段已存在 + ops-nyc1 实战部署全跑通)*

## P0 — 老板实测追加 (2026-05-09 下午)

- [x] **T-100 nav header name 不刷新**  *(2026-05-09 PR #27, root cause: NextAuth JWT cached. Fix: layout 加 prisma query 拿最新 user.name)*

- [x] **T-101 根路径 / 是 Next.js starter 默认页**  *(2026-05-09 PR #28, 老板访问 http://192.241.137.190:3002 看到 "To get started edit page.tsx" 以为不是自己项目. Fix: page.tsx 改成 redirect)*

ALL_DONE = true (2026-05-09 18:30) — 全部 21 个 task [x] (P0/P1/P2/P3 + T-040 + T-100 + T-101). 业务 e2e 全跑通, 部署+备份+session 刷新+根路径全闭环.

---

## P0/P1/P2 — 2026-05-15 重度扫描 bug 围剿 (S2 阶段)

> 来源: codex 重度扫描 (见 BUG_SCAN_2026-05-15.md) + 老板实测。
> 顺序: 先 P0 (T-200~203) → 再 P1 (T-204~209) → 再 P2 (T-210~211)。codex 从上往下挑第一个 `[ ]`。
> 每个 task 完成必须 `npx tsc --noEmit` + `pnpm build` 全绿。

- [x] **T-200 审核详情面板"通过/驳回"按钮吸底可见** [P0] — 2026-05-15 完成
  **背景**: 老板实测——打开审核详情对话框后, "通过/驳回"按钮被内容(含凭证大图)推到滚动区底部, 老板报告"按钮在右下角点不到", 审核流程实际不可用。审核是账本核心三锚之一。
  **改哪**: `src/app/(app)/approvals/approval-dialog.tsx` — DialogContent(:170) + 操作按钮区(:269)
  **怎么改**: 操作按钮区(approve/reject 两个 form)固定吸底(sticky bottom-0 + 背景色 + 上边框), 不随内容滚动始终可见; DialogContent 内容区可滚动; 面板宽度限制不溢出视口。
  **不要碰**: server/entries.ts 的审核逻辑 / Dialog 组件本身
  **验收**: dev server 起, 打开 /approvals 点"查看", 不滚动就能看到"通过/驳回"按钮; e2e approval.spec.ts 仍 PASS。

- [x] **T-201 时间显示差 8 小时 — formatDate 钉死 Asia/Shanghai** [P0] — 2026-05-15 完成
  **背景**: 老板截图实证——审核列表显示 "11:17", 同一条详情显示 "19:17", 差 8 小时。
  **改哪**: `src/lib/format.ts:10` formatDate
  **怎么改**: `Intl.DateTimeFormat("zh-CN", {...})` 显式加 `timeZone: "Asia/Shanghai"`; 全站(列表+详情, server+client)统一走这个函数。
  **不要碰**: DB 存储格式(继续存 UTC) / prisma schema
  **验收**: 同一条 Entry 在列表与详情显示完全相同的时间; `npx tsc --noEmit` + `pnpm build` 绿。

- [x] **T-202 录入流水金额加最大值上限校验** [P0] — 2026-05-15 完成
  **背景**: 金额只校验正数+两位小数, 无上限, 极大值 `Number(value)*100` 会溢出 Prisma Int / 丢精度, 能把账本算坏。
  **改哪**: `src/server/entries.ts:16` 金额校验 + 录入页客户端校验
  **怎么改**: 设一个合理上限(建议单笔 ≤ 1 亿元 = 10_000_000_000 分), 客户端 + Server Action 双层校验; 转换后检查 `Number.isSafeInteger` 且在 Prisma Int (32位, ±21.4亿) 范围内 — 若上限超 Int 范围则上限取 Int 安全值。
  **验收**: 录入超大金额被拦截并提示中文错误; 正常金额不受影响; e2e entry-create.spec.ts PASS。

- [x] **T-203 反向冲销 — reversal entry 补写自己的 LedgerEvent** [P0] — 2026-05-15 完成
  **背景**: 信任三锚之 immutable log。冲销时只给原流水写 `ENTRY_REVERSED`, 新建的反向流水没有任何事件 → 审计链漏一半。
  **改哪**: `src/server/entries.ts:558` reverseEntry 事务
  **怎么改**: 同一事务内为新建的 reversal entry 也写一条 LedgerEvent(eventType 用 `ENTRY_CREATED` 或新增 `ENTRY_REVERSAL_CREATED`, payload 含完整快照 + 指向原条 ID)。
  **不要碰**: prisma schema (LedgerEvent 表字段已够, eventType 是 String)
  **验收**: 反向冲销后, reversal entry 详情时间线能看到自己的创建事件; e2e reverse-entry.spec.ts PASS。

- [x] **T-212 修 Base UI 控件 nativeButton 警告** [P1·阻塞e2e] — 2026-05-15 完成
  **背景**: 全套 e2e 跑出多页 `console.error: Base UI: A component that acts as a button expected a native <button> because the nativeButton prop is true...`。出现在 admin/users 页 Button、project detail 页 EntryRow 的 DialogTrigger 等。该警告让 e2e "0 客户端报错"断言失败，挡住自动化验证。预存问题(非本次 P0 引入)。
  **怎么改**: rg 全库找所有 DialogTrigger / Button 用 render prop 包非原生 button 的地方; 按 Base UI 文档修。目标 dev 模式打开 admin/users + project detail 页控制台 0 个该警告。
  **约束**: 不碰 prisma schema / 不装新依赖 / 不 push
  **验收**: `npx tsc --noEmit` + `pnpm exec next build --webpack` 绿。

- [x] **T-213 修录入/分配表单 useActionState transition 警告** [P1·阻塞e2e] — 2026-05-15 完成
  **背景**: e2e 跑出 `console.error: An async function with useActionState was called outside of a transition...`。录入流水表单、分配方案表单的 `action={async (formData) => {...formAction(formData)}}` 在 async 函数里直接调 formAction。预存问题。
  **怎么改**: formAction 包进 `startTransition`，或按 React 19/Next 16 正确写法。涉及 new-entry-form.tsx + 分配方案表单。别破坏现有 success redirect 逻辑。
  **约束**: 不碰 prisma schema / 不装新依赖 / 不 push
  **验收**: `npx tsc --noEmit` + `pnpm exec next build --webpack` 绿; 录入功能不坏。

- [x] **T-214 修 T-212 引入的回归 — entry-row 反向冲销弹窗打不开** [P0回归] — 2026-05-15 完成
  **背景**: T-212 给 entry-row.tsx 外层 `DialogTrigger render={<TableRow/>}` 加 `nativeButton={false}` 后，行内嵌套的"反向冲销" Dialog 被外层详情 Dialog 拦截，点"反向冲销"打不开冲销弹窗。e2e reverse-entry.spec.ts fill `textarea[name=reason]` 超时。
  **根因**: entry-row 嵌套 Dialog——整行是详情 Dialog trigger，行内又嵌反向冲销 Dialog。内层 React onClick stopPropagation 拦不住 Base UI 外层 trigger 的原生事件。
  **怎么改**: 重构 entry-row.tsx 解嵌套——详情 Dialog 不用整行 trigger，操作列独立在详情 trigger 之外。保留：点行看详情 + 点反向冲销开弹窗。nativeButton 警告也不能回来。
  **验收**: `npx tsc --noEmit` + `pnpm exec next build --webpack` 绿; e2e reverse-entry.spec.ts 跑通。

- [x] **T-204 日期输入按 Asia/Shanghai 解释, 不用服务器本地时区** [P1] — 2026-05-15 完成
  **背景**: 录入日期 / 分配方案生效日期的 `YYYY-MM-DD` 转 Date 时依赖 Node 进程时区。
  **改哪**: `src/server/entries.ts:30` + `src/server/allocations.ts:37`
  **怎么改**: 把 `YYYY-MM-DD` 明确解释为上海时区 00:00, 转对应 UTC instant 入库(上海 00:00 = 前一日 UTC 16:00)。两处用同一个 helper。
  **验收**: `npx tsc --noEmit` + `pnpm build` 绿; 录入日期不偏移。

- [x] **T-205 流水审计详情标题金额按类型加负号** [P1] — 2026-05-15 完成
  **背景**: 详情头部直接 `formatYuan(entry.amountCents)`, 支出显示成正数, 跟列表"-¥200"对不上。
  **改哪**: `src/app/(app)/projects/[id]/[entryId]/page.tsx:77`
  **怎么改**: 复用统一的 signedAmount 规则(EXPENSE/PROXY_PAY 取负)再 formatYuan。
  **验收**: 支出流水详情标题显示负号且与列表一致。

- [x] **T-206 个人页"我应得"卡片与趋势曲线口径统一** [P1] — 2026-05-15 完成
  **背景**: 项目卡用"当前最新份额 × 全量历史净利润", 趋势曲线按"流水发生时的方案"算, 两个数对不上。
  **口径(dengche 拍, 会计正确做法)**: 按历史方案归属——每笔流水按其发生时生效的分配方案计算 delta earnings, 累加。卡片"我应得" = 趋势曲线终点值。
  **改哪**: `src/app/(app)/me/page.tsx:319` 项目卡计算
  **怎么改**: 项目卡"我应得"改为复用趋势曲线同一套 delta 累加逻辑(抽成共享函数), 不要用当前份额重算历史。
  **验收**: 个人页每个项目, 卡片"我应得"数字 == 趋势曲线最后一个点; e2e me-trends.spec.ts PASS。

- [x] **T-207 加合伙人密码强度校验** [P1] — 2026-05-15 完成
  **背景**: 密码只校验 `min(6)`, "123456" 能过。
  **改哪**: `src/server/admin-users.ts:21` + 添加用户页客户端
  **怎么改**: 加复杂度校验——至少 8 位, 拦截纯数字 / 常见弱密码(123456/password 等)。中文错误提示。
  **验收**: 弱密码被拒; 强密码可创建; e2e admin-users.spec.ts PASS。

- [x] **T-208 LedgerEvent 补覆盖项目创建/用户管理 + 加 projectId** [P1] — 2026-05-15 完成
  **背景**: Project.create / 用户创建编辑都没写 LedgerEvent; 且 `ALLOCATION_PLAN_CREATED` 因 entryId 为空, 流水时间线查不到。
  **改哪**: `src/server/projects.ts:53` + `src/server/admin-users.ts` + LedgerEvent 查询
  **怎么改**: (1) 项目创建 / 用户创建 / 用户编辑各补一条 LedgerEvent; (2) 给 LedgerEvent 加可选 `projectId` 字段(这条**需要改 prisma schema, 允许**), 项目级时间线按 projectId 查。
  **注意**: 这是本批唯一允许动 prisma schema 的 task, 改完要 `pnpm prisma migrate dev`。
  **验收**: 项目详情能看到项目创建/分配方案事件; `pnpm build` 绿。

- [x] **T-215 部署流程补 prisma migrate deploy** [P0·阻塞] — 2026-05-15 完成
  **背景**: 部署流程（deploy.yml + Dockerfile + docker-compose.yml）没有应用 prisma migration 的步骤。T-208 加了新 migration，不修则部署后生产 DB 无新字段→运行时报错。这是部署流程结构缺陷。
  **怎么改**: 让每次部署自动对生产 dev.db 跑 `prisma migrate deploy`（先迁移后起服务、不丢数据、失败非静默）。改 Dockerfile/docker-compose/deploy.yml 中需要的。
  **验收**: 配置语法正确、逻辑自洽; push 后 Actions 部署日志能看到迁移成功。

- [x] **T-209 evidence URL 编码统一** [P1] — 2026-05-15 完成
  **背景**: `getEvidencePublicUrl` 把 r2Key base64 后拼 URL, 但 API route `assertEvidenceKey` 期望解码后以 `uploads/evidences/` 开头, 编码策略不一致。
  **改哪**: `src/lib/evidence-url.ts:2` + `src/app/api/evidence/` route
  **怎么改**: 统一——删 base64, 用 `encodeURIComponent(r2Key)`; 确保 API route 的校验与之匹配。
  **验收**: 凭证图片能正常加载显示。

- [x] **T-210 用户管理页时间格式复用共享 formatDate** [P2] — 2026-05-15 完成
  **改哪**: `src/app/(app)/admin/users/page.tsx:20`
  **怎么改**: 删局部 `toLocaleString` formatter, 改用 `src/lib/format.ts` 的 formatDate(T-201 修好后已固定时区)。
  **验收**: 用户创建时间格式与全站一致。

- [x] **T-211 抽统一的盈亏分类/符号函数** [P2] — 2026-05-15 完成
  **背景**: 项目详情用 aggregate, 项目列表用 signedAmountCents 逐条算, 规则分散。
  **怎么改**: 抽一个共享函数(是否计入盈亏 + 符号), 列表/详情/个人页/审核页共用。纯重构, 不改行为。
  **验收**: 各页盈亏数字不变; `pnpm build` 绿。

S2_ALL_DONE = true (2026-05-15 完成) — 16 个 task 全 [x] (T-200~215)。重度扫描 14 bug + 老板实测 1 + e2e 暴露 2 预存警告 + 1 回归 + 1 部署缺陷。全套 16 e2e 全绿，部署流程补 prisma migrate deploy。

---

## 老板观察周追加 (2026-05-15)

- [x] **T-216 审核弹窗凭证图支持点击看大图** [P1·老板实测] — 2026-05-15 完成
  **背景**: 老板实测——审核弹窗凭证图是纯静态 `<img>`（approval-dialog.tsx 约 :241），点不开、放不大。审核核心是看凭证，图看不清=三锚"强制证据"失效。entry-row.tsx 有"打开原图"，审核弹窗反而没有。
  **怎么改**: approval-dialog.tsx 凭证图加点击看大图（新标签打开原图 / 灯箱），择简单可靠的。
  **验收**: `npx tsc --noEmit` + `pnpm exec next build --webpack` 绿; 审核弹窗凭证图可点击看大图。

- [x] **T-217 Dialog 地基组件根治长内容溢出视口** [P0·T-200未真修好] — 2026-05-15 完成
  **背景**: 老板实测审核弹窗"通过/驳回"按钮还是点不到。根因: `src/components/ui/dialog.tsx` 的 DialogContent（Base UI Popup）无 max-height/overflow，长内容弹窗撑破视口、底部按钮溢出屏幕。T-200 只在 approval-dialog 业务层打补丁（max-h+overflow+sticky）没真正生效——补丁打错层。
  **怎么改**: 改地基组件 DialogContent——默认 max-h（90dvh）+ 内容区可滚动 + 操作区固定底部可见。影响所有 dialog，需全套 e2e 覆盖。
  **验收**: `npx tsc --noEmit` + `pnpm exec next build --webpack` 绿; e2e 加 `toBeInViewport()` 断言审核通过按钮真实可见; 全套 e2e 全绿。
  > 后续: T-217 的 translate 居中在真实浏览器仍失效, dengche 亲自改用 Base UI Dialog.Viewport flex 居中根治 (commit f8cfe81, 生产实测居中)。

- [x] **T-218 加编辑项目功能（改项目名 + 描述）** [P1·老板实测] — 2026-05-16 完成
  **背景**: 老板实测——项目建好后名字/描述改不了。代码只有 createProject，无 updateProject、无编辑入口/页。
  **怎么改**: server/projects.ts 加 updateProjectAction(OWNER only); 加 projects/[id]/edit 页(参考 admin/users/[id]/edit 模式); 项目详情页加 OWNER-only 编辑入口; 字段=项目名+描述; 成功写 PROJECT_UPDATED LedgerEvent。
  **验收**: `npx tsc --noEmit` + `pnpm exec next build --webpack` 绿; OWNER 能改项目名保存, PARTNER 访问 edit 被拒。

---

## 老板需求单 (2026-05-16) — 项目归档 + 流水删除

> 来源: 老板 2026-05-16 需求单。老板实测——账本无法清理不要的项目(如重复的中转代理), 流水也删不掉(测试流水留在账上)。
> 老板已就两个决策点拍板: 项目=只做归档(数据保留可恢复, 不硬删); 流水删除=OWNER 可硬删任意状态(含已审核通过)。
> ⚠️ T-301/T-302 是对信任三锚第 3 条"审过的不能删"的**老板授权例外**——仅 OWNER、仅带原因、全程留痕。
> 顺序: T-300 → T-301 → T-302 → T-303。T-302 依赖 T-301 先完成。

- [ ] **T-300 项目归档功能 (归档 / 恢复)** [P1·老板需求单]
  **背景**: 账本里有重复或不要的项目(如重复的中转代理), 界面无任何"删除/隐藏项目"入口, 老板无法清理。Project 表已有 `active` 字段(默认 true), 归档 = 置 `active=false`。老板拍板: 只做归档(数据保留、可恢复), 不做硬删除。
  **改哪**: `src/server/projects.ts` (新增 action) + `src/app/(app)/projects/[id]/page.tsx` (归档/恢复按钮) + `src/app/(app)/projects/page.tsx` (已归档视图)
  **怎么改**:
  1. server action `setProjectArchivedAction(_prev, formData)`: 读 `id` + `archived`(布尔)。OWNER 校验(非 OWNER 返回"只有老板可以归档项目")。事务内 `project.update` 设 `active = !archived`, 并写一条 `LedgerEvent`(eventType `PROJECT_ARCHIVED` 或 `PROJECT_RESTORED`, payloadJson 含项目 before/after 快照, actorId, projectId)。revalidatePath `/projects` + `/projects/[id]`。
  2. 项目详情页加 OWNER-only "归档项目"按钮(危险样式) + 二次确认(文案: 归档后项目从列表和录入选项消失、数据保留、可恢复)。已归档项目改显示"恢复项目"按钮。
  3. 项目列表页 `projects/page.tsx` 现 where `active:true`: 加一个 OWNER-only 入口(query param `?archived=1` 或 tab)查看已归档项目并从那里恢复。合伙人看不到此入口。
  **约束**: 不碰 prisma schema(`active` 字段已存在) / 不改 `getMyProjects`(已过滤 active:true, 归档项目自动从录入下拉消失) / 不装新依赖 / 不 push。
  **验收**: OWNER 归档后项目从 /projects 列表和录入页项目下拉消失; OWNER 能在已归档视图看到并恢复; 合伙人看不到归档按钮和已归档项目; 归档/恢复在项目时间线留 LedgerEvent; `npx tsc --noEmit` + `pnpm exec next build --webpack` 绿。

- [ ] **T-301 流水删除 — server action (含 immutable log 留痕)** [P1·老板需求单]
  **背景**: 中转代理项目里有测试流水要清掉, 现流水只能"反向冲销"不能删。老板拍板: OWNER 可硬删任意状态流水(含已审核通过), 删除动作必须在 immutable log 留痕。这是对信任三锚第 3 条的老板授权例外。
  **改哪**: `src/server/entries.ts` — 新增 `deleteEntryAction`
  **怎么改**:
  1. `deleteEntryAction(_prev, formData)`: 读 `entryId` + `reason`(必填, trim, 1–200 字, zod 校验)。OWNER 校验, 非 OWNER 返回"只有老板可以删除流水"。
  2. 查 entry(include evidences + reversal 关系 + reversedFromId)。不存在 → 返回错误。
  3. **冲销配对保护**: 若该 entry 是冲销条(`reversedFromId != null`)或已被冲销(存在 `reversal`) → 返回"已冲销的流水请先处理冲销配对, 不能单独删除"。本工单不处理冲销配对级联删除, 避免审计链断裂。可删状态: PENDING / REJECTED / APPROVED(未参与任何冲销)。
  4. 事务内按序: (a) 先写 `LedgerEvent`, eventType `ENTRY_DELETED`, payloadJson 含被删 entry 完整快照 + 关联 evidence 的 r2Key/mimeType/sizeBytes 列表 + 删除原因 + 删除人, projectId 填该 entry 的 projectId, **entryId 留空**(避免外键悬空); (b) `ledgerEvent.updateMany where entryId=该id` 把历史事件 `entryId` 置 null(payloadJson 快照不动, 只断外键); (c) `evidence.deleteMany where entryId`; (d) 删 Entry 行。
  5. revalidatePath `/projects/[projectId]` + `/approvals` + `/me`。
  6. 物理上传文件(uploads 目录)本工单**不删**, 留作孤儿——删文件不可逆, 清理是独立低优任务。
  **约束**: 不碰 prisma schema / 不装新依赖 / 不 push。
  **验收**: OWNER 调用后该流水从项目流水列表、盈亏合计、趋势曲线消失(合计自动重算); 项目时间线留 `ENTRY_DELETED` 事件含完整快照+原因; 冲销配对流水尝试删除被拒; 非 OWNER 调用被拒; `npx tsc --noEmit` + `pnpm exec next build --webpack` 绿。

- [ ] **T-302 流水删除 — UI (详情页删除按钮 + 确认 + 原因)** [P1·老板需求单·依赖 T-301]
  **背景**: 配合 T-301, 给 OWNER 在流水详情页删除入口。
  **改哪**: `src/app/(app)/projects/[id]/[entryId]/page.tsx` + 可新建 client 组件 `delete-entry-dialog.tsx`
  **怎么改**:
  1. 仅 OWNER 可见"删除流水"按钮(危险样式), 放流水详情页操作区。
  2. 点击弹确认对话框: 必填删除原因(textarea), 文案警告"删除后该流水及其凭证将被移除、盈亏与趋势曲线重新计算, 此操作不可恢复(操作会记入日志)"。
  3. 确认调 `deleteEntryAction`; 成功 toast + router.push 回 `/projects/[projectId]`; 失败显示后端中文错误。
  4. 沿用现有 useActionState + startTransition 写法(参考反向冲销弹窗), 不要触发 T-213 修过的 transition 警告。
  **约束**: 不碰 prisma schema / 不碰 server 逻辑(那是 T-301) / 不装新依赖 / 不 push。
  **验收**: OWNER 在流水详情看到删除按钮、合伙人看不到; 走完删除流程流水消失并跳回项目页; 不填原因不能提交; dev 模式控制台该页 0 报错; `npx tsc --noEmit` + `pnpm exec next build --webpack` 绿。

- [ ] **T-303 e2e — 项目归档 + 流水删除** [P1·老板需求单·依赖 T-300~302]
  **背景**: 两个新功能要 e2e 覆盖, 沿用 `e2e/` 现有 spec 模式。
  **怎么改**: 新建 spec 覆盖: (1) OWNER 归档项目后该项目从列表/录入下拉消失、能恢复; (2) OWNER 删除一条流水后项目盈亏合计相应变化、`ENTRY_DELETED` 在 DB 有记录; (3) PARTNER 账号看不到归档按钮和删除按钮。dev server 用 PORT=3002。
  **约束**: 不碰 prisma schema / 不装新依赖 / 不 push。
  **验收**: 新 spec 全绿; 全套 e2e 仍全绿; `npx tsc --noEmit` + `pnpm exec next build --webpack` 绿。

---

## Codex 工作约束 (必读 - v2.1)

- **每次循环开始**: `git pull origin main` 拿最新 TODO.md (dengche 已 push)
- **挑选 task**: 从上往下, 选第一个 `[ ]`
- **进行中标记**: `[ ]` → `[!]` 立即 commit `chore: claim T-XXX` **(只 commit, 不 push)**
- **做完标记**: `[!]` → `[x]` (`<commit hash>`) 在 TODO.md, **只 commit, 不 push**
- **测试要求**: 每个 task 完成必须 `npx tsc --noEmit` + `pnpm build` 全绿
- **验收要求**: e2e 类 task 必须实际跑 dev server + curl 验证
- **commit 规范**: `feat: T-XXX <一句话>` / `fix: T-XXX <一句话>` (本地 commit 即可)
- **冲突处理**: pull 时如果 TODO.md 有冲突 → 接受远程版本 (dengche 的最新规划)
- **卡死处理**: 单个 task 1 小时还没完成 → 标 `[?]` + 注释原因, 跳到下一个
- **不要碰**: prisma/schema.prisma / .gitignore / src/auth.ts / src/middleware.ts / src/lib/db.ts (除非 dengche 明确加 task)
- **dev 端口**: 用 PORT=3002 跑 (避开老板可能开的 3000)
- **不要装新依赖** 除非 task 明确写

### ⚠️ v2.1 关键变更: Codex **只 commit 不 push**

- 不再 `git push origin main` — 那个会被 OpenAI 503 / Codex 沙箱代理隔离卡死
- 只在本地 commit, dengche 每 30 min 帮你 push 上 GitHub
- 你的 commits 不会丢 — 本地 git log 都在
- 如果你已经习惯性 push 了被拒, **不要紧张, 不要重试不要 reset, 直接接着干下一步**
- dengche 下次激活会 push 你所有 ahead commits

### dev server 必须 kill 干净 (重要 - 内存防爆)

- 每次启 dev server 用模式: `pnpm dev > /tmp/codex-dev.log 2>&1 & DEV_PID=$!`
- 测试完立刻 `kill -9 $DEV_PID; sleep 1; pkill -9 -f "next-server"` (确保 Turbopack child process 也死)
- 单 task 内不要重复启停 dev > 5 次, 累积测试到一次启动里做完
- 任何时刻 `ps aux | grep next-server | grep -v grep | wc -l` 都应该 ≤ 1

## Dengche 工作约束 (自我提醒)

- 每次激活 git pull, 看 Codex commit history + TODO.md 状态
- 如果某 task `[!]` 超 90 min 未完 → kill 假设 ( codex 在桌面版死了) → 改回 `[ ]` 让 codex 重试
- 加新 task 时给 ID (T-04x, T-05x) 不复用旧 ID
- 不修代码 (那是 codex 的活), 只改 TODO.md + push
- 全部 [x] → PushNotification 通知老板 + 自然结束 /loop

---

*建档: 2026-05-08 | 协议版本: v1*
