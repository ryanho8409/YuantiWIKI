# 元体知识库（YuantiWIKI）设计文档索引

对标 **ONES Wiki**，面向「文档编辑 + 知识沉淀」的企业内网知识库系统。技术栈：React + Node + PostgreSQL，前后端分离，权限由管理员分配。

## 当前开发进度（截至第 9 周 / Release V1.0）

- **后端（backend/）**
  - Fastify + TypeScript，Prisma 7 + PostgreSQL（含 driver adapter、`prisma.config.ts`）。
  - 数据表：`users`、`spaces`、`space_permissions`、`pages`、`page_versions`（已迁移并 seed）；`page_permissions`（第五周）；`attachments`（第六周：multipart 上传与按 id 读文件）。
  - 认证：JWT Bearer，`src/lib/auth.ts` 生成/校验 token，`src/plugins/auth.ts` 解析并挂载 `req.user`。
  - 接口：
    - `GET /api/health`
    - Auth：`POST /api/v1/auth/login`、`GET /api/v1/auth/me`、`POST /api/v1/auth/logout`
    - Spaces：`GET /api/v1/spaces`、`GET /api/v1/spaces/:id`、`POST /api/v1/spaces`、`PATCH /api/v1/spaces/:id`、`DELETE /api/v1/spaces/:id`
    - Space permissions：`GET /api/v1/spaces/:id/permissions`、`PUT /api/v1/spaces/:id/permissions`
    - Search：`GET /api/v1/search?q=...`（第四周）
    - Dashboard：`GET /api/v1/dashboard`（第九周，首页真实统计与最近文档）
    - Attachments：`POST /api/v1/spaces/:spaceId/attachments`、`GET /api/v1/attachments/:id/file`、`DELETE /api/v1/spaces/:spaceId/attachments/:id`（第六周）
  - 维护脚本：
    - `npm run cleanup:demo:dryrun` / `npm run cleanup:demo`（清理历史演示知识库，软删除）
    - `npm run cleanup:space-icons:dryrun` / `npm run cleanup:space-icons`（批量清空历史 `space.icon` 字段）
- **前端（frontend/）**
  - Vite + React 18 + TypeScript，React Router、TanStack React Query。
  - 路由：`/login`（登录页）、`/`（需登录的首页）；AuthProvider 启动时调 `/auth/me` 恢复状态，PrivateRoute 未登录跳转 `/login`。
  - 登录页对接 `POST /api/v1/auth/login`，token 存 localStorage，成功后跳转首页；顶栏显示当前用户与 Sign out。
  - 首页已接入真实仪表盘数据：调用 `GET /api/v1/dashboard` 获取统计与最近文档，知识库卡片调用 `GET /api/v1/spaces`，点击跳转 `/space/:spaceId`。
  - 搜索入口：`/search` 页面 + 顶栏搜索输入（Enter 跳转并渲染结果）（第四周）
  - SpacePage：`Page settings` 弹窗与页面级权限驱动（第五周）；编辑态「Insert image」+ TipTap `Image` 扩展（第六周）
- **运行方式**
  - 后端：`cd backend && npm run dev`（默认 3000 端口）；前端：`cd frontend && npm run dev`（默认 5173 端口，`/api` 代理到后端）。
- 详细任务勾选见：
  - [06-第一周开发Todo](./06-第一周开发Todo.md)（第 1 周已全部完成）
  - [07-第二周开发Todo](./07-第二周开发Todo.md)
  - [08-第三周开发Todo](./08-第三周开发Todo.md)
  - [09-第四周开发Todo](./09-第四周开发Todo.md)
  - [10-第五周开发Todo](./10-第五周开发Todo.md)
  - [11-第六周开发Todo](./11-第六周开发Todo.md)
  - [12-第七周方向草案](./12-第七周方向草案.md)（中文优先：语言 / 交互 / 克制功能）
  - [13-第七周开发Todo](./13-第七周开发Todo.md)（**Day 1～7 按日任务**；F-001～F-005 含 F-003 全量；与迭代 #1 同步）
  - [14-第八周开发Todo](./14-第八周开发Todo.md)（承接第 7 周遗留：F-001 全站中文扫尾、F-005 空间页细节对标）
  - [15-第八周结项快照](./15-第八周结项快照.md)（第 8 周范围、质量结果、遗留与下周建议）
  - [16-第九周方向草案](./16-第九周方向草案.md)（第 9 周冻结方向：品牌化、导航/权限/编辑体验升级）
  - [17-第九周开发Todo](./17-第九周开发Todo.md)（第 9 周按日执行清单与测试入口）
  - [产品迭代计划](./产品迭代计划.md)（按周记录功能/体验/性能等迭代）

