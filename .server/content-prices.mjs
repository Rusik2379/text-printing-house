import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createQuotation } from './quotation.mjs';

const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const format = (value, digits = 2) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value);
export async function createContentPrices({ root, catalog, store }) {
  const registry = JSON.parse(
    await readFile(path.join(root, '.server', 'content-price-cases.json'), 'utf8'),
  );
  const pricing = await createQuotation(root, catalog, store);
  let revision,
    cache = new Map();
  function refresh() {
    if (revision !== store.snapshot().revision) {
      revision = store.snapshot().revision;
      cache.clear();
    }
  }
  function value(key, trail = []) {
    refresh();
    if (cache.has('value:' + key)) return cache.get('value:' + key);
    const spec = registry.cases[key];
    if (!spec || trail.includes(key) || trail.length > 20)
      throw Error('Invalid content price binding: ' + key);
    const get = (k) => value(k, [...trail, key]);
    let result;
    if (spec.kind === 'minimum') result = pricing.minimum(spec.id);
    else if (spec.kind === 'detail') {
      const detail = pricing
        .example(spec.id, spec.configuration)
        .details.find((d) => d.label === spec.label);
      result =
        typeof detail?.value === 'number'
          ? detail.value
          : Number.parseFloat(String(detail?.value).replace(',', '.'));
    } else if (spec.kind === 'difference') result = get(spec.left) - get(spec.right);
    else if (spec.kind === 'ratio')
      result = (get(spec.left) / get(spec.right)) * (spec.factor ?? 1);
    else {
      const q = pricing.example(spec.id, spec.configuration);
      result = spec.upper ? q.upper : q.price;
      if (spec.divisor) result /= spec.divisor;
    }
    if (!Number.isFinite(result)) throw Error('Non-finite content price: ' + key);
    cache.set('value:' + key, result);
    return result;
  }
  function text(key) {
    refresh();
    if (cache.has('text:' + key)) return cache.get('text:' + key);
    const spec = registry.cases[key];
    if (!spec) throw Error('Unknown content price: ' + key);
    let output = format(value(key), spec.digits ?? 2);
    if (spec.range) {
      const q = pricing.example(spec.id, spec.configuration);
      if (q.upper > q.price) output += '–' + format(q.upper, spec.digits ?? 2);
    }
    output += spec.suffix ?? ' ₽';
    cache.set('text:' + key, output);
    return output;
  }
  function comparison(key) {
    const spec = registry.comparisons[key];
    if (!spec) throw Error('Unknown content price comparison: ' + key);
    const [first, last] = spec.points,
      low = value(first.key) / first.quantity,
      high = value(last.key) / last.quantity;
    const delta = low ? Math.round((1 - high / low) * 100) : 0;
    return (
      `Для одинаковой конфигурации «${spec.label}»: ${format(first.quantity)} шт. — ${format(low)} ₽/шт., ${format(last.quantity)} шт. — ${format(high)} ₽/шт. ` +
      (delta > 0
        ? `Цена за единицу снижается примерно на ${delta}%.`
        : delta < 0
          ? `Цена за единицу увеличивается примерно на ${Math.abs(delta)}%.`
          : 'Стоимость за единицу для этих тиражей одинакова.')
    );
  }
  function render(source) {
    if (!source.includes('data-price-')) return source;
    let output = source.replace(
      /(<([a-z][\w:-]*)\b[^>]*\bdata-price-(example|comparison)="([a-zA-Z0-9_-]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
      (_, open, tag, type, key, body, close) =>
        open + escape(type === 'comparison' ? comparison(key) : text(key)) + close,
    );
    // Keep FAQ structured data consistent with its visible, tariff-bound answer.
    const plain = (s) =>
      s
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;|&#160;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\s+([%.,;:!?])/g, '$1');
    const blocks = (s) =>
      new Map(
        [
          ...s.matchAll(
            /<([a-z][\w:-]*)\b[^>]*\bdata-price-(?:block|comparison)="([a-zA-Z0-9_-]+)"[^>]*>([\s\S]*?)<\/\1>/g,
          ),
        ].map((m) => [m[2], plain(m[3])]),
      );
    const before = blocks(source),
      after = blocks(output),
      changes = new Map();
    for (const [key, old] of before)
      if (after.has(key) && after.get(key) !== old) changes.set(old, after.get(key));
    if (changes.size)
      output = output.replace(
        /(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,
        (all, open, body, close) => {
          let changed = false;
          const visit = (v) => {
            if (typeof v === 'string' && changes.has(plain(v))) {
              changed = true;
              return changes.get(plain(v));
            }
            if (Array.isArray(v)) return v.map(visit);
            if (v && typeof v === 'object')
              return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, visit(x)]));
            return v;
          };
          const data = visit(JSON.parse(body));
          return changed ? open + JSON.stringify(data).replace(/</g, '\\u003c') + close : all;
        },
      );
    return output;
  }
  return { render, text, value, comparison, registry };
}
