/* Continuous logo strip. Hover and mouse focus cannot leave autoplay stuck. */
(() => {
  'use strict';
  function mount(strip) {
    if (!strip || strip.dataset.carouselReady) return;
    strip.dataset.carouselReady = 'true';
    const items = [...strip.children];
    if (!items.length) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const copies = () =>
      items.map((item) => {
        const copy = item.cloneNode(true);
        copy.setAttribute('aria-hidden', 'true');
        copy.inert = true;
        copy.querySelectorAll('img').forEach((img) => (img.alt = ''));
        return copy;
      });
    const prefix = copies(),
      suffix = copies();
    strip.prepend(...prefix);
    strip.append(...suffix);
    strip.classList.add('is-carousel');
    let cycle = 0,
      frameId = 0,
      lastTime = 0,
      remainder = 0;
    let visible = false,
      dragging = false,
      keyboardFocus = false,
      resumeAt = 0;
    const listeners = [];
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      listeners.push(() => target.removeEventListener(type, handler, options));
    };
    const position = (value) => {
      if (cycle > 0) strip.scrollLeft = cycle + ((((value - cycle) % cycle) + cycle) % cycle);
    };
    function measure() {
      const phase = cycle ? (strip.scrollLeft - cycle) / cycle : 0;
      cycle = items[0].getBoundingClientRect().left - prefix[0].getBoundingClientRect().left;
      position(cycle * (1 + phase));
    }
    const running = () => visible && !document.hidden && !motion.matches;
    function schedule() {
      if (!frameId && running()) {
        lastTime = 0;
        frameId = requestAnimationFrame(animate);
      }
    }
    function animate(time) {
      frameId = 0;
      if (!running()) {
        lastTime = 0;
        return;
      }
      const elapsed = lastTime ? Math.min(64, time - lastTime) : 0;
      lastTime = time;
      if (!dragging && !keyboardFocus && time >= resumeAt) {
        remainder += elapsed * 0.06;
        const pixels = Math.floor(remainder);
        remainder -= pixels;
        if (pixels) position(strip.scrollLeft + pixels);
      }
      // Keep checking transient interaction state, so releasing the pointer always resumes.
      frameId = requestAnimationFrame(animate);
    }
    const hold = () => {
      resumeAt = performance.now() + 4000;
      schedule();
    };
    listen(
      strip,
      'pointerdown',
      () => {
        dragging = true;
        keyboardFocus = false;
        hold();
      },
      { passive: true },
    );
    listen(
      window,
      'pointerup',
      () => {
        if (dragging) {
          dragging = false;
          hold();
        }
      },
      { passive: true },
    );
    listen(
      window,
      'pointercancel',
      () => {
        dragging = false;
        hold();
      },
      { passive: true },
    );
    listen(strip, 'wheel', hold, { passive: true });
    listen(strip, 'keydown', () => {
      keyboardFocus = true;
      hold();
    });
    listen(strip, 'focusout', (event) => {
      if (!strip.contains(event.relatedTarget)) keyboardFocus = false;
      schedule();
    });
    listen(
      strip,
      'scroll',
      () => {
        if (cycle && (strip.scrollLeft < cycle || strip.scrollLeft >= cycle * 2))
          position(strip.scrollLeft);
      },
      { passive: true },
    );
    listen(document, 'visibilitychange', schedule);
    listen(motion, 'change', schedule);
    const resize = new ResizeObserver(() => {
      measure();
      schedule();
    });
    resize.observe(strip);
    const intersection = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        if (visible) measure();
        schedule();
      },
      { threshold: 0 },
    );
    intersection.observe(strip);
    measure();
    return {
      destroy() {
        cancelAnimationFrame(frameId);
        listeners.forEach((remove) => remove());
        resize.disconnect();
        intersection.disconnect();
        prefix.concat(suffix).forEach((el) => el.remove());
        strip.classList.remove('is-carousel');
        delete strip.dataset.carouselReady;
      },
    };
  }
  window.TEXT_CLIENT_CAROUSEL = { mount };
})();
