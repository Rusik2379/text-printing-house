"""Import Copy Center content and formula data; never execute archive JavaScript.

Usage: python scripts/import-copycenter-archive.py path/to/TEKST_HTML_FINAL.zip
The archive supplies content and prices, not the site's design.
"""
from pathlib import Path
import hashlib, json, re, sys, zipfile

ROOT = Path(__file__).resolve().parents[1]
decoder = json.JSONDecoder()

def payload(text, marker):
    return decoder.raw_decode(text.split(marker, 1)[1].lstrip())[0]

archive = Path(sys.argv[1])
with zipfile.ZipFile(archive) as z:
    data_path = next(n for n in z.namelist() if n.endswith('/data.js'))
    base = data_path.removesuffix('data.js')
    read = lambda name: z.read(base + name).decode('utf-8-sig')
    data = payload(read('data.js'), '=')
    technical = json.loads(read('technical-content.json'))
    services, pricing, registry = [], {}, {}
    for original in data['services']:
        if original['category'] != 0:
            continue
        override = read('pages/service-' + original['id'] + '.js')
        service = original | decoder.raw_decode(override[override.index(',{') + 1:])[0]
        if not re.fullmatch(r'/kopitsentr/[a-z0-9-]+/', service['url']):
            raise ValueError('Unexpected Copy Center route: ' + service['url'])
        schema = data['schemas'][service['book']]
        model = payload(read(schema['file']), ']=')
        service['technical'] = technical['services'][service['id']]
        service['path'] = service['url'].strip('/') + '/'
        service['art'] = 'copycenter-' + service['path'].split('/')[1] + '.webp'
        services.append(service)
        registry[service['id']] = {k: service[k] for k in ('id', 'name', 'path')}
        pricing[service['id']] = {'schema': schema, 'book': model}
    if {s['id'] for s in services} != {f'1.{n}' for n in range(1,10)}:
        raise ValueError('Expected all nine Copy Center services')
    # Workbook formula data may change on re-import; executable code needs review.
    engine_source = read('engine.js')
    if hashlib.sha256(engine_source.encode('utf-8')).hexdigest() != 'ab85aea198b84b47fc36be3583c008f6b96667448abc5a2b7000c848773f6e13':
        raise ValueError('The archive formula engine changed; review it before importing')
    content = {
        'source': {'file': archive.name, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
                   'technical_updated': technical['updated'], 'pricing': 'Customer workbook formulas in calculators/c*.js'},
        'services': services,
        'articles': [a for a in data['articles'] if a['category'] == 0],
    }
    (ROOT / 'copycenter-content.json').write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for file, variable, value in [('copycenter-services.js', 'TEXT_COPYCENTER_SERVICES', registry),
                                   ('copycenter-pricing-data.js', 'TEXT_COPYCENTER_DATA', pricing)]:
        (ROOT / file).write_text('// Imported customer data; see copycenter-content.json for provenance.\n'
                                + 'globalThis.' + variable + '=' + json.dumps(value, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    engine = engine_source.replace('global.CalcEngine=CalcEngine;global.ExcelParse=parse;',
                                    'global.TEXT_COPYCENTER_ENGINE=CalcEngine;')
    (ROOT / 'copycenter-engine.js').write_text(engine, encoding='utf-8')
print('Imported', len(services), 'Copy Center services, formulas and technical requirements.')
