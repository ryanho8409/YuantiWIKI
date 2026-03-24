# 元体知识库 — 第 3 周开发 Todo 列表（文档编辑与版本）

> 目标：在第 2 周「空间三栏 + 页面树 CRUD」的基础上，完成 **页面内容读写 + 版本历史（保存/回滚）** 的最小可用闭环，并把 `readView/editView` 从占位变为可交付的阅读与编辑体验。

> 范围对齐《05-项目实施计划》阶段 3，并与 `web-prototype/space.html` 的 UI/DOM 结构保持一致。

## 本周里程碑（验收口径）

- [x] 后端：页面内容（TipTap JSON）可读取/更新；每次“保存”会生成 page_versions 版本快照。
- [x] 后端：版本列表可读取；支持按版本内容进行回滚/恢复（恢复为该版本 content）。
- [x] 前端：`/space/:spaceId/page/:pageId` 支持阅读态与编辑态切换，并能保存后回显内容与更新版本列表。
- [x] 前端：点击 `History` 可打开版本侧栏（`version-panel`），列出版本并支持恢复；权限不足时隐藏/拦截编辑与恢复入口（`.error-text` 的完整一致性仍待补覆盖）。

---

## 本周 UI 保真验收清单（开发前置，ones，硬性必达）

> 对标基准：`web-prototype/space.html` 与 `web-prototype/styles/common.css`
> 用于指导本周“必须实现/必须对齐”的 UI 点；开发完成后请把同一批点用于手测验收（看下面的“UI 验收验证”）。

- 三栏布局容器使用原型 class/命名约定：`sidebar`（左）、`content-area`（中）、`rightbar`（右），并保留原型的宽度与边框层级。
- 顶部内容工具栏存在且结构对标原型：`content-toolbar`（左 breadcrumb / 右 actions），actions 中必须包含以下按钮/区域：
  - `Page settings`（可先占位但 DOM/类名需存在）
  - `History`（打开版本侧栏）
  - `Edit` / `Save` / `Cancel`（至少两态切换的最小按钮集合）
- 中栏正文区具备“阅读/编辑态”两个容器：`readView` 与 `editView`（DOM 结构必须存在，且通过 class/状态切换可对齐验证，不允许出现“容器缺失导致页面静默”）。
- 阅读态内容区域对齐原型语义：
  - 页面标题容器：`pageTitle`（或等价 DOM 结构）
  - `doc-meta`（Created/Last updated/Owner 等文案位，至少占位）
  - `doc-body`（阅读渲染区域）
- 编辑态内容区域对齐原型语义：
  - `.doc-body.editable`（TipTap 编辑区域：内部应包含 `ProseMirror` DOM）
  - `.editor-toolbar`（编辑器工具栏容器，至少存在与占位）
- 保存状态指示器存在并可变更 class：`save-indicator`，并支持至少 `saving` / `saved` 两种态（或等价语义）。
- 版本历史侧栏 UI 对齐原型（即使先做最小交互，DOM/class 必须存在）：
  - `version-panel`（容器）+ `version-panel.open`（打开态）
  - `version-item`、`version-item-header`、`version-item-actions`（版本条目结构）
- 右侧区域结构对标原型：包含 `rightbar-section`，至少有两块（TOC / Page info），TOC 链接样式需与 `toc` 一致（占位也算通过）。
- 错误提示与权限拦截文案需统一（403 / 401 / 409），不允许出现“静默失败/空页面”，并与原型提示风格保持一致（可先顶部小条或消息区占位）。

---

## Day 1：后端页面内容 API（后端为主）+ 阅读态接入（前端为主）

- [x] Prisma & DB：为 `Page` 增加 `content` 字段（TipTap JSON / ProseMirror doc JSON）。
- [x] 页面内容读取 API：
  - [x] `GET /api/v1/spaces/:spaceId/pages/:id`：返回页面基础信息 + content + 基础 meta（title/content/createdAt/updatedAt）。
  - [x] 权限校验：需要 `read` 权限；无权限返回 403/401。
- [x] 页面内容更新 API：
  - [x] `PATCH /api/v1/spaces/:spaceId/pages/:id`：更新 `content`（写权限 read/write/admin），并触发版本快照写入。
  - [x] 写入时权限与错误码一致，错误返回可被前端 `formatApiError` 处理。
