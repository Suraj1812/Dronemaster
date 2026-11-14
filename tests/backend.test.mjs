import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Run the production handlers against SQLite with D1's statement/batch interface.
// Only the Cloudflare bindings and dispatch-owned identity are replaced.
const require = createRequire(import.meta.url);
const zodURL = pathToFileURL(require.resolve('zod')).href;
function moduleURL(path, replacements = {}) {
  let source = readFileSync(new URL(path, import.meta.url), 'utf8');
  for (const [from, to] of Object.entries(replacements)) source = source.replace(from, to);
  source = source.replaceAll("from 'zod'", `from '${zodURL}'`);
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return 'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64');
}
const bindings = {};
globalThis.__backendTestBindings = bindings;
const validationURL = moduleURL('../lib/inspection-validation.ts');
const { handleApi } = await import(moduleURL('../lib/inspection-api.ts', {
  "import { env } from 'cloudflare:workers';": 'const env = globalThis.__backendTestBindings;',
  "import { getChatGPTUser } from '@/app/chatgpt-auth';": 'const getChatGPTUser = async () => globalThis.__backendTestUser;',
  "from './inspection-validation'": `from '${validationURL}'`,
}));
let sqlite, queries, objects, bucketReads;
class Statement {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.sql, args); }
  execute() {
    queries.push(this.sql);
    const statement = sqlite.prepare(this.sql);
    const results = statement.columns().length ? statement.all(...this.args) : (statement.run(...this.args), []);
    return { results, success: true, meta: { changes: sqlite.prepare('SELECT changes() AS n').get().n } };
  }
  async first() { return this.execute().results[0] ?? null; }
  async all() { return this.execute(); }
  async run() { return this.execute(); }
}
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
  }
  queries = []; objects = new Map(); bucketReads = 0;
  bindings.DB = {
    prepare: sql => new Statement(sql),
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const results = statements.map(s => s.execute()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  bindings.BUCKET = {
    async put(key, bytes) { objects.set(key, bytes); },
    async get(key) { bucketReads++; return objects.has(key) ? { body: objects.get(key) } : null; },
    async delete(key) { objects.delete(key); },
  };
  globalThis.__backendTestUser = { userId: 'owner' };
});
afterEach(() => { sqlite.close(); });
const time = '2026-11-14T00:00:00.000Z';
function inspection(id = 'inspection', owner = 'owner') {
  sqlite.prepare('INSERT INTO inspections(id,owner_id,title,site,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(id, owner, 'Roof inspection', 'Building A', '', time, time);
  return id;
}
function photo(parent = 'inspection', size = 12, owner = 'owner') {
  const id = crypto.randomUUID();
  sqlite.prepare('INSERT INTO files(id,inspection_id,owner_id,name,mime,bytes,object_key,sha256,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id, parent, owner, 'roof.png', 'image/png', size, id, 'abc123', time);
  objects.set(id, new Uint8Array(size));
  return id;
}
function finding(parent = 'inspection', fileId = null) {
  const id = crypto.randomUUID();
  sqlite.prepare('INSERT INTO findings(id,inspection_id,owner_id,file_id,title_en,detail_en,severity,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id, parent, 'owner', fileId, 'Roof damage', 'Review the roof', 'low', time);
  return id;
}
function request(path, method = 'GET', body, headers = {}) {
  return new Request('https://dronemaster.test/api/' + path, {
    method, headers: { Origin: 'https://dronemaster.test', ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...headers },
    ...(body !== undefined ? { body: typeof body === 'string' || body instanceof FormData ? body : JSON.stringify(body) } : {}),
  });
}
function upload() {
  const form = new FormData();
  form.set('photo', new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])], 'roof.png', { type: 'image/png' }));
  return form;
}

