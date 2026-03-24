#!/usr/bin/env node

/**
 * Week 3 API automation tests.
 *
 * Focus:
 * - Page content read/update (TipTap JSON stored in Page.content)
 * - Save triggers PageVersion snapshot
 * - Versions list + restore
 * - Permission boundaries for restore (write required)
 */

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const idx = args.findIndex((x) => x === `--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
}

if (args.includes('--help')) {
  console.log(`
Week 3 API automation

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
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    // ignore non-json body
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

async function login(username, password) {
  const { res, body } = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return { res, body };
}

function tiptapDocWithText(text) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

function stableStringify(obj) {
  return JSON.stringify(obj);
}

function extractTiptapText(doc) {
  let out = '';
  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    if (typeof node !== 'object') return;

    if (node.type === 'text' && typeof node.text === 'string') {
      out += node.text;
    }

    for (const k of Object.keys(node)) {
      walk(node[k]);
    }
  };
  walk(doc);
  return out;
}

async function main() {
  console.log(`Running week3 API tests against ${config.baseUrl}`);

  let adminToken = '';
  let demoToken = '';
  let adminId = '';
  let demoId = '';

  let testSpaceId = '';
  let rootPageId = '';

  const v1 = tiptapDocWithText('week3 v1');
  const v2 = tiptapDocWithText('week3 v2');

  const results = [];

  results.push(
    await runCase('A-01 admin/demo login success', async () => {
      const admin = await login(config.adminUser, config.adminPass);
      assert(admin.res.ok, `admin login expected 2xx, got ${admin.res.status}`);
      assert(admin.body?.token, 'admin token missing');
      adminToken = admin.body.token;
      adminId = admin.body.user?.id ?? '';
      assert(adminId, 'admin user id missing');

      const demo = await login(config.demoUser, config.demoPass);
      assert(demo.res.ok, `demo login expected 2xx, got ${demo.res.status}`);
      assert(demo.body?.token, 'demo token missing');
      demoToken = demo.body.token;
      demoId = demo.body.user?.id ?? '';
      assert(demoId, 'demo user id missing');
    })
  );

  results.push(
    await runCase('A-02 create temp space + permissions', async () => {
      const created = await request('/api/v1/spaces', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          name: `Week3 Test Space ${Date.now()}`,
          description: 'automation test',
          icon: '🧪',
          sortOrder: 999,
        }),
      });
      assert(created.res.status === 201, `expected 201, got ${created.res.status}`);
      testSpaceId = created.body?.id ?? '';
      assert(testSpaceId, 'created space id missing');

      const putPerm = await request(`/api/v1/spaces/${testSpaceId}/permissions`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          permissions: [
            { userId: adminId, permission: 'admin' },
            { userId: demoId, permission: 'read' },
          ],
        }),
      });
      assert(putPerm.res.status === 204, `expected 204, got ${putPerm.res.status}`);
    })
  );

  results.push(
    await runCase('A-03 create page with content v1', async () => {
      const created = await request(`/api/v1/spaces/${testSpaceId}/pages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          title: 'week3-root',
          parentId: null,
          content: v1,
        }),
      });
      assert(created.res.status === 201, `expected 201, got ${created.res.status}`);
      rootPageId = created.body?.id ?? '';
      assert(rootPageId, 'rootPageId missing');

      const detail = await request(`/api/v1/spaces/${testSpaceId}/pages/${rootPageId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(detail.res.ok, `page GET expected 2xx, got ${detail.res.status}`);
      assert(extractTiptapText(detail.body?.content) === extractTiptapText(v1), 'page content must equal v1 (text)');
    })
  );

  results.push(
    await runCase('A-04 PATCH save to v2 creates versions', async () => {
      const patched = await request(`/api/v1/spaces/${testSpaceId}/pages/${rootPageId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ content: v2 }),
      });
      assert(patched.res.ok, `page PATCH expected 2xx, got ${patched.res.status}`);

      const detail = await request(`/api/v1/spaces/${testSpaceId}/pages/${rootPageId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(detail.res.ok, `page GET after patch expected 2xx, got ${detail.res.status}`);
      assert(extractTiptapText(detail.body?.content) === extractTiptapText(v2), 'page content must equal v2 (text)');

      const versionsList = await request(
        `/api/v1/spaces/${testSpaceId}/pages/${rootPageId}/versions`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      assert(versionsList.res.ok, `versions list expected 2xx, got ${versionsList.res.status}`);
      assert(Array.isArray(versionsList.body?.versions), 'versions list must return versions[]');
      assert(versionsList.body.versions.length >= 2, 'versions length should be >= 2 after save');
    })
  );

  results.push(
    await runCase('A-05 versions restore back to v1', async () => {
      const versionsList = await request(
        `/api/v1/spaces/${testSpaceId}/pages/${rootPageId}/versions`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      assert(versionsList.res.ok, `versions list expected 2xx, got ${versionsList.res.status}`);

      const versions = versionsList.body?.versions ?? [];
      assert(versions.length >= 2, 'need at least 2 versions to restore older');

      // versions are sorted desc; the second one should be older snapshot
      const older = versions[1];
      assert(older?.id, 'older version id missing');

      const restore = await request(
        `/api/v1/spaces/${testSpaceId}/pages/${rootPageId}/versions/${older.id}/restore`,
        { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } }
      );
      assert(restore.res.ok, `restore expected 2xx, got ${restore.res.status}`);

      const detail = await request(`/api/v1/spaces/${testSpaceId}/pages/${rootPageId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(detail.res.ok, `page GET after restore expected 2xx, got ${detail.res.status}`);
      assert(extractTiptapText(detail.body?.content) === extractTiptapText(v1), 'content should be restored to v1 (text)');
    })
  );

  results.push(
    await runCase('A-06 demo restore 403 (write required)', async () => {
      // Ensure demo has only read permission
      const putPerm = await request(`/api/v1/spaces/${testSpaceId}/permissions`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          permissions: [
            { userId: adminId, permission: 'admin' },
            { userId: demoId, permission: 'read' },
          ],
        }),
      });
      assert(putPerm.res.status === 204, `expected 204, got ${putPerm.res.status}`);

      const versionsList = await request(
        `/api/v1/spaces/${testSpaceId}/pages/${rootPageId}/versions`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      assert(versionsList.res.ok, 'versions list expected ok');
      const versions = versionsList.body?.versions ?? [];
      assert(versions.length >= 1, 'versions should not be empty');

      const latest = versions[0];
      assert(latest?.id, 'latest version id missing');

      const restore = await request(
        `/api/v1/spaces/${testSpaceId}/pages/${rootPageId}/versions/${latest.id}/restore`,
        { method: 'POST', headers: { Authorization: `Bearer ${demoToken}` } }
      );
      assert(restore.res.status === 403, `expected 403, got ${restore.res.status}`);
      assert(restore.body?.code === 'FORBIDDEN', `expected code FORBIDDEN, got ${restore.body?.code}`);
    })
  );

  // Cleanup
  results.push(
    await runCase('cleanup delete temp space', async () => {
      if (!testSpaceId) return;
      const del = await request(`/api/v1/spaces/${testSpaceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(del.res.status === 204, `expected 204, got ${del.res.status}`);
    })
  );

  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.length - passCount;
  console.log(`\nSummary: ${passCount}/${results.length} passed, ${failCount} failed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

