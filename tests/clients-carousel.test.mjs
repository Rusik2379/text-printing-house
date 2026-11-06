import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const source = await readFile(new URL('../clients-carousel.js', import.meta.url), 'utf8');
function setup() {
  const dom = new JSDOM(
      '<ul><li><img alt="A"></li><li><img alt="B"></li><li><img alt="C"></li></ul>',
      { runScripts: 'outside-only', pretendToBeVisual: true },
    ),
    w = dom.window,
    strip = w.document.querySelector('ul');
  let now = 1000,
    scroll = 0,
    visible,
    resize,
    hidden = false,
    id = 0;
  const frames = new Map();
  const motion = new w.EventTarget();
  motion.matches = false;
  w.matchMedia = () => motion;
  Object.defineProperty(w.performance, 'now', { value: () => now });
  Object.defineProperty(w.document, 'hidden', { get: () => hidden });
  Object.defineProperty(strip, 'scrollLeft', {
    get: () => scroll,
    set: (v) => (scroll = Math.round(v)),
  });
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    return { left: [...strip.children].indexOf(this) * 100 - scroll };
  };
  w.requestAnimationFrame = (cb) => {
    frames.set(++id, cb);
    return id;
  };
  w.cancelAnimationFrame = (key) => frames.delete(key);
  w.ResizeObserver = class {
    constructor(cb) {
      resize = cb;
    }
    observe() {
      resize();
    }
    disconnect() {}
  };
  w.IntersectionObserver = class {
    constructor(cb) {
      visible = cb;
    }
    observe() {
      visible([{ isIntersecting: true }]);
    }
    disconnect() {}
  };
  w.eval(source);
  const api = w.TEXT_CLIENT_CAROUSEL.mount(strip);
  function advance(duration) {
    const until = now + duration;
    while (now < until) {
      now = Math.min(until, now + 16);
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((cb) => cb(now));
    }
  }
  return {
    w,
    strip,
    motion,
    advance,
    api,
    visibility(value) {
      hidden = !value;
      w.document.dispatchEvent(new w.Event('visibilitychange'));
    },
    intersection(value) {
      visible([{ isIntersecting: value }]);
    },
    close() {
      api.destroy();
      dom.window.close();
    },
  };
}
test('Logos move immediately and mouse hover or mouse focus do not stop autoplay', () => {
  const t = setup();
  try {
    const initial = t.strip.scrollLeft;
    t.advance(500);
    assert.ok(t.strip.scrollLeft > initial);
    t.strip.dispatchEvent(new t.w.Event('pointerenter'));
    t.strip.dispatchEvent(new t.w.Event('focusin'));
    const before = t.strip.scrollLeft;
    t.advance(500);
    assert.ok(t.strip.scrollLeft > before);
  } finally {
    t.close();
  }
});
test('Dragging pauses the strip temporarily; release, tab visibility and viewport return resume it', () => {
  const t = setup();
  try {
    t.advance(100);
    t.strip.dispatchEvent(new t.w.Event('pointerdown'));
    const held = t.strip.scrollLeft;
    t.advance(500);
    assert.equal(t.strip.scrollLeft, held);
    t.w.dispatchEvent(new t.w.Event('pointerup'));
    t.advance(3000);
    assert.equal(t.strip.scrollLeft, held);
    t.advance(1300);
    assert.notEqual(t.strip.scrollLeft, held);
    t.visibility(false);
    const hidden = t.strip.scrollLeft;
    t.advance(500);
    assert.equal(t.strip.scrollLeft, hidden);
    t.visibility(true);
    t.advance(500);
    assert.notEqual(t.strip.scrollLeft, hidden);
    t.intersection(false);
    const outside = t.strip.scrollLeft;
    t.advance(500);
    assert.equal(t.strip.scrollLeft, outside);
    t.intersection(true);
    t.advance(500);
    assert.notEqual(t.strip.scrollLeft, outside);
  } finally {
    t.close();
  }
});
test('Reduced motion stops autoplay and duplicate logos remain hidden to assistive technology', () => {
  const t = setup();
  try {
    assert.equal(t.strip.querySelectorAll('[aria-hidden="true"]').length, 6);
    t.advance(100);
    t.motion.matches = true;
    t.motion.dispatchEvent(new t.w.Event('change'));
    const before = t.strip.scrollLeft;
    t.advance(500);
    assert.equal(t.strip.scrollLeft, before);
  } finally {
    t.close();
  }
});
