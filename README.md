# 元体WIKI（YuantiWIKI）- Release V1.0

一个面向企业内网场景的知识库系统，支持：

- 用户登录与权限控制（`system_admin` / `user`）
- 知识库（Space）与页面树管理
- 富文本编辑（TipTap）与历史版本
- 空间级权限管理
- 全局搜索
- 附件上传与访问

---

## 1. 技术栈

- 前端：React 18 + TypeScript + Vite + React Query + React Router
- 后端：Fastify + TypeScript
- 数据库：PostgreSQL
- ORM：Prisma 7
- 鉴权：JWT

---

## 2. 项目结构

```text
YuantiWIKI/
  frontend/                 # Web 前端
  backend/                  # API 服务 + Prisma
  docs/                     # 设计/迭代/周计划文档
  tests/                    # 自动化脚本与测试计划
  web-prototype/            # 保真原型
```

---

## 3. 环境要求

- Node.js 18+
- npm 9+
- PostgreSQL 14+

---

## 4. 本地开发启动

### 4.1 后端

```bash
cd backend
npm install
```

复制环境变量文件：

```bash
# Linux / macOS
cp .env.example .env

# Windows PowerShell
copy .env.example .env
```

编辑 `backend/.env`，至少配置：

- `DATABASE_URL`
- `SHADOW_DATABASE_URL`（`migrate dev` 时建议配置）
- `JWT_SECRET`
- `PORT`（默认 3000）

初始化数据库（开发环境）：

```bash
npx prisma migrate dev
npx prisma db seed
```

启动后端：

```bash
npm run dev
```

### 4.2 前端

```bash
cd frontend
npm install
npm run dev
```

默认访问：

- 前端：http://localhost:5173
- 后端：http://localhost:3000

> 前端开发服务器已配置 `/api` 代理到 `http://localhost:3000`。

---

## 5. 生产部署（Release V1.0）

以下为推荐的基础部署流程（无容器版本）。

### 5.1 拉取代码并安装依赖

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 5.2 配置后端环境变量

在服务器设置 `backend/.env`（重点：`DATABASE_URL`、`JWT_SECRET`）。

### 5.3 数据库迁移与 Prisma Client

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

### 5.4 （可选）初始化最小账号

```bash
npx prisma db seed
```

> 当前 seed 策略：仅初始化 `admin/system_admin` 账号，不再注入演示知识库/演示页面。

### 5.5 构建与启动

```bash
cd backend
npm run build
npm run start
```

```bash
cd frontend
npm run build
npm run preview
```

> 生产环境通常建议将 `frontend/dist` 交由 Nginx 托管，`backend` 由 PM2/systemd 托管。

---

## 6. 首次上线前建议执行

### 6.1 清理历史演示知识库（软删除）

```bash
cd backend
npm run cleanup:demo:dryrun   # 先预览
npm run cleanup:demo          # 再执行
```

### 6.2 清理历史知识库 icon 字段（仅置空字段，不删知识库）

```bash
cd backend
npm run cleanup:space-icons:dryrun   # 先预览
npm run cleanup:space-icons          # 再执行
```

---

## 7. 默认账号说明

- `admin / admin123`（`system_admin`）

> 建议上线后第一时间修改默认密码，或通过运维流程重置为强密码。

---

## 8. 常见问题

- **端口占用（3000/5173）**：修改服务端口或结束占用进程。
- **登录 401**：检查 `JWT_SECRET`、用户密码、前后端地址是否一致。
- **数据库迁移失败**：确认 `DATABASE_URL` 可连通且账号具备迁移权限。
- **前端无数据**：确认后端已启动，且前端 `/api` 代理指向正确。

---

## 9. 相关文档

- 项目文档索引：`docs/README.md`
- 第九周方向：`docs/16-第九周方向草案.md`
- 第九周执行：`docs/17-第九周开发Todo.md`
- 迭代计划：`docs/产品迭代计划.md`
- Week9 测试计划：`tests/week9/week9-test-plan.md`

---

## 10. 一键发布命令清单（Release V1.0）

> 适用于 Linux/macOS Bash。执行前请先确认 `backend/.env` 已配置完成。

```bash
set -e

echo "== 1) 安装依赖 =="
cd backend && npm install
cd ../frontend && npm install
cd ..

echo "== 2) 后端迁移与生成 =="
cd backend
npx prisma migrate deploy
npx prisma generate

echo "== 3) （可选）执行 seed =="
# 首次环境可执行；已有生产数据时请谨慎
# npx prisma db seed

echo "== 4) 发布前数据清理（建议先 dryrun） =="
npm run cleanup:demo:dryrun
npm run cleanup:space-icons:dryrun

echo "== 5) 确认后执行清理 =="
# 需要执行时取消注释
# npm run cleanup:demo
# npm run cleanup:space-icons

echo "== 6) 构建后端并启动 =="
npm run build
# 建议由 PM2/systemd 托管；此处仅示例前台启动
# npm run start
cd ..

echo "== 7) 构建前端 =="
cd frontend
npm run build
# 若不使用 Nginx，可临时预览
# npm run preview
cd ..

echo "== Done: Release V1.0 build completed =="
```

### 10.1 PM2 启动示例（可选）

```bash
cd backend
pm2 start dist/server.js --name yuantiwiki-backend
pm2 save
pm2 status
```

### 10.2 回滚最小清单（建议）

- 保留上一个后端构建目录（或镜像/tag）
- 发布前备份数据库
- 若回滚代码：同步回滚 Prisma migration 变更策略（按实际数据库状态执行）

