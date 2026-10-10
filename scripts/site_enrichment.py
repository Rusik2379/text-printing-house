"""Shared, static reference blocks and navigation for all existing site routes."""
from pathlib import Path
from html import escape,unescape
from html.parser import HTMLParser
import json,re

ROOT=Path(__file__).resolve().parents[1]

def icon(name):return f'<span data-icon="{name}"></span>'
def text(value):return escape(str(value),quote=True)

def technical(s,container=''):
    r=s['technical'];items=lambda values:''.join(f'<li>{text(v)}</li>' for v in values)
    check=icon('check')
    return f'''<section class="{container}section req-inline req-inline-v2" id="requirements" aria-labelledby="service-requirements-title">
<span id="service-requirements" aria-hidden="true"></span><div class="req-inline-head"><div><div class="eyebrow">Макет без переделок</div><h2 id="service-requirements-title">Технические требования<br>для «{text(s['name'])}»</h2><p>Не общий шаблон: ниже — чек-лист именно для этой услуги, с её размером, обработкой и типом файла.</p></div><div class="req-inline-links"><button class="text-button req-print-link" type="button" data-print-requirements>{icon('printer')}Печать / сохранить PDF</button><a class="text-button" href="../../requirements/#requirement-{s['id'].replace('.','-')}">Все требования →</a></div></div>
<div class="req-detail"><div class="req-detail-main"><div class="req-send"><span class="req-icon">{icon('document')}</span><div><small>Что передать</small><b>{text(r['send'])}</b></div></div>{s['schemeHtml']}<div class="req-fixed">{''.join(f'<span>{text(v)}</span>' for v in r['fixed'])}</div></div>
<div class="req-checks"><h3>Проверьте перед отправкой</h3><ul>{''.join(f'<li>{check}<span>{text(v)}</span></li>' for v in r['checks'])}</ul></div>
<aside class="req-example"><span>Пример</span><p>{text(r['example'])}</p>{f'<div class="req-note"><b>Важно</b>{text(r["note"])}</div>' if r.get('note') else ''}</aside>
<div class="req-file-spec"><span class="req-mini-icon">{icon('document')}</span><div><small>Файл и технический минимум</small><p>{text(r['fileSpec'])}</p></div></div>
<div class="req-deep-grid"><section class="req-deep-card req-deep-critical"><div class="req-deep-title">{icon('shield')}<h3>Критично</h3></div><ul>{items(r['critical'])}</ul></section><section class="req-deep-card req-deep-mistakes"><div class="req-deep-title">{icon('close')}<h3>Не делайте так</h3></div><ul>{items(r['mistakes'])}</ul></section></div>
<div class="req-preflight"><span class="req-mini-icon">{icon('check')}</span><div><small>Что проверяем перед запуском</small><p>{text(r['preflight'])}</p></div></div></div><div class="req-source-line"><span>Обновлено {text(r.get('updated','07.10.2026'))}</span><span>Параметры из калькулятора и производственных правил ТЕКСТ имеют приоритет перед общими рекомендациями.</span></div></section>'''

def geo(s,container=''):
    key='service-geo-'+s['id'].replace('.','-')
    return f'<section class="{container}geo-answer section" aria-labelledby="{key}"><div class="geo-answer-head"><div><div class="eyebrow">Коротко и по делу</div><h2 id="{key}">Ответы об услуге «{text(s["name"])}»</h2><p>Всё важное о заказе — в одном месте.</p></div><span class="geo-proof">Факты из калькулятора и условий ТЕКСТ</span></div><div class="geo-answer-grid">'+''.join(f'<article class="geo-answer-card"><span>{i:02}</span><h3>{text(a["title"])}</h3><p>{text(a["text"])}</p></article>' for i,a in enumerate(s['answers'],1))+'</div></section>'

def intent(s,container=''):
    return '<section class="intent-block'+(' container' if container else '')+'"><div><div class="eyebrow">ТЕКСТ · Барнаул</div><h2>Заказ без скрытых условий</h2><p>Цена считается по выбранной конфигурации. Самовывоз — проспект Строителей, 11; готовые тиражи можем отправить по России после согласования перевозчика и стоимости.</p></div><div class="intent-chips" aria-label="Популярные формулировки услуги">'+''.join(f'<span>{text(v)}</span>' for v in dict.fromkeys(s['terms']))+'</div></section>'

