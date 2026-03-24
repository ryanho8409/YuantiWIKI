# 第 8 周测试文档（可执行）

> 关联 Todo：`docs/14-第八周开发Todo.md`

## 1. 基本信息

- 周次：第 8 周
- 执行人：AI + 人工复核
- 环境：
  - Backend：`http://localhost:3000`
  - Frontend：`http://localhost:5174`

## 2. 测试范围

- F-001 全站中文扫尾：
  - 高风险页面（登录/首页/搜索/空间/管理端）文案中文化
  - 错误与空态提示中文一致
- F-005 空间页对标打磨：
  - 顶栏无无序双行堆砌
  - 侧栏主新建入口独立且明显
  - Expand/Collapse 降级为次要
- 回归：
  - week7 API 自动化与 week7 E2E 不回退

## 3. 前置条件

- [x] 后端服务已启动
- [x] 前端服务已启动
- [x] 账号可用：`admin/admin123`、`demo/demo123`

## 4. 手工测试步骤

| ID | 场景 | 步骤 | 预期结果 | 结果 |
|----|------|------|----------|------|
| M-01 | 全站中文扫尾（高频页） | 依次打开登录/首页/搜索/空间/管理端 | 用户可见文案无明显英文残留（技术术语除外） | Pass（代码核验+E2E覆盖） |
| M-02 | 空间页顶栏无堆砌 | 在常见桌面宽度下打开 `SpacePage` | 顶栏主操作不乱换行；低频操作可通过“更多”到达 | Pass（E2E+样式核验） |
| M-03 | 侧栏主次层级 | 检查 Pages 区按钮布局 | 主新建入口独立；Expand/Collapse 为次级操作 | Pass（代码核验） |
| M-04 | 空态与错误提示一致性 | 触发无结果/无权限/失败态 | 文案语气统一、行动建议清晰 | Pass（代码核验+E2E覆盖） |

## 5. 自动化回归清单

| ID | 场景 | 是否自动化 | 脚本路径 | 结果 |
|----|------|------------|----------|------|
| A-01 | week7 API 回归 | 是 | `tests/week7/week7-api-automation.mjs` | Pass（6/6） |
| A-02 | week7 E2E 回归 | 是 | `frontend/tests/e2e/week7.e2e.spec.mjs` | Pass（5/5） |

## 6. 执行命令

```bash
node tests/week7/week7-api-automation.mjs --baseUrl http://localhost:3000
```

在 `frontend/` 目录执行：

```bash
npm run test:e2e -- tests/e2e/week7.e2e.spec.mjs
```

## 7. 结论（回填）

- 是否允许进入下一周：是
- 遗留项：无阻塞遗留；建议下一周仅进行体验微调与性能优化（非本周 P0）

