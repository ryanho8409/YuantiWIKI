# 第 N 周测试文档模板（可执行）

> 文档用途：把每周 Todo 中“需要验证的功能 + UI 保真”转换为可执行测试步骤，并明确哪些可自动化。

## 1. 基本信息

- 周次：第 N 周
- 关联 Todo：`docs/0N-第N周开发Todo.md`
- 执行人：
- 执行日期：
- 环境：
  - Backend: `http://localhost:3000`
  - Frontend: `http://localhost:5173`

## 2. 测试范围

- 功能范围：
- UI 保真范围（对标 ones）：
- 非范围（本周不测）：

## 3. 前置条件

- [ ] 数据库迁移已执行
- [ ] 种子数据已执行（账号/空间可用）
- [ ] 后端服务启动成功
- [ ] 前端服务启动成功

## 4. 手工测试步骤（可执行）

| ID | 场景 | 步骤 | 预期结果 | 结果 |
|----|------|------|----------|------|
| M-01 | 示例 | 1) ... 2) ... | ... | Pass/Fail |

## 4.1 一致性映射要求（必填）

- `M-xx`/`A-xx` 的场景必须来自对应周 `docs/0N-第N周开发Todo.md` 的“本周 UI 验收验证（开发完成后手测）”checkbox；
- 自动化用例（`A-xx`）必须指向真实脚本路径，脚本需能给出明确 Pass/Fail；
- 测试跑完后，回填顺序固定为：先回填 `tests/weekN/weekN-test-plan.md`，再回填对应 `Todo.md` 的 checkbox。

## 5. 自动化测试清单

| ID | 场景 | 是否自动化 | 脚本路径 | 结果 |
|----|------|------------|----------|------|
| A-01 | 示例 | 是 | `tests/weekN/weekN-api-automation.mjs` | Pass/Fail |

## 6. 自动化脚本执行方式

```bash
node tests/weekN/weekN-api-automation.mjs --help
node tests/weekN/weekN-api-automation.mjs --baseUrl http://localhost:3000
```

## 7. 缺陷与风险记录

- 缺陷：
- 风险：
- 阻塞项：

## 8. 结论

- 通过率：
- 是否允许进入下一周：
- 备注：
