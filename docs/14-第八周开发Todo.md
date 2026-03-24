# 元体知识库 — 第 8 周开发 Todo 列表（第 7 周遗留收口）

> 目标：承接第 7 周遗留，完成 `12-第七周方向草案` 中未完成项，重点为 **F-001 全站中文扫尾** 与 **F-005 空间页顶栏/侧栏对标打磨**。  
> 输入来源：`docs/12-第七周方向草案.md`（v1.5 回填状态）与 `docs/13-第七周开发Todo.md` 收口结论。

---

## 本周里程碑（P0）

- [x] **W8-01（F-001）全站中文扫尾**：登录、Layout、首页、搜索、空间页、管理端、错误提示、空态、状态文案无明显英文残留（技术术语/URL/code 可保留）。  
- [x] **W8-02（F-005）空间页顶栏去堆砌**：`SpacePage` 顶栏操作在常见桌面宽度下无“无序双行堆叠”，低频操作收纳到“更多”。  
- [x] **W8-03（F-005）侧栏对标 `space.html`**：Pages 区主新建入口独立且显著；Expand/Collapse 降级为次要操作，不再三键挤一行。  
- [x] **W8-04（交互一致性）**：空态、错误态、成功提示策略统一（避免 alert 与行内提示混用）。  
- [x] **W8-05（工程与质量）**：`frontend` / `backend` build 通过；week7 API 自动化与 week7 E2E 保持通过。  

---

## Day 1：F-001 文案盘点与集中

- [x] 导出高频页面文案清单（登录、首页、搜索、空间、管理端、403）。  
- [x] 建立文案集中常量（最小版本，可先 `frontend/src/constants/copy.ts`）。  
- [x] 完成第一轮替换：导航、按钮、表单标签、空态。  

## Day 2：F-001 错误/状态文案统一

- [x] 错误提示统一中文短句（保留 code）。  
- [x] loading/saving/success/empty 状态文案统一语气。  
- [x] `document.title` 与页面标题一致化（“当前在哪”可感知）。  

## Day 3：F-005 顶栏收纳

- [x] `SpacePage` 顶栏操作分层：高频保留，低频入“更多”。  
- [x] 修复 `.actions` 换行堆砌问题（优先 `nowrap` + 收纳）。  
- [x] 确保窄宽度下仍可操作（不遮挡、可点击）。  

## Day 4：F-005 侧栏改造

- [x] Pages 区主按钮改为独立行/整宽入口。  
- [x] Expand/Collapse 变为次要操作（图标或次级链接）。  
- [x] 树节点间距、层级、激活态细节与 `space.html` 精神对齐。  

## Day 5：交互一致性与回归

- [x] 成功/失败反馈方式统一（优先行内 + 状态栏）。  
- [x] 空态文案统一（无页、无权限、无结果）。  
- [x] 跑 `npm run build`（前后端）。  

## Day 6：测试与修复

- [x] 执行 `tests/week7/week7-api-automation.mjs`。  
- [x] 执行 `frontend/tests/e2e/week7.e2e.spec.mjs`。  
- [x] 新建并执行 `tests/week8/week8-test-plan.md` 手测项。  
- [x] 根据测试结果修复阻塞问题。  

## Day 7：结项回填

- [x] 回填本文件勾选状态。  
- [x] 若全部通过，更新 `docs/产品迭代计划.md` 新增迭代 #2（第 8 周）。  
- [x] 更新 `docs/README.md` 修订说明。  

---

## 本周测试入口

- [x] `node tests/week7/week7-api-automation.mjs --baseUrl http://localhost:3000`
- [x] `npm run test:e2e -- tests/e2e/week7.e2e.spec.mjs`（在 `frontend/` 目录）
- [x] 参照 `tests/week8/week8-test-plan.md` 执行手测回填

---

## 修订

| 日期 | 说明 |
|------|------|
| 2026-03-23 | 新建：承接第 7 周遗留（F-001、F-005）并形成第 8 周可执行清单 |
| 2026-03-23 | Day 1 进展：完成高频页面第一轮中文替换，新增 `frontend/src/constants/copy.ts`，并修复 week7 E2E 文案兼容断言 |
| 2026-03-23 | Day 2 进展：完成错误/状态文案统一与多页面 `document.title` 落地（登录/首页/搜索/管理/403/空间页） |
| 2026-03-23 | Day 3 进展：SpacePage 顶栏完成“高频直出 + 低频收纳到更多”，并通过 week7 E2E 回归 |
| 2026-03-23 | Day 4 进展：Pages 侧栏主新建入口改为整宽独立按钮，展开/收起降级为次级链接，完成样式细节调整并通过回归 |
| 2026-03-23 | Day 5 进展：管理页反馈统一为单一状态行、补齐空态中文文案；frontend/backend build + week7 API + week7 E2E 回归全通过 |
| 2026-03-23 | Day 6/7 收口：week8 手测计划完成回填；`产品迭代计划` 迭代 #2 结项；`docs/README.md` 同步更新 |

