# dengche-finance ledger

## 项目简介

dengche-finance ledger 是一个内部项目级损益账本，用来让老板和固定合伙人按项目录入流水、附凭证、同步审核，并看清每个项目赚没赚、每个人应得多少。不开放注册，不做外部客户入口，数据默认存本地 SQLite。

## 信任三锚

- **强制证据**: 每条流水必须上传支付截图或票据图片，不能只靠口头说明。
- **同步审核**: 合伙人提交后先进入待审池，老板通过前不计入项目盈亏、趋势和贡献。
- **immutable log**: 账本事件追加写入 `LedgerEvent`；录错不能直接删改，用反向冲销保留原始痕迹。

## 用户角色

- **老板 OWNER**: 审核流水、创建项目、录入分配方案、查看全局数据。
- **合伙人 PARTNER**: 录入自己相关项目的流水，查看自己的投入、应得和趋势。
- **账号规则**: 不开放注册；账号由老板或种子数据创建。

## 技术栈

- Next.js 16 App Router + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Prisma 7 + better-sqlite3
- SQLite `file:./dev.db`
- NextAuth v5 Credentials + JWT session
- React Hook Form + Zod
- Recharts
- pnpm

## 本地开发 - 4 步搞定

### 1. 拉代码并安装依赖

```bash
git clone https://github.com/liujz1/dengche-finance.git
cd dengche-finance
pnpm install
```

### 2. 准备环境变量

```bash
cp .env.example .env  # 默认 SQLite 不用改
```

### 3. 初始化数据库和示例数据

```bash
pnpm prisma migrate deploy
pnpm db:seed  # 创建老板 + 2 合伙人 + 2 项目 示例数据
```

### 4. 启动开发服务器

```bash
pnpm dev
# → http://localhost:3000
# 默认账号:
#   - 老板 boss@dengche.local / boss123456
#   - 合伙人 A partner-a@dengche.local / partnera123
```

## 数据库

默认使用 SQLite:

```env
DATABASE_URL="file:./dev.db"
```

`dev.db` 是本地文件，`.gitignore` 已忽略。每个环境独立维护自己的数据库文件；本地、测试机、生产 VPS 不共享同一个 `dev.db`。

## 备份

SQLite 备份就是复制数据库文件。建议停服务或低峰期执行:

```bash
cp dev.db dev-$(date +%Y%m%d).db
```

上传凭证在 `uploads/`，生产环境也要一起备份。

## 部署到 VPS

### 推荐: Docker

首次部署:

```bash
cp .env.example .env
pnpm install
pnpm prisma migrate deploy
pnpm db:seed
mkdir -p uploads
docker compose up -d --build
```

`docker-compose.yml` 会把宿主机的 `./dev.db` 挂载到容器 `/app/dev.db`，把 `./uploads` 挂载到容器 `/app/uploads`。生产前请把 `AUTH_SECRET` 改成强随机值，并把 `AUTH_URL` 改成正式域名。

常用命令:

```bash
docker compose logs -f ledger
docker compose restart ledger
docker compose pull && docker compose up -d --build
```

### 可选: systemd

如果不用 Docker，可以直接在 VPS 上运行 Next.js:

```ini
# /etc/systemd/system/dengche-ledger.service
[Unit]
Description=dengche finance ledger
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/dengche-finance
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATABASE_URL=file:./dev.db
Environment=AUTH_SECRET=replace-with-random-secret
Environment=AUTH_URL=https://finance.dengche.cc
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

构建和启动:

```bash
pnpm install
pnpm prisma migrate deploy
pnpm build
sudo systemctl enable --now dengche-ledger
```

### nginx 反代

```nginx
server {
  server_name finance.dengche.cc;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 项目结构

```text
.
├── prisma/
│   ├── schema.prisma        # SQLite schema: 用户、项目、流水、凭证、分配、事件日志
│   ├── migrations/          # Prisma migration
│   └── seed.ts              # 默认账号、项目、分配和示例流水
├── src/
│   ├── app/
│   │   ├── (auth)/login/    # 登录页
│   │   ├── (app)/           # 登录后主界面
│   │   └── api/evidence/    # 凭证图片读取接口
│   ├── components/          # 业务组件和 shadcn/ui 组件
│   ├── generated/prisma/    # Prisma 7 生成客户端
│   ├── lib/                 # db、上传、格式化、工具函数
│   ├── server/              # Server Actions
│   ├── auth.ts              # NextAuth v5 配置
│   └── middleware.ts        # 路由保护
├── uploads/                 # 本地凭证图片，生产需挂载和备份
├── dev.db                   # SQLite 数据库，本地生成，不提交
├── Dockerfile
└── docker-compose.yml
```

## 主要路由表

| 路由 | 说明 | 权限 |
| --- | --- | --- |
| `/login` | 登录 | 未登录 |
| `/projects` | 项目列表 | OWNER / PARTNER |
| `/projects/[id]` | 项目详情和流水 | OWNER / PARTNER |
| `/projects/new` | 新建项目 | OWNER |
| `/entries/new` | 录入新流水和凭证 | OWNER / PARTNER |
| `/approvals` | 待审池，通过或驳回流水 | OWNER |
| `/allocations` | 分配方案列表 | OWNER |
| `/allocations/new` | 新建分配方案 | OWNER |
| `/me` | 合伙人投入、应得和趋势 | PARTNER |
