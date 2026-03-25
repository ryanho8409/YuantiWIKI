import { test, expect } from '@playwright/test';
import path from 'path';

const uiBaseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const backendBaseUrl = process.env.PW_BACKEND_BASE_URL || 'http://127.0.0.1:3000';

const adminUser = process.env.PW_ADMIN_USER || 'admin';
const adminPass = process.env.PW_ADMIN_PASS || 'admin123';

const TOKEN_KEY = 'yuanti_wiki_token';

const avatarFilePath =
  process.env.PW_AVATAR_FILE || 'e:\\My Projects\\YuantiWIKI\\123.png';

function tiptapDocWithText(text) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

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
    data: { name, description: 'e2e release v1.1', icon: '🧪', sortOrder: 990 },
  });
  expect([200, 201]).toContain(res.status());
  const body = await res.json();
  return body.id;
}

async function apiCreatePage(request, token, spaceId, title, parentId, content) {
  const res = await request.post(`${backendBaseUrl}/api/v1/spaces/${spaceId}/pages`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title, parentId, content },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return body.id;
}

async function apiGetJson(request, path, token) {
  const res = await request.get(`${backendBaseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    // no-op
  }
  return { res, body };
}

async function apiUploadAttachment(request, token, spaceId, pageId) {
  const fs = await import('fs');
  const buffer = fs.readFileSync(avatarFilePath);
  const res = await request.post(`${backendBaseUrl}/api/v1/spaces/${spaceId}/attachments?pageId=${encodeURIComponent(pageId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: 'upload.png',
        mimeType: 'image/png',
        buffer,
      },
    },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function loginWithToken(page, token, path = '/') {
  await page.goto(`${uiBaseUrl}/login`);
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: TOKEN_KEY, value: token },
  );
  // route navigation (no full refresh needed; still counts as "not logging in again")
  await page.goto(`${uiBaseUrl}${path}`);
}

async function writeResults(outPath, results) {
  // Playwright test is still Node runtime, so fs is ok.
  const fs = await import('fs');
  fs.writeFileSync(outPath, JSON.stringify({ version: 'v1.1', scope: 'e2e', results }, null, 2), 'utf8');
}

