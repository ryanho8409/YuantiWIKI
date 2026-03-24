# 元体知识库 — 第 2 周开发 Todo 列表（空间与页面树）

> 目标：在第 1 周「登录 → 首页」闭环基础上，完成 **空间 CRUD + 空间权限 + 页面树 CRUD（标题为主）**，并在前端落地 **空间三栏布局骨架 + 页面树操作**。  
> 范围对齐《05-项目实施计划》阶段 2、《03-API设计》章节 5～6。

## 本周里程碑（验收口径）

- [x] **空间**：系统管理员可创建/更新/软删除空间；普通用户只看到自己有读权限的空间。
- [x] **空间权限**：空间管理员可查看/配置空间权限（用户 → read/write/admin）。
- [x] **页面树**：进入空间后可看到页面树；具备写权限的用户可新建/重命名/删除页面（先以 title 为主，content 可占位）。
- [x] **前端**：`/space/:spaceId` 落地三栏布局（左树/中内容/右栏占位），页面树与右键/按钮操作可用（不要求拖拽排序）。

## 本周 UI 保真验收清单（开发前置，ones，硬性必达）

> 对标基准：`web-prototype/space.html` 与 `web-prototype/styles/common.css`
> 用于指导本周“必须实现/必须对齐”的 UI 点；开发完成后请把同一批点用于手测验收（看下面的“UI 验收验证”）。

- 三栏布局容器使用原型 class/命名约定：`sidebar`（左）、`content-area`（中）、`rightbar`（右），并保留原型的宽度与边框层级（左 260px，右 240px）。
- 顶部内容工具栏存在且结构对标原型：`content-toolbar`（左 breadcrumb / 右 actions），即使内容仍为占位也必须有该结构与间距。
- 中栏正文区具备“阅读/编辑态”两个容器：`readView` 与 `editView`（可先占位，但 DOM 结构需存在，后续可直接接编辑器/阅读渲染）。
- 左侧页面树节点样式对标原型：使用 `tree-node`，并能呈现“选中 active 状态”与“层级缩进”（子节点容器可用 `tree-children` 或等价结构）。
- 右侧区域结构对标原型：包含 `rightbar-section`，至少有两块（TOC / Page info），TOC 链接样式需与 `toc` 一致。
- 按钮/交互控件优先使用原型/项目已存在的类：`.btn-primary` / `.btn-secondary` / `.btn-ghost`，禁止新增关键布局的行内 style（除非明确与原型保持一致且可审查）。
- 错误提示与权限拦截文案需统一（403 / 401 / 409），不允许出现“静默失败/空页面”，并与原型的提示位置/风格保持一致（可先顶部小条或消息区占位）。

---

## Day 1：空间 CRUD（后端为主）

- [x] **Spaces 表与 Prisma 模型补齐（若需要）**
  - [x] 字段对齐《02》：`name, description, icon, sortOrder, createdById, deletedAt, createdAt, updatedAt`。
  - [x] 软删除约定：删除仅设置 `deletedAt`，列表默认过滤 `deletedAt IS NULL`。
- [x] **空间 CRUD API**
  - [x] `GET /api/v1/spaces`：只返回当前用户有读权限的空间（system_admin 全量可见；普通用户按权限表过滤）。
  - [x] `GET /api/v1/spaces/:id`：空间详情（含基本字段，需空间 read）。
  - [x] `POST /api/v1/spaces`：创建空间（系统管理员）。
  - [x] `PATCH /api/v1/spaces/:id`：更新空间（空间 admin / system_admin）。
  - [x] `DELETE /api/v1/spaces/:id`：软删除空间（空间 admin / system_admin）。
- [x] **Postman 验证**
  - [x] 管理员 token 可创建空间、更新、删除；删除后不出现在列表中。

## Day 2：空间权限（后端为主）

- [x] **SpacePermission 数据模型（Prisma）**
  - [x] 表：`space_permissions`（Prisma model `SpacePermission`）
  - [x] 字段：`id, spaceId, subjectType('user'), subjectId(User.id), permission('read'|'write'|'admin'), createdAt`
  - [x] 唯一约束：`@@unique([spaceId, subjectType, subjectId])`
