# 元体知识库 — 第 5 周开发 Todo 列表（页面级权限与打磨）

> 目标：进入《05-项目实施计划》阶段 5：补齐 `page_permissions`，让“页面可见/可编辑”能够覆盖空间级权限，并把体验打磨到可验收状态。

## 本周里程碑（验收口径）

- [x] 后端：实现 `page_permissions` 的增删查（用于页面设置配置），并在所有页面相关“读/写接口”中按 **页面级优先** 做覆盖校验
- [x] 前端：在页面工具栏 `Page settings` 弹窗里配置“对某个成员可读/可写/继承空间”
- [x] 前端：根据页面级有效权限，正确显示/隐藏 `Edit / Save / Cancel / History / Restore` 等关键 UI
- [x] 体验：403/404 等错误不静默空白，`.error-text` 文案与错误 contract 保持一致

## 本周 UI 保真验收清单（开发前置，ones，硬性必达）

> 对标基准：`web-prototype/space.html` 中“Page settings dialog（页面级权限原型占位）”与已有的错误/按钮样式约定

- [x] 页面设置按钮行为：点击打开弹窗，关闭可收起 overlay 与弹窗
- [x] 弹窗结构与语义 class：
  - `page-settings`
  - `page-settings-header`
  - `page-settings-title`
  - 成员权限表使用表格语义 `<table><thead><tbody>`
- [x] 权限下拉选项支持三态：`Inherit from space` / `Can edit` / `Can view`
- [x] 有效权限生效：demo 在“对该页设为 Can view”时，页面编辑与 Restore 行为被拦截且出现 `.error-text`

---

## Day 1：Prisma + 数据层（page_permissions）

- [x] Prisma 增加模型：`PagePermission`（字段：pageId/subjectType/subjectId/permission/read|write）
- [x] 迁移：创建 `page_permissions` 表
- [x] 更新关系：User <-> PagePermission，Page <-> PagePermission

---

## Day 2：后端 API（page permissions）

- [x] 实现路由 `GET /api/v1/spaces/:spaceId/pages/:pageId/permissions`（space admin 可用）
- [x] 实现路由 `PUT /api/v1/spaces/:spaceId/pages/:pageId/permissions`（覆盖/继承逻辑）
- [x] 实现有效权限判定：页面级写优先于空间级写（页面级 read 仅允许查看）

---

## Day 3：后端贯穿校验（覆盖到所有读/写接口）

- [x] `GET /spaces/:spaceId/pages/:id` 返回当前用户有效权限 `myPermission`
- [x] `PATCH /pages/:id` 需要有效写权限（404/403 友好）
- [x] `POST /versions/:versionId/restore` 需要有效写权限
- [x] `DELETE /pages/:id` 需要有效写权限
- [x] `PATCH /pages/:id` / restore 403 时前端能显示统一 `.error-text`

---

## Day 4：前端 UI（Page settings 弹窗 + 权限驱动）

- [x] 在 `SpacePage` 实现弹窗（复用 overlay 规则）
- [x] 弹窗读取当前页面设置，并渲染成员行与权限下拉
- [x] 保存调用 PUT 接口，并在保存后刷新有效权限
- [x] 根据有效权限更新 UI：Edit/Save/Cancel/Restore 显隐与可操作性

---

## Day 5：测试资产与回填

- [x] 新建 `tests/week5/week5-test-plan.md` 并回填测试结果
- [x] 新建/更新 `tests/week5/week5-api-automation.mjs`（page permissions + 有效权限）
- [x] 新建/更新 `frontend/tests/e2e/week5.e2e.spec.mjs`（Page settings UI + Restore 权限拦截）
- [x] 回填本周 UI 验收验证勾选项

---

## 本周 UI 验收验证（开发完成后手测，ones，硬性必达）

- [x] demo 在“该页设为 Can view”后：
  - 不显示 `Edit / Save / Cancel`
  - History 中不出现 `Restore`（或点击 Restore 后 `.error-text` 出现且不静默）
- [x] 对应的失败链路在 `.error-text` 中可见，并且文案包含 `You don't have permission`
- [x] 弹窗权限保存后刷新：有效权限立刻生效（不需要手动刷新页面时最好）

