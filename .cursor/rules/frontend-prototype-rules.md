# Yuanti Wiki 前端原型设计规则（保真原型阶段）

## 1. 语言与文案

- 原型阶段 UI **默认使用英文**，方便对标市场产品；关键业务含义可在汇报时用中文讲解，不强求全面中文化。
- 页面标题、按钮、导航文案保持简洁、产品风格统一，例如：
  - 登录页：`Sign in - Yuanti Wiki`，字段：`Account / Password / Sign in`。
  - 首页：`Home dashboard - Yuanti Wiki`，欢迎语 `Welcome back, ...`，动作 `Go to Product docs space`、`Search docs`。
- 若未来需要中文化，应优先统一首页与导航，再逐步扩展到各子页面，避免中英混搭。

## 2. 布局与遮挡规则

- 所有带固定顶部导航的页面，正文容器必须包含 `main-wrap` 或 `dashboard-wrap`，并统一由 `styles/common.css` 控制顶部内边距：
  - `.main-wrap, .dashboard-wrap { padding-top: calc(var(--header-height) + 16px); }`
- 空间页使用三栏布局：
  - 左侧：空间列表 + 当前空间的页面树（class `sidebar`）。
  - 中间：文档阅读/编辑区域（class `content-area`）。
  - 右侧：大纲 + 页面信息（class `rightbar`）。
- 特殊后台页（如 `user-management.html`）如临时取消固定头部，可在本页 header 上加 `style="position: static;"`，但这应视为例外而非通用做法。

## 3. 交互与反馈

- 所有“关键操作”在原型中都要有明显反馈，即便只是前端假交互：
  - 文档编辑：进入编辑态时状态文案从 `View only` 切换为 `Editing (not saved)`，输入后出现 `Saving...`，一段时间后显示 `All changes saved (prototype)`。
  - 版本回滚：点击 `Restore` 前弹出确认对话框，确认后出现提示（可用 alert/toast）说明“已回滚到所选版本（演示，不影响真实数据）”。
  - 新建页面：点击 `+ New page` 时，左侧树出现 `Untitled page` 节点，并切到编辑态，同时给出“已创建新页面（尚未保存）”的提示。
  - 用户与权限：`New user`、`Save permissions` 等操作至少要有一处成功提示（toast 或顶部小条）。
- 原型中的所有反馈文案应明确标注“prototype/demo”，避免给人“已经有真实后端能力”的误解。

## 4. 页面与导航结构

- 顶部导航统一结构：
  - 左侧：Logo/产品名链接至首页 `index.html`（class `logo`）。
  - 右侧：搜索框（需要搜索的页面上）、常用入口（如 `User management`）、当前用户信息（class `user`）。
- 当前原型必须保留的页面及职责：
  - `login.html`：登录页（静态表单，提交后跳转首页）。
  - `index.html`：首页仪表盘（空间概览 + 最近访问 + 近期变更）。
  - `space.html`：空间主界面（三栏 + 阅读/编辑 + 版本历史 + 新建页面流）。
  - `search.html`：搜索结果页（关键词 + 空间筛选占位 + 结果列表）。
  - `permissions.html`：空间权限配置页（成员 + 权限下拉）。
  - `user-management.html`：用户管理列表页（系统管理员视角）。
  - `user-new.html`：新建用户表单页。

## 5. 富文本与内容展示

- 阅读态必须明显体现“富文本能力”，而不是只有纯文本：
  - 标题层级：`h1 / h2`。
  - 列表：`ul > li`。
  - 引用块：`<blockquote>`。
  - 代码块：`<pre>`。
  - 表格：`<table>`（哪怕是简单示例）。
- 编辑态用 `contenteditable` + 工具栏按钮占位（H2/Bold/List/Code/Link 等），不要求真实语义行为，但要让人一眼看出“可编辑”“类富文本编辑器”。

## 6. 用户与权限原型约定

- 账号体系：
  - 采用自建用户表 + “系统管理员后台管理账户”的方案，不开放自助注册。
  - `user-management.html` 展示用户列表（用户名、邮箱、角色、状态），顶部有 `New user` 按钮。
  - `user-new.html` 展示新建用户表单（用户名、展示名、邮箱、初始密码、角色）。
- 权限体系：
  - `permissions.html` 只展示空间级权限（成员 + 权限下拉），不做页面级权限的真实逻辑，仅为 UI 占位。
  - 页面级权限在 `space.html` 的 `Page settings`/右侧信息中以“说明 + 假表单”形式体现即可，具体策略在产品文档中说明。

## 7. 技术约束（原型阶段）

- 原型只使用 **纯 HTML + CSS + 极少量 JS**，不依赖打包工具和框架：
  - 双击本地 `*.html` 文件即可打开演示；
  - 所有交互逻辑（编辑切换、假保存、假回滚、新建页面）均在前端模拟。
- 所有静态资源路径相对 `web-prototype` 根目录，例如：
  - 样式：`styles/common.css`
  - 日后若加入 logo：直接放在 `web-prototype/` 下引用 `logo1.png` 等。

