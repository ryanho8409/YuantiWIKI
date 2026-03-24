#!/usr/bin/env node

/**
 * Week 1 API automation smoke tests.
 * Usage:
 *   node tests/week1/week1-api-automation.mjs --help
 *   node tests/week1/week1-api-automation.mjs --baseUrl http://localhost:3000
 */

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const idx = args.findIndex((x) => x === `--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
}

if (args.includes('--help')) {
  console.log(`
Week 1 API automation

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
    // keep null for non-json body
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
  console.log(`Running week1 API tests against ${config.baseUrl}`);

  let adminToken = '';
  let demoToken = '';

  const results = [];

  results.push(
    await runCase('A-01 health endpoint works', async () => {
      const { res, body } = await request('/api/health');
      assert(res.ok, `expected 2xx, got ${res.status}`);
      assert(body && typeof body === 'object', 'health response should be object');
    })
  );

  results.push(
    await runCase('A-02 admin login success', async () => {
      const { res, body } = await login(config.adminUser, config.adminPass);
      assert(res.ok, `expected 2xx, got ${res.status}`);
      assert(body?.token, 'admin login should return token');
      adminToken = body.token;
    })
  );

  results.push(
    await runCase('A-03 demo login success', async () => {
      const { res, body } = await login(config.demoUser, config.demoPass);
      assert(res.ok, `expected 2xx, got ${res.status}`);
      assert(body?.token, 'demo login should return token');
      demoToken = body.token;
    })
  );

  results.push(
    await runCase('A-04 /auth/me unauthorized without token', async () => {
      const { res, body } = await request('/api/v1/auth/me');
      assert(res.status === 401, `expected 401, got ${res.status}`);
      assert(body?.code === 'UNAUTHORIZED', `expected code UNAUTHORIZED, got ${body?.code}`);
    })
  );

  results.push(
    await runCase('A-05 /auth/me returns user with admin token', async () => {
      assert(adminToken, 'adminToken is empty');
      const { res, body } = await request('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.ok, `expected 2xx, got ${res.status}`);
      assert(body?.username === config.adminUser, `expected ${config.adminUser}, got ${body?.username}`);
    })
  );

  results.push(
    await runCase('A-06 /spaces returns array for admin and demo', async () => {
      assert(adminToken && demoToken, 'tokens should not be empty');
      const adminRes = await request('/api/v1/spaces', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(adminRes.res.ok, `admin /spaces expected 2xx, got ${adminRes.res.status}`);
      assert(Array.isArray(adminRes.body), 'admin /spaces should return array');

      const demoRes = await request('/api/v1/spaces', {
        headers: { Authorization: `Bearer ${demoToken}` },
      });
      assert(demoRes.res.ok, `demo /spaces expected 2xx, got ${demoRes.res.status}`);
      assert(Array.isArray(demoRes.body), 'demo /spaces should return array');
    })
  );

  results.push(
    await runCase('A-07 login fails with wrong password', async () => {
      const { res } = await login(config.adminUser, '__wrong_password__');
      assert(res.status === 401, `expected 401, got ${res.status}`);
    })
  );

  const passed = results.filter((x) => x.pass).length;
  const failed = results.length - passed;
  console.log(`\nSummary: ${passed}/${results.length} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