test('authentication and origin checks reject requests before database access', async () => {
  globalThis.__backendTestUser = null;
  assert.equal((await handleApi(request('workspace'))).status, 401);
  globalThis.__backendTestUser = { userId: 'owner' };
  assert.equal((await handleApi(request('inspections', 'POST', {}, { Origin: 'https://other.test' }))).status, 403);
  assert.equal(queries.length, 0);
});
test('malformed JSON and non-object payloads return 400', async () => {
  for (const value of ['{', 'null', '[]', '42']) assert.equal((await handleApi(request('files/missing', 'PATCH', value))).status, 400);
});
test('streamed JSON without Content-Length is stopped at the byte limit', async () => {
  let cancelled = false;
  const body = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(16 * 1024)); }, cancel() { cancelled = true; } });
  const r = new Request('https://dronemaster.test/api/inspections', { method: 'POST', headers: { Origin: 'https://dronemaster.test', 'Content-Type': 'application/json' }, body, duplex: 'half' });
  assert.equal((await handleApi(r)).status, 413);
  assert.equal(cancelled, true);
});
test('full-length multilingual finding fits the JSON byte limit', async () => {
  inspection();
  const response = await handleApi(request('inspections/inspection/findings', 'POST', { titleEn: 'Roof', detailEn: '界'.repeat(3000), detailIt: '界'.repeat(3000), severity: 'low' }));
  assert.equal(response.status, 201);
});
test('details use one batch and never disclose another owner’s inspection', async () => {
  inspection(); photo(); finding();
  const response = await handleApi(request('inspections/inspection'));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.files.length, 1); assert.equal(data.findings.length, 1);
  assert.equal(queries.length, 3);
  globalThis.__backendTestUser = { userId: 'other' };
  assert.equal((await handleApi(request('inspections/inspection'))).status, 404);
});
test('photo revalidation skips R2 but checks ownership and deletion first', async () => {
  inspection(); const id = photo();
  let response = await handleApi(request('files/' + id));
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'private, no-cache');
  const etag = response.headers.get('ETag');
  response = await handleApi(request('files/' + id, 'GET', undefined, { 'If-None-Match': `"old", W/${etag}` }));
  assert.equal(response.status, 304); assert.equal(bucketReads, 1);
  globalThis.__backendTestUser = { userId: 'other' };
  assert.equal((await handleApi(request('files/' + id, 'GET', undefined, { 'If-None-Match': etag }))).status, 404);
  globalThis.__backendTestUser = { userId: 'owner' };
  sqlite.exec("UPDATE inspections SET deleted_at='deleted'");
  assert.equal((await handleApi(request('files/' + id, 'GET', undefined, { 'If-None-Match': etag }))).status, 404);
});
test('dashboard totals exclude deleted parents and preserve storage accounting', async () => {
  inspection(); photo(); finding(); inspection('deleted'); photo('deleted', 30); finding('deleted');
  inspection('other', 'someone-else'); photo('other', 20, 'someone-else');
  sqlite.exec("UPDATE inspections SET deleted_at='deleted' WHERE id='deleted'");
  const data = await (await handleApi(request('workspace'))).json();
  assert.deepEqual(data.stats, { inspections: 1, photos: 1, pending: 1, bytes: 42 });
  assert.equal(data.inspections.length, 1); assert.equal(data.inspections[0].file_count, 1);
});
test('upload verifies image signatures and stores valid evidence', async () => {
  inspection();
  const bad = new FormData(); bad.set('photo', new File(['not an image'], 'fake.png', { type: 'image/png' }));
  assert.equal((await handleApi(request('inspections/inspection/files', 'POST', bad))).status, 415);
  assert.equal((await handleApi(request('inspections/inspection/files', 'POST', upload()))).status, 201);
  assert.equal(objects.size, 1); assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM files').get().n, 1);
});
test('database protects photo count and storage limits after stale preflight checks', () => {
  inspection(); for (let i = 0; i < 12; i++) photo();
  assert.throws(() => photo(), /workspace_photo_limit/);
  inspection('second'); photo('second', 104857600 - 12 * 12);
  assert.throws(() => photo('second', 1), /workspace_photo_limit/);
  assert.throws(() => photo('second', 1, 'someone-else'), /inactive_inspection/);
});
test('failed upload transaction removes its R2 object and leaves no audit event', async () => {
  inspection();
  bindings.BUCKET.put = async (key, bytes) => { objects.set(key, bytes); sqlite.exec("UPDATE inspections SET deleted_at='deleted'"); };
  assert.equal((await handleApi(request('inspections/inspection/files', 'POST', upload()))).status, 404);
  assert.equal(objects.size, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM files').get().n, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM audit_events').get().n, 0);
});
test('finding limit rejects atomically without audit or parent update', async () => {
  inspection(); for (let i = 0; i < 50; i++) finding();
  const r = await handleApi(request('inspections/inspection/findings', 'POST', { titleEn: 'Roof', detailEn: 'Check roof damage', severity: 'high' }));
  assert.equal(r.status, 409);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM findings').get().n, 50);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM audit_events').get().n, 0);
  assert.equal(sqlite.prepare('SELECT updated_at FROM inspections').get().updated_at, time);
});
test('restoring a finding cannot relink deleted evidence', async () => {
  inspection(); const file = photo(); const id = finding('inspection', file);
  sqlite.prepare("UPDATE findings SET deleted_at='deleted' WHERE id=?").run(id);
  sqlite.prepare("UPDATE files SET deleted_at='deleted' WHERE id=?").run(file);
  const response = await handleApi(request('trash/finding/' + id, 'POST', {}));
  assert.equal(response.status, 409);
  assert.equal(sqlite.prepare('SELECT deleted_at FROM findings WHERE id=?').get(id).deleted_at, 'deleted');
});
test('rate limiting caps attempts and supplies retry timing without per-write cleanup', async () => {
  for (let i = 0; i < 40; i++) assert.equal((await handleApi(request('files/missing', 'PATCH', { name: 'roof' }))).status, 404);
  const response = await handleApi(request('files/missing', 'PATCH', { name: 'roof' }));
  assert.equal(response.status, 429); assert.ok(Number(response.headers.get('Retry-After')) > 0);
  assert.ok(queries.filter(q => q.startsWith('DELETE FROM rate_windows')).length <= 1);
  assert.equal(sqlite.prepare('SELECT count FROM rate_windows').get().count, 41);
});
test('dashboard and evidence queries use indexes without temporary sort', () => {
  const plan = sqlite.prepare('EXPLAIN QUERY PLAN SELECT * FROM inspections WHERE owner_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100').all('owner').map(r => r.detail).join('\n');
  assert.match(plan, /inspection_owner_active_updated/); assert.doesNotMatch(plan, /TEMP B-TREE/);
  const filePlan = sqlite.prepare('EXPLAIN QUERY PLAN SELECT * FROM files WHERE inspection_id=? AND owner_id=? AND deleted_at IS NULL ORDER BY created_at').all('inspection', 'owner').map(r => r.detail).join('\n');
  assert.match(filePlan, /file_inspection_active_created/); assert.doesNotMatch(filePlan, /TEMP B-TREE/);
});
