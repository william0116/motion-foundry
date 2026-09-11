import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../scripts/serve.mjs';

test('local server serves dist only, with MIME types and bounded paths', async () => {
  const server = await startServer({ port: 0 });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const index = await fetch(base);
    assert.equal(index.status, 200);
    assert.match(await index.text(), /Motion Foundry/);
    const module = await fetch(`${base}/data.js`);
    assert.match(module.headers.get('content-type'), /javascript/);
    assert.equal(module.headers.get('x-content-type-options'), 'nosniff');
    const head = await fetch(`${base}/data.js`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    for (const [url, status] of [
      ['/package.json', 404],
      ['/missing.js', 404],
      ['/.git/config', 403],
      ['/%2e%2e%2fpackage.json', 403],
      ['/%5cpackage.json', 400],
      ['/%00', 400],
      ['/%ZZ', 400],
    ])
      assert.equal((await fetch(base + url)).status, status, url);
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
