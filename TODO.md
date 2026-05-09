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

- [?] **T-004 分配方案录入 e2e**  *(2026-05-09 卡 step 2 — 老板浏览器试 + 拍优先级)*
  step 1 框架就位但 step 2 submit click 后 server action 似乎没真触发 (无 redirect 无 toast). e2e/allocation.spec.ts test.skip 暂存. 老板试一下 boss → /allocations/new?projectId=seed_project_image2 → 填三人比例, 看是真业务 bug 还是 e2e 写法问题.

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

- [ ] **T-020 反向冲销 e2e + UI**  *(2026-05-09 step 1+2 [x], step 3 真实点击 WIP — 跟 T-004 类似 form 撞墙)*

  ### Steps progress
  - [x] step 1: reverseEntryAction server action (commit b7fe77d)
  - [x] step 2: UI — EntryRow 加 isOwner prop + "反向冲销" 按钮 (OWNER + APPROVED only) + Dialog (commit 4b28718). e2e smoke 2/2 PASS (按钮可见 / 非 OWNER 看不到).
  - [ ] step 3: 真实点击冲销 → 服务端没收到 (button count 不变), 跟 T-004 同根 (React 19 form action + useActionState 在 Dialog 内可能有 quirk). 老板浏览器试 + 拍优先级.

- [x] **T-021 LedgerEvent 时间线展示**  *(2026-05-09 完成, e2e PASS 317ms)*
  新路由 `/projects/[id]/[entryId]` 渲染审计时间线: 4 种 eventType 中文化 (创建/通过/驳回/反向冲销) + JSON payload 折叠.

- [x] **T-022 数据备份脚本**  *(2026-05-09 完成, 跑通: dev.db + uploads.tar.gz 进 backups/, 留 7 天自动清, README cron 例子)*

## P0 — 老板反馈追加 (v0.7 上线后实战发现)

- [ ] **T-040 用户管理 (admin add/edit partner)**  *(2026-05-09 step 1 [x] server actions, step 2-5 待续)*

  ### Steps progress
  - [x] step 1: src/server/admin-users.ts (addPartnerAction + editUserAction, OWNER-only + zod + bcrypt) commit 272f2ab
  - [ ] step 2: src/app/(app)/admin/users/page.tsx — 列表 (table 邮箱/姓名/角色/创建时间/编辑按钮)
  - [ ] step 3: src/app/(app)/admin/users/new/page.tsx — 添加合伙人 form
  - [ ] step 4: src/app/(app)/admin/users/[id]/edit/page.tsx — 编辑 form
  - [ ] step 5: app layout nav 加 OWNER-only 用户链接 + e2e

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

- [ ] **T-030 验证 Dockerfile 真能 build + 跑**
  docker build → docker compose up → curl :3000/login 200。
  README 里现有 Dockerfile 没人测过, Codex 要真跑一次, 跑不通修。

- [ ] **T-031 写 GitHub Actions CI**
  .github/workflows/ci.yml: pnpm install → tsc → lint → build。
  每次 push main 跑。

- [ ] **T-032 README 加 "部署到 finance.dengche.cc" 一节**
  详细步骤: VPS 准备 → DNS 解析 → systemd / docker-compose → nginx + Let's Encrypt。

## ALL_DONE 标志

当**所有 P0 + P1 + P2** 全部 [x], dengche 把本节改写为 `ALL_DONE = true (date)` + 调 PushNotification 通知老板。
P3 不阻塞 ALL_DONE (运维优化, 老板回来再说)。

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
