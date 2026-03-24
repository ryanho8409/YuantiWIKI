# 元体知识库 — Node 后端 API 设计

## 1. 技术约定

- **风格**：RESTful；JSON 请求/响应。
- **认证**：Session Cookie 或 JWT（Bearer），由前端与部署方式决定；所有需登录接口均校验身份。
- **权限**：每个接口在业务层校验「当前用户对该空间/页面」的读/写/管理权限，与《01-产品与系统设计》一致。
- **错误**：统一格式，例如：`{ "code": "FORBIDDEN", "message": "无权限访问该空间" }`，HTTP 状态码 4xx/5xx。

---

## 2. 通用说明

- **Base URL**：`/api/v1`（示例）
- **时间**：响应中时间字段建议 ISO 8601（如 `2025-03-16T08:00:00.000Z`）
- **分页**：列表类接口统一 `?page=1&pageSize=20`，响应含 `list`、`total`（可选 `hasMore`）

---

## 3. 认证与用户

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/login` | 登录（username + password），返回 Session 或 JWT |
| POST | `/auth/logout` | 登出 |
| GET  | `/auth/me`     | 当前用户信息（用于前端校验与展示） |

---

## 4. 用户管理（系统管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/users`       | 用户列表（分页、搜索） |
| GET    | `/users/:id`   | 用户详情 |
| POST   | `/users`       | 创建用户 |
| PATCH  | `/users/:id`   | 更新用户 |
| DELETE | `/users/:id`   | 禁用/删除用户（软删除） |

---

## 5. 空间

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET    | `/spaces`           | 空间列表（仅含当前用户有读权限的空间） | 已登录 |
| GET    | `/spaces/:id`       | 空间详情 | 空间读 |
| POST   | `/spaces`           | 创建空间 | 系统管理员 |
| PATCH  | `/spaces/:id`       | 更新空间 | 空间管理 |
| DELETE | `/spaces/:id`       | 删除空间（软删除） | 空间管理 |
| GET    | `/spaces/:id/permissions`   | 空间权限列表（供「空间管理页内嵌权限面板」读取） | system_admin |
| PUT    | `/spaces/:id/permissions`   | 设置空间权限（`Admin` / `Edit` / `Read Only`；全量覆盖或增量，由实现定） | system_admin |

**请求/响应示例**

- `POST /spaces` Body: `{ "name": "产品文档", "description": "...", "icon": "book" }`
- `GET /spaces` Response: `{ "list": [{ "id", "name", "description", "icon", "createdAt", "updatedAt" }], "total": 1 }`

---

## 6. 页面（树形）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET    | `/spaces/:spaceId/pages`        | 空间下页面树（可平铺 list 或树形 tree，由 query 定） | 空间读 |
| GET    | `/spaces/:spaceId/pages/:id`   | 页面详情（含 content） | 空间读 + 页面读 |
| POST   | `/spaces/:spaceId/pages`       | 创建页面（body 含 parentId、title、content、sortOrder） | 空间写 |
| PATCH  | `/spaces/:spaceId/pages/:id`   | 更新页面（标题、内容、顺序、父节点） | 空间写 + 页面写 |
| DELETE | `/spaces/:spaceId/pages/:id`   | 删除页面（软删除；子页面策略：一并删或禁止） | 空间写 |
| GET    | `/spaces/:spaceId/pages/:id/versions` | 版本列表 | 空间读 |
| GET    | `/spaces/:spaceId/pages/:id/versions/:versionId` | 某版本内容 | 空间读 |
| POST   | `/spaces/:spaceId/pages/:id/versions/:versionId/restore` | 回滚到该版本 | 空间写 |

### 6.1 全局页面管理（第 7 周 · 方案 A）

> 仅 `system_admin` 可访问；用于「全局页面管理独立入口页」的最小闭环（列表 + 跳转），不含批量/审核。

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/admin/pages` | 全局页面列表（支持 `q`、`spaceId`、`page/pageSize`） | system_admin |

响应建议：`{ "list": [{ "pageId", "title", "spaceId", "spaceName", "updatedAt", "updatedBy" }], "total" }`

**页面树返回建议**：  
- `GET /spaces/:spaceId/pages?format=tree` 返回嵌套结构便于左侧树渲染。  
- `GET /spaces/:spaceId/pages?format=list` 返回平铺 + `parentId`，前端自行组树。

---

## 7. 搜索

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/search` | 全局搜索，q=关键词，spaceId=可选限定空间，page/pageSize | 已登录（仅返回有读权限的页面） |
| GET | `/spaces/:spaceId/search` | 空间内搜索，q=关键词 | 空间读 |

响应：`{ "list": [{ "pageId", "spaceId", "title", "excerpt", "updatedAt" }], "total" }`

---

## 8. 附件

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST   | `/spaces/:spaceId/attachments` | 上传附件（multipart/form-data），可选 pageId | 空间写 |
| GET    | `/spaces/:spaceId/attachments/:id` | 下载/访问附件（或返回重定向 URL） | 空间读 |
| DELETE | `/spaces/:spaceId/attachments/:id` | 删除附件 | 空间写 |

---

## 9. 权限模型在 API 中的体现

- **空间读**：可访问 `GET /spaces/:id`、`GET /spaces/:spaceId/pages`、页面详情、版本、搜索。
- **空间写**：可在空间内创建/更新/删除页面、上传/删附件、回滚版本。
- **空间管理（system_admin）**：可修改空间信息、在空间管理页中配置空间权限（内嵌权限面板）与页面级权限。
- **系统管理员**：可访问用户管理、创建/删除任意空间。
- **全局页面管理（system_admin）**：可访问 `GET /admin/pages` 查看全局列表并跳转到目标空间/页面。

所有写操作需在服务端再次校验「当前用户在该空间/页面上是否具备对应权限」，不能仅依赖前端隐藏按钮。

---

## 10. Node 技术选型建议（不实现，仅规划）

| 层次 | 建议 |
|------|------|
| 框架 | Express 或 Fastify |
| ORM/查询 | pg + 手写 SQL，或 Prisma / TypeORM |
| 认证 | express-session + 内存/Redis，或 passport；若 JWT 可用 jsonwebtoken |
| 权限 | 中间件从 Session/JWT 取 user，在 controller 或 service 中按 space/page 查权限表后决定 403 或继续 |
| 校验 | Joi / Zod 做 body/query 校验 |
| 日志 | pino / winston |

API 设计与此文档一致即可在实现阶段直接落地为 Node 路由与控制器。