test.describe.serial('Release V1.1 P0 Smoke (E-L + F)', () => {
  test('P0 E-L: dashboard/space/editor/history/avatar/theme/import stub/logout', async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);

    const results = {};

    async function runCase(letter, name, fn) {
      try {
        await fn();
        results[letter] = 'Pass';
        console.log(`PASS ${letter}: ${name}`);
      } catch (err) {
        results[letter] = `Fail: ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}`;
        console.error(`FAIL ${letter}: ${name}`);
        console.error(err instanceof Error ? err.message : String(err));
      }
    }

    // Prepare data for UI scenes (Space + parent page with initial v0)
    const admin = await apiLogin(request, adminUser, adminPass);
    const spaceName = `ReleaseV1.1 E2E Space ${Date.now()}`;
    const spaceId = await apiCreateSpace(request, admin.token, spaceName);

    const parentTitle = `release-v1.1-e2e-parent-${Date.now()}`;
    const parentPageId = await apiCreatePage(
      request,
      admin.token,
      spaceId,
      parentTitle,
      null,
      tiptapDocWithText('v0'),
    );

    const childTitle = `release-v1.1-e2e-child-${Date.now()}`;
    await apiCreatePage(
      request,
      admin.token,
      spaceId,
      childTitle,
      parentPageId,
      tiptapDocWithText('child'),
    );

    try {
      // Scenario E: login -> dashboard, refresh keeps authenticated state
      await runCase('E', '登录后回到 Dashboard + 刷新仍可见', async () => {
        await loginWithToken(page, admin.token, '/');
        await expect(page.locator('.dash-title')).toBeVisible({ timeout: 20000 });
        await page.reload();
        await expect(page.locator('.dash-title')).toBeVisible({ timeout: 20000 });
        await expect(page.locator('.dash-sub')).toBeVisible();
      });

      // Scenario G/H/I: read -> edit/save v1 -> edit/save v2 -> history/restore -> show v1
      await runCase('G', '进入 Space -> 阅读态可见', async () => {
        await page.goto(`${uiBaseUrl}/space/${spaceId}/page/${parentPageId}`);
        await expect(page.locator('#readView')).toBeVisible({ timeout: 20000 });
        await expect(page.locator('#pageTitle')).toContainText(parentTitle);
        await expect(page.locator('#readView')).toContainText('v0');
      });

      await runCase('H', '编辑/保存 v1 + History 可见至少 2 版本', async () => {
        await page.getByRole('button', { name: '编辑' }).click();

        const editor = page.locator('.doc-body.editable .ProseMirror');
        await expect(editor).toBeVisible({ timeout: 20000 });
        await editor.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.type('v1');

        // Save button is in content-toolbar, not inside #editView
        await page.locator('.content-toolbar').getByRole('button', { name: '保存' }).click({ timeout: 20000 });
        await expect(page.locator('#readView')).toContainText('v1', { timeout: 25000 });

        await page.locator('#readView').getByRole('button', { name: '历史版本' }).click();
        await expect(page.locator('#versionPanel')).toBeVisible();

        // Wait until at least one version item is rendered
        await expect(page.locator('#versionPanel .version-item').first()).toBeVisible({ timeout: 20000 });

        // Restore buttons live under each version item actions.
        const restoreButtons = page.locator('#versionPanel .version-item-actions button');
        const count = await restoreButtons.count();
        expect(count).toBeGreaterThan(1);
      });

      await runCase('I', 'Restore 到旧版本（非最新）后内容回到 v1', async () => {
        // close history panel if still open from previous step
        const closeHistoryBtn = page.locator('#versionPanel').getByRole('button', { name: '关闭' });
        if (await closeHistoryBtn.isVisible().catch(() => false)) {
          await closeHistoryBtn.click();
        }

        // create v2 first
        await page.getByRole('button', { name: '编辑' }).click();
        const editor = page.locator('.doc-body.editable .ProseMirror');
        await expect(editor).toBeVisible({ timeout: 20000 });
        await editor.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.type('v2');
        await page.locator('.content-toolbar').getByRole('button', { name: '保存' }).click({ timeout: 20000 });
        await expect(page.locator('#readView')).toContainText('v2', { timeout: 25000 });

        // open history and restore second button (older than latest)
        await page.locator('#readView').getByRole('button', { name: '历史版本' }).click();
        await expect(page.locator('#versionPanel')).toBeVisible();

        const restoreButtons = page.locator('#versionPanel').getByRole('button', { name: '恢复' });
        const count = await restoreButtons.count();
        expect(count).toBeGreaterThan(1);

        await restoreButtons.nth(1).click();
        await expect(page.locator('#readView')).toContainText('v1', { timeout: 25000 });
        await expect(page.locator('#readView').getByText('v2')).toHaveCount(0);
      });

      // Scenario L: import stub message should be inside create popover only
      await runCase('L', '导入入口提示出现在浮层内部，不污染正文', async () => {
        // Make sure we are on space page read view
        // If history panel is open from previous step, close it first.
        const closeHistoryBtn = page.locator('#versionPanel').getByRole('button', { name: '关闭' });
        if (await closeHistoryBtn.isVisible().catch(() => false)) {
          await closeHistoryBtn.click({ timeout: 5000 });
        }

        await page.goto(`${uiBaseUrl}/space/${spaceId}/page/${parentPageId}`);

        // open "create child" popover from tree row actions
        const newChildBtn = page.locator('button[aria-label="新建子页面"]').first();
        await expect(newChildBtn).toBeVisible({ timeout: 20000 });
        await newChildBtn.click({ timeout: 20000, force: true });

        const popover = page.locator('.sidebar-page-create-popover');
        await expect(popover).toBeVisible();

        const importBtn = popover.locator('button.sidebar-create-import');
        await importBtn.click();

        await expect(popover.locator('.sidebar-import-stub-msg')).toBeVisible();
        await expect(page.locator('#readView').getByText('导入功能暂未开放')).toHaveCount(0);
      });

      // Scenario J: avatar upload -> header and dashboard update without hard refresh
      await runCase('J', '设置页上传头像：顶栏与 Dashboard 欢迎区即时刷新', async () => {
        await page.locator('.header-menu-trigger').click({ force: true });
        await page.getByRole('menuitem', { name: '个人设置' }).click();

        const headerAvatar = page.locator('.header-user-avatar');
        await expect(page.locator('.settings-page-title')).toContainText('个人设置', { timeout: 20000 });

        const before = await headerAvatar.getAttribute('src');
        expect(before).toBeTruthy();

        await page.setInputFiles('.settings-avatar-file-input', avatarFilePath);

        await expect
          .poll(async () => await headerAvatar.getAttribute('src'), { timeout: 20000 })
          .not.toBe(before);

        const after = await headerAvatar.getAttribute('src');
        expect(after).toBeTruthy();
        expect(after).not.toBe(before);

        // go back to dashboard via logo link
        await page.locator('a.logo').click();
        await expect(page.locator('.dash-header-avatar')).toBeVisible({ timeout: 20000 });
        const dashSrc = await page.locator('.dash-header-avatar').getAttribute('src');
        expect(dashSrc).toBe(after);

        // reset to default
        await page.locator('.header-menu-trigger').click({ force: true });
        await page.getByRole('menuitem', { name: '个人设置' }).click();
        await page.getByRole('button', { name: '恢复默认头像' }).click();

        await expect
          .poll(async () => await headerAvatar.getAttribute('src'), { timeout: 20000 })
          .toBe('/default-avatar.svg');
      });

      // Scenario K: deep mode toggle persists via localStorage + html[data-theme]
      await runCase('K', '深色模式开关切换并刷新后保持', async () => {
        await page.locator('.header-menu-trigger').click({ force: true });
        await page.getByRole('menuitem', { name: '个人设置' }).click();
        const checkbox = page.locator('.settings-checkbox');
        await expect(checkbox).toBeVisible();

        // turn on dark
        const isChecked = await checkbox.isChecked().catch(() => false);
        if (!isChecked) await checkbox.click();

        await page.waitForFunction(
          () => document.documentElement.getAttribute('data-theme') === 'dark',
          { timeout: 20000 },
        );

        await page.reload();
        await page.waitForFunction(
          () => document.documentElement.getAttribute('data-theme') === 'dark',
          { timeout: 20000 },
        );
      });

      // Scenario F: logout -> protected route redirect to login
      await runCase('F', '退出登录后访问受保护路由会跳转登录页', async () => {
        await page.getByRole('button', { name: '退出登录' }).click();
        await expect(page).toHaveURL(/\/login/);
        await page.goto(`${uiBaseUrl}/settings`);
        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator('.login-card')).toBeVisible({ timeout: 20000 });
      });

      // Scenario M: search empty state
      await runCase('M', '搜索空态（未找到匹配结果）稳定展示', async () => {
        await loginWithToken(page, admin.token, `/search?q=${encodeURIComponent(`never-match-${Date.now()}`)}`);
        await expect(page.locator('.search-box-wrap')).toBeVisible({ timeout: 20000 });
        await expect(page.getByText('未找到匹配结果')).toBeVisible({ timeout: 20000 });
      });

      // Scenario N: attachment upload -> access -> delete -> access 404
      await runCase('N', '附件上传/读取/删除链路', async () => {
        const up = await apiUploadAttachment(request, admin.token, spaceId, parentPageId);
        if (![200, 201].includes(up.res.status())) {
          throw new Error(`upload expected 200/201, got ${up.res.status()} body=${JSON.stringify(up.body)}`);
        }
        const attId = up.body?.id;
        const attUrl = up.body?.url;
        if (!attId || !attUrl) throw new Error(`upload response missing id/url: ${JSON.stringify(up.body)}`);

        // file read should 200 with token query
        const fileRes = await request.get(`${backendBaseUrl}${attUrl}?token=${encodeURIComponent(admin.token)}`);
        expect(fileRes.status()).toBe(200);

        // delete
        const delRes = await request.delete(`${backendBaseUrl}/api/v1/spaces/${spaceId}/attachments/${attId}`, {
          headers: { Authorization: `Bearer ${admin.token}` },
        });
        expect([200, 204]).toContain(delRes.status());

        // read again should 404
        const fileRes2 = await request.get(`${backendBaseUrl}${attUrl}?token=${encodeURIComponent(admin.token)}`);
        expect(fileRes2.status()).toBe(404);
      });
    } finally {
      // cleanup best effort: delete space
      try {
        await request.delete(`${backendBaseUrl}/api/v1/spaces/${encodeURIComponent(spaceId)}`, {
          headers: { Authorization: `Bearer ${admin.token}` },
        });
      } catch {
        // no-op
      }

      const outPath = path.resolve(process.cwd(), '..', 'tests', '.release-v1.1-results-e2e.json');
      await writeResults(outPath, results);
    }
  });
});

