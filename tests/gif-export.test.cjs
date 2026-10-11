// npm run test:browser; starts an isolated local server unless MOTION_TEST_URL is set.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const outputParent = path.resolve(
  process.env.MOTION_TEST_OUTPUT || path.join(__dirname, '../test-results'),
);

(async () => {
  await fs.mkdir(outputParent, { recursive: true });
  const root = await fs.mkdtemp(path.join(outputParent, 'browser-'));
  const { startServer } = await import('../scripts/serve.mjs');
  const server = process.env.MOTION_TEST_URL ? null : await startServer({ port: 0 });
  const base = (process.env.MOTION_TEST_URL || `http://127.0.0.1:${server.address().port}`).replace(
    /\/$/,
    '',
  );
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.MOTION_BROWSER_CHANNEL
        ? { channel: process.env.MOTION_BROWSER_CHANNEL }
        : {}),
    });
    console.log('Browser:', browser.version());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
      errors = [],
      downloads = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('download', (d) => downloads.push(d.suggestedFilename()));
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    // Inspector layout: the editor must remain reachable with a compact, collapsible preview.
    assert((await page.locator('#previewStage').boundingBox()).height < 220);
    await page.locator('#togglePreview').click();
    assert.equal(await page.locator('#togglePreview').getAttribute('aria-expanded'), 'false');
    assert(await page.locator('#previewBody').isHidden());
    await page.locator('#scale').scrollIntoViewIfNeeded();
    assert(await page.locator('#scale').isVisible());
    await page.locator('#togglePreview').click();
    await page.locator('#expandPreview').click();
    assert(await page.locator('#largePreviewDialog').isVisible());
    await page.locator('#closeLargePreview').click();
    await page.locator('.inspector').evaluate((el) => (el.scrollTop = 0));
    await page.screenshot({ path: path.join(root, 'workbench.png') });
    await page.locator('#exportButton').click();
    assert.equal(await page.locator('#exportResolution').inputValue(), '1080');
    await page.locator('[name=format][value=gif]').check();
    assert.equal(await page.locator('#exportResolution').inputValue(), '480');
    assert.equal(await page.locator('#exportFps').inputValue(), '15');
    await page.locator('#exportResolution').selectOption('360');
    await page.locator('#exportFps').selectOption('20');
    await page.locator('[name=format][value=frame]').check();
    assert.equal(await page.locator('#exportResolution').inputValue(), '1080');
    assert(await page.locator('#exportFps').isDisabled());
    await page.locator('[name=format][value=gif]').check();
    assert.equal(await page.locator('#exportResolution').inputValue(), '360');
    assert.equal(await page.locator('#exportFps').inputValue(), '20');
    await page.locator('#exportResolution').selectOption('480');
    await page.locator('#exportFps').selectOption('15');
    await page.screenshot({ path: path.join(root, 'gif-export-dialog.png') });
    const save = async () => {
      const pending = page.waitForEvent('download');
      await page.locator('#startExport').click();
      const download = await pending;
      await download.saveAs(path.join(root, download.suggestedFilename()));
      await page.waitForFunction(() => !document.getElementById('startExport').disabled);
      return download.suggestedFilename();
    };
    const exported = await save();
    assert(exported.endsWith('15fps-transparent.gif'));
    console.log('UI GIF download:', exported);
    const decoded = await page.evaluate(async () => {
      const link = document.querySelector('#exportProgress a'),
        data = await (await fetch(link.href)).arrayBuffer();
      const decoder = new ImageDecoder({ data, type: 'image/gif' });
      await decoder.tracks.ready;
      let total = 0;
      for (let i = 0; i < decoder.tracks.selectedTrack.frameCount; i++) {
        const { image } = await decoder.decode({ frameIndex: i });
        total += image.duration;
        image.close();
      }
      const result = { frames: decoder.tracks.selectedTrack.frameCount, durationMs: total / 1000 };
      decoder.close();
      return result;
    });
    const duration = Number(await page.locator('#duration').inputValue());
    assert.equal(decoded.frames, Math.round(duration * 15));
    assert.equal(decoded.durationMs, duration * 1000);
    console.log('Independent Chromium GIF decoder:', JSON.stringify(decoded));
    // Inject a deterministic canvas read error; confirm controls recover and can retry.
    await page.evaluate(() => {
      const original = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function (...args) {
        CanvasRenderingContext2D.prototype.getImageData = original;
        throw new Error('GIF test: canvas read failed');
      };
    });
    await page.locator('#startExport').click();
    await page.locator('#exportError').waitFor({ state: 'visible' });
    assert.match(await page.locator('#exportError').textContent(), /canvas read failed/);
    assert(await page.locator('#startExport').isEnabled());
    const before = downloads.length;
    await page.locator('#exportResolution').selectOption('720');
    await page.locator('#exportFps').selectOption('20');
    await page.locator('#startExport').click();
    await page.locator('#cancelExport').click();
    await page.waitForFunction(() =>
      document.querySelector('#exportProgress p').textContent.includes('已取消生成'),
    );
    assert.equal(downloads.length, before);
    assert(await page.locator('#startExport').isEnabled());
    // Both matte modes, restored PNG path, and downloaded file extensions.
    await page.locator('#exportResolution').selectOption('360');
    await page.locator('#exportFps').selectOption('10');
    for (const background of ['white', 'black']) {
      await page.locator('#gifBackground').selectOption(background);
      assert((await save()).endsWith(`${background}.gif`));
    }
    await page.locator('[name=format][value=frame]').check();
    await page.locator('#exportResolution').selectOption('720');
    assert((await save()).endsWith('.png'));
    await page.locator('[name=format][value=gif]').check();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(root, 'gif-export-mobile.png') });
    const fits = await page.locator('#exportDialog').evaluate((el) => ({
      width: el.clientWidth,
      scroll: el.scrollWidth,
      height: el.getBoundingClientRect().height,
      viewport: innerHeight,
    }));
    assert(fits.scroll <= fits.width + 1);
    assert(fits.height <= fits.viewport);
    await page.locator('#startExport').scrollIntoViewIfNeeded();
    assert(await page.locator('#startExport').isVisible());
    // WebMCP tools: describe_template, export_motion and resolve_export must
    // work as standalone tools with the same deterministic renderer.
    const webmcp = await page.evaluate(async () => {
      const m = await import('/webmcp-tools.js');
      const describe = m.describeTemplate('s-trend');
      const invalid = (() => {
        try {
          m.startExport({ effectId: 'nope' });
          return null;
        } catch (e) {
          return e.message;
        }
      })();
      const frame = m.startExport({
        effectId: 's-trend',
        title: '98',
        body: '阶段一:45\n阶段二:98',
        format: 'frame',
        resolution: 720,
        download: false,
      });
      const poll = async (taskId) => {
        for (let i = 0; i < 80; i++) {
          const r = m.resolveExport(taskId);
          if (r.status !== 'running') return r;
          await new Promise((res) => setTimeout(res, 100));
        }
        return m.resolveExport(taskId);
      };
      const frameResult = await poll(frame.taskId);
      const gif = m.startExport({
        effectId: 's-trend',
        title: '98',
        body: '阶段一:45\n阶段二:98',
        format: 'gif',
        resolution: 360,
        fps: 10,
        download: false,
      });
      const gifResult = await poll(gif.taskId);
      return { describe, invalid, frameResult, gifResult };
    });
    assert(webmcp.describe.id === 's-trend');
    assert.equal(webmcp.describe.bodyMode, 'series');
    assert(webmcp.describe.fieldInfo.fields.some((f) => f.key === 'body'));
    assert(webmcp.describe.output.formats.includes('sequence'));
    assert.match(webmcp.invalid, /未找到该动效/);
    assert.equal(webmcp.frameResult.status, 'done');
    assert.equal(webmcp.frameResult.result.format, 'PNG');
    assert(webmcp.frameResult.result.bytes > 0);
    assert.equal(webmcp.gifResult.status, 'done');
    assert.equal(webmcp.gifResult.result.format, 'GIF');
    assert.equal(webmcp.gifResult.result.background, 'transparent');
    console.log(
      'WebMCP tools:',
      JSON.stringify({
        describe: webmcp.describe.id,
        frameResult: webmcp.frameResult.status,
        gifResult: webmcp.gifResult.status,
      }),
    );
    // Cancellation must stop a running GIF export and report cancelled.
    const cancelled = await page.evaluate(async () => {
      const m = await import('/webmcp-tools.js');
      const t = m.startExport({
        effectId: 'confetti',
        title: '值得庆祝！',
        format: 'gif',
        resolution: 720,
        fps: 20,
        download: false,
      });
      await new Promise((res) => setTimeout(res, 150));
      return m.resolveExport(t.taskId, 'cancel');
    });
    assert(['cancelled', 'error'].includes(cancelled.status));
    console.log('WebMCP cancel:', cancelled.status);
    await page.goto(base + '/qa.html');
    await page.locator('#run').click();
    await page.waitForFunction(
      () => {
        try {
          return (
            typeof JSON.parse(document.getElementById('results').textContent).total === 'number'
          );
        } catch {
          return false;
        }
      },
      {},
      { timeout: 180000 },
    );
    const qa = JSON.parse(await page.locator('#results').textContent());
    await fs.writeFile(path.join(root, 'qa-results.json'), JSON.stringify(qa, null, 2));
    assert.equal(qa.passed, qa.total, JSON.stringify(qa.results.filter((r) => !r.pass)));
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify(
        { passed: qa.passed, total: qa.total, downloads, mobile: fits, errors, output: root },
        null,
        2,
      ),
    );
  } finally {
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
