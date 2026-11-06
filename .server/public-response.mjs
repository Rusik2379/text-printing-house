import { createHash } from 'node:crypto';
import { gzip, brotliCompress, constants } from 'node:zlib';
import { promisify } from 'node:util';
const gz = promisify(gzip),
  br = promisify(brotliCompress);
export function publicResponses() {
  const encoded = new Map();
  return async function send(req, res, data, type, immutable = false) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data),
      digest = createHash('sha256').update(bytes).digest('hex'),
      etag = 'W/"' + digest + '"';
    const compressible = /^(?:text\/|application\/(?:javascript|json|xml))|image\/svg\+xml/.test(
      type,
    );
    const headers = {
      'Content-Type': type,
      'Cache-Control': immutable
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      ETag: etag,
      ...(compressible ? { Vary: 'Accept-Encoding' } : {}),
    };
    if (
      (req.headers['if-none-match'] || '')
        .split(',')
        .some((v) => v.trim() === '*' || v.trim().replace(/^W\//, '') === etag.slice(2))
    ) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    const accepted = new Map(
      (req.headers['accept-encoding'] || '').split(',').map((v) => {
        const [name, ...params] = v.trim().split(';');
        const q = params.find((p) => p.trim().startsWith('q='));
        return [name.trim(), q ? Number(q.trim().slice(2)) : 1];
      }),
    );
    const available = (encoding) => (accepted.get(encoding) ?? accepted.get('*') ?? 0) > 0;
    const encoding =
      compressible && bytes.length >= 1024
        ? available('br')
          ? 'br'
          : available('gzip')
            ? 'gzip'
            : null
        : null;
    let body = bytes;
    if (encoding) {
      const key = encoding + digest;
      if (!encoded.has(key)) {
        const task =
          encoding === 'br'
            ? br(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
            : gz(bytes, { level: 6 });
        encoded.set(key, task);
        if (encoded.size > 128) encoded.delete(encoded.keys().next().value);
        task.catch(() => encoded.delete(key));
      }
      body = await encoded.get(key);
      headers['Content-Encoding'] = encoding;
    }
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  };
}
