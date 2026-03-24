#!/usr/bin/env node

/**
 * Week 2 API automation tests.
 * Usage:
 *   node tests/week2/week2-api-automation.mjs --help
 *   node tests/week2/week2-api-automation.mjs --baseUrl http://localhost:3000
 */

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const idx = args.findIndex((x) => x === `--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
}

if (args.includes('--help')) {
  console.log(`
Week 2 API automation

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

async function main() {
  console.log(`Running week2 API tests against ${config.baseUrl}`);

  let adminToken = '';
  let adminId = '';
  let demoToken = '';
  let demoId = '';

  let testSpaceId = '';
  let rootPageId = '';
  let childPageId = '';

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
    await runCase('A-02 admin can create/update/delete a space', async () => {
      const created = await request('/api/v1/spaces', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          name: `Week2 Test Space ${Date.now()}`,
          description: 'automation test',
          icon: '🧪',
          sortOrder: 999,
        }),
      });
      assert(created.res.status === 201, `expected 201, got ${created.res.status}`);
      testSpaceId = created.body?.id ?? '';
      assert(testSpaceId, 'created space id missing');

      const patched = await request(`/api/v1/spaces/${testSpaceId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ description: 'automation test updated' }),
      });
      assert(patched.res.ok, `space patch expected 2xx, got ${patched.res.status}`);
      assert(
        patched.body?.description === 'automation test updated',
        'space description should be updated'
      );
    })
  );

  results.push(
    await runCase('A-03 demo cannot create space (403)', async () => {
      const created = await request('/api/v1/spaces', {
        method: 'POST',
        headers: { Authorization: `Bearer ${demoToken}` },
        body: JSON.stringify({ name: `Should Fail ${Date.now()}` }),
      });
      assert(created.res.status === 403, `expected 403, got ${created.res.status}`);
      assert(created.body?.code === 'FORBIDDEN', `expected FORBIDDEN, got ${created.body?.code}`);
    })
  );

  results.push(
    await runCase('A-04 permissions GET/PUT works for admin', async () => {
      const putRes = await request(`/api/v1/spaces/${testSpaceId}/permissions`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          permissions: [
            { userId: adminId, permission: 'admin' },
            { userId: demoId, permission: 'read' },
          ],
        }),
      });
      assert(putRes.res.status === 204, `expected 204, got ${putRes.res.status}`);

      const getRes = await request(`/api/v1/spaces/${testSpaceId}/permissions`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(getRes.res.ok, `permissions get expected 2xx, got ${getRes.res.status}`);
      assert(Array.isArray(getRes.body?.list), 'permissions list should be array');
    })
  );

  results.push(
    await runCase('A-05 demo cannot read space permissions (403)', async () => {
      const res = await request(`/api/v1/spaces/${testSpaceId}/permissions`, {
        headers: { Authorization: `Bearer ${demoToken}` },
      });
      assert(res.res.status === 403, `expected 403, got ${res.res.status}`);
      assert(res.body?.code === 'FORBIDDEN', `expected FORBIDDEN, got ${res.body?.code}`);
    })
  );

  results.push(
    await runCase('A-06 pages list/tree format works', async () => {
      const listRes = await request(`/api/v1/spaces/${testSpaceId}/pages?format=list`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(listRes.res.ok, `pages list expected 2xx, got ${listRes.res.status}`);
      assert(Array.isArray(listRes.body?.list), 'list format should return list[]');

      const treeRes = await request(`/api/v1/spaces/${testSpaceId}/pages?format=tree`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(treeRes.res.ok, `pages tree expected 2xx, got ${treeRes.res.status}`);
      assert(Array.isArray(treeRes.body?.tree), 'tree format should return tree[]');
    })
  );

  results.push(
    await runCase('A-07 page create/rename/delete works', async () => {
      const root = await request(`/api/v1/spaces/${testSpaceId}/pages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ title: 'root-page', parentId: null }),
      });
      assert(root.res.status === 201, `root create expected 201, got ${root.res.status}`);
      rootPageId = root.body?.id ?? '';
      assert(rootPageId, 'root page id missing');

      const child = await request(`/api/v1/spaces/${testSpaceId}/pages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ title: 'child-page', parentId: rootPageId }),
      });
      assert(child.res.status === 201, `child create expected 201, got ${child.res.status}`);
      childPageId = child.body?.id ?? '';
      assert(childPageId, 'child page id missing');

      const rename = await request(`/api/v1/spaces/${testSpaceId}/pages/${childPageId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ title: 'child-renamed' }),
      });
      assert(rename.res.ok, `rename expected 2xx, got ${rename.res.status}`);
      assert(rename.body?.title === 'child-renamed', 'rename should update title');

      const delChild = await request(`/api/v1/spaces/${testSpaceId}/pages/${childPageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(delChild.res.status === 204, `child delete expected 204, got ${delChild.res.status}`);
      childPageId = '';

      const delRoot = await request(`/api/v1/spaces/${testSpaceId}/pages/${rootPageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(delRoot.res.status === 204, `root delete expected 204, got ${delRoot.res.status}`);
      rootPageId = '';
    })
  );

  results.push(
    await runCase('A-08 delete parent with children returns HAS_CHILDREN', async () => {
      const root = await request(`/api/v1/spaces/${testSpaceId}/pages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ title: 'root-2', parentId: null }),
      });
      assert(root.res.status === 201, `root2 create expected 201, got ${root.res.status}`);
      rootPageId = root.body?.id ?? '';

      const child = await request(`/api/v1/spaces/${testSpaceId}/pages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ title: 'child-2', parentId: rootPageId }),
      });
      assert(child.res.status === 201, `child2 create expected 201, got ${child.res.status}`);
      childPageId = child.body?.id ?? '';

      const delRoot = await request(`/api/v1/spaces/${testSpaceId}/pages/${rootPageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(delRoot.res.status === 409, `expected 409, got ${delRoot.res.status}`);
      assert(delRoot.body?.code === 'HAS_CHILDREN', `expected HAS_CHILDREN, got ${delRoot.body?.code}`);
    })
  );

  // Cleanup best-effort
  await runCase('cleanup created pages/space', async () => {
    if (childPageId) {
      await request(`/api/v1/spaces/${testSpaceId}/pages/${childPageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      childPageId = '';
    }
    if (rootPageId) {
      await request(`/api/v1/spaces/${testSpaceId}/pages/${rootPageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      rootPageId = '';
    }
    if (testSpaceId) {
      const delSpace = await request(`/api/v1/spaces/${testSpaceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(
        delSpace.res.status === 204 || delSpace.res.status === 404,
        `space cleanup expected 204/404, got ${delSpace.res.status}`
      );
    }
  });

  const passed = results.filter((x) => x.pass).length;
  const failed = results.length - passed;
  console.log(`\nSummary: ${passed}/${results.length} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
