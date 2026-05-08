# 老板使用反馈黑板

> 老板使用 V0.7 / 试用过程中发现的问题、想要的新功能、不顺手的体验都记这里。
> dengche 周期性消化 → 转化为 TODO.md 的正式 task → Codex 拿来做。
> 跟 TODO.md 区别: TODO 给 Codex 看 (技术细节, dengche 写); FEEDBACK 给老板用 (人话, 老板写)。

---

## 怎么用

### 老板加条目 (3 种方式都行)

**方式 A. 直接 edit 这个文件**:
```
### YYYY-MM-DD HH:MM - 一句话标题

详细描述. 越具体越好 (哪个页面 / 啥操作 / 期望啥结果).
可以加截图链接 / 错误信息粘贴 / 任何东西.
```

**方式 B. 聊天告诉 dengche**:
直接跟 dengche 说: "登录跳转太慢" / "我想要 X 功能" / "Y 页面金额显示错了"
→ dengche 帮你记到本文件 + 转 TODO.md

**方式 C. 紧急截图反馈**:
截图后告诉 dengche: "看这个 bug" → dengche 看图诊断 + 决定是 dengche 自己救火 or 转 TODO.md 给 Codex

### dengche 处理流程

每次 /loop 激活 dengche 做:
1. 读本文件 "待处理" 段
2. 每条 feedback 转化为 TODO.md 里的 task (给 task ID T-04x)
3. 把这条 feedback 从"待处理"挪到"已处理 (归档)" + 标 task ID
4. push GitHub
5. Codex 下次循环 git pull 看到新 task → 做

---

## 待处理 (新反馈, dengche 会消化这段)

<!-- 老板在这下面加新条目, dengche 会处理后挪走 -->



---

## 已处理 (归档)

<!-- dengche 把"待处理"消化后挪到这里, 留痕审计 -->

### ✅ 2026-05-08 11:55 - 用户管理 (添加合伙人 + 编辑名字)
**老板发现**: 当前 hardcode 老板 / 合伙人 A / 合伙人 B 三个 seed 用户。无法:
- 添加新合伙人 (生意扩张要拉新合伙人时没法加)
- 编辑姓名 (合伙人想改个名字, 比如真名 / 化名换)
- 修改密码 (合伙人想改密码不能)
**dengche 处置**: 转 TODO.md → **T-040 用户管理 (admin)**, P0 优先级
   (V0.7 PRD 写的是"老板手动给合伙人开账号", 但 seed 后没界面加新人 — 这是 V0.7 的盲点)
**等做**: Codex 服务恢复时拿, 或 dengche 救火做 (老板拍)

### ✅ 2026-05-08 11:35 - 登录页 Runtime CredentialsSignin 报错
**老板看到**: 输密码后红色 Next.js Runtime Error 页面
**dengche 处置**: 直接救火, 不转 TODO (紧急 bug 挡老板验收) →
   commit `fd031f8` fix: NextAuth v5 signinAction 加 try/catch
**收尾**: 老板浏览器刷新即可

### ✅ 2026-05-08 11:40 - 登录后 node:path Native module not found
**老板看到**: 登录成功后 "Failed to load external module node:path" 报错
**dengche 处置**: 直接救火 (Edge Runtime 不能 import prisma) →
   commit `4d2b556` 拆 auth.config (edge-safe) + auth (node)
**收尾**: 老板强刷 (Cmd+Shift+R) 重新登

---

## 一些 dengche 会自动转 task 的常见反馈类型

| 反馈类型 | 转 TODO.md 优先级 |
|---------|-------------------|
| Runtime Error / 500 错误 | P0 (立刻修, 挡用户) |
| 登录 / 录入 / 审核 / 分配 e2e 跑不通 | P0 |
| UI 显示错乱 / 中英文混杂 / 标签错 | P1 |
| 体验粗糙 (loading / 空状态 / 提示) | P1 |
| 想加新功能 (V0 没的) | P2 (按价值排) |
| 部署 / 备份 / 监控 类 | P3 |

---

*建档: 2026-05-08 11:45 | 配套 TODO.md 使用*
