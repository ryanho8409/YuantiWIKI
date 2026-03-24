# 第 1 周测试文档（可执行）

> 关联 Todo：`docs/06-第一周开发Todo.md`

## 1. 基本信息

- 周次：第 1 周
- 执行人：待填写
- 执行日期：待填写
- 环境：
  - Backend: `http://localhost:3000`
  - Frontend: `http://localhost:5173`

## 2. 测试范围

- 功能范围：
  - 认证闭环：`/api/v1/auth/login`、`/api/v1/auth/me`
  - 受保护路由：未登录访问 `/` 会跳转 `/login`
  - 空间列表最小可用：`GET /api/v1/spaces`
- UI 保真范围（对标 ones）：
  - 顶栏 `app-header` 样式语义
  - 登录页 `login-page/login-card` 结构与按钮样式
  - 首页 `card/space-card` 布局语义

## 3. 前置条件

- [ ] 数据库迁移已执行（backend）
- [ ] 种子数据已执行（至少有 `admin/admin123`、`demo/demo123`）
- [ ] 后端服务已启动：`cd backend && npm run dev`
- [ ] 前端服务已启动：`cd frontend && npm run dev`

## 4. 手工测试步骤（可执行）

| ID | 场景 | 步骤 | 预期结果 | 结果 |
|----|------|------|----------|------|
| M-01 | 未登录受保护路由跳转 | 1) 浏览器直接打开 `http://localhost:5173/` | 自动跳转到 `/login` | Pass |
| M-02 | 登录页 UI 保真 | 1) 打开 `/login` 2) 检查页面结构是否为 `login-page > login-card` 3) 检查按钮样式类 | 结构与 `web-prototype/login.html` 对齐，主按钮为 `.btn.btn-primary` | Pass |
| M-03 | 顶栏 UI 保真 | 1) 使用有效账号登录 2) 进入 `/` 3) 检查顶栏是否是固定 header，类语义为 `app-header/logo/nav/user` | 顶栏不遮挡正文，结构对齐原型 | Pass |
| M-04 | 首页空间卡片 UI 保真 | 1) 登录后查看 `/` 2) 检查空间区域是否使用 `card` 与 `space-card` 布局 | 卡片圆角、边框、间距与原型语义一致 | Pass |
| M-05 | 登录成功流程 | 1) 在 `/login` 输入 `admin/admin123` 2) 点击 Sign in | 跳转到 `/`，顶栏显示用户信息 | Pass |
| M-06 | 登录失败流程 | 1) 在 `/login` 输入错误密码 | 页面提示错误，不跳转 | Pass |

## 5. 自动化测试清单

| ID | 场景 | 是否自动化 | 脚本路径 | 结果 |
|----|------|------------|----------|------|
| A-01 | 健康检查可用 | 是 | `tests/week1/week1-api-automation.mjs` | Pass |
| A-02 | `admin` 登录成功并返回 token | 是 | `tests/week1/week1-api-automation.mjs` | Pass |
| A-03 | `demo` 登录成功并返回 token | 是 | `tests/week1/week1-api-automation.mjs` | Pass |
| A-04 | 无 token 访问 `/auth/me` 返回 401 | 是 | `tests/week1/week1-api-automation.mjs` | Pass |
| A-05 | 带 token 访问 `/auth/me` 返回当前用户 | 是 | `tests/week1/week1-api-automation.mjs` | Pass |
| A-06 | `GET /spaces` 返回数组（admin/demo） | 是 | `tests/week1/week1-api-automation.mjs` | Pass |
| A-07 | 错误密码登录返回失败状态 | 是 | `tests/week1/week1-api-automation.mjs` | Pass |
| A-08 | `/` 未登录重定向 `/login` | 是 | `frontend/tests/e2e/week1.e2e.spec.mjs` | Pass |
| A-09 | 登录页/首页 UI 保真 | 是 | `frontend/tests/e2e/week1.e2e.spec.mjs` | Pass |

## 6. 自动化脚本执行方式

```bash
node tests/week1/week1-api-automation.mjs --help
node tests/week1/week1-api-automation.mjs --baseUrl http://localhost:3000
```

可选参数：

- `--adminUser`（默认 `admin`）
- `--adminPass`（默认 `admin123`）
- `--demoUser`（默认 `demo`）
- `--demoPass`（默认 `demo123`）

## 7. 缺陷与风险记录

- 当前自动化包含 API + Playwright E2E 对关键 UI 保真项的覆盖，但仍可能存在像素级/边界视觉差异未被完全验证。
- 若后端端口/账号与默认值不一致，需要通过脚本参数覆盖。

## 8. 结论

- 通过率：7/7（自动化 API）+ 4/4（Playwright E2E）
- 是否允许进入下一周：允许进入（API/认证/空间列表 + UI 保真均已通过）
- 备注：week1 自动化 API 冒烟与 Playwright E2E 均已通过