- [x] **权限 API**
  - [x] `GET /api/v1/spaces/:id/permissions`（空间 admin / system_admin）
  - [x] `PUT /api/v1/spaces/:id/permissions`（空间 admin / system_admin，全量覆盖）
- [x] **权限校验框架**
  - [x] 封装 `requireSpacePermission(spaceId, level)`：read/write/admin
  - [x] system_admin：默认拥有所有空间的 admin 权限（实现上可短路）
- [x] **种子数据**
  - [x] 为三条默认空间写入权限：`admin` 为 admin；新增普通用户 `demo/demo123` 用于验证过滤与权限 API

## Day 3：页面树（后端为主）

- [x] **Page 数据模型（Prisma）**
  - [x] 表：`Page`（PostgreSQL 表名 `Page`，与现有 `Space` 命名一致）
  - [x] 字段最小集：`id, spaceId, parentId, title, sortOrder, createdById, updatedById, createdAt, updatedAt, deletedAt`
  - [x] 约束：`spaceId+parentId` 的索引；软删除过滤
- [x] **页面树 API（title 为主）**
  - [x] `GET /api/v1/spaces/:spaceId/pages?format=tree|list`（空间读）
  - [x] `POST /api/v1/spaces/:spaceId/pages`（空间写）：创建页面（可选 parentId）
  - [x] `PATCH /api/v1/spaces/:spaceId/pages/:id`（空间写）：重命名/移动父节点/更新 sortOrder
  - [x] `DELETE /api/v1/spaces/:spaceId/pages/:id`（空间写）：软删除（**已采用：有子节点则禁止删除**，返回 `409` + `code: HAS_CHILDREN`）
- [x] **种子数据（可选）**
  - [x] 每个空间插入若干页面，包含父子关系，便于前端演示树形结构
- [x] **Day 3 DoD（完成定义）**
  - [ ] Postman 可完整走通：创建根页面 → 创建子页面 → 重命名 → 删除。（建议你再手测打勾）
  - [x] `tree` 与 `list` 两种返回格式结构稳定（字段名固定），前端可直接消费。
  - [x] 权限校验正确：`read` 只能读；`write/admin` 可写；无权限返回 403。

## Day 4：前端空间页三栏骨架（前端为主）

- [x] **路由完善**
  - [x] `/space/:spaceId`：三栏布局骨架页面（左侧页面树/中间占位/右栏占位）
  - [ ] （可选）`/space/:spaceId/page/:pageId`：页面详情占位，为后续第 3 阶段编辑器铺路
- [x] **空间详情与权限（占位即可）**
  - [x] 进入空间时拉取空间详情（name/description/icon）
  - [x] 页面标题区显示当前空间名称（顶栏仍为全局 Yuanti Wiki，可按需再加面包屑）
- [x] **Day 4 DoD（完成定义）**
  - [ ] 手动刷新 `/space/:spaceId` 不报错（含鉴权失败场景）。（建议你再手测打勾）
  - [x] 左中右三栏都能稳定渲染，占位态与 loading/error 态可见。
  - [x] 页面结构可承接 Day 5 树组件，不需要再改路由。
- [x] **UI保真对齐（ones，Day4范围内）**
  - [x] 内容区必须具备 `content-toolbar` 的结构（breadcrumb + actions），可先用占位渲染但不得缺失容器与类名。
  - [x] 必须存在 `readView` 与 `editView` 容器（可先占位），便于后续接富文本阅读/编辑态。

## Day 5：前端页面树 + 最小交互（前端为主）

- [x] **页面树展示**
  - [x] React Query 拉取 `/api/v1/spaces/:spaceId/pages?format=tree` 并渲染树
  - [x] 选中节点后中栏显示占位内容（title + “content under construction”）
  - [x] **体验补齐**：分支 ▶/▼ 折叠；Expand all / Collapse all；写权限下右键菜单（New child / Rename / Delete）；`HAS_CHILDREN` 与 403 友好文案
- [x] **页面树操作（最小）**
  - [x] New page（在当前空间根下或当前节点下创建）
  - [x] Rename page
  - [x] Delete page（遵循后端策略：**有子节点禁止删除**）
  - [x] 操作后 invalidate queries 刷新树
