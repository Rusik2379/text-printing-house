"""Read the customer's SEO data from ZIP; never run scripts from the archive."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import zipfile
from lxml import html

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('archive', type=Path)
parser.add_argument('--imported', required=True, help='Client-local import date, YYYY-MM-DD')
args = parser.parse_args()

def literal(code, prefix):
    assert code.startswith(prefix), 'Unexpected source data format'
    return json.JSONDecoder().raw_decode(code[len(prefix):])[0]

with zipfile.ZipFile(args.archive) as archive:
    data_name = next(name for name in archive.namelist() if name.endswith('/data.js'))
    prefix = data_name.removesuffix('data.js')
    data = literal(archive.read(data_name).decode('utf-8-sig'), 'window.TEKST_DATA=')
    terms = literal(archive.read(prefix + 'seo-final.js').decode('utf-8-sig'), 'window.TEKST_SEO_FINAL=')
    assert len(data['services']) == 55 and len(data['articles']) == 150
    pages = {}
    for entry in archive.infolist():
        if entry.is_dir() or not entry.filename.endswith('.html'):
            continue
        path = PurePosixPath(entry.filename)
        assert not path.is_absolute() and '..' not in path.parts
        relative = entry.filename.removeprefix(prefix)
        route = '/' if relative == 'index.html' else '/' + relative.removesuffix('index.html')
        doc = html.fromstring(archive.read(entry))
        meta = {node.get('name') or node.get('property'): node.get('content')
                for node in doc.xpath('//head/meta[@name or @property]')}
        pages[route] = {
            'title': doc.xpath('string(//title)'),
            'description': meta.get('description', ''),
            'canonical': doc.xpath('string(//link[@rel="canonical"]/@href)'),
            'robots': meta.get('robots', 'index,follow'),
            'open_graph': {key: value for key, value in meta.items() if key.startswith('og:')},
            'schema': [json.loads(node.text) for node in doc.xpath('//script[@type="application/ld+json"]')],
        }
    business = next(entity for block in pages['/']['schema'] for entity in block['@graph']
                    if entity['@type'] == 'LocalBusiness')
    # The static home block omits these fields; they are present in the source's service schema.
    service_graph = pages['/nakleyki-i-stikery/stikerpaki/']['schema'][0]['@graph']
    complete_business = next(entity for entity in service_graph if entity['@type'] == 'LocalBusiness')
    business.update(complete_business)

payload = {
    'source': {'archive': args.archive.name, 'sha256': hashlib.sha256(args.archive.read_bytes()).hexdigest(),
               'imported': args.imported, 'html_pages': len(pages), 'services': 55, 'articles': 150},
    'origin': data['origin'].rstrip('/') + '/',
    'business': business,
    'pages': pages,
    'service_search_terms': terms,
    'excluded_routes': ['/company/photo/', '/company/action/', '/company/request/'],
    'overrides': {
        '/': {'description': 'Документы, чертежи, наклейки и полиграфия в студии ТЕКСТ в Барнауле. '
                            '55 услуг, онлайн-расчёт стоимости и подготовка запроса на печать.'},
        '/company/': {'title': 'Компания ТЕКСТ — услуги и информация о студии в Барнауле',
                     'description': 'Вся информация о студии печати ТЕКСТ: производство, контакты, '
                                    'оплата и доставка, подготовка макетов, вопросы и статьи.'},
        '/company/payment/': {'description': 'Оплата заказа в студии ТЕКСТ: согласование макета и итоговой стоимости. '
                                            'Способ оплаты и реквизиты сообщаем при подтверждении заказа.'},
        '/company/vopros-otvet/': {'description': 'Ответы студии ТЕКСТ о заказе, макетах, оплате и доставке, '
                                                 'печати документов, наклейках, полиграфии и UV-печати. Барнаул, Строителей, 11.'},
        '/kak-oformit-zakaz/': {'description': 'Как оформить заказ в студии ТЕКСТ в Барнауле: выбрать услугу, '
                                             'подготовить параметры и макет, отправить запрос и согласовать печать.'},
    },
}
assert payload['origin'] == 'https://text-print.ru/'
(ROOT / 'seo-content.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Imported SEO for {len(pages)} source pages, 55 services and 150 articles.')
