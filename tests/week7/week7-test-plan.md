# 第 7 周测试文档（可执行）

> 关联 Todo：`docs/13-第七周开发Todo.md`

## 1. 基本信息

- 周次：第 7 周
- 执行人：待填写
- 环境：
  - Backend：`http://localhost:3000`
  - Frontend：`http://localhost:5174`

## 2. 测试范围

- 管理端与权限（F-003）：
  - 仅 `system_admin` 可见并访问管理入口
  - 空间管理内嵌权限配置（新 UI + 旧 API）
  - 权限档位：`Admin` / `Edit` / `Read Only`
  - 全局页面管理独立入口（仅 `system_admin`，方案 A）
- 首页 Dashboard（F-002）：
  - 右侧最近浏览/最近更新允许占位/假数据
  - 使用占位/假数据时必须标注“演示数据”
- 搜索（F-003 完成线）：
  - 本周完成线：布局 + 主筛选 + 空态
  - 其余能力进入第二期（在 `docs/12` 或 PR 说明）

## 3. 前置条件

- [ ] 后端服务已启动
- [ ] 前端服务已启动
- [ ] 测试账号可用：`admin/admin123`、`demo/demo123`
- [ ] `admin` 用户角色为 `system_admin`，`demo` 为普通 `user`

## 4. 手工测试步骤（可执行）

| ID | 场景 | 步骤 | 预期结果 | 结果 |
|----|------|------|----------|------|
| M-01 | 管理入口可见性 | 1) admin 登录 2) 观察顶栏 3) demo 登录重复 | 仅 admin 可见「用户管理/空间管理/全局页面管理」入口；demo 不可见 | Pass（E2E） |
| M-02 | 管理端路由防护 | demo 直接访问 `/admin/users`、`/admin/spaces`、`/admin/pages` | 统一 403 且文案可读，不出现空白页 | Pass（E2E） |
| M-03 | 空间管理内嵌权限配置 | admin 在空间管理页为 demo 分别设 `Edit`、`Read Only` | 权限立即生效；`Edit` 可增改不可删，`Read Only` 仅可读 | Pass（E2E） |
| M-04 | 全局页面管理（方案 A） | admin 打开全局页面管理，点击任一项 | 可见全局列表并能跳转到目标空间/页面；无批量/审核入口 | Pass（E2E） |
| M-05 | Dashboard 右侧演示数据标识 | 打开首页并查看最近浏览/最近更新 | 若为占位或假数据，页面显式显示“演示数据”标识 | Pass（E2E） |
| M-06 | 搜索完成线 | 打开 `/search`，操作主筛选并触发空结果 | 布局达标、主筛选可用、空态文案完整；高级项未做需有二期说明 | Pass（E2E） |
| M-07 | 富文本回归（第 1 期） | 编辑页面使用标题/列表/链接/代码后保存并刷新 | 内容与格式不丢失；只读态可正确渲染 | Pass（E2E） |

## 5. 自动化测试清单

| ID | 场景 | 是否自动化 | 脚本路径 | 结果 |
|----|------|------------|----------|------|
| A-01 | admin 可访问管理端用户列表接口 | 是 | `tests/week7/week7-api-automation.mjs` | Pass |
| A-02 | demo 访问管理端用户列表接口返回 403 | 是 | `tests/week7/week7-api-automation.mjs` | Pass |
| A-03 | admin 可访问全局页面管理接口 | 是 | `tests/week7/week7-api-automation.mjs` | Pass |
| A-04 | demo 访问全局页面管理接口返回 403 | 是 | `tests/week7/week7-api-automation.mjs` | Pass |
| A-05 | 空间权限设为 Edit：demo 可建/改，不可删 | 是 | `tests/week7/week7-api-automation.mjs` | Pass |
| A-06 | 空间权限设为 Read Only：demo 不可新建 | 是 | `tests/week7/week7-api-automation.mjs` | Pass |
| A-07 | M-01/M-02/M-04/M-05 前端交互验证 | 是（E2E） | `frontend/tests/e2e/week7.e2e.spec.mjs` | Pass |
| A-08 | M-03/M-06/M-07 前端交互验证 | 是（E2E） | `frontend/tests/e2e/week7.e2e.spec.mjs` | Pass |

## 6. 自动化脚本执行方式

```bash
node tests/week7/week7-api-automation.mjs --help
node tests/week7/week7-api-automation.mjs --baseUrl http://localhost:3000
```

可选参数：
- `--adminUser`（默认 `admin`）
- `--adminPass`（默认 `admin123`）
- `--demoUser`（默认 `demo`）
- `--demoPass`（默认 `demo123`）

## 7. 结论（回填）

- 是否允许进入下一周：允许（功能主链路与测试主项通过，遗留进入下一迭代）
- 自动化执行：`6/6 passed`（`node tests/week7/week7-api-automation.mjs --baseUrl http://localhost:3000`）
- E2E 执行：`5/5 passed`（`npm run test:e2e -- tests/e2e/week7.e2e.spec.mjs`）

