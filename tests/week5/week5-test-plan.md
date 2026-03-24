# 第 5 周测试文档（可执行）

> 关联 Todo：`docs/10-第五周开发Todo.md`

## 1. 基本信息

- 周次：第 5 周
- 环境：
  - Backend：`http://localhost:3000`
  - Frontend：`http://localhost:5173`

## 2. 测试范围

- page permissions API：
  - 读取页面级权限配置
  - 覆盖/继承写权限配置
  - 有效权限（页面级优先）用于读/写/restore 校验
- 前端 UI：
  - `Page settings` 弹窗
  - 权限驱动的按钮显隐：`Edit/Save/Cancel/History/Restore`
- 错误体验：
  - 403 时 `.error-text` 可见且文案包含 `You don't have permission`

## 3. 前置条件

- [x] 数据库迁移已执行（包含 `page_permissions`）
- [x] 后端服务已启动
- [x] 前端服务已启动

## 4. 手工测试步骤（可执行）

| ID | 场景 | 步骤 | 预期结果 | 结果 |
|----|------|------|----------|------|
| M-01 | Page settings 弹窗可打开/关闭 | 1) 进入某页面 2) 点击 `Page settings` 3) Close/overlay 关闭 | 弹窗出现/收起 overlay，页面可继续操作 | Pass |
| M-02 | 继承空间：demo 可编辑（若 space=write） | 1) demo 在 space 中为 write 2) 不配置页面覆盖（inherit） | demo 可 Edit/Save，Restore 可用 | Pass |
| M-03 | 页面覆盖：demo 改为 Can view | 1) admin 打开 Page settings 2) 对 demo 选择 Can view / 保存 3) 不刷新页面直接观察 | demo 不应显示 Edit/Save/Cancel；Restore 行为要么按钮不显示，要么点击后 `.error-text` 出现 | Pass |
| M-04 | 页面覆盖：403 Restore 文案一致 | 1) demo 首先可 Restore 2) admin 改为 Can view 3) demo 点击 Restore | `.error-text` 可见且包含 `You don't have permission` | Pass |

## 5. 自动化测试清单

| ID | 场景 | 是否自动化 | 脚本路径 | 结果 |
|----|------|------------|----------|------|
| A-01 | page permissions API：读/写与继承逻辑 | 是 | `tests/week5/week5-api-automation.mjs` | Pass |
| A-02 | 有效权限：PATCH/Restore 403/200 | 是 | `tests/week5/week5-api-automation.mjs` | Pass |
| A-03 | 前端 UI：Page settings 保存后有效权限立即生效 | 是 | `frontend/tests/e2e/week5.e2e.spec.mjs` | Pass |