class Sections(HTMLParser):
    """Track complete section spans, including nested cards, without regex nesting."""
    def __init__(self,source):
        super().__init__(convert_charrefs=True);self.source=source;self.stack=[];self.sections=[];self.parents=[]
        self.lines=[0]
        for m in re.finditer('\n',source):self.lines.append(m.end())
        self.feed(source)
    def source_position(self):line,col=self.getpos();return self.lines[line-1]+col
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='section':self.stack.append({'start':self.source_position(),'attrs':attrs,'words':[],'in_container':any('container' in a.get('class','').split() for _,a in self.parents)})
        if tag not in ('area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'):self.parents.append((tag,attrs))
    def handle_data(self,data):
        for section in self.stack:section['words'].append(data)
    def handle_endtag(self,tag):
        if tag=='section' and self.stack:
            section=self.stack.pop();section['end']=self.source_position()+len('</section>');section['text']=' '.join(section.pop('words'));self.sections.append(section)
        for i in range(len(self.parents)-1,-1,-1):
            if self.parents[i][0]==tag:del self.parents[i:];break

def service_blocks(source,s):
    sections=Sections(source).sections
    existing=[n for n in sections if 'req-inline-v2' in n['attrs'].get('class','').split()]
    if existing:
        targets=existing+[n for n in sections if any(c in n['attrs'].get('class','').split() for c in ['geo-answer','intent-block'])]
    else:
        targets=[n for n in sections if ('wide-preparation' in n['attrs'].get('class','').split() or 'sp-requirements' in n['attrs'].get('class','').split() or 'Проверьте перед заказом' in n['text'])]
    assert targets,(s['id'],'No existing technical section')
    first=min(n['start'] for n in targets)
    container='' if next(n for n in targets if n['start']==first)['in_container'] else 'container '
    blocks=technical(s,container)+geo(s,container)
    blocks+=intent(s,container)
    # Keep section boundaries, file contents and calculator DOM independent.
    for n in sorted(targets,key=lambda n:n['start'],reverse=True):
        source=source[:n['start']]+(blocks if n['start']==first else '')+source[n['end']:]
    return source

CATEGORIES=[('Компания','company/'),('Копицентр','kopitsentr/'),('Проектная документация','proektnaya-dokumentatsiya/'),('Листовая полиграфия','listovaya-poligrafiya/'),('Наклейки и стикеры','nakleyki-i-stikery/'),('Широкий формат','shirokiy-format/'),('UV-печать и резка','uv-pechat-i-rezka/')]
def chrome(prefix):
    navigation=''.join(f'<div class="nav-group"><a class="nav-category-link" href="{prefix}{path}">{name}</a><button class="nav-item" type="button" data-menu="{name}" aria-label="Подразделы: {name}" aria-expanded="false" aria-controls="mega-menu">{icon("chevron")}</button></div>' for name,path in CATEGORIES)
    return f'''<div class="topbar"><div class="container topbar-inner chrome-topbar"><div class="chrome-location"><a href="{prefix}contacts/"><b>Барнаул</b><span>пр-т Строителей, 11</span></a><span class="chrome-hours">Пн–Пт 09:00–18:00 · Сб–Вс выходной</span></div><div class="chrome-map-links"><a href="https://yandex.ru/maps/-/CXEUYTi7" target="_blank" rel="noopener" title="Рейтинг проверен 6 октября 2026">Яндекс Карты ★ 5,0</a><a href="https://2gis.ru/barnaul/firm/70000001043200458/tab/reviews" target="_blank" rel="noopener" title="Рейтинг сохранён 4 октября 2026">2ГИС ★ 4,9</a></div><div class="chrome-contact-links"><a href="https://t.me/tekkkstos" target="_blank" rel="noopener" aria-label="Написать в Telegram"><img class="messenger-logo" src="{prefix}assets/telegram.svg" alt="" width="22" height="22"></a><a href="https://max.ru/u/f9LHodD0cOII3pfsxMqRJ6CzaCIs8OuOO5zmsR3qDGblmxnJwlsxM4WiGoY" target="_blank" rel="noopener" aria-label="Написать в MAX"><img class="messenger-logo" src="{prefix}assets/max.svg" alt="" width="22" height="22"></a><a class="topbar-phone" href="tel:+79236547896">+7 (923) 654-78-96</a></div></div></div>
<header class="site-header chrome-header" id="header"><div class="container header-main"><a class="brand" href="{prefix or './'}" aria-label="ТЕКСТ — на главную"><img src="{prefix}assets/brand-mark.webp" alt="" width="52" height="52"><span class="chrome-brand-text"><strong>ТЕКСТ</strong><small>СТУДИЯ ПЕЧАТИ</small></span></a><form class="home-search" id="home-search" role="search"><div class="home-search-field"><label for="home-search-input" class="sr-only">Найти услугу</label>{icon('search')}<input id="home-search-input" data-header-search type="search" placeholder="Что будем печатать? Найдите свою услугу" autocomplete="off" aria-controls="header-search-results" aria-expanded="false" aria-autocomplete="list" role="combobox"></div><div class="header-search-results" id="header-search-results" role="listbox" aria-label="Результаты поиска" hidden></div></form><div class="header-actions"><button type="button" class="icon-button chrome-search-toggle" data-header-search-toggle aria-label="Открыть поиск" aria-expanded="false" aria-controls="home-search">{icon('search')}</button><button class="cart-button" data-action="cart" aria-label="Открыть корзину">{icon('bag')}<span class="cart-label">Корзина</span><span class="cart-count" id="cart-count">0</span></button><button class="icon-button mobile-menu-button" id="mobile-menu-button" aria-label="Открыть меню" aria-expanded="false" aria-controls="navigation">{icon('menu')}</button></div></div><nav class="container navigation" id="navigation" aria-label="Главное меню">{navigation}</nav><div class="mega-menu" id="mega-menu" hidden></div></header>'''

