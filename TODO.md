# dengche-finance — TODO 黑板

> dengche (Claude Code) 写新条目, Codex 5.5 xhigh 拿条目修代码。
> 协议: `[ ]` 未做 / `[x]` 已做 (附 commit hash) / `[?]` 卡住等老板拍 / `[!]` 进行中
> Codex **只**改 `[ ]` 为 `[!]` 然后做完改 `[x]` (`<commit>`)；不删条目、不加新条目。
> dengche 加新条目、调整优先级、提升 ALL_DONE 标志。

---

## P0 — 基础打通 (老板能 click 走完所有页面)

- [ ] **T-001 全站 smoke test 找 runtime error**  *(2026-05-09 v4.2 进度: step 1 已完成, 走 v4.2 自动挡 step-by-step 模式, 不要重做 step 1)*
  跑 `pnpm dev -p 3002`, 用 boss/partner-a/partner-b 三个账号分别登录, 依次点击:
  /login → /projects → /projects/[第一个项目id] → /projects/new (boss) → /entries/new → /approvals (boss) → /allocations (boss) → /allocations/new (boss) → /me (partner-a)
  每个页面截 server log 里的 error/warning, 全部修干净 (0 server-side error)。
  完成标志: 三个账号扫一遍全 200, 无 server log error。

  ### Steps progress
  - [x] step 1: /projects 未登录 redirect 到 localhost:3000 (dev port 3002 不对) — 修 src/auth.config.ts 加 trustHost: true (v4.0 模式 push, commit hash 因 filter-repo 重写改成 `2fc784c`; dengche 已改 .env 注释 AUTH_URL 配合)
  - [x] step 2: unauthenticated baseline — 9 个页面裸 GET 全 200/307, server log 完全干净 (无 error/warn). 登录后探索移到 step 3.
  - [ ] step 3: boss 登录后 GET /projects → 看列表渲染 + server log
  - [ ] step 4: boss GET /projects/[第一个 id] → 详情页
  - [ ] step 5: boss GET /projects/new + POST 建项目 → 看 server log
  - [ ] step 6: partner-a 登录 → GET /entries/new → POST 录流水
  - [ ] step 7: boss GET /approvals → 看待审列表
  - [ ] step 8: boss GET /allocations + /allocations/new
  - [ ] step 9: partner-a GET /me → 看个人趋势
  - [ ] step 10: 三个账号扫一遍 + 0 server log error → 标 task [x]

- [?] **T-002 录入新流水 e2e**
  用 partner-a 登录 → /entries/new → 填项目=image2, 类型=支出, 金额=88.50, 描述="测试一笔", 时间=今天, 上传任一图片 → 提交。
  期望: redirect 到 /projects/[image2-id], Toast 提示"已提交,等待审核", 该笔在流水列表里 PENDING 状态显示。
  跑通 + 修任何 bug。

- [ ] **T-003 老板审核 e2e**
  用 boss 登录 → /approvals → 看到 T-002 录入的待审 → 点查看 → Dialog 显示金额+图片+描述 → 点"通过"。
  期望: Dialog 关闭, 列表少一条, /projects/[id] 里这笔变 APPROVED, 项目盈亏更新。

- [ ] **T-004 分配方案录入 e2e**
  boss → /allocations/new?projectId=image2 → 修改三人比例 (合计仍=100%) → 保存。
  期望: redirect /allocations, 看到新方案为最新生效。

- [ ] **T-005 合伙人趋势曲线 e2e**
  partner-a → /me → 看到 image2 + windsurf 两个项目卡片 + 趋势 chart。
  期望: chart 渲染, 项目应得金额计算正确 (净利润 × basisPoints / 10000)。

## P1 — UX 修

- [ ] **T-010 中文提示统一审查**
  全站搜索 "Error" / "Failed" / 英文短语, 全部翻译为中文友好提示。
  特别检查 zod error message。

- [ ] **T-011 form 提交 loading + disabled**
  所有 form 在 pending 期间按钮 disabled + 显示 spinner (sonner toast 'submitting...')。

- [ ] **T-012 空状态文案**
  /projects 无项目时显示 "还没有项目, 老板可以新建一个"
  /approvals 无待审显示 "审核待办空了"
  /me 无数据显示 "等老板审核第一笔录入后这里会有曲线"

- [ ] **T-013 项目详情页加"录入新流水"按钮**
  /projects/[id] 顶部加一个绿色 button "+ 录入新流水"  → /entries/new?projectId=[id]
  这是高频动作, 不该埋在 nav 里。

## P2 — 数据完整性

- [ ] **T-020 反向冲销 e2e + UI**
  approve 过的 entry 在详情 / 项目流水里加一个 "反向冲销" 按钮 (OWNER 专属)。
  点了弹 Dialog 输入原因 → 调 reverseEntryAction。
  验证: 原条 status='VOIDED' 划线显示, 新建的反向条 amountCents 相反, LedgerEvent 留两条。

- [ ] **T-021 LedgerEvent 时间线展示**
  /projects/[id]/[entryId] 单条详情页 (新建路由) 显示该 entry 所有 LedgerEvent (创建 / 审核 / 驳回 / 冲销) 时间线。
  审计可视化。

- [ ] **T-022 数据备份脚本**
  写 scripts/backup.sh: cp dev.db backups/dev-$(date +%Y%m%d-%H%M).db + tar uploads/
  README 加 cron job 例子。

## P0 — 老板反馈追加 (v0.7 上线后实战发现)

- [ ] **T-040 用户管理 (admin add/edit partner)**  *(2026-05-08 老板反馈: 不能加合伙人 + 不能改名字)*

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
