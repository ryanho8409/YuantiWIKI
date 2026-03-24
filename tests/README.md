# YuantiWIKI Tests Guide

本目录用于沉淀“每周 Todo 对应的可执行测试资产”，包括：

- 周测试文档（手工步骤 + 自动化覆盖清单）
- 自动化脚本（当前以 API 自动化为主）
- 周测试模板（用于后续复用）

## 目录结构

```text
tests/
  README.md
  WEEKLY_TEST_PLAN_TEMPLATE.md
  week1/
    week1-test-plan.md
    week1-api-automation.mjs
  week2/
    week2-test-plan.md
    week2-api-automation.mjs
  week3/
    week3-test-plan.md
    week3-api-automation.mjs
  week4/
    week4-test-plan.md
    week4-api-automation.mjs
  week5/
    week5-test-plan.md
    week5-api-automation.mjs
  week6/
    week6-test-plan.md
    week6-api-automation.mjs
  week7/
    week7-test-plan.md
    week7-api-automation.mjs
  week8/
    week8-test-plan.md
  week9/
    week9-test-plan.md
```

## 执行前准备

1. 启动后端（默认 `http://localhost:3000`）
2. 启动前端（默认 `http://localhost:5173`）
3. 确认数据库 migration/seed 已执行
4. 确认测试账号可用（默认）：
   - `admin / admin123`
   - `demo / demo123`
5. 若你在本地修改过测试账号密码，请在执行脚本时显式传参（避免 401）：
   - API 自动化：`--adminPass` / `--demoPass`
   - E2E：`PW_ADMIN_PASS` / `PW_DEMO_PASS`

## 自动化脚本

### Week 1

```bash
node tests/week1/week1-api-automation.mjs --help
node tests/week1/week1-api-automation.mjs --baseUrl http://localhost:3000
```

### Week 2

```bash
node tests/week2/week2-api-automation.mjs --help
node tests/week2/week2-api-automation.mjs --baseUrl http://localhost:3000
```
 
### Week 3
```bash
node tests/week3/week3-api-automation.mjs --help
node tests/week3/week3-api-automation.mjs --baseUrl http://localhost:3000
```

### Week 4
```bash
node tests/week4/week4-api-automation.mjs --help
node tests/week4/week4-api-automation.mjs --baseUrl http://localhost:3000
```

### Week 5
```bash
node tests/week5/week5-api-automation.mjs --help
node tests/week5/week5-api-automation.mjs --baseUrl http://localhost:3000
```

### Week 6
```bash
node tests/week6/week6-api-automation.mjs --help
node tests/week6/week6-api-automation.mjs --baseUrl http://localhost:3000
```

### Week 7
```bash
node tests/week7/week7-api-automation.mjs --help
node tests/week7/week7-api-automation.mjs --baseUrl http://localhost:3000
# 若本地改过密码，请显式传参（示例）
# node tests/week7/week7-api-automation.mjs --baseUrl http://localhost:3000 --demoPass 123456
```

Week 7 前端 E2E（在 `frontend/` 目录；默认前端 `http://localhost:5173`，与 `vite` 一致）：
```bash
# 可选：与 Playwright 默认 baseURL 对齐
# $env:PLAYWRIGHT_BASE_URL="http://localhost:5173"
# 若本地改过密码，请显式传参（示例）
# $env:PW_ADMIN_PASS="admin123"
# $env:PW_DEMO_PASS="123456"
npm run test:e2e -- tests/e2e/week7.e2e.spec.mjs
```

### Week 8

Week 8 以“回归不退化”为目标，复用 week7 自动化脚本：
```bash
node tests/week7/week7-api-automation.mjs --baseUrl http://localhost:3000
```

在 `frontend/` 目录执行：
```bash
npm run test:e2e -- tests/e2e/week7.e2e.spec.mjs
```

### Week 9

Week 9 测试计划已建立：
```text
tests/week9/week9-test-plan.md
```

建议新增自动化脚本（待实现）：
```text
tests/week9/week9-api-automation.mjs
frontend/tests/e2e/week9.e2e.spec.mjs
```

可选参数（两个脚本一致）：

- `--adminUser`（默认 `admin`）
- `--adminPass`（默认 `admin123`）
- `--demoUser`（默认 `demo`）
- `--demoPass`（默认 `demo123`）

## 推荐执行顺序

1. 跑对应周的 API 自动化脚本（快速确认核心后端能力）
2. 按该周 `weekN-test-plan.md` 执行手工测试（尤其 UI 保真项）
3. 将结果回填到周测试文档与周 Todo 勾选项

为了保证“项目实施计划 -> 开发 Todo -> 测试计划 -> 测试脚本”的一致性映射闭环，请优先参考：
- `docs/测试验证闭环模板.md`

## 失败排查

- 连接失败（`ECONNREFUSED`）：
  - 检查 backend 是否已启动、端口是否正确
- 401/403 异常：
  - 检查 seed 数据和账号密码
  - 检查 token 是否正确传递
- 404 异常：
  - 检查 API 前缀是否为 `/api/v1`
- UI 断言失败：
  - 对照 `web-prototype/*.html` 与 `docs/*开发Todo*.md` 的 UI 验收验证条目逐项核对

## 约定

- 每新增一周开发 Todo，都要新增：
  - `tests/weekN/weekN-test-plan.md`
  - 可自动化部分对应脚本（如 `weekN-api-automation.mjs`）
  - 若当周仅做回归，也需在 `weekN-test-plan.md` 明确“复用脚本来源与原因”
- 文档先写“UI 保真验收清单（开发前置）”，开发完成后用“UI 验收验证”手工勾选。
- `weekN-test-plan.md` 中的每个 `M-xx/A-xx` 必须能追溯到 `docs/0N-第N周开发Todo.md` 的对应 checkbox（形成验收与自动化的一一映射）。
