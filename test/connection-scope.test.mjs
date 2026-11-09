import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Exercise real App orchestration with deterministic client fixtures. These
// tests cover cancellation/ownership, not real AI or Web source acceptance.
const output = new URL('../.nimi/local/scope-tests/', import.meta.url);
mkdirSync(output, { recursive: true });
await build({ entryPoints: ['src/odd-bureau/nimi.ts', 'src/odd-bureau/play-runtime.ts'],
  outdir: fileURLToPath(output), bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent' });
const { locatePhoto, readSavedDocument, saveSession, textTurn } = await import(new URL('nimi.js', output));
const { persistPlay } = await import(new URL('play-runtime.js', output));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const scopeFor = client => { const controller = new AbortController(); return { client, signal: controller.signal, viewKey: 'test', controller }; };

test('disconnect while reading an image prevents the later artifact upload', async () => {
  const bytes = deferred(); let uploaded = false;
  const scope = scopeFor({ ai: { artifacts: { upload() { uploaded = true; } } } });
  const operation = locatePhoto(scope, { blob: { arrayBuffer: () => bytes.promise } }, new AbortController().signal);
  scope.controller.abort(); bytes.resolve(new ArrayBuffer(4));
  await assert.rejects(operation, { name: 'AbortError' }); assert.equal(uploaded, false);
});

test('disconnect cancels a running text stream and cannot produce a completed story', async () => {
  const started = deferred(), release = deferred(); let canceled = 0;
  const scope = scopeFor({ ai: { text: { async streamTurn() { return {
    async *[Symbol.asyncIterator]() { started.resolve(); await release.promise; yield { type: 'completed', finishReason: 'stop' }; },
    async cancel() { canceled++; release.resolve(); },
  }; } } } });
  const operation = textTurn(scope, 'fixture prompt', new AbortController().signal, 20);
  await started.promise; scope.controller.abort();
  await assert.rejects(operation, { name: 'AbortError' }); assert.ok(canceled > 0);
});

test('disconnect after photo storage prevents the queued game document from being written', async () => {
  const asset = deferred(); let writes = 0;
  const scope = scopeFor({ storage: { assets: { write: () => asset.promise }, writeJson: async () => { writes++; } } });
  const saving = persistPlay(scope, { id: 'round-a', photoPath: '' }, { blob: new Blob(['photo']) });
  scope.controller.abort(); asset.resolve();
  await assert.rejects(saving, { name: 'AbortError' }); assert.equal(writes, 0);
  await assert.rejects(saveSession(scope, { id: 'queued-a' }), { name: 'AbortError' }); assert.equal(writes, 0);
});

test('the same browser Blob cannot reuse another client’s stored photo path', async () => {
  const paths = [], photo = { blob: new Blob(['photo']) };
  const make = () => scopeFor({ storage: { assets: { async write(input) { paths.push(input.relativePath); } }, async writeJson() {} } });
  const a = await persistPlay(make(), { id: 'a', photoPath: '' }, photo);
  const b = await persistPlay(make(), { id: 'b', photoPath: '' }, photo);
  assert.equal(paths.length, 2); assert.notEqual(a.photoPath, b.photoPath);
});

test('missing saves are empty on both carriers; denial and disconnected reads remain failures', async () => {
  for (const reasonCode of ['not-found', 'APP_STORAGE_ENTRY_NOT_FOUND']) {
    assert.deepEqual(await readSavedDocument(scopeFor({ storage: { async readJson() { throw { reasonCode }; } } }), 'round.json'), { value: null });
  }
  const denied = new Error('denied');
  await assert.rejects(readSavedDocument(scopeFor({ storage: { async readJson() { throw denied; } } }), 'round.json'), error => error === denied);
  const read = deferred(), scope = scopeFor({ storage: { readJson: () => read.promise } });
  const operation = readSavedDocument(scope, 'round.json'); scope.controller.abort(); read.resolve({ value: { private: 'old' } });
  await assert.rejects(operation, { name: 'AbortError' });
});