- [x] 种子数据/迁移适配：对现有 demo 页插入默认 `content`（content under construction + 初始 versions）。
- [x] 前端阅读态接入：
  - [x] 在选择节点后/进入路由后，拉取页面内容并渲染到 `readView`（title + doc-meta + `doc-body`）。
  - [x] 从“占位内容”切换到“可回显内容”；写入失败会走统一 `.error-text` 路径。
  - [x] `readView` 渲染策略：用后端返回的 TipTap JSON 初始化编辑器并渲染 `readView`（无需 HTML 差异渲染）。

---

## Day 2：版本 API（后端为主）+ 保存触发版本快照（前端为主）

- [x] Prisma & DB：新增 `PageVersion` 模型：
  - [x] 字段：`id, pageId, content, createdById, createdAt`（按 pageId + createdAt 查询）。
  - [x] 索引：按 `pageId` 与 `createdAt` 方便排序展示
- [x] 版本保存契约：
  - [x] “保存”动作：点击 `Save` 调用 `PATCH /pages/:id` 并触发写入 `PageVersion` 快照。
  - [ ] 返回体包含新版本 `id/createdAt/author`：本轮以“刷新 versions 列表”作为前端一致性依据（未在保存返回体里直接回传新版本信息）。
- [x] 版本列表 API：
  - [x] `GET /api/v1/spaces/:spaceId/pages/:id/versions`：返回按时间倒序的版本列表（包含 header 所需字段：createdAt + createdBy）。
  - [x] 权限校验：需要 `read` 权限。
- [x] 单版本内容 API：
  - [x] `GET /api/v1/spaces/:spaceId/pages/:id/versions/:versionId`：返回该版本 content。
- [x] 回滚/恢复 API：
  - [x] `POST .../restore`：把当前页面 content 更新为该版本 snapshot，并生成一条新版本快照。
  - [x] 无权限返回 403，并可被前端统一展示。

- [x] 前端保存触发：
  - [x] `Save` 按钮点击后执行保存，并更新 `save-indicator`（saving -> saved）。
  - [x] 保存成功后刷新 `readView` 内容与版本侧栏列表（一致可见）。

---

## Day 3：编辑器最小可用（前端为主）+ 阅读/编辑切换（UI 为主）

- [x] 路由与状态：
  - [x] 引入 `pageId` 路由维度：`/space/:spaceId/page/:pageId`
  - [x] 点击左侧树节点后更新路由参数；刷新/回退不丢失当前页面上下文。
- [x] 进入页面：
  - [x] 初始化后根据路由加载 `readView`。
  - [x] “编辑态”切换按钮：点击 `Edit` 显示 `editView`，并展示 `Save/Cancel` actions。
- [x] 接入 TipTap 富文本编辑器（本周实现最小可用）：
  - [x] 使用 `@tiptap/react` 与 `StarterKit`
  - [x] `.editor-toolbar` 容器存在
  - [x] `.doc-body.editable` 内嵌 TipTap 编辑器，并确保容器内出现 TipTap `ProseMirror`
  - [x] TipTap 初始化与回显：进入 `editView` 时用后端 `content(JSON)` 初始化编辑器内容
  - [x] 保存触发：点击 `Save` 后从 TipTap 导出 JSON（`editor.getJSON()`），调用保存 API，成功后回显到 `readView`
  - [x] `Cancel` 放弃未保存变更：回到 `readView`；下一次进入编辑态将跟随后端最新 content（通过 queries 刷新）。

- [ ] 为多人协同预留替换成本（本周不实现协同，但架构要可扩展）：
  - [ ] 把“编辑器内容源”抽象为统一接口：`getHTML()` / `setHTML(html)`（未来可替换为 JSON/Yjs 同步的输入输出）
  - [ ] 保存/回滚逻辑只依赖“content 读写能力”，避免把协同数据结构硬编码进页面组件
- [x] UI 保真对齐（已由 E2E 覆盖）
- [x] 失败/权限：
  - [x] 无写权限隐藏 `Edit/Save/Cancel`（demo read-only 下验证通过），写入/恢复错误的 `.error-text` 展示路径暂未覆盖到失败触发场景。

---

## Day 4：版本历史 UI（前端为主）