- [x] **权限体验（最小）**
  - [x] 无 write 权限隐藏“New/Rename/Delete”
  - [x] 接口返回 403 时提示 “You don’t have permission”
- [x] **Day 5 DoD（完成定义）**
  - [x] 页面树操作后可见即时反馈（成功 / 失败文案；未接 toast 库）。
  - [x] Query 刷新后树状态与后端一致（无重复节点、无幽灵节点）。（已通过 Playwright E2E）
  - [x] 不同权限账号验证通过：`admin`、`demo(read)` 至少各测一轮。（已通过 Playwright E2E）
- [x] **UI保真对齐（ones，Day5范围内）**
  - [x] 左侧树节点 DOM 使用 `tree-node`，选中 active 态与层级缩进能与原型保持一致（可先用最小样式落地）。
  - [x] 右侧至少两块 `rightbar-section`，并包含 `toc` 区域（占位也要有）。

## 本周 UI 验收验证（开发完成后手测，ones，硬性必达）

> 请逐条手测：DOM/class 是否存在、布局是否对齐、权限/错误提示是否一致；完成后在对应项勾选。

- [x] 三栏布局容器 class/命名：`sidebar` / `content-area` / `rightbar`，宽度（左 260px / 右 240px）与边框层级对齐原型。（已通过 Playwright E2E）
- [x] 顶部 `content-toolbar` 容器存在，breadcrumb + actions 结构与间距对齐原型。（已通过 Playwright E2E）
- [x] 中栏存在 `readView` 与 `editView` 容器（即使占位也必须存在）。（已通过 Playwright E2E）
- [x] 左侧树节点使用 `tree-node`，选中 active 态、层级缩进与原型一致（等价结构也可，但必须可对齐验证）。（已通过 Playwright E2E）
- [x] 右侧至少两块 `rightbar-section`，并包含 `toc` 区域，样式与 `toc` 一致。（已通过 Playwright E2E）
- [x] 按钮类统一使用 `.btn-primary` / `.btn-secondary` / `.btn-ghost`，关键布局不使用散乱行内样式（除非可审查例外）。（已通过 Playwright E2E）
- [x] 403/401/409 等错误提示文案统一且不“静默失败/空页面”，位置与风格与原型一致（可先占位）。（已通过 Playwright E2E）

---

## 本周剩余任务冲刺顺序（建议按此执行）

1. [x] **先定删除策略（阻塞项）**  
       在 Day 3 开发前确认：`DELETE page` 采用“禁止删有子节点”还是“级联删除”。  
       > 建议本周采用 **禁止删有子节点**，实现更简单、前端提示更直观。
2. [x] **完成 Day 3 后端页面树 API**  
       先出 `list` 再出 `tree`，联调时更容易排查数据问题。
3. [x] **完成 Day 4 路由与布局骨架**  
       保证页面可进入、可显示空间名称与基础状态。
4. [x] **完成 Day 5 树展示与 CRUD 交互**  
       先做展示和 New，再做 Rename/Delete，最后补权限体验。
5. [x] **回归验证 + 文档更新**
       按“验证清单”逐条打勾，并补充最终接口示例请求/响应。

## 验证清单（建议）

- [x] 登录后：空间列表只展示有权限的空间（至少能区分 system_admin/普通用户）。
- [x] 进入空间：看到页面树；能新建/重命名/删除（写权限用户）。（已通过 Playwright E2E）
- [x] 无权限：访问空间/页面树接口返回 401/403，前端有友好提示。（已通过 Playwright E2E）
- [x] 数据一致性：删除（软删）后列表与树均不再出现；刷新页面状态可恢复。（已通过 Playwright E2E）

## 今日可直接开工（建议）

- [x] 后端：确定 `DELETE /pages/:id` 策略并写入 API 注释（30 min）
- [x] 后端：完成 `Page` Prisma model + migration + 基础 seed（1.5 h）
- [x] 后端：完成 `GET pages(list/tree)` 与 `POST pages`（2 h）
- [x] 前端：创建 `/space/:spaceId` 三栏骨架页与占位态（1 h）
- [x] 联调：打通“进入空间 -> 拉树 -> 新建页面 -> 刷新可见”（1 h）

