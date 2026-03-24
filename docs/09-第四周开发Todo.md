# 元体知识库 — 第 4 周开发 Todo 列表（搜索与基础检索）

> 目标：进入《05-项目实施计划》阶段 4（搜索与附件）后，先完成 **搜索能力最小闭环**：后端搜索 API（权限过滤）+ 前端 `/search` 页面（结果列表与跳转到具体页面）。

## 本周里程碑（验收口径）

- [x] 后端：提供可用的搜索 API（全局或空间内均可），返回包含 `spaceId/pageId/title/path/excerpt` 的结果集；结果必须经过权限过滤（read/write/admin 均可读）。
- [x] 前端：实现 `/search` 页面，提供搜索输入框、展示结果列表卡片并支持点击跳转到 `/space/:spaceId/page/:pageId`。
- [x] 权限体验：无权限用户看到的搜索结果为空或被正确过滤；API 返回 401/403 时前端有统一 `.error-text` 提示。

## 本周 UI 保真验收清单（开发前置，ones，硬性必达）

> 对标基准：`web-prototype/search.html` 与 `web-prototype/styles/common.css`。

- [x] 顶部搜索输入框（如有）语义与样式贴合原型（placeholder、padding、边框圆角）。
- [x] `/search` 页面搜索输入与结果卡片使用对应语义 class：
  - `search-box-wrap`（输入框外层）
  - `search-result`（结果卡片）
  - `search-meta`（结果条数/提示）
  - `path`（路径文案）
  - `excerpt`（摘要文案）
- [x] 结果卡片可点击，点击后路由跳转到对应 `space/page`，并展示 `readView` 内容。
- [x] 错误提示：401/403 等错误不静默空白，`.error-text` 文案与错误 contract 保持一致。

---

## Day 1：后端搜索 API（权限过滤为主）

- [x] 新增路由：`GET /api/v1/search?q=...`
- [x] 权限过滤：仅返回当前用户在对应空间的 `read/write/admin` 可读页面
- [x] 搜索匹配：对 TipTap JSON content 提取文本后做字符串匹配（最小实现）
- [x] 结果格式：至少返回 `spaceId, pageId, title, path, excerpt`

---

## Day 2：前端 `/search` 页面骨架（UI 为主）

- [x] 新建 `frontend/src/pages/SearchPage.tsx`，使用 React Query 获取搜索结果
- [x] 页面布局：`search-box-wrap/search-meta/search-result/path/excerpt`
- [x] 空结果/异常处理：空结果给出提示；异常显示 `.error-text`
- [x] 点击结果卡片：导航到 `/space/:spaceId/page/:pageId`

---

## Day 3：Header 搜索输入接入（可选加分）

- [x] 在全局 header（`Layout.tsx`）增加搜索输入框
- [x] 输入后按 Enter 导航到 `/search?q=...`
- [x] 与原型对齐：placeholder、宽度、边框层级

---

## Day 4：回归校验（权限与跳转）

- [x] admin 搜索可见所有符合关键词的页面
- [x] demo 搜索只显示有权限的页面
- [x] 点击结果可进入 SpacePage 并渲染 readView

---

## Day 5：测试资产与回填

- [x] 新建 `tests/week4/week4-test-plan.md`，并回填测试结果
- [x] 新建/更新 `tests/week4/week4-api-automation.mjs`（搜索 API）
- [x] 新建/更新 `frontend/tests/e2e/week4.e2e.spec.mjs`（搜索 UI/跳转）
- [x] 回填本周 UI 验收验证勾选项

---

## 本周 UI 验收验证（开发完成后手测，ones，硬性必达）

- [x] `/search` 页面存在并渲染：`search-box-wrap/search-meta/search-result/path/excerpt`
- [x] 搜索存在匹配内容时，至少显示 1 条结果
- [x] 点击结果能跳转 `/space/:spaceId/page/:pageId`，readView 内部显示 ProseMirror/内容回显
- [x] demo 只看到有权限的搜索结果（不应泄露不可读页面）
- [x] 401/403 时 `.error-text` 有可见且文案统一的提示

