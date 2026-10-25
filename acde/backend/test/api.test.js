const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'test-secret';
process.env.MONGO_URI = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/acde_test';
process.env.DEPLOY_MODE = 'docker';
process.env.NGINX_RELOAD_CMD = '';
process.env.WORKSPACE_DIR = path.join(__dirname, '..', '..', 'workspace-test');
process.env.NGINX_CONF_DIR = path.join(__dirname, '..', '..', 'nginx', 'conf.d-test');

const { app } = require('../src/index');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Deployment = require('../src/models/Deployment');
const Log = require('../src/models/Log');

let server;
let baseUrl;
let tokenA;
let tokenB;
let userAId;
let projectId;
let lastDeploymentId;

async function request(method, urlPath, body, token) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function waitForDeployment(id, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const deployment = await Deployment.findById(id);
    if (deployment && ['deployed', 'failed', 'stopped'].includes(deployment.status)) {
      return deployment;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return Deployment.findById(id);
}

before(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([
    User.deleteMany({}),
    Project.deleteMany({}),
    Deployment.deleteMany({}),
    Log.deleteMany({}),
  ]);

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (lastDeploymentId) {
    await waitForDeployment(lastDeploymentId, 60000).catch(() => null);
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.connection.dropDatabase().catch(() => null);
  await mongoose.disconnect().catch(() => null);
});

describe('ACDE API test cases (Slide 16)', () => {
  it('TC-01 Valid login returns JWT', async () => {
    const reg = await request('POST', '/api/auth/register', {
      name: 'Sahil',
      email: 'sahil@example.com',
      password: 'secret123',
    });
    assert.equal(reg.status, 201);
    assert.ok(reg.data.token);

    const login = await request('POST', '/api/auth/login', {
      email: 'sahil@example.com',
      password: 'secret123',
    });
    assert.equal(login.status, 200);
    assert.ok(login.data.token);
    tokenA = login.data.token;
    userAId = login.data.user.id;
  });

  it('TC-02 Invalid repository input is rejected', async () => {
    const res = await request(
      'POST',
      '/api/projects',
      {
        project_name: 'bad-repo',
        git_repo_url: 'not-a-valid-git-url',
      },
      tokenA
    );
    assert.equal(res.status, 400);
    assert.match(res.data.error, /Invalid Git/i);

    const count = await Project.countDocuments({ user_id: userAId });
    assert.equal(count, 0);
  });

  it('creates a project with a valid local sample path', async () => {
    const samplePath = path.resolve(
      __dirname,
      '..',
      '..',
      'samples',
      'hello-app'
    );
    const res = await request(
      'POST',
      '/api/projects',
      {
        project_name: 'hello-demo',
        git_repo_url: samplePath,
      },
      tokenA
    );
    assert.equal(res.status, 201);
    projectId = res.data.project.id;
    assert.equal(res.data.project.status, 'pending');
  });

  it('TC-05 Unauthorized project access is denied', async () => {
    const other = await request('POST', '/api/auth/register', {
      name: 'Other',
      email: 'other@example.com',
      password: 'secret123',
    });
    tokenB = other.data.token;

    const res = await request('GET', `/api/projects/${projectId}`, null, tokenB);
    assert.equal(res.status, 403);
    assert.match(res.data.error, /Access denied/i);
  });

  it('TC-03 / TC-04 deployment pipeline records success or failure logs', async () => {
    const start = await request(
      'POST',
      `/api/projects/${projectId}/deploy`,
      null,
      tokenA
    );
    assert.equal(start.status, 202);
    assert.ok(start.data.deployment.id);
    lastDeploymentId = start.data.deployment.id;

    const deployment = await waitForDeployment(lastDeploymentId);
    assert.ok(deployment);
    assert.ok(['deployed', 'failed'].includes(deployment.status));

    const logs = await Log.find({ deployment_id: deployment._id });
    assert.ok(logs.length >= 1, 'expected at least one log entry');

    if (deployment.status === 'failed') {
      const hasError = logs.some((l) => /ERROR/i.test(l.log_message));
      assert.ok(hasError, 'failed deployments must log an ERROR line (TC-04)');
    }

    if (deployment.status === 'deployed') {
      assert.ok(deployment.live_url, 'successful deploy must expose live_url (TC-03)');
    }

    const owned = await request('GET', `/api/projects/${projectId}`, null, tokenA);
    assert.equal(owned.status, 200);
    assert.equal(owned.data.project.id, projectId);
  });
});
