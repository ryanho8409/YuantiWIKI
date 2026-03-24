# 元体知识库 — 第 1 周开发 Todo 列表

> 目标：打通「登录 → 空白受保护页面」闭环，搭好前后端和数据库基础，为后续空间/页面树开发做好准备。

## Day 1：仓库与基础环境

- [x] **后端项目初始化**
  - [x] 创建 Node + TypeScript 项目（建议 Fastify 或 Express）。
  - [x] 建立基础目录结构：`src/app.ts`、`src/routes/`、`src/modules/`、`src/config/`。
  - [x] 配置环境变量加载（如 dotenv），预留 `DATABASE_URL`、`JWT_SECRET` 等。
- [x] **数据库连接与健康检查**
  - [x] 按《02-数据模型与数据库设计》确定使用方式（Prisma/TypeORM 或原生 pg）。
  - [x] 实现基础数据库连接初始化代码。
  - [x] 提供一个 `/health` 或 `/api/health` 接口，返回应用与数据库连接状态。
- [x] **前端项目初始化**
  - [x] 使用 Vite + React + TypeScript 创建前端项目。
  - [x] 引入 React Router、React Query（或计划中选型）。
  - [x] 创建基础布局组件：顶栏占位 + 主内容区域。

## 本周 UI 保真验收清单（开发前置，ones，硬性必达）

> 对标基准：`web-prototype/login.html`、`web-prototype/index.html`、`web-prototype/styles/common.css`

> 用于指导本周“必须实现/必须对齐”的 UI 点；开发完成后请用下面的“UI 验收验证”逐条手测并勾选。

- 顶栏结构与视觉：使用原型 `app-header` 风格（固定高度、底边框、左右布局一致），并由 `main-wrap` / `dashboard-wrap` 保证内容不遮挡。
- 登录页布局与文案：React `/login` 页面保持与 `web-prototype/login.html` 相同的字段/按钮/提示区域位置与类名语义，按钮使用 `.btn-primary` / `.btn-ghost` 等统一类。
- 首页卡片/列表排版：`/` 页面采用原型首页的卡片/列表容器语义（card 结构、间距、字号与原型保持一致；可先简化但不得换布局）。
- 路由级权限语义：未登录访问受保护路由稳定跳转 `/login`，且不引入临时布局破坏整体结构。

## Day 2：数据模型与认证框架搭建

- [x] **数据库表结构准备**
  - [x] 根据《02-数据模型与数据库设计》落地 `users` 表（先实现用户和角色字段）。
  - [x] 编写初始 migration（SQL 或 ORM migration），可重复执行。
  - [x] 准备种子数据：1 个 system admin 用户（如 `admin/admin123`）。
- [x] **后端认证框架**
  - [x] 选定认证方式（JWT + Bearer 或 Session + Cookie），与《03-API设计》保持一致。
  - [x] 定义用户 payload 结构（id、username、role）。
  - [x] 实现生成/验证 token 的工具方法。
  - [x] 在后端中间件中解析请求中的认证信息并挂载 `req.user`。

## Day 3：Auth API 与前端登录页

- [x] **实现认证相关 API**
  - [x] `POST /api/v1/auth/login`：校验 `username + password`，返回 token 或设置 Cookie。
  - [x] `POST /api/v1/auth/logout`：清理 Session 或让前端丢弃 token。
  - [x] `GET /api/v1/auth/me`：返回当前登录用户的基本信息（id、username、role）。
- [x] **前端登录页面**
  - [x] 根据 `web-prototype/login.html` 实现 `/login` React 页面（保持文案和布局风格）。
  - [x] 对接 `POST /auth/login`，登录成功后保存 token（或依赖 HttpOnly Cookie）。
  - [x] 登录成功后跳转到 `/`（暂时是空白或简单欢迎页）。

- [x] **UI保真对齐（ones，Day3范围内）**
  - [x] `/login` 页面 DOM/布局结构与原型一致（字段/按钮/提示区域位置），按钮类使用 `.btn-primary` / `.btn-ghost`。

## Day 4：路由守卫与基础布局联通

- [x] **前端路由结构**
  - [x] 根据《04-前端架构设计》配置基础路由：`/login`、`/`（受保护）。
  - [x] 创建 `AuthProvider`（或等价方案），在应用启动时调用 `/auth/me` 恢复登录状态。
- [x] **路由守卫**
  - [x] 实现 `PrivateRoute` 或受保护路由包装，未登录跳转 `/login`。
  - [x] 在顶栏显示当前用户（例如右上角的 `demo` 或 `System admin`），UI 参考原型。
- [x] **首页占位页**
  - [x] 在 `/` 路由下先渲染一个简单的 “Dashboard placeholder”（例如 “Yuanti Wiki dashboard (under construction)”），确认登录后能访问。

## Day 5：空间列表接口雏形（可选加分项）

- [x] **后端 Space 列表最小实现**
  - [x] 按《02》《03》创建 `spaces` 表（只实现必要字段：id、name、description、created_at）。
  - [x] 实现 `GET /api/v1/spaces`：先简单返回所有空间列表，后续再加权限过滤。
  - [x] 添加少量种子空间数据（Product docs、Tech guidelines、Ops handbook）。
- [x] **前端首页读取空间列表**
  - [x] 在 `/` 页面使用 React Query 调用 `/spaces`。
  - [x] 用卡片列表形式渲染空间（以 `web-prototype/index.html` 为视觉参考，但可以先简化）。
  - [x] 预留点击卡片跳转 `/space/:spaceId` 的路由逻辑（页面可先为空）。

- [x] **UI保真对齐（ones，Day5范围内）**
  - [x] 首页空间展示使用 `card` 语义/边框圆角/间距与原型一致（可简化但不得换布局结构）。

## 本周 UI 验收验证（开发完成后手测，ones，硬性必达）

> 请逐条手测：DOM/class 是否存在、布局是否对齐、权限/错误提示是否一致；完成后在对应项勾选。

- [x] 顶栏结构与视觉：`app-header` 风格（固定高度、底边框、左右布局一致），并由 `main-wrap` / `dashboard-wrap` 保证不遮挡。（已手测通过）
- [x] 登录页布局与文案：`/login` 字段/按钮/提示区域位置与原型一致，按钮类使用 `.btn-primary` / `.btn-ghost`。（已手测通过）
- [x] 首页卡片/列表排版：`/` 页面卡片/列表容器结构、圆角/间距/字号与原型一致（可简化但不换布局）。（已手测通过）
- [x] 路由级权限语义：未登录进入受保护路由稳定跳转 `/login`，且不引入临时布局破坏整体结构。（已手测通过）

---

> 使用建议：  
> - 本文档只覆盖第 1 周的「最小可行后端 + 登录 + 空白首页」目标。  
> - 第 2 周起可以按《05-项目实施计划》中“阶段 2：空间与页面树”的任务继续拆分 Todo。 