def ensure_sticker_category():
    target=ROOT/'nakleyki-i-stikery/index.html'
    if target.is_file():return
    template=(ROOT/'shirokiy-format/index.html').read_text(encoding='utf8')
    services=json.loads((ROOT/'sticker-services.js').read_text(encoding='utf8').split('=',1)[1].strip().rstrip(';'))
    cards=''.join(f'<a class="featured-card" href="../{s["path"]}"><span class="featured-copy"><span class="featured-name">{text(s["name"])}</span></span><span class="featured-art"><img src="../assets/{s["hero"]}" width="1000" height="1000" alt="{text(s["name"])}" loading="lazy"></span></a>' for s in services.values())
    body='<section class="container sp-hero-section"><nav class="sp-breadcrumbs" aria-label="Хлебные крошки"><a href="../">Главная</a><span>/</span><span aria-current="page">Наклейки и стикеры</span></nav><div class="sp-section-title sp-title-left"><h1>Наклейки и стикеры в Барнауле</h1><p>Выберите форму, материал и технологию. На странице каждой услуги — калькулятор, требования к макету и ответы о заказе.</p></div></section><section class="container sp-section"><div class="featured-grid wide-category-grid">'+cards+'</div></section>'
    template=re.sub(r'<main id="main">.*?</main>',lambda _:f'<main id="main">{body}</main>',template,flags=re.S)
    template=template.replace('wide-format-page','sticker-category-page')
    target.write_text(template,encoding='utf8')

def apply_site_enrichment():
    file=ROOT/'service-enrichment.json'
    if not file.is_file():return
    data=json.loads(file.read_text(encoding='utf8'))
    ensure_sticker_category()
    for s in data['services'].values():
        file=ROOT/s['path']/'index.html';source=file.read_text(encoding='utf8')
        file.write_text(service_blocks(source,s),encoding='utf8')
    for file in sorted(ROOT.rglob('*.html')):
        if any(p.startswith('.') or p in ('preview','node_modules') for p in file.relative_to(ROOT).parts):continue
        source=file.read_text(encoding='utf8');prefix='../'*len(file.parent.relative_to(ROOT).parts)
        # The shared header includes the location strip, but preserves skip links.
        source=re.sub(r'<div class="topbar">.*?</header>',lambda _:chrome(prefix),source,count=1,flags=re.S)
        for name,tag in [('site-chrome.css','link'),('service-enrichment.css','link'),('site-chrome.js','script')]:
            source=re.sub(r'\s*<(?:link|script)\b[^>]*(?:href|src)="[^"]*'+re.escape(name)+r'(?:\?[^\"]*)?"[^>]*>(?:</script>)?','',source)
            resource=f'<link rel="stylesheet" href="{prefix}{name}">' if tag=='link' else f'<script src="{prefix}{name}" defer></script>'
            source=source.replace('</head>',resource+'\n</head>',1)
        file.write_text(source,encoding='utf8')
    print('Enriched 55 services and shared navigation on all site pages.')

if __name__=='__main__':
    apply_site_enrichment()
    from site_seo import apply_site_seo
    apply_site_seo()