## 文档列表

| 文档 | 内容 |
|------|------|
| [01-产品与系统设计](./01-产品与系统设计.md) | 产品定位、信息架构（Space/Page）、功能范围、权限模型、与 ONES 对标小结 |
| [02-数据模型与数据库设计](./02-数据模型与数据库设计.md) | PostgreSQL 表结构（users、spaces、pages、page_versions、权限、附件）、树形与全文检索 |
| [03-API设计](./03-API设计.md) | RESTful 接口（认证、用户、空间、页面、版本、搜索、附件）、Node 技术选型建议 |
| [04-前端架构设计](./04-前端架构设计.md) | React 路由、三栏布局、模块划分、状态与数据流、编辑器选型、权限体现 |
| [05-项目实施计划](./05-项目实施计划.md) | 阶段 0～5 的任务、里程碑、依赖与风险 |
| [12-第七周方向草案](./12-第七周方向草案.md) | 第 7 周：中文优先下的语言、交互与功能补缺方向（草案） |
| [13-第七周开发Todo](./13-第七周开发Todo.md) | 第 7 周开发清单：**Day 1～7 按日任务** + 里程碑；与 `12` 范围、`产品迭代计划` 迭代 #1 一致 |
| [14-第八周开发Todo](./14-第八周开发Todo.md) | 第 8 周开发清单：承接 `12/13` 遗留项与收口任务 |
| [15-第八周结项快照](./15-第八周结项快照.md) | 第 8 周结项摘要：完成范围、质量结果、遗留与下周建议 |
| [16-第九周方向草案](./16-第九周方向草案.md) | 第 9 周方向冻结文档：体验升级与结构收敛（P0 范围） |
| [17-第九周开发Todo](./17-第九周开发Todo.md) | 第 9 周开发执行清单：Day 1～Day 7 + 测试入口 |
| [产品迭代计划](./产品迭代计划.md) | 按迭代记录功能/体验/性能等优化；**迭代 #1** = 第 7 周 |
| [05-保真原型Todo清单](./05-保真原型Todo清单.md) | 阶段 0 保真原型的详细 Todo（0.1–0.28） |
| [06-第一周开发Todo](./06-第一周开发Todo.md) | 第 1 周开发任务列表（后端 + 登录 + 首页闭环），已完成项已勾选 |
| [07-第二周开发Todo](./07-第二周开发Todo.md) | 第 2 周开发任务列表（空间 CRUD + 权限 + 页面树 + 空间三栏骨架） |
| **prototype/** | 保真原型配套产出（汇报脚本、竞品拆解、页面清单与站点地图） |
| **web-prototype/**（项目根下） | 可点击的 HTML/CSS 保真原型，浏览器打开 `login.html` 即可预览 |

## 阅读顺序建议

1. 先读 **01** 明确「做什么、不做什么」和权限模型。
2. 再读 **02**、**03**、**04** 理解数据、接口与前端结构。
3. 实施前以 **05** 为排期与验收依据。

## 修订说明

- 设计文档为前期产出；项目已进入开发，第 1 周「登录 → 空白受保护首页」闭环已完成，实现时可在不偏离目标的前提下做细节补充（如错误码、日志、监控）。
- 2026-03-20：完成第 4 周 `GET /api/v1/search` + 前端 `/search` 检索闭环；完成第 5 周 `page_permissions`（Page settings 弹窗 + 页面级有效权限驱动）闭环，并同步回填 `tests/week4`、`tests/week5`。
- 2026-03-23：完成第 6 周附件上传与 SpacePage 插入图片（正文不持久化 JWT，仅渲染时补 `token`）；新增 `tests/week6` 与 `docs/11-第六周开发Todo.md`。
- 2026-03-23：新增 `docs/12-第七周方向草案.md`（中文优先：全站文案、主路径交互、克制功能补缺）。
- 2026-03-23：`12-第七周方向草案` 升级为 v0.2：增加**产品不满点六维诊断、登记表与 Top3**，默认排期从属于登记表。
- 2026-03-23：`12-第七周方向草案` v0.3：去掉「最/Top3」强迫表述；支持**整体不满意**；排期与情绪解绑。
- 2026-03-23：`12-第七周方向草案` v0.4：登记表 **F-001** — 产品用户可见文案改为**简体中文**。
- 2026-03-23：`12-第七周方向草案` v0.5：登记表 **F-002** — 首页 Dashboard 对标 `web-prototype/index.html`。
- 2026-03-23：`12-第七周方向草案` v0.6：登记表 **F-003** — 原型管理端/检索等缺口与 **§3.5** 对照表（v1.0 起 **§5.5.1** 为全量实现验收，不再「仅分期」）。
- 2026-03-23：`12-第七周方向草案` v0.7：登记表 **F-004** — 富文本编辑仅 Bold；**§5.3.1** 全量工具栏目标与分期。
- 2026-03-23：`12-第七周方向草案` v0.8：登记表 **F-005** — 空间页顶栏/侧栏对标 `space.html`；**§5.3.2** 解决按钮堆砌。
- 2026-03-23：冻结第 7 周主要工作（F-001～F-005）；新增 `docs/13-第七周开发Todo.md`；`12` 升级为 v0.9。
- 2026-03-23：新增 `docs/产品迭代计划.md`，**迭代 #1** 记录第 7 周（与 `13` 对齐）。
- 2026-03-23：`12-第七周方向草案` **v1.0**：**F-003** 与 F-001/F-002/F-004/F-005 同为第 7 周 **P0 必须完成**；**§5.5.1** 改为实现验收清单；全文去除「最低交付 / 仅文档分期」口径。同步 `13`、`产品迭代计划`。
- 2026-03-23：`13-第七周开发Todo`：按 **第 5/6 周模板** 扩展为 **Day 1～Day 7** 按日任务 + 与 `产品迭代计划` 分工说明；覆盖 **迭代 #1** 全范围。
- 2026-03-23：`12` v1.5 + `13` 收口回填：已完成项勾选同步；遗留项聚焦 F-001（中文扫尾）与 F-005（空间页细节打磨）。
- 2026-03-23：新增 `docs/14-第八周开发Todo.md` 与 `tests/week8/week8-test-plan.md`，承接第 7 周未完成项并形成第 8 周执行/测试入口。
- 2026-03-23：第 8 周收口完成：F-001（全站中文扫尾）与 F-005（空间页顶栏/侧栏对标打磨）完成；week7 API 与 E2E 回归保持通过，`产品迭代计划` 迭代 #2 已结项。
- 2026-03-23：新增 `docs/15-第八周结项快照.md`，用于周报/汇报快速复用（范围、质量、遗留、建议）。
- 2026-03-23：冻结第 9 周迭代范围；新增 `docs/16-第九周方向草案.md` 与 `docs/17-第九周开发Todo.md`。
- 2026-03-23：新增 `tests/week9/week9-test-plan.md`，同步第 9 周冻结范围的测试入口与回填模板。
- 2026-03-23：第 9 周开工前定版：已把实施决议（Logo/菜单分组/权限兼容/图标与优先级）固化到 `16/17/产品迭代计划`，并同步 `tests/README.md` 的周测试资产索引。
- 2026-03-24：第 9 周结项：完成品牌化（Logo+标题+favicon）、齿轮菜单分组、Space 右栏收起、编辑器图标化、阅读态信息区与操作收敛、权限模型收敛与初始化数据单空间；build 与 week7 回归通过，week9 测试计划已回填。
- 2026-03-24：Release V1.0 收口：Dashboard 改为真实数据链路（`/api/v1/dashboard`），首页去除重复“搜索文档”按钮并保留顶栏搜索；知识库卡片统一系统文件夹图标并忽略 `space.icon`；新增并执行历史图标字段清理脚本。
