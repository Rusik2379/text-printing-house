import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { randomUUID, webcrypto } from 'node:crypto';

const source = await readFile(new URL('../orders-client.js', import.meta.url), 'utf8');
const tick = () => new Promise((r) => setTimeout(r, 20));
async function checkout({
  status = 'queued',
  notification = 'pending',
  consent = true,
  submitError = false,
} = {}) {
  const dom = new JSDOM(
    '<div><p class="dialog-intro"></p><form><input name="name" value="Private"><input name="phone" value="+79991112233"><textarea name="comment">Private</textarea><input name="personalDataConsent" value="2026-10-07"><input id="file-input" type="file"><p id="file-feedback"></p><div class="form-actions"><button type="submit">Send</button></div><p class="form-disclosure"></p></form></div>',
    { url: 'https://text-print.ru/', runScripts: 'outside-only' },
  );
  const w = dom.window,
    goals = [],
    calls = [],
    timers = [];
  w.AbortSignal = AbortSignal;
  w.AbortController = AbortController;
  w.crypto.randomUUID = randomUUID;
  w.crypto.getRandomValues = (a) => webcrypto.getRandomValues(a);
  w.setTimeout = (fn) => {
    timers.push(fn);
    return timers.length;
  };
  w.clearTimeout = () => {};
  let allowed = consent,
    current = notification;
  w.TEXT_ANALYTICS = {
    allowed: () => allowed,
    track: (...args) => {
      goals.push(args);
      return true;
    },
  };
  w.TEXT_FILES = { validate: () => '' };
  w.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/config'))
      return Response.json({
        enabled: true,
        mode: status === 'preview' ? 'preview' : 'live',
        maxFiles: 20,
        maxTotalBytes: 524288000,
        retentionDays: 30,
      });
    if (String(url).endsWith('/draft'))
      return Response.json({ id: 'private-order-id', files: [], changed: false });
    if (String(url).endsWith('/notification')) {
      if (current instanceof Error) throw current;
      return Response.json({ notification: current });
    }
    if (submitError) return Response.json({ error: 'Rejected' }, { status: 400 });
    return Response.json({
      status,
      preview: status === 'preview',
      number: 'TXT-private',
      links: { pdf: '/order-files/private/quote', zip: '/order-files/private/archive' },
    });
  };
  w.eval(source);
  const form = w.document.querySelector('form');
  await w.TEXT_ORDER_CHECKOUT.mount({
    form,
    siteRoot: w.location.href,
    getItems: () => [{ key: 'row', id: '1.1' }],
    getFile: () => null,
    notify() {},
  });
  const submit = () => form.dispatchEvent(new w.Event('submit', { cancelable: true }));
  submit();
  await tick();
  return {
    w,
    goals,
    calls,
    form,
    submit,
    timers,
    setNotification(value) {
      current = value;
    },
    revoke() {
      allowed = false;
      w.document.dispatchEvent(
        new w.CustomEvent('text:analytics-consent', { detail: { allowed: false } }),
      );
    },
    close() {
      w.dispatchEvent(new w.Event('pagehide'));
      w.close();
    },
  };
}

test('Queue is a saved order, not delivery; a later confirmation sends order_sent once without private parameters', async () => {
  const t = await checkout();
  try {
    assert.deepEqual(t.goals, [['order_accepted']]);
    assert.equal(t.calls.filter((c) => c.url.endsWith('/notification')).length, 1);
    const query = t.calls.at(-1);
    assert.match(query.options.headers['X-Order-Token'], /^[a-f0-9]{64}$/);
    assert.equal(query.url.includes(query.options.headers['X-Order-Token']), false);
    t.setNotification('delivered');
    await t.timers.shift()();
    assert.deepEqual(t.goals, [['order_accepted'], ['order_sent']]);
    t.submit();
    await tick();
    assert.equal(t.calls.filter((c) => c.url.endsWith('/submit')).length, 1);
    assert.equal(t.w.document.querySelectorAll('.ym-disable-tracklink').length, 2);
  } finally {
    t.close();
  }
});
test('Retry, terminal failure, preview and an API rejection have distinct outcomes', async () => {
  for (const [options, expected] of [
    [{ status: 'retrying' }, ['order_accepted']],
    [{ status: 'failed' }, ['order_accepted', 'order_notification_failed']],
    [{ notification: 'failed' }, ['order_accepted', 'order_notification_failed']],
    [{ notification: new Error('Offline') }, ['order_accepted']],
    [{ status: 'preview' }, []],
    [{ submitError: true }, []],
    [{ consent: false }, []],
  ]) {
    const t = await checkout(options);
    try {
      assert.deepEqual(
        t.goals.map((g) => g[0]),
        expected,
        JSON.stringify(options),
      );
      if (
        options.consent === false ||
        options.status === 'preview' ||
        options.status === 'failed' ||
        options.submitError
      )
        assert.equal(t.calls.filter((c) => c.url.endsWith('/notification')).length, 0);
    } finally {
      t.close();
    }
  }
});
test('Revoking consent or leaving the page aborts status checks; no late success is counted', async () => {
  for (const action of ['revoke', 'pagehide']) {
    const t = await checkout();
    try {
      const check = t.calls.find((c) => c.url.endsWith('/notification'));
      if (action === 'revoke') t.revoke();
      else t.w.dispatchEvent(new t.w.Event('pagehide'));
      assert.equal(check.options.signal.aborted, true);
      t.setNotification('delivered');
      await t.timers.shift()();
      assert.deepEqual(t.goals, [['order_accepted']]);
      assert.equal(t.calls.filter((c) => c.url.endsWith('/notification')).length, 1);
    } finally {
      t.close();
    }
  }
});
