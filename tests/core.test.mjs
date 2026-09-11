import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  categories,
  effects,
  defaults,
  dimensions,
  validateContent,
  validateBody,
} from '../dist/data.js';
import { schemes } from '../dist/schemes.js';
import { parseSeries } from '../dist/expanded-effects.js';
import { crc32, zipFiles } from '../dist/exporter.js';

test('template IDs, categories and schemes are unique and all defaults validate', () => {
  assert.equal(new Set(effects.map((e) => e.id)).size, effects.length);
  assert.equal(new Set(categories.map(([id]) => id)).size, categories.length);
  assert.equal(new Set(schemes.map((s) => s.id)).size, schemes.length);
  for (const effect of effects) {
    const settings = defaults(effect);
    assert(
      categories.some(([id]) => id === effect.category),
      effect.id,
    );
    assert(
      schemes.some((scheme) => scheme.id === settings.scheme),
      effect.id,
    );
    assert(['16:9', '9:16', '1:1'].includes(settings.ratio), effect.id);
    assert([2, 3, 5].includes(settings.duration), effect.id);
    assert.equal(validateContent(effect, settings.title), '', effect.id);
    assert.equal(validateBody(effect, settings.body), '', effect.id);
  }
});

test('README feature counts agree with the actual catalog', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert(readme.includes(`${effects.length} 个模板、${categories.length} 个分类`));
  assert(
    readme.includes(
      `${effects.filter((e) => defaults(e).ratio === '9:16').length} 个模板默认采用 9:16`,
    ),
  );
  assert(readme.includes(`${schemes.length} 种配色方案`));
});

test('dimensions use the selected short side, including portrait rounding', () => {
  assert.deepEqual(dimensions('16:9', 1080), [1920, 1080]);
  assert.deepEqual(dimensions('9:16', 480), [480, 853]);
  assert.deepEqual(dimensions('1:1', 720), [720, 720]);
});

test('data input rejects negative, empty, excessive and zero-only series', () => {
  const effect = effects.find((e) => e.id === 'x-line');
  for (const body of [
    '',
    'A:1',
    'A:-1\nB:2',
    'A:0\nB:0',
    'A:1000000\nB:2',
    'A:1\nB:2\nC:3\nD:4\nE:5\nF:6\nG:7',
  ]) {
    assert(validateBody(effect, body), body);
  }
  assert.equal(validateBody(effect, '甲：1.5\n乙:2'), '');
  assert.deepEqual(parseSeries('甲：1.5\n乙:2'), [
    { label: '甲', value: 1.5 },
    { label: '乙', value: 2 },
  ]);
  assert(
    validateContent(
      effects.find((e) => e.id === 'progress'),
      '101',
    ),
  );
  assert(
    validateContent(
      effects.find((e) => e.id === 'x-odometer'),
      '1.5',
    ),
  );
});

test('CRC32 matches a known vector and ZIP preserves UTF-8 names and bytes', async () => {
  const data = new TextEncoder().encode('123456789');
  assert.equal(crc32(data), 0xcbf43926);
  const name = 'frames/测试.txt';
  const bytes = new Uint8Array(await zipFiles([{ name, data }]).arrayBuffer());
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint16(6, true), 0x800);
  assert.equal(view.getUint32(14, true), 0xcbf43926);
  const nameLength = view.getUint16(26, true);
  assert.equal(new TextDecoder().decode(bytes.slice(30, 30 + nameLength)), name);
  assert.deepEqual(bytes.slice(30 + nameLength, 30 + nameLength + data.length), data);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(bytes.length - 12, true), 1);
});
