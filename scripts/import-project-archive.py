"""Import project documentation content and workbook data without running archive code."""
from pathlib import Path
import hashlib, json, re, sys, zipfile

ROOT = Path(__file__).resolve().parents[1]
decoder = json.JSONDecoder()
def payload(text, marker):
    return decoder.raw_decode(text.split(marker, 1)[1].lstrip())[0]

archive = Path(sys.argv[1])
with zipfile.ZipFile(archive) as z:
    base = next(n for n in z.namelist() if n.endswith('/data.js')).removesuffix('data.js')
    read = lambda name: z.read(base + name).decode('utf-8-sig')
    data = payload(read('data.js'), '=')
    technical = json.loads(read('technical-content.json'))
    services, pricing, registry = [], {}, {}
    for original in data['services']:
        if original['category'] != 1: continue
        override = read('pages/service-' + original['id'] + '.js')
        service = original | decoder.raw_decode(override[override.index(',{') + 1:])[0]
        if not re.fullmatch(r'/proektnaya-dokumentatsiya/[a-z0-9-]+/', service['url']):
            raise ValueError('Unexpected project route: ' + service['url'])
        schema = data['schemas'][service['book']]
        model = payload(read(schema['file']), ']=')
        service['technical'] = technical['services'][service['id']]
        service['path'] = service['url'].strip('/') + '/'
        service['art'] = 'project-' + service['path'].split('/')[1] + '.webp'
        services.append(service)
        registry[service['id']] = {k:service[k] for k in ('id','name','path')}
        pricing[service['id']] = {'schema':schema,'book':model}
    if {s['id'] for s in services} != {f'2.{n}' for n in range(1,8)}:
        raise ValueError('Expected all seven project services')
    if hashlib.sha256(read('engine.js').encode()).hexdigest() != 'ab85aea198b84b47fc36be3583c008f6b96667448abc5a2b7000c848773f6e13':
        raise ValueError('Review changed formula engine before importing')
    content = {'source':{'file':archive.name,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
                          'technical_updated':technical['updated'],'pricing':'Customer workbook formulas in calculators/c*.js'},
               'services':services,'articles':[a for a in data['articles'] if a['category']==1]}
    (ROOT/'project-content.json').write_text(json.dumps(content,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    for file,variable,value in [('project-services.js','TEXT_PROJECT_SERVICES',registry),('project-pricing-data.js','TEXT_PROJECT_DATA',pricing)]:
        (ROOT/file).write_text('// Imported customer data; provenance in project-content.json.\n'+
                              'globalThis.'+variable+'='+json.dumps(value,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
print('Imported 7 project services, workbook formulas and technical requirements.')
