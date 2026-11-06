/* Public, read-only tools. Uses server prices without changing the page or basket. */
(() => {
  'use strict';
  const context = document.modelContext || navigator.modelContext;
  if (!context?.registerTool) return;
  const root = new URL('.', document.currentScript.src);
  const fields = {
    serviceId: {
      type: 'string',
      pattern: '^[1-6]\\.[0-9]{1,2}$',
      description: 'ID из search_print_services, например 3.2',
    },
    parameters: {
      type: 'object',
      description: 'Ключи и значения из get_print_service_parameters. Размеры — в мм.',
    },
  };
  async function request(path, data, signal) {
    const response = await fetch(new URL(path, root), {
      credentials: 'omit',
      cache: 'no-store',
      signal,
      ...(data
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          }
        : {}),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Расчёт недоступен.');
    return JSON.stringify(result);
  }
  const tools = [
    {
      name: 'search_print_services',
      title: 'Найти услугу печати',
      description:
        'Найти услуги студии ТЕКСТ по названию или задаче. Возвращает ID, описание и ссылки. Пустой запрос возвращает каталог. Не изменяет страницу или заказ.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', maxLength: 200 },
          limit: { type: 'integer', minimum: 1, maximum: 55, default: 10 },
          category: { type: 'string', maxLength: 100 },
        },
        additionalProperties: false,
      },
      execute: async (input = {}, options = {}) => {
        const query = new URLSearchParams({
          q: input.query || '',
          limit: String(input.limit ?? 10),
        });
        if (input.category) query.set('category', input.category);
        return request('api/ai/services?' + query, null, options.signal);
      },
    },
    {
      name: 'get_print_service_parameters',
      title: 'Параметры калькулятора',
      description:
        'Получить допустимые поля, значения, варианты, состав листов и начальную конфигурацию выбранной услуги. Повторите с parameters после изменения зависимых полей. Не оформляет заказ.',
      inputSchema: {
        type: 'object',
        properties: fields,
        required: ['serviceId'],
        additionalProperties: false,
      },
      execute: async ({ serviceId, parameters }, options = {}) =>
        request(
          'api/ai/parameters',
          { serviceId, configuration: parameters || {} },
          options.signal,
        ),
    },
    {
      name: 'configure_print_calculation',
      title: 'Рассчитать печать',
      description:
        'Предварительно рассчитать выбранную услугу по текущим серверным тарифам. Возвращает итог в рублях, минимальные доплаты и ссылку на калькулятор с параметрами. Сначала получите допустимые параметры. Не меняет страницу, не добавляет в корзину, не отправляет файлы и не создаёт заказ.',
      inputSchema: {
        type: 'object',
        properties: fields,
        required: ['serviceId'],
        additionalProperties: false,
      },
      execute: async ({ serviceId, parameters }, options = {}) =>
        request('api/ai/quote', { serviceId, configuration: parameters || {} }, options.signal),
    },
  ];
  for (const tool of tools) {
    tool.annotations = {
      readOnlyHint: true,
      consequentialHint: false,
      untrustedContentHint: false,
    };
    try {
      Promise.resolve(context.registerTool(tool)).catch(() => {});
    } catch {
      /* Unsupported experimental implementations do not affect the site. */
    }
  }
})();
