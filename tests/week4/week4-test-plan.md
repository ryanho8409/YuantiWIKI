# 第 4 周测试文档（可执行）

> 关联 Todo：`docs/09-第四周开发Todo.md`

## 1. 基本信息

- 周次：第 4 周
- 执行人：待填写
- 环境：
  - Backend：`http://localhost:3000`
  - Frontend：`http://localhost:5173`

## 2. 测试范围

- 功能范围：
  - 全局搜索 API：`GET /api/v1/search?q=...`
  - 权限过滤：demo 只看到可读空间的页面
  - 前端 `/search` 页面：搜索输入、结果列表、点击跳转到 `/space/:spaceId/page/:pageId`
- UI 保真范围（对标 ones）：
  - header 搜索输入（可选但尽量覆盖）
  - `/search` 页面 `search-box-wrap/search-meta/search-result/path/excerpt`

## 3. 前置条件

- [ ] 后端服务已启动
- [ ] 前端服务已启动
- [ ] 测试账号可用：`admin/admin123`、`demo/demo123`

## 4. 手工测试步骤（可执行）

| ID | 场景 | 步骤 | 预期结果 | 结果 |
|----|------|------|----------|------|
| M-01 | Admin 搜索展示与跳转 | 1) 进入 `/search?q=week4-xxx` 2) 确认至少 1 条 `search-result` 3) 点击结果卡片 | 跳转到对应 `/space/:spaceId/page/:pageId`，readView 内 `.ProseMirror` 呈现匹配文本 | Pass |
| M-02 | Demo 权限过滤不泄露 | 1) demo 登录 2) 进入 `/search?q=week4-xxx` 3) 对比不同空间内容 | demo 只看到其具备 read/write/admin 权限的页面结果 | Pass |
| M-03 | Header 搜索输入 Enter 跳转 | 1) admin 登录 2) 在顶部 header 输入框输入关键字并按 Enter | 跳转到 `/search?q=...` 并渲染结果 | Pass |
| M-04 | 错误场景提示一致性 | 1) 以无效 token 或非预期场景触发 401/403 2) 观察前端提示 | 前端不静默空白，`.error-text` 可见且文案符合 contract | Pass |

## 5. 自动化测试清单

| ID | 场景 | 是否自动化 | 脚本路径 | 结果 |
|----|------|------------|----------|------|
| A-01 | 搜索 API 返回权限过滤结果 | 是 | `tests/week4/week4-api-automation.mjs` | Pass |
| A-02 | 搜索 UI 与跳转（admin/demo） | 是 | `frontend/tests/e2e/week4.e2e.spec.mjs` | Pass |

## 6. 自动化脚本执行方式

```bash
node tests/week4/week4-api-automation.mjs --help
node tests/week4/week4-api-automation.mjs --baseUrl http://localhost:3000
```

可选参数：
- `--adminUser`（默认 `admin`）
- `--adminPass`（默认 `admin123`）
- `--demoUser`（默认 `demo`）
- `--demoPass`（默认 `demo123`）

## 7. 结论

- 是否允许进入下一周：允许（搜索链路已验证）

