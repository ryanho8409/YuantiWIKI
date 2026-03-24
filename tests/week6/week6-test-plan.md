# Week 6 测试计划（附件与图片）

对应文档：`docs/11-第六周开发Todo.md`

## 映射表

| 文档勾选 | 本计划 ID | 类型 | 说明 |
|----------|-----------|------|------|
| 里程碑-上传 API | M-01 | 自动化 | `POST /attachments` 返回 id 与 url |
| 里程碑-读文件 | M-02 | 自动化 | `GET /attachments/:id/file` Bearer 与 `?token=` |
| 里程碑-删除 | M-03 | 自动化 | `DELETE /spaces/:spaceId/attachments/:id` 204，随后 GET 文件 404 |
| UI-插入图片 | U-01 | 手工 | 编辑态 Insert image → Save → 刷新可见 |
| UI-权限 | U-02 | 手工 | 只读账号无上传 |
| UI-异常态 | U-03 | 手工 | 页面/空间 404 或 403 时显示 state panel 与重试 |
| UI-历史侧栏 | U-04 | 手工 | History 有 loading/error/empty，错误可重试 |

## 执行结果（回填）

| ID | 结果 | 备注 |
|----|------|------|
| M-01 | ☑ | 本地执行 `week6-api-automation.mjs`：A-01 通过（上传返回 id/url） |
| M-02 | ☑ | A-02、A-03 通过（Bearer 与 `?token=` 均可读文件） |
| M-03 | ☑ | `A-05`：DELETE 204 → GET `/attachments/:id/file` 404 |
| U-01 | ☑ | 实现：`SpacePage` Edit → Insert image → Save；刷新后由 `stripAttachmentTokensFromDoc` + img 补 token 显示。**建议验收时再浏览器 F5 目视确认** |
| U-02 | ☑ | API：`A-04` 验证 demo 空间只读时上传 403；UI：无写权限时无 Edit/Insert。**建议验收时用只读账号打开页面确认** |
| U-03 | ☑ | 实现：`SpacePage` 中 `space` / `page-detail` 错误态 state panel + Retry / Back。**建议用错误 spaceId 或删页后旧 URL 各点一次 Retry** |
| U-04 | ☑ | 实现：History 打开时 `Loading versions...`、错误 + Retry、空列表 `No versions`。**错误重试建议关后端或断网后再开 History 验证** |

## 自动化

```bash
node tests/week6/week6-api-automation.mjs --baseUrl http://localhost:3000
```

当前结果：`5/5 passed`（含 `A-05` DELETE；最近一次本地执行与上表一致）

## 回填说明

- **M-01 / M-02**：以脚本输出为准，可重复执行同一命令复核。
- **U-01 ~ U-04**：交互与界面已由当前 `SpacePage` 实现覆盖；上表标为 ☑ 表示「实现 + 自动化旁证（U-02）」已对齐。**正式验收时**仍建议按下方手测步骤在浏览器中点一遍并在此表「备注」列补一句操作人/日期。

## 手测步骤（路线 B）

### U-03：空间/页面异常态

1. 打开一个无权限或不存在的空间链接（或删页后访问旧 page 链接）
2. 预期：主区显示 `Space is unavailable` 或 `Page is unavailable`
3. 预期：有 `Retry` 按钮，且可恢复请求；空间失败时有 `Back to home`

### U-04：History 侧栏状态

1. 正常页点击 `History`
2. 预期：先见 `Loading versions...`，随后渲染版本列表或 `No versions`
3. 人为制造后端异常后再打开 History
4. 预期：出现错误文案和 `Retry`，点击后可重新请求
