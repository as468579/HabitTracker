const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
test('iPhone home-screen launch and iPad detection include Apple-specific behavior', async () => {
  const { isStandalone, isAppleMobile } = await import('../src/pwa.ts');
  assert.equal(isStandalone(false, true), true);
  assert.equal(isStandalone(true, undefined), true);
  assert.equal(isStandalone(false, false), false);
  assert.equal(isAppleMobile('iPhone', 'iPhone', 5), true);
  assert.equal(isAppleMobile('Macintosh', 'MacIntel', 5), true);
  assert.equal(isAppleMobile('Macintosh', 'MacIntel', 0), false);
});
test('PWA manifest and iPhone icon provide a standalone launch with valid PNG sizes', () => {
  const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.start_url, '/?tab=dashboard');
  for (const icon of [...manifest.icons, { src: '/icons/apple-touch-icon.png', sizes: '180x180' }]) {
    const png = fs.readFileSync('public' + icon.src);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});
function worker(online = true) {
  const handlers = {};
  const store = new Map([['/index.html', 'offline-shell'], ['/app.js', 'cached-script']]);
  const context = {
    self: { location: { origin: 'https://slowday.test' }, addEventListener: (event, fn) => { handlers[event] = fn; }, clients: { claim: async () => {} }, skipWaiting: () => {} },
    caches: { open: async () => ({ match: async key => store.get(key) }), keys: async () => [] },
    URL,
    fetch: async () => { if (!online) throw new Error('offline'); return 'network'; },
  };
  const source = fs.readFileSync('scripts/service-worker.template.js', 'utf8').replace('const PRECACHE = __PRECACHE__;', 'const PRECACHE = ["/index.html", "/app.js"];');
  vm.runInNewContext(source, context);
  return handlers;
}
test('offline navigation falls back to app shell and cached assets remain available', async () => {
  const handlers = worker(false); let response;
  handlers.fetch({ request: { url: 'https://slowday.test/?tab=tasks', method: 'GET', mode: 'navigate' }, respondWith: value => { response = value; } });
  assert.equal(await response, 'offline-shell');
  handlers.fetch({ request: { url: 'https://slowday.test/privacy/', method: 'GET', mode: 'navigate' }, respondWith: value => { response = value; } });
  assert.equal(await response, 'offline-shell');
  handlers.fetch({ request: { url: 'https://slowday.test/app.js', method: 'GET', mode: 'cors' }, respondWith: value => { response = value; } });
  assert.equal(await response, 'cached-script');
});
test('online navigation uses network; auth, API, cross-origin and writes are not intercepted', async () => {
  const handlers = worker(true); let response;
  handlers.fetch({ request: { url: 'https://slowday.test/', method: 'GET', mode: 'navigate' }, respondWith: value => { response = value; } });
  assert.equal(await response, 'network');
  for (const request of [
    { url: 'https://slowday.test/auth/login', method: 'GET', mode: 'navigate' },
    { url: 'https://slowday.test/api/tasks', method: 'GET', mode: 'cors' },
    { url: 'https://other.test/app.js', method: 'GET', mode: 'cors' },
    { url: 'https://slowday.test/', method: 'POST', mode: 'navigate' },
  ]) handlers.fetch({ request, respondWith: () => assert.fail('Unexpected interception') });
});