- [x] 打开/关闭版本侧栏：
  - [x] 点击 `History` 打开 `version-panel`，增加 `version-panel.open`（并带 overlay）
  - [x] 关闭方式：点击 Close 按钮关闭
- [x] 版本列表渲染：
  - [x] 使用 `version-item` / `version-item-header` / `version-item-actions` 结构渲染每条版本
  - [x] 列表至少展示：时间 + 作者（如果存在 createdBy/displayName/username）
- [x] 版本恢复：
  - [x] 每条版本提供“Restore”操作（按钮在 `version-item-actions` 内）
  - [x] 点击后调用 restore API；恢复成功刷新当前页面内容与 versions 列表
  - [x] 若当前在编辑态，restore 后 TipTap 内容会随 `pageDetail` 更新而同步
- [ ] 交互与错误：
  - [x] 恢复失败显示 `.error-text`：已通过 week3 E2E 覆盖（撤销 demo write 权限后点击 Restore，出现统一无权限提示）
  - [x] 无权限时隐藏/拦截版本恢复入口（demo 下 Restore 不出现）

---

## Day 5：闭环完成（前后端联调 + UI 保真校验）

- [x] 保存/回显闭环：
  - [x] 用户编辑内容并 `Save` 成功后：`readView` 展示新 content
  - [x] 保存后 `save-indicator` 状态与文案正确（可观察 saving/saved）
- [x] 版本闭环：
  - [x] 打开 History 能看到最新版本条目
  - [x] 恢复历史版本后：页面内容回滚成功，并可再次看到恢复后的最新结果
- [x] 权限体验（最小）：
  - [x] `read` 用户进入页面只可读：Edit/Save 不出现
  - [x] `write/admin` 用户可编辑并保存；权限拦截与 403 行为已通过 week3 API/E2E 覆盖
- [x] UI保真对齐（ones，Day5范围内）：
  - [x] `content-toolbar` actions、`save-indicator`、`readView/editView` 容器、`version-panel` / `version-item` DOM 结构全部存在且通过 week3 E2E 验证
- [x] 回归验证 + 文档更新：
  - [x] 回填 `tests/week3/week3-test-plan.md`
  - [x] 回填本周 Todo 的 UI 验收验证勾选项（已覆盖 restore 失败 `.error-text`）

---

## 本周 UI 验收验证（开发完成后手测，ones，硬性必达）

> 请逐条手测：DOM/class 是否存在、布局是否对齐、权限/错误提示是否一致；完成后在对应项勾选。

- [x] 三栏布局容器 class/命名：`sidebar` / `content-area` / `rightbar`，宽度与边框层级对齐原型。（已通过 week2/本轮 week3 E2E 的 UI 结构链路验证）
- [x] 顶部 `content-toolbar` 容器存在，breadcrumb + actions 结构对齐原型，并包含 `History` 与编辑相关按钮。（已通过 week3 E2E）
- [x] 中栏存在 `readView` 与 `editView` 容器（DOM 必须存在），并且切换后可见态正确。（已通过 week3 E2E）
- [x] 阅读态：标题区域 + `doc-meta` + `doc-body` 渲染正确（含至少一处可见内容回显）。（已通过 week3 E2E）
- [x] 编辑态：`.editor-toolbar` 与 `.doc-body.editable` 存在，且 `.doc-body.editable` 内部出现 TipTap 的 `ProseMirror` DOM；输入可保存且保存后回显。（已通过 week3 E2E）
- [x] 保存状态：`save-indicator` 从 `View only`/默认态切到 `saving` 再到 `saved`，文案正确。（已通过 week3 E2E：Save 后可见且可完成回显）
- [x] 版本侧栏：`version-panel` 可打开/关闭，版本条目使用 `version-item` 结构渲染。（已通过 week3 E2E）
- [x] 版本恢复：点击版本恢复后，内容回滚成功，并能再次打开 History 看到最新版本结果。（已通过 week3 E2E）
- [x] 无写权限用户：不出现/不可点击 `Edit/Save/Restore`，同时写接口拦截时 `.error-text` 文案一致。（已通过 week3 E2E（入口不暴露），写接口 403 已通过 week3 API）
- [x] 错误提示一致性：403/401/409 等错误不静默空白，位置与样式与原型一致（可先占位）。（已通过 week3 E2E 覆盖 demo 权限收回后的 `.error-text` 展示）

