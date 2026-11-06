// Parse trusted Excel formulas into positioned nodes. Admins can edit numbers,
// never formula text, references, conditions, function names or executable code.
export function parseFormula(source) {
  let p = source.startsWith('=') ? 1 : 0;
  const tokens = [];
  while (p < source.length) {
    const s = source.slice(p);
    let m, k, v;
    if (/^\s/.test(s)) {
      p++;
      continue;
    }
    if ((m = s.match(/^"((?:[^"]|"")*)"/))) {
      k = 'value';
      v = m[1].replace(/""/g, '"');
    } else if ((m = s.match(/^'((?:[^']|'')*)'/))) {
      k = 'id';
      v = m[1].replace(/''/g, "'");
    } else if ((m = s.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?/))) {
      k = 'value';
      v = Number(m[0]);
    } else if ((m = s.match(/^[\p{L}_$][\p{L}\p{N}_.$]*/u))) {
      k = 'id';
      v = m[0];
    } else if ((m = s.match(/^(<>|<=|>=|[+*/^&%=<>(),:!\-])/))) {
      k = m[0];
      v = k;
    } else throw Error('Unsupported formula token');
    tokens.push({ k, v, start: p, end: p + m[0].length });
    p += m[0].length;
  }
  let i = 0;
  const peek = () => tokens[i]?.k,
    take = (k) => {
      const t = tokens[i++];
      if (!t || (k && t.k !== k)) throw Error('Invalid formula');
      return t;
    };
  function atom() {
    if (['-', '+'].includes(peek())) {
      const op = take().k;
      return { type: 'unary', op, a: atom() };
    }
    if (peek() === '(') {
      take();
      const a = expr();
      take(')');
      return a;
    }
    const x = take();
    if (x.k === 'value') return { type: 'value', ...x };
    if (x.k !== 'id') throw Error('Invalid formula');
    if (peek() === '(') {
      take();
      const args = [];
      if (peek() !== ')') {
        do {
          if (peek() === ',') take();
          args.push(expr());
        } while (peek() === ',');
      }
      take(')');
      return { type: 'function', name: x.v.toUpperCase(), args };
    }
    let sheet = null,
      ref = x.v;
    if (peek() === '!') {
      take();
      sheet = ref;
      ref = take('id').v;
    }
    if (peek() === ':') {
      take();
      return { type: 'range', sheet, from: ref, to: take('id').v };
    }
    return { type: 'reference', sheet, ref };
  }
  const precedence = {
    '=': 1,
    '<>': 1,
    '<': 1,
    '>': 1,
    '<=': 1,
    '>=': 1,
    '&': 2,
    '+': 3,
    '-': 3,
    '*': 4,
    '/': 4,
    '^': 5,
  };
  function expr(min = 0) {
    let a = atom();
    while (peek() === '%') {
      take();
      a = { type: 'unary', op: '%', a };
    }
    while (precedence[peek()] >= min) {
      const op = take().k;
      a = { type: 'operation', op, a, b: expr(precedence[op] + 1) };
    }
    return a;
  }
  const ast = expr();
  if (i !== tokens.length) throw Error('Extra formula tokens');
  return ast;
}

export function references(ast, book, sheet) {
  const out = [];
  const visit = (a) => {
    if (a.type === 'reference') {
      if (book.names?.[a.ref]) {
        try {
          visit(parseFormula(book.names[a.ref]));
        } catch {}
      } else out.push([a.sheet || sheet, a.ref.replace(/\$/g, '')]);
    } else if (a.type === 'range') {
      const coord = (s) => {
        const m = s.replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/);
        return m && [m[1].split('').reduce((v, c) => v * 26 + c.charCodeAt(0) - 64, 0), +m[2]];
      };
      const start = coord(a.from),
        end = coord(a.to);
      if (!start || !end) return;
      for (const ref of Object.keys(book.sheets[a.sheet || sheet]?.cells || {})) {
        const c = coord(ref);
        if (c && c[0] >= start[0] && c[0] <= end[0] && c[1] >= start[1] && c[1] <= end[1])
          out.push([a.sheet || sheet, ref]);
      }
    } else if (a.type === 'function') a.args.forEach(visit);
    else if (a.type === 'operation') {
      visit(a.a);
      visit(a.b);
    } else if (a.a) visit(a.a);
  };
  visit(ast);
  return out;
}

export function tariffLiterals(ast, source) {
  const out = [];
  function walk(a, context = [], allow = false) {
    if (a.type === 'value') {
      if (typeof a.v === 'number' && a.v > 0 && allow)
        out.push({ ...a, context: context.join(' · ') });
      return;
    }
    if (a.type === 'function') {
      if (a.name === 'IF') {
        // Only branch values; comparison bounds and validation limits are immutable.
        const condition = describe(a.args[0]);
        walk(a.args[1], [...context, condition], true);
        if (a.args[2]) walk(a.args[2], [...context, 'иначе ' + condition], true);
      } else if (['ROUND', 'ROUNDUP', 'INT'].includes(a.name)) walk(a.args[0], context, allow);
      else if (['MIN', 'MAX'].includes(a.name)) a.args.forEach((x) => walk(x, context, true));
      else if (a.name === 'SUM') a.args.forEach((x) => walk(x, context, allow));
      // INDEX/MATCH offsets, SUMIFS criteria, dimension conversions stay fixed.
      return;
    }
    if (a.type === 'operation') {
      if (['=', '<>', '<', '>', '<=', '>=', '&', '^'].includes(a.op)) return;
      walk(a.a, context, allow);
      // Decimal multipliers encode monetary coefficients. Integer multipliers
      // and divisors usually represent sheet counts or mm² → m² conversions.
      walk(
        a.b,
        context,
        a.op === '*' && a.b.type === 'value' && a.b.v !== Math.trunc(a.b.v) && a.b.v < 10,
      );
    } else if (a.a) walk(a.a, context, false);
  }
  function describe(a) {
    if (a.type === 'value') return typeof a.v === 'string' ? a.v : String(a.v);
    if (a.type === 'reference') return a.ref.replace(/\$/g, '');
    if (a.type === 'operation') return `${describe(a.a)} ${a.op} ${describe(a.b)}`;
    if (a.type === 'function') return a.args.map(describe).join(a.name === 'AND' ? ' и ' : ' / ');
    return '';
  }
  walk(ast, [], ast.type === 'value');
  return out.map((x) => ({ ...x, original: source.slice(x.start, x.end) }));
}
