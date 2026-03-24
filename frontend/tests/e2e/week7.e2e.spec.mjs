import { test, expect } from '@playwright/test';

/** 与 Vite 默认端口一致；若用其它端口请设环境变量 PLAYWRIGHT_BASE_URL */
const uiBaseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
/** 默认用 127.0.0.1，避免部分环境下 `localhost` 解析到 ::1 与代理导致登录异常 */
const backendBaseUrl = process.env.PW_BACKEND_BASE_URL || 'http://127.0.0.1:3000';
const adminUser = process.env.PW_ADMIN_USER || 'admin';
const adminPass = process.env.PW_ADMIN_PASS || 'admin123';
const demoUser = process.env.PW_DEMO_USER || 'demo';
const demoPass = process.env.PW_DEMO_PASS || 'demo123';
const TOKEN_KEY = 'yuanti_wiki_token';

async function apiLogin(request, username, password) {
  const res = await request.post(`${backendBaseUrl}/api/v1/auth/login`, {
    data: { username, password },
  });
  if (res.status() !== 200) {
    let detail = 'no-body';
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      // no-op
    }
    throw new Error(`apiLogin failed: status=${res.status()} body=${detail}`);
  }
  const body = await res.json();
  expect(body?.token).toBeTruthy();
  return { token: body.token, user: body.user };
}

async function apiCreateSpace(request, adminToken, name) {
  const res = await request.post(`${backendBaseUrl}/api/v1/spaces`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name, description: 'e2e week7', icon: '🧪', sortOrder: 996 },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return body.id;
}

async function apiCreatePage(request, token, spaceId, title, content) {
  const res = await request.post(`${backendBaseUrl}/api/v1/spaces/${spaceId}/pages`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title, parentId: null, content },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id;
}

async function apiSetSpacePermissions(request, adminToken, spaceId, permissions) {
  const res = await request.put(`${backendBaseUrl}/api/v1/spaces/${spaceId}/permissions`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { permissions },
  });
  expect(res.status()).toBe(204);
}

