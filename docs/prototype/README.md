# 保真原型阶段 — 产出文档

本目录存放阶段 0「保真原型设计」的配套产出，与《05-保真原型Todo清单》中的任务一一对应。

| 文件 | 对应 Todo | 内容 |
|------|-----------|------|
| [00-汇报准备与脚本.md](./00-汇报准备与脚本.md) | 0.1–0.3 | 汇报对象与决策点（填空）、演示脚本话术、对标 ONES 维度表 |
| [01-竞品拆解与差异化.md](./01-竞品拆解与差异化.md) | 0.4–0.6 | ONES 界面拆解表、布局与交互特征、本系统差异化说明（汇报用） |
| [02-页面清单与站点地图.md](./02-页面清单与站点地图.md) | 0.7–0.8 | 原型页面范围（必需/次要/可选）、站点地图与 Mermaid 流程图、演示路径 |

**使用建议**：先完成 00 中 0.1 的填写，再按 01 做竞品截图与标注（0.4），然后按 02 的页面顺序在 Figma/Axure 中从 0.9 起逐页做高保真。

---

## web-prototype 原型覆盖清单（对照 0.9–0.17）

> 说明：用于汇报前快速对勾，确认哪些页面已在 `web-prototype/` 中落地，以及入口路径。

| 编号 | 需求页面 | 当前原型文件 | 覆盖说明 |
|------|----------|--------------|----------|
| 0.9  | 登录页 | `web-prototype/login.html` | 已实现账号/密码表单，提交后跳转首页，文案为英文登录态。 |
| 0.10 | 首页 / 空间列表 | `web-prototype/index.html` | 已实现 Dashboard：空间卡片 + 最近访问 + 最近变更，顶栏含搜索与「User management」入口。 |
| 0.11 | 空间主界面（三栏） | `web-prototype/space.html` | 已实现三栏布局：左侧空间/页面树，中间内容区，右侧 Page outline & info。 |
| 0.12 | 文档阅读页 | `web-prototype/space.html`（阅读态） | 中间内容区在 `readView` 下展示富文本（标题、列表、引用、代码块、表格）。 |
| 0.13 | 文档编辑页 | `web-prototype/space.html`（编辑态） | `Edit` 按钮切换到 `editView`，使用 `contenteditable` + 工具栏按钮，占位富文本编辑器，并带「保存中 / 已保存（prototype）」状态。 |
| 0.14 | 版本历史 | `web-prototype/space.html` | `History` 按钮打开右侧滑出版本侧板，列出多条版本记录，含 View / Restore 按钮（前端假交互）。 |
| 0.15 | 搜索结果 | `web-prototype/search.html` | 顶部搜索框 + 结果列表，点击结果返回 `space.html`，体现全局/空间内搜索能力（UI 占位）。 |
| 0.16 | 空间权限配置 | `web-prototype/permissions.html` | 用表格展示成员 + 权限下拉（Read only / Edit / Admin），顶部有 Save 按钮，作为空间级权限配置占位。 |
| 0.17 | 页面设置 / 页面级权限 | `web-prototype/space.html`（Page settings 弹窗） | 工具栏中的 `Page settings` 按钮打开弹窗，展示当前页 Basic info + page-level permissions 表格，并明确标注为 prototype/demo，不做真实权限计算。 |
| 0.18 | 空间管理（System admin） | `web-prototype/admin-spaces.html` | 系统管理员视角的 Space 管理列表页，可从 `User management` 顶栏入口进入，包含 `New space (prototype)` 按钮，用于说明「只有 System admin 可以创建空间」。 |

**演示主路径快速索引：**

1. `login.html` → 填写示例账号后进入 `index.html`。  
2. `index.html` 顶部按钮 → 进入 `space.html` 的三栏空间主界面。  
3. 在 `space.html` 左侧树点击页面 → 中栏阅读态（0.12）。  
4. 点击 `Edit` → 进入编辑态，演示工具栏、自动保存文案（0.13）。  
5. 点击 `History` → 打开版本历史侧板，选择一条版本讲解回滚能力（0.14）。  
6. 顶部导航搜索框或 `Search docs` → 跳转 `search.html` 展示搜索结果（0.15）。  
7. 从 `space.html` 顶部 `Space permissions` → 跳转 `permissions.html` 展示空间权限配置（0.16）。  
8. 回到 `space.html`，点击 `Page settings` → 打开页面级权限弹窗，说明可对标 ONES 的细粒度控制（0.17，原型占位）。 
