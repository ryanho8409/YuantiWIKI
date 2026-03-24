#!/usr/bin/env node
/**
 * Week 6 API automation (attachments: upload + file read + delete)
 * Usage:
 *   node tests/week6/week6-api-automation.mjs --help
 *   node tests/week6/week6-api-automation.mjs --baseUrl http://localhost:3000
 */

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const idx = args.findIndex((x) => x === `--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
}

if (args.includes('--help')) {
  console.log(`
Week 6 API automation

Options:
  --baseUrl    Backend base url (default: http://localhost:3000)
  --adminUser  Admin username (default: admin)
  --adminPass  Admin password (default: admin123)
  --demoUser   Demo username (default: demo)
  --demoPass   Demo password (default: demo123)
`);
  process.exit(0);
}

const config = {
  baseUrl: getArg('baseUrl', 'http://localhost:3000'),
  adminUser: getArg('adminUser', 'admin'),
  adminPass: getArg('adminPass', 'admin123'),
  demoUser: getArg('demoUser', 'demo'),
  demoPass: getArg('demoPass', 'demo123'),
};

async function request(path, init = {}) {
  const res = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  let body = null;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      body = await res.json();
    } catch {
      // ignore
    }
  }
  return { res, body };
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function runCase(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
    return { name, pass: true };
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    return { name, pass: false };
  }
}

function tiptapDocWithText(text) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

async function apiLogin(username, password) {
  const { res, body } = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  assert(res.ok, `login failed: ${res.status}`);
  assert(body?.token, 'login should return token');
  return { token: body.token, user: body.user };
}

async function apiCreateSpace(token, name) {
  const res = await fetch(`${config.baseUrl}/api/v1/spaces`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description: 'e2e week6', icon: '📎', sortOrder: 998 }),
  });
  const body = await res.json();
  assert(res.status === 201 || res.status === 200, `create space failed: ${res.status}`);
  return body.id;
}

async function apiSetSpacePermissions(adminToken, spaceId, permissions) {
  const res = await fetch(`${config.baseUrl}/api/v1/spaces/${spaceId}/permissions`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions }),
  });
  assert(res.status === 204, `set space permissions failed: ${res.status}`);
}

async function apiCreatePage(adminToken, spaceId, title, contentDoc) {
  const { res, body } = await request(`/api/v1/spaces/${spaceId}/pages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ title, parentId: null, content: contentDoc }),
  });
  assert(res.status === 201, `create page failed: ${res.status}`);
  return body.id;
}

async function apiDeleteSpace(adminToken, spaceId) {
  const res = await fetch(`${config.baseUrl}/api/v1/spaces/${spaceId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(res.status === 200 || res.status === 204, `delete space failed: ${res.status}`);
}

/** 1x1 PNG */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function apiUploadAttachment(token, spaceId, pageId) {
  const fd = new FormData();
  const blob = new Blob([PNG_1X1], { type: 'image/png' });
  fd.append('file', blob, 'week6.png');
  const res = await fetch(
    `${config.baseUrl}/api/v1/spaces/${spaceId}/attachments?pageId=${encodeURIComponent(pageId)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    }
  );
  const body = await res.json();
  return { status: res.status, body };
}

async function apiGetAttachmentFile(pathWithQuery, headers = {}) {
  const res = await fetch(`${config.baseUrl}${pathWithQuery}`, { headers });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, buf };
}

async function apiDeleteAttachment(token, spaceId, attachmentId) {
  const res = await fetch(`${config.baseUrl}/api/v1/spaces/${spaceId}/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status;
}

async function main() {
  console.log(`Running week6 API tests against ${config.baseUrl}`);

  let adminToken = '';
  let demoToken = '';
  let adminUser = null;
  let demoUser = null;
  let spaceId = '';
  let pageId = '';
  let attachmentId = '';

  try {
    const admin = await apiLogin(config.adminUser, config.adminPass);
    adminToken = admin.token;
    adminUser = admin.user;

    const demo = await apiLogin(config.demoUser, config.demoPass);
    demoToken = demo.token;
    demoUser = demo.user;

    spaceId = await apiCreateSpace(adminToken, `Week6 Space ${Date.now()}`);

    await apiSetSpacePermissions(adminToken, spaceId, [
      { userId: adminUser.id, permission: 'admin' },
      { userId: demoUser.id, permission: 'read' },
    ]);

    pageId = await apiCreatePage(adminToken, spaceId, 'week6-page', tiptapDocWithText('attachments'));

    const results = [];

    results.push(
      await runCase('A-01: admin uploads attachment with pageId', async () => {
        const { status, body } = await apiUploadAttachment(adminToken, spaceId, pageId);
        assert(status === 200, `expected 200, got ${status}`);
        assert(body?.id && body?.url, 'response should include id and url');
        attachmentId = body.id;
        assert(body.url.includes(attachmentId), 'url should reference attachment id');
      })
    );

    results.push(
      await runCase('A-02: GET file with Bearer returns PNG bytes', async () => {
        assert(attachmentId, 'attachment id missing');
        const { status, buf } = await apiGetAttachmentFile(`/api/v1/attachments/${attachmentId}/file`, {
          Authorization: `Bearer ${adminToken}`,
        });
        assert(status === 200, `expected 200, got ${status}`);
        // 1x1 PNG 仅约 68 字节，阈值勿过大
        assert(buf.length >= 50, `png should not be empty (got ${buf.length} bytes)`);
        assert(buf[0] === 0x89 && buf[1] === 0x50, 'should look like PNG');
      })
    );

    results.push(
      await runCase('A-03: GET file with token query works', async () => {
        const { status, buf } = await apiGetAttachmentFile(
          `/api/v1/attachments/${attachmentId}/file?token=${encodeURIComponent(adminToken)}`
        );
        assert(status === 200, `expected 200, got ${status}`);
        assert(buf.length > 50, 'body should have bytes');
      })
    );

    results.push(
      await runCase('A-04: demo (space read) cannot upload', async () => {
        const { status } = await apiUploadAttachment(demoToken, spaceId, pageId);
        assert(status === 403, `expected 403, got ${status}`);
      })
    );

    results.push(
      await runCase('A-05: DELETE attachment then GET file returns 404', async () => {
        assert(attachmentId, 'attachment id missing');
        const delStatus = await apiDeleteAttachment(adminToken, spaceId, attachmentId);
        assert(delStatus === 204, `expected DELETE 204, got ${delStatus}`);
        const { status } = await apiGetAttachmentFile(`/api/v1/attachments/${attachmentId}/file`, {
          Authorization: `Bearer ${adminToken}`,
        });
        assert(status === 404, `expected GET 404 after delete, got ${status}`);
      })
    );

    const passed = results.filter((x) => x.pass).length;
    const failed = results.length - passed;
    console.log(`\nSummary: ${passed}/${results.length} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  } finally {
    if (spaceId) {
      try {
        await apiDeleteSpace(adminToken, spaceId);
      } catch {
        // best effort cleanup
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
