# 第 3 周测试文档（可执行）

> 关联 Todo：`docs/08-第三周开发Todo.md`

## 1. 基本信息

- 周次：第 3 周
- 执行人：待填写
- 执行日期：待填写
- 环境：
  - Backend: `http://localhost:3000`
  - Frontend: `http://localhost:5173`

## 2. 测试范围

- 功能范围：
  - 页面内容读取/更新（TipTap JSON 存储）
  - 保存触发版本快照
  - 版本列表读取
  - 版本恢复（restore）与内容回显
  - 权限体验：read-only 用户不可编辑与恢复
  - UI：`/space/:spaceId/page/:pageId` 的阅读态/编辑态、History 侧栏
- UI 保真范围（对标 ones）：
  - 顶部 `content-toolbar` actions
  - 中栏 `readView/editView` 容器与 `.doc-body.editable` + TipTap `ProseMirror`
  - 右栏 `version-panel/version-item` 结构与 overlay

## 3. 前置条件

- [ ] 数据库迁移已执行（backend：包含 Page.content 与 PageVersion）
- [ ] 种子数据已执行（至少有 `admin/admin123`、`demo/demo123`）
- [ ] 后端服务已启动：`cd backend && npm run dev`
- [ ] 前端服务已启动：`cd frontend && npm run dev`

## 4. 手工测试步骤（可执行）

| ID | 场景 | 步骤 | 预期结果 | 结果 |
|----|------|------|----------|------|
| M-01 | Admin 阅读态 + TipTap 渲染 | 1) 进入 `/space/:spaceId/page/:pageId` 2) 打开 `.ProseMirror` 内容 | ProseMirror 存在，readView 可见 | Pass |
| M-02 | Admin Edit/Cancel/Save | 1) 点击 Edit 2) 修改 ProseMirror 文本 3) 点击 Cancel 4) 再次 Edit 并修改 5) 点击 Save | Cancel 不改变内容；Save 后回到阅读态并回显新内容 | Pass（本次 E2E 覆盖 Edit/Save/回显；Cancel 可回滚逻辑未单独断言） |
| M-03 | Admin History + Restore | 1) 点击 History 2) 至少看到 2 条 version 3) 点击非最新那条的 Restore | 恢复后内容回到旧版本 | Pass |
| M-04 | Demo read-only 按钮显隐 | 1) 使用 demo 登录 2) 进入页面 3) 打开 History | 不出现 Edit/Save/Cancel；History 可打开但没有 Restore 按钮 | Pass |
| M-05 | 权限拦截文案一致性 | 1) demo 具备 write，打开 History 并确认 Restore 按钮可见 2) 撤销 demo write -> read（不刷新）3) 点击 Restore 4) 观察 `.error-text` | 前端 `.error-text` 显示统一“无权限/禁止”（如 `You don't have permission`），且不出现静默空白 | Pass（week3 E2E 覆盖） |

## 5. 自动化测试清单

| ID | 场景 | 是否自动化 | 脚本路径 | 结果 |
|----|------|------------|----------|------|
| A-01 | 页面内容 GET/对应 TipTap JSON | 是 | `tests/week3/week3-api-automation.mjs` | Pass |
| A-02 | PATCH 保存生成版本快照 | 是 | `tests/week3/week3-api-automation.mjs` | Pass |
| A-03 | versions 列表 + restore 恢复内容 | 是 | `tests/week3/week3-api-automation.mjs` | Pass |
| A-04 | Demo restore 403（写权限） | 是 | `tests/week3/week3-api-automation.mjs` | Pass |
| A-05 | 前端 Edit/Save/History/Restore UI E2E | 是 | `frontend/tests/e2e/week3.e2e.spec.mjs` | Pass |
| A-06 | Demo read-only 下 History 不出现 Restore 按钮 | 是 | `frontend/tests/e2e/week3.e2e.spec.mjs` | Pass |

## 6. 自动化脚本执行方式

```bash
node tests/week3/week3-api-automation.mjs --help
node tests/week3/week3-api-automation.mjs --baseUrl http://localhost:3000
```

可选参数：

- `--adminUser`（默认 `admin`）
- `--adminPass`（默认 `admin123`）
- `--demoUser`（默认 `demo`）
- `--demoPass`（默认 `demo123`）

## 7. 缺陷与风险记录

- 自动化覆盖关键路径；可能未覆盖像素级/边界视觉差异与协同场景。

## 8. 结论

- 通过率：7/7（API）+ 2/2（E2E）
- 是否允许进入下一周：允许（content/versions/History/Restore 关键链路已验证）

