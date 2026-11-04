const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function findAvailablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  return port;
}

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise(resolve => child.once('exit', resolve));
}

test('backend serves health with Helmet headers and enforces API rate limits', async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fw-webinar-smoke-'));
  const port = await findAvailablePort();
  const logs = [];
  const child = spawn(process.execPath, ['backend/server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATA_DIR: dataDir, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', chunk => logs.push(chunk.toString()));
  child.stderr.on('data', chunk => logs.push(chunk.toString()));

  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
    }
    let timeout;
    await Promise.race([
      waitForExit(child),
      new Promise(resolve => {
        timeout = setTimeout(resolve, 5000);
      })
    ]);
    clearTimeout(timeout);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await waitForExit(child);
    }
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const url = `http://127.0.0.1:${port}/api/health`;
  const deadline = Date.now() + 10_000;
  let healthResponse;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      break;
    }
    try {
      healthResponse = await fetch(url);
      break;
    } catch (error) {
      lastError = error;
      await delay(100);
    }
  }

  assert.ok(healthResponse, `Backend failed to start: ${lastError}\n${logs.join('')}`);
  assert.equal(healthResponse.status, 200);
  assert.equal(healthResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(healthResponse.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal((await healthResponse.json()).status, 'ok');

  for (let request = 1; request < 100; request += 1) {
    const response = await fetch(url);
    assert.equal(response.status, 200, `Health request ${request + 1} was unexpectedly throttled`);
  }

  const limitedResponse = await fetch(url);
  assert.equal(limitedResponse.status, 429);
});
