import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicJson, readJson, ApiError } from './storage.mjs';

export const defaultRatings = {
  yandex: { rating: 5, count: 166 },
  gis: { rating: 4.9, count: 577 },
  google: { rating: 4.6, count: 10 },
};
export const ratingNames = { yandex: 'Яндекс Карты', gis: '2ГИС', google: 'Google' };
const copy = (ratings) =>
  Object.fromEntries(Object.entries(ratings).map(([id, value]) => [id, { ...value }]));
function validate(ratings) {
  if (
    !ratings ||
    typeof ratings !== 'object' ||
    Array.isArray(ratings) ||
    Object.keys(ratings).sort().join() !== Object.keys(defaultRatings).sort().join()
  )
    throw new ApiError(400, 'Укажите оценки трёх картографических сервисов.');
  for (const [id, value] of Object.entries(ratings)) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).sort().join() !== 'count,rating' ||
      typeof value.rating !== 'number' ||
      !Number.isFinite(value.rating) ||
      value.rating < 0 ||
      value.rating > 5 ||
      Math.abs(value.rating * 10 - Math.round(value.rating * 10)) > 1e-8 ||
      !Number.isSafeInteger(value.count) ||
      value.count < 0 ||
      value.count > 10000000
    )
      throw new ApiError(
        400,
        `${ratingNames[id]}: оценка от 0 до 5 с одним знаком после запятой, число отзывов — целое неотрицательное число.`,
      );
  }
}
export async function createRatings(directory) {
  const file = path.join(directory, 'site-settings.json');
  let state = await readJson(file);
  if (state) {
    if (state.version !== 1 || typeof state.revision !== 'string')
      throw Error('Некорректные настройки оценок.');
    validate(state.ratings);
  } else state = { version: 1, revision: randomUUID(), ratings: copy(defaultRatings) };
  let pending = Promise.resolve();
  const snapshot = () => ({ revision: state.revision, ratings: copy(state.ratings) });
  return {
    snapshot,
    replace(revision, ratings) {
      const task = pending.then(async () => {
        if (revision !== state.revision)
          throw new ApiError(
            409,
            'Оценки изменены в другой вкладке. Обновите данные и повторите правки.',
          );
        validate(ratings);
        const next = { version: 1, revision: randomUUID(), ratings: copy(ratings) };
        await atomicJson(file, next);
        state = next;
        return snapshot();
      });
      pending = task.catch(() => {});
      return task;
    },
    render(html) {
      return html.replace(
        /(<span data-rating-(value|count)="(yandex|gis|google)">)[^<]*(<\/span>)/g,
        (_, open, type, id, close) =>
          open +
          (type === 'value'
            ? state.ratings[id].rating.toFixed(1).replace('.', ',')
            : state.ratings[id].count) +
          close,
      );
    },
  };
}
