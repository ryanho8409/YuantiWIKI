# Release V1.1 说明

> **发布日期**：2026-03-25  
> **相对基线**：Release V1.0（第 9 周结项版本）

本版本在 V1.0 能力之上，补齐**个人设置与账号资料**、**服务端头像**、**深色模式与主题**等体验，并修正升级数据库时的迁移注意事项。

---

## 1. 本日上午开发总结（可贴 GitHub Release Notes）

### 1.1 数据库与迁移（必须执行）

- 新增迁移：`20260325103000_user_profile_fields`（用户资料字段、`lastLoginAt` 等）、`20260325120000_user_avatar_path`（`User.avatarUrl` 废弃，改为服务端文件字段 **`avatarPath`**）。
- **若从 V1.0 升级**：部署前在 `backend` 目录执行 `npx prisma migrate deploy`（及 `npx prisma generate`），并重启后端服务。  
  **未应用迁移时**，Prisma 模型与库表不一致，可能导致用户相关接口报错（如登录后 `/auth/me` 失败）。
- 历史「外链头像 URL」字段已移除；若曾使用外链，需用户在设置中重新上传头像。

### 1.2 后端

- 用户资料：`lastLoginAt`（登录成功时更新）、`email` 唯一约束（空值可多条）、`avatarPath`（相对 `UPLOAD_DIR` 的文件路径）。
- 接口：`GET/POST` 登录与 `GET /api/v1/auth/me` 返回资料与 `hasCustomAvatar`；`PATCH /api/v1/auth/profile` 更新显示名与邮箱；`POST/DELETE /api/v1/auth/avatar` 上传/删除头像；`GET /api/v1/users/:userId/avatar/file?token=…` 读取头像文件。
- 错误契约：邮箱冲突返回 `409` + `EMAIL_IN_USE`。

### 1.3 前端

- **个人设置**（`/settings`）：个人资料只读信息、显示名/邮箱表单、头像上传与恢复默认、显示设置（深色模式）。
- **深色模式**：`ThemeContext` + `localStorage`（`yuanti-theme`）+ `html[data-theme="dark"]`；`index.html` 内联脚本减轻首屏闪烁（详见 `docs/19-深色模式后续迭代备忘.md` 中「当前已实现」）。
- **Dashboard（首页）**：欢迎区展示用户头像（与顶栏同一套头像逻辑），与「欢迎回来，用户名」并排。
- **全局头像刷新**：`AuthContext` 增加 `avatarRevision` 与 `bumpAvatarRevision()`；在个人设置上传/删除头像成功后递增，**顶栏、首页欢迎区、设置页预览**无需刷新路由即可更新图片（避免浏览器缓存同 URL）。

### 1.4 文档与工程

- 根目录 `README`、产品文档索引与迭代计划已更新为 **Release V1.1** 口径。
- 详细过程记录仍见：`docs/20-第十周开发方向草案.md`（本日已落地与第十周草案）。

---

## 2. 升级检查清单（运维 / 自建）

1. 拉取代码后 `backend`：`npm install` → `npx prisma migrate deploy` → `npx prisma generate` → `npm run build` → 重启进程。
2. `frontend`：`npm install` → `npm run build`，部署 `dist`。
3. 确认 `backend/.env` 中 `UPLOAD_DIR`（或项目约定目录）可写，且头像文件路径与权限正常。
4. 建议：备份数据库后再执行迁移。

---

## 3. 与 V1.0 的关系

| 项目 | V1.0 | V1.1 |
|------|------|------|
| 个人资料 / 头像 | 无 | 有（服务端文件 + 设置页） |
| 深色模式 | 无 | 有（设置页开关 + CSS 变量） |
| Dashboard 欢迎区 | 纯文案 | 文案 + 头像展示 |
| 数据库 | 至 V1.0 迁移集合 | 增加上述两条迁移 |

---

## 4. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-03-25 | 新建：Release V1.1 发布说明，与 GitHub Release 对应。 |
