(() => {
  'use strict';
  const key = 'text-print-consent-v1',
    version = 1,
    maxAge = 180 * 24 * 60 * 60 * 1000;
  const counter = 86530452;
  const production = ['text-print.ru', 'www.text-print.ru'].includes(location.hostname);
  const banner = document.querySelector('#cookie-banner');
  if (!banner) return;
  let choice = null,
    script = null,
    initialized = false,
    returnFocus = null,
    editing = false;
  const goals = new Set([
    'order_sent',
    'order_accepted',
    'order_notification_failed',
    'phone_click',
    'telegram_click',
    'max_click',
    'email_click',
    'pdf_download',
    'xlsx_download',
  ]);
  const pendingGoals = [];
  const allowed = () => production && choice?.analytics === true;
  // Apply before the recorder starts, including to dialogs inserted later.
  const privateContent = [
    '.request-form',
    '.cart-panel',
    '.order-confirmation',
    '.file-feedback',
    '[data-cc-file-label]',
    '[data-cc-file-status]',
    '#sp-file-label',
    '#sp-file-status',
    '[data-download-cart-file]',
  ].join(',');
  function protectPrivacy(root = document) {
    const mark = (selector, className) => {
      if (root.matches?.(selector)) root.classList.add(className);
      root.querySelectorAll?.(selector).forEach((node) => node.classList.add(className));
    };
    mark('input, textarea, select', 'ym-disable-keys');
    mark(privateContent, 'ym-hide-content');
    mark('a[download], a[href*="/order-files/"], a[href^="blob:"]', 'ym-disable-tracklink');
  }
  protectPrivacy();
  new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type === 'attributes') protectPrivacy(change.target);
      else for (const node of change.addedNodes) if (node.nodeType === 1) protectPrivacy(node);
    }
  }).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['href', 'download'],
  });
  window.TEXT_ANALYTICS = {
    allowed,
    track(goal) {
      if (!allowed() || !goals.has(goal)) return false;
      try {
        if (initialized && typeof window.ym === 'function') window.ym(counter, 'reachGoal', goal);
        else if (pendingGoals.length < 32) pendingGoals.push(goal);
        return true;
      } catch {
        return false;
      }
    },
  };
  document.addEventListener?.('click', (event) => {
    const a = event.target.closest?.('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    const goal = href.startsWith('tel:')
      ? 'phone_click'
      : href.startsWith('mailto:')
        ? 'email_click'
        : /^https:\/\/t\.me\//.test(href)
          ? 'telegram_click'
          : /^https:\/\/max\.ru\//.test(href)
            ? 'max_click'
            : null;
    if (goal) window.TEXT_ANALYTICS.track(goal);
  });
  const option = banner.querySelector('[data-cookie-option]');
  const analyticsInput = banner.querySelector('[data-cookie-analytics]');
  const accept = banner.querySelector('[data-cookie-choice="analytics"]');
  function readChoice() {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      const age = Date.now() - Date.parse(value?.updatedAt);
      return value?.version === version &&
        typeof value.analytics === 'boolean' &&
        age >= 0 &&
        age < maxAge
        ? value
        : null;
    } catch {
      return null;
    }
  }
  function clearAnalyticsData() {
    try {
      const names = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
      names
        .filter((name) => name?.startsWith('_ym'))
        .forEach((name) => localStorage.removeItem(name));
    } catch {}
    document.cookie.split(';').forEach((item) => {
      const name = item.split('=')[0].trim();
      if (!name.startsWith('_ym')) return;
      const domains = ['', location.hostname, '.' + location.hostname];
      if (location.hostname === 'www.text-print.ru') domains.push('.text-print.ru');
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax${domain ? '; domain=' + domain : ''}`;
      }
    });
  }
  function stopAnalytics() {
    if (initialized && typeof window.ym === 'function') window.ym(counter, 'destruct');
    initialized = false;
    pendingGoals.length = 0;
    if (script) {
      script.onload = null;
      script.onerror = null;
      script.remove();
      script = null;
    }
    clearAnalyticsData();
  }
  function startAnalytics() {
    if (!production || !choice?.analytics || initialized || script) return;
    if (typeof window.ym !== 'function') {
      window.ym = function () {
        (window.ym.a = window.ym.a || []).push(arguments);
      };
      window.ym.l = Date.now();
    }
    const tag = document.createElement('script');
    script = tag;
    tag.src = 'https://mc.yandex.ru/metrika/tag.js?id=' + counter;
    tag.async = true;
    tag.onload = () => {
      if (script !== tag || !choice?.analytics || initialized) return;
      initialized = true;
      let referrer = '';
      try {
        if (document.referrer) {
          const previous = new URL(document.referrer);
          if (!previous.pathname.startsWith('/order-files/'))
            referrer = previous.origin + previous.pathname;
        }
      } catch {}
      window.ym(counter, 'init', {
        ssr: true,
        webvisor: true,
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        // One initial view, without private calculation parameters or file capabilities.
        url: location.origin + location.pathname,
        referrer,
      });
      for (const goal of pendingGoals.splice(0)) window.ym(counter, 'reachGoal', goal);
    };
    tag.onerror = () => {
      if (script === tag) {
        tag.remove();
        script = null;
      }
    };
    document.head.append(tag);
  }
  function applyChoice() {
    if (choice?.analytics) startAnalytics();
    else stopAnalytics();
    document.dispatchEvent(
      new CustomEvent('text:analytics-consent', { detail: { allowed: allowed() } }),
    );
    banner.hidden = Boolean(choice);
    option.hidden = !editing;
    analyticsInput.checked = Boolean(choice?.analytics);
    accept.textContent = editing ? 'Сохранить' : 'Принять cookies';
    const current = banner.querySelector('[data-cookie-current]');
    if (current) {
      current.hidden = !choice;
      current.textContent = choice?.analytics
        ? 'Сейчас аналитика разрешена. Вы можете изменить выбор.'
        : 'Сейчас используются только необходимые данные.';
    }
  }
  function saveChoice(analytics) {
    const restoreFocus = banner.contains(document.activeElement);
    choice = { version, analytics, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(key, JSON.stringify(choice));
    } catch {}
    editing = false;
    applyChoice();
    if (restoreFocus) returnFocus?.focus();
  }
  accept.addEventListener('click', () => saveChoice(editing ? analyticsInput.checked : true));
  function closeBanner() {
    if (!choice) {
      saveChoice(false);
      return;
    }
    editing = false;
    applyChoice();
    returnFocus?.focus();
  }
  banner.querySelector('[data-cookie-close]').addEventListener('click', closeBanner);
  document.querySelectorAll('[data-cookie-settings]').forEach((button) =>
    button.addEventListener('click', () => {
      returnFocus = button;
      editing = true;
      applyChoice();
      banner.hidden = false;
      analyticsInput.focus();
    }),
  );
  banner.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeBanner();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === key || event.key === null) {
      choice = readChoice();
      applyChoice();
    }
  });
  choice = readChoice();
  applyChoice();
})();