async function apiDeleteSpace(request, token, spaceId) {
  const res = await request.delete(`${backendBaseUrl}/api/v1/spaces/${spaceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect([200, 204]).toContain(res.status());
}

function tiptapDocWithText(text) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

async function loginWithToken(page, token, path = '/') {
  await page.goto(`${uiBaseUrl}/login`);
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: TOKEN_KEY, value: token }
  );
  await page.goto(`${uiBaseUrl}${path}`);
}

// 串行执行：避免多 worker 同时打 /auth/login 时偶发 401（与后端/连接池竞争有关）
test.describe.serial('Week 7 E2E', () => {
  test('M-01/M-02: 管理入口与路由防护', async ({
    browser,
    request,
  }) => {
    test.setTimeout(90000);
    const admin = await apiLogin(request, adminUser, adminPass);
    const demo = await apiLogin(request, demoUser, demoPass);

    const adminContext = await browser.newContext();
    const demoContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const demoPage = await demoContext.newPage();

    try {
      await loginWithToken(adminPage, admin.token, '/');
      await adminPage.locator('.header-menu-trigger').click({ force: true });
      await expect(adminPage.locator('.header-menu-panel')).toBeVisible();
      await expect(adminPage.locator('.header-menu-item', { hasText: '用户管理' })).toBeVisible();
      await expect(adminPage.locator('.header-menu-item', { hasText: '知识库管理' })).toBeVisible();

      await loginWithToken(demoPage, demo.token, '/');
      await expect(demoPage.getByRole('link', { name: '用户管理' })).toHaveCount(0);
      await expect(demoPage.getByRole('link', { name: '知识库管理' })).toHaveCount(0);

      for (const path of ['/admin/users', '/admin/spaces']) {
        await demoPage.goto(`${uiBaseUrl}${path}`);
        await expect(demoPage.getByText('403 无权限访问')).toBeVisible();
      }
    } finally {
      await adminContext.close();
      await demoContext.close();
    }
  });

  test('M-03: 空间管理内嵌权限配置生效（Edit -> Read Only）', async ({
    browser,
    page,
    request,
  }) => {
    test.setTimeout(120000);
    const admin = await apiLogin(request, adminUser, adminPass);
    const demo = await apiLogin(request, demoUser, demoPass);

    let spaceId = '';
    let pageId = '';
    const demoContext = await browser.newContext();
    const demoPage = await demoContext.newPage();
    try {
      spaceId = await apiCreateSpace(request, admin.token, `Week7 M03 Space ${Date.now()}`);
      await apiSetSpacePermissions(request, admin.token, spaceId, [
        { userId: admin.user.id, permission: 'admin' },
        { userId: demo.user.id, permission: 'write' },
      ]);
      pageId = await apiCreatePage(request, admin.token, spaceId, 'm03-page', tiptapDocWithText('m03'));

      // demo at write/edit should have Edit button.
      await loginWithToken(demoPage, demo.token, `/space/${spaceId}/page/${pageId}`);
      await expect(demoPage.getByRole('button', { name: /^(Edit|编辑)$/ })).toBeVisible();

      // admin uses embedded permission panel to set demo to read.
      await loginWithToken(page, admin.token, '/admin/spaces');
      await page.locator('select').first().selectOption(spaceId);
      const userSelect = page.locator('.admin-toolbar select').nth(1);
      await userSelect.selectOption(demo.user.id);
      await page.locator('.admin-toolbar select').nth(2).selectOption('read');
      await page.getByRole('button', { name: '添加/更新' }).click();
      await page.getByRole('button', { name: '保存权限' }).click();
      await expect(page.getByText(/(保存成功|空间权限已保存)/)).toBeVisible();

      // demo reload, Edit should disappear in read-only mode.
      await demoPage.reload();
      await expect(demoPage.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    } finally {
      await demoContext.close();
      if (spaceId) {
        try {
          await apiDeleteSpace(request, admin.token, spaceId);
        } catch {
          // ignore cleanup failures
        }
      }
    }
  });

  test('M-06: 搜索完成线（布局 + 主筛选 + 空态）', async ({ page, request }) => {
    test.setTimeout(90000);
    const admin = await apiLogin(request, adminUser, adminPass);

    await loginWithToken(page, admin.token, '/search?q=week7-never-match-keyword');
    await expect(page.locator('.search-box-wrap')).toBeVisible();
    await expect(page.getByText('主筛选：')).toBeVisible();
    await expect(page.getByRole('button', { name: '全部' })).toBeVisible();
    await expect(page.getByRole('button', { name: '标题' })).toBeVisible();
    await expect(page.getByRole('button', { name: '正文摘要' })).toBeVisible();
    await expect(page.getByText('未找到匹配结果')).toBeVisible();
  });

  test('M-07: 富文本第1期保存回读（标题 + 粗体 + 代码块）', async ({ page, request }) => {
    test.setTimeout(120000);
    const admin = await apiLogin(request, adminUser, adminPass);

    let spaceId = '';
    let pageId = '';
    try {
      spaceId = await apiCreateSpace(request, admin.token, `Week7 M07 Space ${Date.now()}`);
      pageId = await apiCreatePage(request, admin.token, spaceId, 'm07-page', tiptapDocWithText('initial'));

      await loginWithToken(page, admin.token, `/space/${spaceId}/page/${pageId}`);
      await page.getByRole('button', { name: /^(Edit|编辑)$/ }).click();
      await expect(page.locator('.editor-toolbar')).toBeVisible();
      await expect(page.locator('.editor-icon-btn[title="一级标题"]')).toBeVisible();
      await expect(page.locator('.editor-icon-btn[title="粗体"]')).toBeVisible();
      await expect(page.locator('.editor-toolbar-more > summary[title="更多"]')).toBeVisible();

      const editor = page.locator('.doc-body.editable .ProseMirror');
      await editor.click();
      await page.locator('.editor-icon-btn[title="一级标题"]').click();
      await editor.fill('Week7 Heading');
      await page.locator('.editor-toolbar-more > summary[title="更多"]').click();
      await page.getByRole('button', { name: '代码块' }).click();
      await editor.press('Enter');
      await editor.type('const week7 = true;');

      await page.getByRole('button', { name: /^(Save|保存)$/ }).click();
      await expect(page.locator('#readView')).toBeVisible();
      await expect(page.getByText('Week7 Heading')).toBeVisible();
      await expect(page.getByText('const week7 = true;')).toBeVisible();

      await page.reload();
      await expect(page.getByText('Week7 Heading')).toBeVisible();
      await expect(page.getByText('const week7 = true;')).toBeVisible();
    } finally {
      if (spaceId) {
        try {
          await apiDeleteSpace(request, admin.token, spaceId);
        } catch {
          // ignore cleanup failures
        }
      }
    }
  });
});

