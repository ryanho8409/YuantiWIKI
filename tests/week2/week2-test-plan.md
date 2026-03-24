# 第 2 周测试文档（可执行）

> 关联 Todo：`docs/07-第二周开发Todo.md`

## 1. 基本信息

- 周次：第 2 周
- 执行人：待填写
- 执行日期：待填写
- 环境：
  - Backend: `http://localhost:3000`
  - Frontend: `http://localhost:5173`

## 2. 测试范围

- 功能范围：
  - 空间 CRUD（系统管理员）
  - 空间权限列表/覆盖更新
  - 页面树 API：`tree/list`、新建、重命名、删除（含 `HAS_CHILDREN`）
  - 前端空间页最小交互（页面树 + New/Rename/Delete + 权限显隐）
- UI 保真范围（对标 ones）：
  - 三栏 class：`sidebar/content-area/rightbar`
  - 中栏 `content-toolbar` + `readView/editView`
  - 左树 `tree-node/tree-children` + 右栏 `rightbar-section/toc`

## 3. 前置条件

- [ ] 数据库迁移已执行（backend）
- [ ] 种子数据已执行（至少有 `admin/admin123`、`demo/demo123`）
- [ ] 后端服务已启动：`cd backend && npm run dev`
- [ ] 前端服务已启动：`cd frontend && npm run dev`

## 4. 手工测试步骤（可执行）

| ID | 场景 | 步骤 | 预期结果 | 结果 |
|----|------|------|----------|------|
| M-01 | 三栏布局 class 对齐 | 1) 登录后进入 `/space/:spaceId` 2) 用 DevTools 检查容器类 | 存在 `sidebar/content-area/rightbar`；左 260、右 240 的布局语义正确 | Pass |
| M-02 | 中栏结构对齐 | 1) 检查中栏顶部 2) 检查正文容器 | 存在 `content-toolbar`，含 breadcrumb/actions；存在 `readView/editView` | Pass |
| M-03 | 左树/右栏结构对齐 | 1) 检查树节点 2) 检查右栏区块 | 树节点使用 `tree-node/tree-children`；右栏有两块 `rightbar-section` 且包含 `toc` | Pass |
| M-04 | 写权限用户页面树操作 | 1) admin 进入空间 2) New/Rename/Delete 页面 | 操作成功后树刷新，状态提示可见 | Pass |
| M-05 | 无写权限体验 | 1) demo 进入只读空间 2) 检查按钮/右键 | 不显示 New/Rename/Delete，写接口失败时提示无权限 | Pass |
| M-06 | 鉴权错误提示 | 1) 失效 token 或直接访问受限接口 | 401/403 有可见提示，不出现静默空白 | Pass |
| M-07 | 数据一致性 | 1) 删除页面 2) 刷新 | 删除后树中不再出现，刷新后状态一致 | Pass |

## 5. 自动化测试清单

| ID | 场景 | 是否自动化 | 脚本路径 | 结果 |
|----|------|------------|----------|------|
| A-01 | admin/demo 登录成功 | 是 | `tests/week2/week2-api-automation.mjs` | Pass |
| A-02 | admin 可创建/更新/删除空间 | 是 | `tests/week2/week2-api-automation.mjs` | Pass |
| A-03 | demo 无法创建空间（403） | 是 | `tests/week2/week2-api-automation.mjs` | Pass |
| A-04 | 空间权限 GET/PUT 可用（admin） | 是 | `tests/week2/week2-api-automation.mjs` | Pass |
| A-05 | demo 访问权限配置接口返回 403 | 是 | `tests/week2/week2-api-automation.mjs` | Pass |
| A-06 | 页面树 `list/tree` 返回结构稳定 | 是 | `tests/week2/week2-api-automation.mjs` | Pass |
| A-07 | 页面 CRUD（创建子页/重命名/删除） | 是 | `tests/week2/week2-api-automation.mjs` | Pass |
| A-08 | 删除含子节点页面返回 `409/HAS_CHILDREN` | 是 | `tests/week2/week2-api-automation.mjs` | Pass |
| A-09 | UI 保真 7 项（Todo 的 UI 验收验证） | 是 | `frontend/tests/e2e/week2.e2e.spec.mjs` | Pass |
| A-10 | 前端按钮显隐/提示文案体验 | 是 | `frontend/tests/e2e/week2.e2e.spec.mjs` | Pass |

## 6. 自动化脚本执行方式

```bash
node tests/week2/week2-api-automation.mjs --help
node tests/week2/week2-api-automation.mjs --baseUrl http://localhost:3000
```

可选参数：

- `--adminUser`（默认 `admin`）
- `--adminPass`（默认 `admin123`）
- `--demoUser`（默认 `demo`）
- `--demoPass`（默认 `demo123`）

## 7. 缺陷与风险记录

- 当前自动化包含 API + Playwright UI/交互关键断言，但仍未覆盖所有像素级/边界视觉差异场景。
- 自动化会创建一个临时空间并在结束后删除；若执行中断可能残留测试数据。

## 8. 结论

- 通过率：API 8/8 + Playwright UI E2E 4/4（覆盖 M-01~M-07）
- 是否允许进入下一周：允许进入（API 自动化与 Playwright UI E2E 均通过）
- 备注：week2 页树/权限/CRUD 接口联调冒烟测试与 UI/交互 E2E 已通过
