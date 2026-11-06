import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
export async function createOrderPdf(root) {
  const c = vm.createContext({
    window: {},
    Uint8Array,
    ArrayBuffer,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array,
    TextDecoder,
    TextEncoder,
    setTimeout,
    clearTimeout,
  });
  for (const f of [
    'vendor/pdf/pdf-lib-1.17.1.min.js',
    'vendor/pdf/fontkit-1.1.1.min.js',
    'cart-pdf.js',
  ])
    vm.runInContext(await readFile(path.join(root, f), 'utf8'), c, { filename: f, timeout: 10000 });
  const deps = {
    PDFLib: c.PDFLib,
    fontkit: c.fontkit,
    regularBytes: new Uint8Array(await readFile(path.join(root, 'assets/fonts/DejaVuSans.ttf'))),
    boldBytes: new Uint8Array(await readFile(path.join(root, 'assets/fonts/DejaVuSans-Bold.ttf'))),
    logoBytes: new Uint8Array(await readFile(path.join(root, 'assets/brand-mark.png'))),
  };
  return async (order, catalog) => {
    const rows = order.quote.rows.length
      ? order.quote.rows
      : [
          {
            id: 'request',
            price: null,
            description:
              'Макет и описание задачи переданы для проверки. Стоимость и срок согласуем со студией.',
            fileName: order.files.map((f) => f.name).join(', '),
          },
        ];
    const data = c.window.TEXT_CART_PDF.model(
      rows,
      order.quote.rows.length
        ? catalog
        : [{ id: 'request', name: 'Заявка без предварительного расчёта' }],
      order.quote.breakdown,
      new Date(order.created),
    );
    data.order = {
      number: order.number,
      name: order.contact.name,
      phone: order.contact.phone,
      comment: order.contact.comment,
      channel: order.contact.channel || 'max',
      telegram: order.contact.telegram,
    };
    return Buffer.from(await c.window.TEXT_CART_PDF.create(data, deps));
  };
}
