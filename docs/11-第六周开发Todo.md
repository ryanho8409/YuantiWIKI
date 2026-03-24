# 元体知识库 — 第 6 周开发 Todo 列表（附件上传 + 编辑器插入图片）

> 目标：补齐《05-项目实施计划》阶段 4 未收尾项：`attachments` 数据与 API、multipart 上传、TipTap 插入图片；正文存储无 JWT 的图片 URL，前端渲染时补 `token` 查询参数。

## 本周里程碑（验收口径）

- [x] 后端：`Attachment` 模型与迁移；`POST /spaces/:spaceId/attachments`（multipart）；`GET /attachments/:id/file`（Bearer 或 `?token=`）；`DELETE` 删除记录与文件
- [x] 前端：`@tiptap/extension-image`；编辑态「Insert image」上传并插入；保存前剥离 URL 中的 `token`
- [x] 工程：`backend/.gitignore` 忽略 `uploads/`；`npm run build` 通过

## 本周 UI / 体验验收清单

- [x] 编辑态工具栏出现「Insert image」，可选图并插入到正文
- [x] 保存后只读视图图片可显示（依赖 DOM 层为附件 URL 补 token）
- [x] 无写权限用户无法上传（403）

---

## Day 1：数据层 + 后端路由

- [x] Prisma：`Attachment` 与 `User` / `Space` / `Page` 关系
- [x] 迁移：`add_attachments`
- [x] `@fastify/multipart` 注册与大小限制
- [x] 上传落盘：`UPLOAD_DIR` 或 `cwd/uploads`，DB 存相对路径

---

## Day 2：前端编辑器

- [x] `SpacePage`：`Image` 扩展 + 上传 `FormData`
- [x] 插入 URL：`/api/v1/attachments/:id/file?token=...`（仅编辑会话）；`stripAttachmentTokensFromDoc` 在 PATCH 前清理
- [x] 只读/编辑共用 `MutationObserver` 为 `.doc-body img` 补 token

---

## Day 3：测试与文档回填

- [x] `tests/week6/week6-test-plan.md`
- [x] `tests/week6/week6-api-automation.mjs`（上传 + 读文件 + token 查询参数）
- [x] `docs/README.md` 修订说明
- [x] 跑通自动化：`week6-api-automation`（5/5 passed，含 DELETE 附件）

---

## Day 4：路线 B（异常态与加载态打磨）

- [x] `SpacePage` 增加 `space/page` 404/403 显式状态面板（含 Retry / 返回入口）
- [x] `History` 侧栏补齐 loading / error / empty 三态，错误支持重试
- [x] 核心按钮增加 pending disable（Save/Restore/权限保存/树操作）避免重复提交
- [x] 空树态补齐引导（可写用户显示 Create first page）

---

## 本周 UI 验收验证（手测）

- [x] 在可写页面插入图片 → Save → 刷新后图片仍可见（见 `tests/week6/week6-test-plan.md` U-01）
- [x] 切换账号为只读：无法 Insert / 上传返回 403（U-02；API 侧见脚本 A-04）
