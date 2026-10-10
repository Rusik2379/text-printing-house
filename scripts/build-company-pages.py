"""Build static company pages from company-content.json and the shared homepage.

Python standard library only; original ZIP/XLSX is needed only for a fresh import.
"""
from pathlib import Path
from html import escape, unescape
import json, re, math, hashlib
from urllib.parse import quote, unquote, urlsplit, urlunsplit, parse_qsl, urlencode
from company_requirements_diagrams import diagram

ROOT = Path(__file__).resolve().parents[1]
SOURCE=json.loads((ROOT/'company-content.json').read_text(encoding='utf-8'))
FAQ_SOURCE=json.loads((ROOT/'company-faq.json').read_text(encoding='utf-8'))
PAGES = [
    ('О нас','company/about/','О студии, производстве и нашем подходе к работе'),
    ('Контакты','contacts/','Адрес, график работы и удобные способы связи'),
    ('Доставка','dostavka-i-oplata/','Самовывоз, отправка и расчёт у перевозчиков'),
    ('Оплата','company/payment/','Согласование заказа, способ оплаты и документы'),
    ('Технические требования','requirements/','Подготовьте файл к печати и обработке'),
    ('Вопросы и ответы','company/vopros-otvet/','Ответы о заказе, файлах, оплате и получении'),
    ('Статьи','company/article/','Практические материалы о печати и макетах'),
    ('Как заказать','kak-oformit-zakaz/','Порядок оформления, отправки файлов и подтверждения'),
]
LEGAL_PAGES = [
    ('Конфиденциальность','company/privacy/','Как студия использует и защищает данные'),
    ('Согласие на обработку данных','company/personal-data-consent/','Отдельное согласие для обращения и заказа'),
    ('Политика cookies','company/cookies/','Необходимые данные и выбор аналитики'),
    ('Лицензии шрифтов','company/font-license/','Сведения о шрифтах и тексты лицензий'),
]
CATEGORIES = [
    ('Копицентр','popular-art-печать документов',8),('Проектная документация','popular-art-инженерная печать',17),
    ('Листовая полиграфия','popular-art-визитки',26),('Наклейки и стикеры','popular-art-стикерпаки',37),
    ('Широкий формат','popular-art-накатка на пвх',44),('UV-печать и резка','popular-art-прямая уф печать',50),
]
home = (ROOT/'index.html').read_text(encoding='utf-8')

def links(prefix):
    return ''.join(f'<a href="{prefix}{path}">{label}</a>' for label,path,_ in PAGES)

def legal_footer(prefix):
    return '<div class="container footer-legal" data-legal-links>'+''.join(f'<a href="{prefix}{path}">{label}</a>' for label,path,_ in LEGAL_PAGES)+'<button type="button" data-cookie-settings>Настройки cookies</button></div>'

def cookie_banner(prefix):
    return f'''<aside id="cookie-banner" class="cookie-banner" role="region" aria-labelledby="cookie-title" hidden>
      <div class="cookie-copy"><h2 id="cookie-title">Cookies и данные сайта</h2><p>Сохраняем корзину и настройки в браузере. Аналитические cookies помогают улучшать сайт и включаются только с вашего согласия. <a href="{prefix}company/cookies/">Подробнее о cookies</a></p><p class="cookie-current" data-cookie-current hidden></p></div>
      <div class="cookie-actions"><button class="button button-white" type="button" data-cookie-choice="necessary">Только необходимые</button><button class="button button-primary" type="button" data-cookie-choice="analytics">Принять cookies</button></div>
    </aside>'''

# Keep the homepage and all product pages connected to the same company section.
product_pages=[(str(file.relative_to(ROOT)),'../'*len(file.relative_to(ROOT).parent.parts)) for file in sorted([*(ROOT/'nakleyki-i-stikery').rglob('index.html'),*(ROOT/'kopitsentr').rglob('index.html'),*(ROOT/'proektnaya-dokumentatsiya').rglob('index.html'),*(ROOT/'listovaya-poligrafiya').rglob('index.html'),*(ROOT/'uv-pechat-i-rezka').rglob('index.html'),*(ROOT/'shirokiy-format').rglob('index.html')])]
for relative,prefix in [('index.html',''),*product_pages]:
    file=ROOT/relative
    newline='\r\n' if b'\r\n' in file.read_bytes() else '\n'
    text=file.read_text(encoding='utf-8')
    for registry in ['project-services','leaflet-services','uv-services','wide-format-services','wide-format-pricing']:
        text=re.sub(r'\s*<script src="[^"]*'+registry+r'\.js(?:\?[^"]*)?" defer></script>','',text)
        text=re.sub(r'(<script src="[^"]*app\.js(?:\?[^"]*)?" defer></script>)',lambda m:f'<script src="{prefix}{registry}.js" defer></script>\n  '+m[1],text,count=1)
    text=re.sub(r'(<div class="footer-links" id="footer-services">).*?(</div>)',lambda m:m[1]+f'<a href="{prefix}kopitsentr/">Копицентр</a><a href="{prefix}proektnaya-dokumentatsiya/">Проектная документация</a><a href="{prefix}listovaya-poligrafiya/">Листовая полиграфия</a><a href="{prefix}uv-pechat-i-rezka/">UV-печать и резка</a><a href="{prefix}shirokiy-format/">Широкий формат</a>'+m[2],text,count=1,flags=re.S)
    text=re.sub(r'(<h3>Компания</h3>)<div class="footer-links"[^>]*>.*?</div>',
                lambda match:match[1]+f'<div class="footer-links" data-company-links>{links(prefix)}</div>',text,count=1,flags=re.S)
    for asset,tag in [('consent.css',f'<link rel="stylesheet" href="{prefix}consent.css">'),('consent.js',f'<script src="{prefix}consent.js" defer></script>'),('cart.css',f'<link rel="stylesheet" href="{prefix}cart.css">'),('cart-pdf.js',f'<script src="{prefix}cart-pdf.js" defer></script>'),('cart-xlsx.js',f'<script src="{prefix}cart-xlsx.js" defer></script>'),('project-services.js',f'<script src="{prefix}project-services.js" defer></script>')]:
        if not re.search(r'(?:href|src)="[^"]*'+re.escape(asset)+r'(?:\?[^\"]*)?"',text):text=text.replace('</head>',tag+'\n</head>',1)
    text=re.sub(r'<div class="container footer-legal" data-legal-links>.*?</div>','',text,flags=re.S)
    text=text.replace('<div class="container footer-bottom">',legal_footer(prefix)+'<div class="container footer-bottom">',1)
    text=text.replace('href="https://text-print.ru/pk/"',f'href="{prefix}company/privacy/"')
    text=re.sub(r'\s*<aside id="cookie-banner".*?</aside>\s*','\n',text,flags=re.S)
    text=text.replace('</body>',cookie_banner(prefix)+'\n</body>',1)
    credit=f'<div class="footer-credit"><div class="footer-credit-copy"><span>Сделано «Сибирь Софт»</span><span>Поддерживается с 2026 года</span></div><a class="footer-credit-logo" href="https://sibsoft-it.ru/" target="_blank" rel="noopener" aria-label="Сибирь Софт — разработка и поддержка сайта"><img src="{prefix}assets/sibsoft-logo.png" alt="Сибирь Софт" width="848" height="1264" loading="lazy"></a></div>'
    text=re.sub(r'<a class="footer-credit"[^>]*>.*?</a>|<div class="footer-credit">.*?</a></div>|<span>Сделано с <span class="footer-heart">♥</span> в Барнауле</span>',lambda _:credit,text,count=1,flags=re.S)
    file.write_text(text,encoding='utf-8',newline=newline)
home=(ROOT/'index.html').read_text(encoding='utf-8')
header=home[home.index('  <a class="skip-link"'):home.index('  <main id="main">')]
footer=home[home.index('  <footer'):home.index('</body>')]
head=home[home.index('<head>')+6:home.index('</head>')]
head=re.sub(r'\s*<script\b[^>]*id="site-schema"[^>]*>.*?</script>', '', head, flags=re.S)

def icon(name):return f'<span data-icon="{name}"></span>'
def plain(value):return re.sub(r'\s+',' ',unescape(re.sub('<[^>]+>',' ',value))).strip()
def root_paths(text,prefix):
    # Homepage-relative resources and company links become page-relative.
    return re.sub(r'(href|src)="([^"#]+)"',lambda m:m[0] if re.match(r'^[a-z]+:|^//',m[2]) else f'{m[1]}="{prefix}{m[2]}"',text)

def cta(prefix,title='Давайте обсудим вашу задачу',text='Расскажите, что хотите напечатать. Поможем с выбором и подготовкой заказа.'):
    return f'<aside class="company-cta"><div><h2>{title}</h2><p>{text}</p></div><div class="company-actions"><a class="company-phone" href="tel:+79236547896">{icon("phone")}+7 (923) 654-78-96</a><button class="button button-primary" data-action="contacts">Написать нам {icon("arrow")}</button></div></aside>'

def section(title,body,intro='',extra=''):
    return f'<section class="company-section" {extra}><div class="company-section-heading"><h2>{title}</h2></div>{f"<p class=\"company-section-intro\">{intro}</p>" if intro else ""}{body}</section>'

def card(title,text,ico='check',extra=''):
    return f'<article class="company-card {extra}">{icon(ico)}<h3>{title}</h3><p>{text}</p></article>'

def faq(items,filterable=False):
    cards=''.join(f'<details{f" data-filter-item data-category=\"{escape(cat)}\"" if filterable else ""}><summary>{q}{icon("plus")}</summary><p>{answer}</p></details>' for cat,q,answer in items)
    return f'<div class="company-faq faq-list"{ " data-filter-list" if filterable else ""}>{cards}</div>'

def filters(names,article=False,requirements=False):
    label='Поиск по статьям' if article else 'Поиск по требованиям' if requirements else 'Поиск по вопросам'
    placeholder='Найти статью…' if article else 'Найти услугу…' if requirements else 'Найти ответ…'
    return f'<label class="company-search">{icon("search")}<span class="sr-only">{label}</span><input type="search" data-company-search placeholder="{placeholder}"></label><div class="company-filter" aria-label="Темы">'+''.join(f'<button type="button" data-company-filter="{escape(value)}" aria-pressed="{str(i==0).lower()}">{label}</button>' for i,(value,label) in enumerate([('all','Все темы')]+[(n,n) for n in names]))+'</div><p class="company-results" data-results-status role="status" aria-live="polite"></p>'

def empty():return '<p class="company-empty" data-empty-results hidden>Попробуйте другой запрос или выберите «Все темы». Если нужна помощь, напишите нам.</p>'

def build(path,title,intro,art,body,actions=None,schema_type='WebPage',seo=None):
    prefix='../'*len(Path(path).parts)
    page_body=body(prefix)
    page_head=root_paths(head,prefix)
    seo=seo or {}
    page_head=re.sub(r'<title>.*?</title>',lambda _:f'<title>{escape(seo.get("title",plain(title)+" | ТЕКСТ"))}</title>',page_head)
    page_head=re.sub(r'<meta name="description"[^>]+>',lambda _:f'<meta name="description" content="{escape(seo.get("description",plain(intro)),quote=True)}">',page_head)
    url='https://text-print.ru/'+path
    crumbs=[{'@type':'ListItem','position':1,'name':'Главная','item':'https://text-print.ru/'},{'@type':'ListItem','position':2,'name':'Компания','item':'https://text-print.ru/company/'}]
    article=path.startswith('company/article/') and path!='company/article/'
    if article:crumbs.append({'@type':'ListItem','position':3,'name':'Статьи','item':'https://text-print.ru/company/article/'})
    if path!='company/':crumbs.append({'@type':'ListItem','position':len(crumbs)+1,'name':plain(title),'item':url})
    entity={'@type':schema_type,'name':plain(title),'url':url}
    if article:
        entity.update({'headline':plain(title),'author':{'@type':'Organization','name':'Студия печати ТЕКСТ'},'datePublished':seo['published'],'dateModified':seo['updated'],'inLanguage':'ru'})
        entity['image']=['https://text-print.ru/assets/'+quote(seo['image'])]
    schema={'@context':'https://schema.org','@graph':[entity,{'@type':'BreadcrumbList','itemListElement':crumbs}]}
    if path=='company/vopros-otvet/':
        questions=re.findall(r'<details\b[^>]*data-question-id="[^"]+"[^>]*><summary>(.*?)</summary>(.*?)</details>',page_body,re.S)
        entity['mainEntity']=[{'@type':'Question','name':plain(q),'acceptedAnswer':{'@type':'Answer','text':plain(answer)}} for q,answer in questions]
    if path in ('contacts/','dostavka-i-oplata/','company/payment/','requirements/'):
        questions=re.findall(r'<details><summary>(.*?)</summary><p>(.*?)</p></details>',page_body,re.S)
        schema['@graph'].append({'@type':'FAQPage','mainEntity':[{'@type':'Question','name':plain(q),'acceptedAnswer':{'@type':'Answer','text':plain(answer)}} for q,answer in questions]})
    page_head+=f'  <link rel="canonical" href="{url}">\n  <link rel="stylesheet" href="{prefix}company-pages.css">\n  <script src="{prefix}company-pages.js" defer></script>\n  <script type="application/ld+json">{json.dumps(schema,ensure_ascii=False).replace("</","<\\/")}</script>\n'
    page_header=root_paths(header,prefix).replace('class="brand" href="#main"',f'class="brand" href="{prefix}"')
    page_footer=root_paths(footer,prefix).replace('class="brand" href="#main"',f'class="brand" href="{prefix}"')
    breadcrumb=f'<nav class="company-breadcrumbs" aria-label="Хлебные крошки"><a href="{prefix}">Главная</a><span aria-hidden="true">/</span><a href="{prefix}company/">Компания</a>'+(f'<span aria-hidden="true">/</span><span aria-current="page">{next((l for l,p,_ in PAGES if p==path),"Статья" if article else plain(title))}</span>' if path!='company/' else '')+'</nav>'
    if article:breadcrumb=breadcrumb.replace('<span aria-current="page">Статья</span>',f'<a href="../">Статьи</a><span aria-hidden="true">/</span><span aria-current="page">Статья</span>')
    actions=actions or '<button class="button button-primary" data-action="contacts">Обсудить заказ '+icon('arrow')+'</button><button class="button button-white" data-action="catalog">Наши услуги</button>'
    art_html=f'<div class="company-art"><img src="{prefix}assets/{art}" alt="Робот студии ТЕКСТ — {escape(plain(title))}" width="900" height="900" fetchpriority="high"></div>' if art else ''
    hero=f'<section class="company-hero{" company-hero-text" if not art else ""}" aria-labelledby="company-title"><div><h1 id="company-title">{title}</h1><p>{intro}</p><div class="company-actions">{actions}</div></div>{art_html}</section>'
    if article:
        hero=f'<section class="article-heading" aria-labelledby="company-title"><div class="article-heading-meta"><span>{escape(seo["category"])}</span><span>{icon("document")} {seo["minutes"]} мин чтения</span></div><h1 id="company-title">{title}</h1><p>{intro}</p><a class="article-back" href="../">{icon("arrow")} Все статьи</a></section>'
    page_class='company-page'+(' company-article-page' if article else ' company-articles-page' if path=='company/article/' else ' company-legal-page' if not art else {'company/about/':' company-about-page','contacts/':' company-contacts-page','dostavka-i-oplata/':' company-delivery-page','company/payment/':' company-payment-page','requirements/':' company-requirements-page','company/vopros-otvet/':' company-questions-page'}.get(path,''))
    output=f'<!doctype html>\n<html lang="ru"><head>{page_head}</head><body class="{page_class}">\n{page_header}<main id="main"><div class="container">{breadcrumb}{hero}{page_body}</div></main>\n{page_footer}</body></html>\n'
    target=ROOT/path/'index.html';target.parent.mkdir(parents=True,exist_ok=True);target.write_text(output,encoding='utf-8')

# Content and routes are imported once; rebuilding does not need the customer files.
catalog_text=(ROOT/'catalog.js').read_text(encoding='utf-8')
CATALOG=json.loads(catalog_text[catalog_text.index('['):catalog_text.rindex(']')+1])
SERVICES={s['url']:s for s in CATALOG}
ARTICLES=sorted(SOURCE['articles'],key=lambda a:a['id'])
TOPICS=[c[0] for c in CATEGORIES]+['Заказ и подготовка макетов']
ASSETS={name:asset for name,asset,_ in CATEGORIES}|{'Заказ и подготовка макетов':'company-requirements'}
SOURCE_ROUTES={
    '/company/':'company/about/','/company/contacts/':'contacts/',
    '/company/delivery/':'dostavka-i-oplata/','/company/payment/':'company/payment/',
    '/company/requirements/':'requirements/','/company/articles/':'company/article/',
    '/company/vopros-otvet/':'company/vopros-otvet/',
    '/kak-oformit-zakaz/':'kak-oformit-zakaz/',
    **{'/'+path:path for _,path,_ in LEGAL_PAGES},
    '/fonts/Manrope-OFL.txt':'fonts/Manrope-OFL.txt','/fonts/PlayfairDisplay-OFL.txt':'fonts/PlayfairDisplay-OFL.txt',
    **{a['source_route']:a['path'] for a in ARTICLES},
}
CATEGORY_ROUTES=dict(zip(['/kopitsentr/','/proektnaya-dokumentatsiya/','/listovaya-poligrafiya/',
                         '/nakleyki-i-stikery/','/shirokiy-format/','/uv-pechat-i-rezka/'],TOPICS[:6]))

def service_url(service,prefix):
    route=service['url'].strip('/')+'/'
    return prefix+route if (ROOT/route/'index.html').is_file() else prefix+'?service='+service['id']

def resolve_route(route,prefix):
    if route in SOURCE_ROUTES:return prefix+SOURCE_ROUTES[route]
    if route in SERVICES:return service_url(SERVICES[route],prefix)
    if route in CATEGORY_ROUTES:return prefix+route.strip('/')+'/' if (ROOT/route.strip('/')/'index.html').is_file() else prefix+'?category='+quote(CATEGORY_ROUTES[route])
    if route=='/':return prefix+'?catalog=1'
    raise ValueError('Missing local destination for '+route)

# Adapt only instructions about the source site's UI to the actual shared cart.
# PDF requirements for printing files remain intact.
COPY_ADAPTATIONS={
    'Каждая услуга имеет свой калькулятор.':'Для копицентра, проектной документации, листовой полиграфии, наклеек, UV-печати и резки доступны онлайн-калькуляторы; параметры остальных услуг согласуем со студией.',
    'Это описание текущей версии сайта. Возможности отправки могут расшириться: следите за обновлениями.':'После отправки письма студия проверит файлы и подтвердит заказ.',
    'Расчёт можно редактировать в корзине.':'Расчёты копицентра, проектной документации, листовой полиграфии, наклеек, UV-печати и резки можно изменить из корзины. Для остальных позиций при необходимости добавьте новый расчёт.',
    'Скачайте или распечатайте перед отправкой.':'Скачайте расчёт или запрос перед отправкой.',
    'В расчёт попадают их названия.':'В расчёт попадают их названия.',
    'Выбрать услугу [/]':'Выбрать услугу',
}

def adapt(value):
    for before,after in COPY_ADAPTATIONS.items():value=value.replace(before,after)
    return value

def render_source(value,prefix):
    value=adapt(value)
    value=re.sub(r'href="SOURCE:([^"]+)"',lambda m:'href="'+escape(resolve_route(unescape(m[1]),prefix),quote=True)+'"',value)
    value=re.sub(r'<a href="(https://[^"]+)"',r'<a href="\1" target="_blank" rel="noopener"',value)
    assert 'SOURCE:' not in value
    return value

def source_page(name):return SOURCE['pages']['company/'+name+'/index.html'] if name else SOURCE['pages']['company/index.html']
def paragraphs(name):return [s['text'] for s in source_page(name)['sections'] if s['tag']=='p' and s['text']]
def page_seo(name,description=None):
    page=source_page(name)
    return {'title':page['seo_title'],'description':description or page['description']}
def note(text):return '<div class="company-note">'+icon('info')+'<div>'+text+'</div></div>'
def direction_cards(prefix):
    descriptions=['Документы, фотографии, ламинирование и переплёт','Чертежи, проекты, фальцовка и готовые альбомы',
                  'Визитки, листовки, буклеты и каталоги','Этикетки, фигурные наклейки и готовые наборы',
                  'Баннеры, постеры, плёнка и печать на холсте','Печать на материалах, таблички и изделия с резкой']
    return '<div class="featured-grid company-direction-grid">'+''.join(
        f'<a class="featured-card" href="?category={quote(name)}" data-action="catalog" data-category="{escape(name,quote=True)}" aria-label="{escape(name,quote=True)} — посмотреть услуги"><span class="featured-copy"><span class="featured-name">'+
        ' '.join(f'<span class="featured-word">{escape(word)}</span>' for word in name.split())+
        f'</span><span class="company-direction-description">{escape(desc)}</span><span class="company-direction-link">Смотреть услуги →</span></span><span class="featured-art"><img src="{prefix}assets/{asset}.webp" alt="" width="900" height="900" loading="lazy"></span></a>'
        for (name,asset,_),desc in zip(CATEGORIES,descriptions))+'</div>'

def about(prefix):
    trust='<div class="company-about-facts">'+''.join(f'<article class="company-about-fact">{icon(i)}<div><h2>{title}</h2><p>{text}</p></div></article>' for i,title,text in [
        ('printer','Собственное производство','Печать и обработка в нашей студии'),('pin','Барнаул','Проспект Строителей, 11'),('truck','Отправка по России','Перевозчика и стоимость согласуем')])+'</div>'
    production=paragraphs('')[1:]
    machines='<div class="company-grid four">'+''.join(card(label,escape(text),ico,'company-equipment') for label,text,ico in zip(
        ['Цифровая печать','УФ-печать','Широкий формат','Чертежи и резка'],production,['printer','layers','wide','scissors']))+'</div>'
    story='<div class="company-story company-about-story"><div><h3>Печатаем для бизнеса<br>и ваших идей</h3><p>'+escape(paragraphs('')[0])+'</p></div><div><h3>Согласуем детали<br>до производства</h3><p>Обсудим параметры, проверим макет и подтвердим стоимость. Готовую продукцию можно забрать в студии или получить с доставкой.</p></div></div>'
    steps='<div class="company-grid four">'+''.join(f'<article class="company-step"><span class="company-step-number">0{n}</span><h3>{title}</h3><p>{text}</p></article>' for n,title,text in [
        (1,'Расскажите о задаче','Пришлите файл, размер, материал и тираж.'),(2,'Согласуем детали','Проверим макет, уточним стоимость, оплату и получение.'),
        (3,'Изготовим заказ','Производственный срок начинается после согласования макета.'),(4,'Передадим вам','Самовывоз на Строителей, 11 или отправка перевозчиком.')])+'</div>'
    clients=re.search(r'<section class="container lower-section clients-section".*?</section>',home,re.S)
    client_section=root_paths(clients[0],prefix).replace('class="container lower-section clients-section"','class="company-section clients-section"') if clients else ''
    shortfaq=faq([('','Где находится студия?',f'Барнаул, проспект Строителей, 11. Пн–пт 09:00–18:00. <a href="{prefix}contacts/">Контакты и карта</a>.'),
                  ('','Можно ли оформить заказ удалённо?','Да. Отправьте параметры и макет на почту, в Telegram или MAX. Согласуем детали и получение.'),
                  ('','Как подготовить файл?',f'Посмотрите <a href="{prefix}requirements/">требования к выбранной услуге</a>. Если нужна помощь, напишите нам.'),
                  ('','Когда начинается срок изготовления?','После полного согласования макета. Срок считается в рабочих днях. Работаем с понедельника по пятницу с 09:00 до 18:00.')]).replace('company-faq faq-list','faq-list')
    questions='<section class="company-section company-about-faq lower-home home-faq-section"><h2>Частые вопросы</h2><div class="home-faq-stage"><div class="home-faq-content">'+shortfaq+f'</div><img class="faq-mascot" src="{prefix}assets/faq-peeking-robot.webp" alt="Робот ТЕКСТ держится за край карточек с вопросами" width="1166" height="1349" loading="lazy"></div><aside class="faq-help"><div><h3>Не нашли ответ?</h3><p>Позвоните нам или напишите — поможем разобраться с вашим заказом.</p></div><div class="faq-help-actions"><a href="tel:+79236547896">{icon("phone")}+7 (923) 654-78-96</a><button class="button button-primary" data-action="contacts">Задать вопрос</button></div></aside></section>'
    return trust+section('Больше, чем <span class="company-accent">печать</span>',story)+section('Всё, что нужно вашим идеям',direction_cards(prefix))+section('Наше производство',machines)+section('От идеи до готового заказа',steps)+client_section+questions

MAPS=[('Яндекс Карты','https://yandex.ru/maps/-/CXEUYTi7'),('2ГИС','https://2gis.ru/barnaul/firm/70000001043200458'),('Google Карты','https://maps.app.goo.gl/ZmEnRcK45HJikqRp7')]
def contacts(prefix):
    visit=f'''<div class="contacts-visit-card">
      <div class="contacts-address-heading"><span class="contacts-address-icon">{icon('pin')}</span><div><p>Студия печати ТЕКСТ</p><h3>Барнаул,<br>проспект Строителей, 11</h3></div></div>
      <div class="contacts-copy-row"><button class="contacts-copy-address" type="button" data-copy-contacts-address="Барнаул, проспект Строителей, 11">{icon('copy')}<span>Скопировать адрес</span></button><span class="contacts-copy-status" data-contact-copy-status role="status" aria-live="polite"></span></div>
      <div class="contacts-hours"><h4>{icon('clock')}График работы</h4><div><span>Понедельник — пятница</span><strong>09:00–18:00</strong></div><div><span>Суббота и воскресенье</span><strong>Выходные</strong></div></div>
      <div class="contacts-pickup-note">{icon('bag')}<div><h4>За готовым заказом</h4><p>Перед поездкой уточните готовность заказа — поможем выбрать время получения.</p></div></div>
      <a class="button button-primary contacts-visit-call" href="tel:+79236547896">{icon('phone')}+7 (923) 654-78-96</a>
    </div>'''
    routes=''.join(f'<a class="contacts-map-link" href="{url}" target="_blank" rel="noopener">{label}{icon("arrow")}</a>' for label,url in MAPS)
    mapbox='<div class="company-map contacts-map"><iframe title="Студия ТЕКСТ на Яндекс Картах — проспект Строителей, 11" src="https://yandex.ru/map-widget/v1/?ol=biz&amp;oid=230216768273&amp;z=17" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe><div class="contacts-map-footer"><h3>Как добраться?</h3><p>Откройте удобные карты и постройте маршрут до студии.</p><nav class="contacts-map-links" aria-label="Построить маршрут до студии">'+routes+'</nav></div></div>'
    location=section('Заглядывайте в студию','<div class="company-info-layout contacts-location-layout">'+visit+mapbox+'</div>',extra='id="contacts-location"')
    channels=[('telegram','Telegram','Отправьте макет, задайте вопрос или обсудите идею.','Открыть чат','https://t.me/tekkkstos'),
              ('max','MAX','Обсудите детали заказа в привычном мессенджере.','Открыть чат','https://max.ru/u/f9LHodD0cOII3pfsxMqRJ6CzaCIs8OuOO5zmsR3qDGblmxnJwlsxM4WiGoY'),
              ('mail','Электронная почта','Приложите файлы и опишите, что нужно напечатать.','tekkkst@yandex.ru','mailto:tekkkst@yandex.ru'),
              ('phone','Позвоните нам','Уточните параметры, стоимость или готовность заказа.','+7 (923) 654-78-96','tel:+79236547896')]
    cards=[]
    for key,label,desc,action,url in channels:
        social=f' data-social="{key}" target="_blank" rel="noopener"' if key in ('telegram','max') else ''
        mark=f'<img src="{prefix}assets/{key}.svg" alt="" width="64" height="64">' if social else icon(key)
        cards.append(f'<a class="contacts-channel contacts-channel-{key}" href="{url}"{social}><span class="contacts-channel-icon">{mark}</span><div class="contacts-channel-copy"><h3>{label}</h3><p>{desc}</p><span class="contacts-channel-action">{action}{icon("arrow")}</span></div></a>')
    ways=section('Напишите нам удобным способом','<div class="contacts-channel-grid">'+''.join(cards)+'</div>','Для расчёта укажите услугу, размер, материал и тираж. Макет можно отправить в мессенджер или на почту.',extra='id="contacts-channels"')
    items=[('','Нужно ли приезжать, чтобы оформить заказ?','Нет. Пришлите макет и параметры на почту, в Telegram или MAX. Согласуем детали, стоимость и получение заказа удалённо.'),
           ('','Куда отправить макет?','Напишите на <a href="mailto:tekkkst@yandex.ru">tekkkst@yandex.ru</a> или отправьте файл в Telegram или MAX. Если открываете письмо через сайт, приложите файлы к письму вручную.'),
           ('','Что указать в сообщении?','Название услуги, размер, материал и тираж. Если есть готовый макет, приложите его. Требования к файлам собраны <a href="'+prefix+'requirements/">на отдельной странице</a>.'),
           ('','Когда можно забрать готовый заказ?','В студии по адресу: Барнаул, проспект Строителей, 11, с понедельника по пятницу с 09:00 до 18:00. Перед поездкой уточните готовность по телефону <a href="tel:+79236547896">+7 (923) 654-78-96</a>.'),
           ('','Работаете ли вы по выходным?','Суббота и воскресенье — выходные. Обычный график студии: понедельник — пятница, 09:00–18:00.'),
           ('','Можно ли получить заказ с доставкой?','Да. Адрес, перевозчика и стоимость доставки согласуем отдельно. Посмотрите <a href="'+prefix+'dostavka-i-oplata/">варианты получения заказа</a>.')]
    questions='<section class="company-section company-contacts-faq lower-home home-faq-section" aria-labelledby="contacts-faq-title"><h2 id="contacts-faq-title">Частые вопросы</h2><div class="home-faq-stage"><div class="home-faq-content">'+faq(items).replace('company-faq faq-list','faq-list')+f'</div><img class="faq-mascot" src="{prefix}assets/faq-peeking-robot.webp" alt="Робот ТЕКСТ держится за край карточек с вопросами" width="1166" height="1349" loading="lazy"></div></section>'
    documents=json.loads((ROOT/'business-documents.json').read_text(encoding='utf-8'))['documents']
    files='<div class="contacts-documents-grid">'+''.join(f'<a class="contacts-document" href="{prefix}{item["path"]}" download><span class="contacts-document-icon">{icon("document")}<small>PDF</small></span><div class="contacts-document-copy"><h3>{escape(item["name"])}</h3><p>{escape(item["description"])}</p><span class="contacts-document-size">PDF · {round(item["bytes"]/1024)} КБ</span></div><span class="contacts-document-download" aria-hidden="true">{icon("download")}</span></a>' for item in documents)+'</div>'
    paperwork=section('Фирменные документы',files,'Реквизиты, презентация студии и бланки для деловой переписки. Выберите документ, чтобы скачать PDF.',extra='id="contacts-documents"')
    return location+ways+paperwork+questions+cta(prefix,'Остались вопросы?','Позвоните или напишите — поможем разобраться с вашим заказом.')

def delivery(prefix):
    page=source_page('delivery')
    ways=f'''<div class="company-grid two delivery-ways">
      <article class="company-card delivery-way"><span class="delivery-way-icon">{icon('pin')}</span><span class="delivery-eyebrow">Самовывоз</span><h3>Забрать в студии</h3><p class="delivery-address">Барнаул, проспект Строителей, 11</p><p>Понедельник — пятница: <strong>09:00–18:00</strong><br>Суббота и воскресенье — выходные.</p><a class="delivery-text-link" href="{prefix}contacts/">Карта и контакты {icon('arrow')}</a></article>
      <article class="company-card delivery-way"><span class="delivery-way-icon"><img src="{prefix}assets/delivery-truck-icon.png" alt="" width="1254" height="1254" loading="lazy"></span><span class="delivery-eyebrow">Отправка по России</span><h3>Передадим перевозчику</h3><p>Место отправления: <strong>Барнаул, проспект Строителей, 11</strong>. В калькуляторе перевозчика выберите <strong>забор груза курьером от нашего адреса</strong>.</p><button class="delivery-text-link" type="button" data-action="contacts">Согласовать доставку {icon('arrow')}</button></article>
    </div>'''
    names=[s['text'] for s in page['sections'] if s['tag']=='h3'][2:]
    assert len(names)==len(page['links'])==4
    logos={'ПЭК':('pek','svg',130,33),'СДЭК':('cdek','svg',99,27),'Деловые Линии':('delovye-linii','png',512,249),'Энергия':('energia','svg',1064,335)}
    assert set(names)==set(logos)
    carriers='<div class="company-grid four delivery-carriers">'+''.join(
        f'<a class="company-card company-carrier" href="{escape(link["url"].split("?utm_referrer")[0],quote=True)}" target="_blank" rel="noopener"><div class="carrier-logo carrier-logo-{logos[name][0]}"><img src="{prefix}assets/carrier-{logos[name][0]}.{logos[name][1]}" alt="" width="{logos[name][2]}" height="{logos[name][3]}" loading="lazy"></div><h3>{escape(name)}</h3><span>Рассчитать доставку {icon("arrow")}</span></a>'
        for name,link in zip(names,page['links']))+'</div>'
    table='<div class="company-table-wrap delivery-capacity"><table class="company-table"><caption class="sr-only">Объём изготовления за один рабочий день после полного согласования макета</caption><thead><tr><th scope="col">Направление</th><th scope="col">За один рабочий день</th></tr></thead><tbody>'+''.join(
        f'<tr><th scope="row">{escape(item["name"])}</th><td>До <strong>{format(item["amount"],",").replace(","," ")} ₽</strong></td></tr>'
        for item in page['production_capacity'])+'</tbody></table></div>'
    timing='<div class="company-grid two delivery-timing">'+card('Если заказ больше дневного объёма','Делим сумму заказа на дневной объём раздела и округляем вверх. Например, 12 000 ₽ в копицентре ÷ 10 000 ₽ = 1,2 → <strong>2 рабочих дня</strong>.','calculator')+card('Если услуг несколько','Считаем срок по сумме внутри каждого направления. Для всего заказа берём <strong>самый длительный</strong> из этих сроков.','layers')+'</div>'
    items=[('','Где и когда можно забрать заказ?',f'Барнаул, проспект Строителей, 11. Понедельник — пятница, 09:00–18:00. Суббота и воскресенье — выходные. <a href="{prefix}contacts/">Посмотреть карту и контакты</a>.'),
           ('','Доставка входит в стоимость печати?','Нет. Способ, срок, адрес получения и стоимость доставки согласуем отдельно, до запуска заказа.'),
           ('','Какими компаниями можно отправить заказ?','ПЭК, СДЭК, Деловые Линии и Энергия. Ссылки на их официальные калькуляторы находятся выше.'),
           ('','Какое место отправления указать?', 'Барнаул, проспект Строителей, 11. В калькуляторе перевозчика выбирайте забор груза курьером от этого адреса.'),
           ('','Какие вес и размеры указать перевозчику?','Они зависят от конкретного заказа. После производства подтвердим фактический вес и размеры упаковки, если они нужны перевозчику.'),
           ('','С какого момента считать срок изготовления?','После полного согласования макета. Время его подготовки и согласования в производственный срок не входит. Считаем только рабочие дни: понедельник — пятница, 09:00–18:00. Срок доставки согласуем отдельно.')]
    questions='<section class="company-section company-delivery-faq lower-home home-faq-section" aria-labelledby="delivery-faq-title"><h2 id="delivery-faq-title">Вопросы о получении заказа</h2><div class="home-faq-stage"><div class="home-faq-content">'+faq(items).replace('company-faq faq-list','faq-list')+f'</div><img class="faq-mascot" src="{prefix}assets/faq-peeking-robot.webp" alt="Робот ТЕКСТ держится за край карточек с вопросами" width="1166" height="1349" loading="lazy"></div></section>'
    return section('Как получить заказ',ways,extra='id="delivery-options"')+note('Доставка не входит в стоимость печати. Способ, срок и стоимость отправки согласуем до запуска заказа.')+section('Сравните стоимость у перевозчиков',carriers,'Четыре варианта отправки по России. Ссылки ведут на официальные калькуляторы перевозчиков.',extra='id="delivery-carriers"')+note('Размер и вес упаковки зависят от заказа. После производства подтвердим фактические параметры груза, если они нужны перевозчику.')+section('Когда заказ будет готов?',table+timing,'Срок изготовления считаем после полного согласования макета, в рабочих днях. Работаем пн–пт, 09:00–18:00. Сб–вс — выходные.',extra='id="delivery-production"')+note('В таблице указан объём изготовления. Срок доставки до вашего города рассчитывается отдельно.')+questions+cta(prefix,'Подберём удобное получение','Укажите состав заказа, город и адрес — обсудим самовывоз или отправку.')

def payment(prefix):
    steps=[('Ваши файлы','Параметры заказа','Пришлите макет и параметры: услугу, размер, материал и тираж. Онлайн-расчёт, если он доступен, можно приложить к запросу.'),
           ('Проверка и расчёт','Итоговая сумма','Проверим макет и согласуем окончательный состав заказа. Дополнительные работы и доставку обсудим отдельно.'),
           ('Подтверждение','Как оплатить','При подтверждении заказа сообщим способ оплаты и необходимые реквизиты. Если остались вопросы — поможем разобраться.')]
    cards='<ol class="payment-steps">'+''.join(f'<li class="payment-step"><div class="payment-step-top"><span class="payment-step-number" aria-label="Шаг {n}">0{n}</span><span class="payment-step-label">{label}</span>'+('<span class="payment-step-arrow" aria-hidden="true">'+icon('arrow')+'</span>' if n<3 else '')+f'</div><h3>{title}</h3><p>{text}</p></li>' for n,(label,title,text) in enumerate(steps,1))+'</ol>'
    flow=section('Как проходит оплата',cards,extra='id="payment-process"')
    details=f'''<div class="payment-info-grid">
      <article class="payment-info-card payment-info-business"><div class="payment-business-copy"><span class="payment-eyebrow">Для бизнеса</span><h3>Заказ от организации</h3><p>Сообщите наименование и реквизиты организации при согласовании заказа. Обсудим необходимые документы и порядок оплаты.</p><button class="payment-text-link" type="button" data-action="contacts">Обсудить документы {icon('arrow')}</button></div><div class="payment-paper"><span class="payment-paper-icon" aria-hidden="true">{icon('document')}</span><p class="payment-paper-title">Подготовьте<br>для заказа</p><ul><li>{icon('check')}<span>Наименование<br>организации</span></li><li>{icon('check')}<span>Реквизиты</span></li></ul><span class="payment-paper-rule" aria-hidden="true"></span></div></article>
      <article class="payment-info-card payment-info-reminder"><span class="payment-eyebrow">Важный момент</span><h3>Расчёт <span class="payment-not-equal">≠</span> оплата</h3><p>Скачанный расчёт или запрос не является платёжным документом и не подтверждает оплату. Для оформления заказа отправьте параметры и макет в студию.</p><button class="payment-text-link" type="button" data-action="order-guide" aria-haspopup="dialog">Как оформить заказ {icon('arrow')}</button></article>
    </div>'''
    before=section('Перед оплатой',details,extra='id="payment-details"')+note(f'Стоимость доставки согласуем отдельно. <a href="{prefix}dostavka-i-oplata/">Посмотрите варианты получения заказа</a>.')
    items=[('','Как узнать итоговую стоимость?','Для услуг с онлайн-калькулятором можно сохранить предварительный расчёт. Окончательный состав заказа, дополнительные работы и доставку согласуем после проверки макета. Для остальных услуг стоимость уточнит студия.'),
           ('','Какие способы оплаты доступны?','Способ оплаты и необходимые реквизиты сообщим при подтверждении заказа. Чтобы уточнить условия, позвоните или напишите нам.'),
           ('','Какие данные нужны для заказа от организации?','Сообщите наименование и реквизиты организации вместе с параметрами заказа при согласовании.'),
           ('','Расчёт из корзины подтверждает оплату?','Нет. Скачанный расчёт или запрос помогает согласовать параметры и стоимость. Он не является платёжным документом или подтверждением оплаты.'),
           ('','Скачал расчёт — заказ уже отправлен?',f'Нет. Отправьте параметры и макет на <a href="mailto:tekkkst@yandex.ru">tekkkst@yandex.ru</a> и дождитесь подтверждения студии. Файлы нужно приложить к письму вручную. <a href="{prefix}kak-oformit-zakaz/">Порядок оформления заказа</a>.'),
           ('','Доставка включена в стоимость печати?',f'Нет. Способ, срок и стоимость доставки согласуем отдельно. Подробности — на <a href="{prefix}dostavka-i-oplata/">странице доставки</a>.')]
    questions='<section class="company-section company-payment-faq lower-home home-faq-section" aria-labelledby="payment-faq-title"><h2 id="payment-faq-title">Вопросы об оплате</h2><div class="home-faq-stage"><div class="home-faq-content">'+faq(items).replace('company-faq faq-list','faq-list')+f'</div><img class="faq-mascot" src="{prefix}assets/faq-peeking-robot.webp" alt="Робот ТЕКСТ держится за край карточек с вопросами" width="1166" height="1349" loading="lazy"></div></section>'
    return flow+before+questions+cta(prefix,'Уточним оплату вашего заказа','Позвоните или напишите — сообщим порядок оплаты и необходимые документы.')

REQUIREMENT_ADAPTATIONS={
    'Как и у Pomidor, важно не путать буклет с брошюрой:':'Важно не путать буклет с брошюрой:',
    'По логике Pomidor: вылет':'Вылет',
    'По логике Pomidor контур':'Контур',
    'По присланному референсу: для готового лица':'Например, для готовой лицевой части',
    ' — по текущей модели ТЕКСТ.':'.',
    'Для проектной документации используется отдельная страница и коэффициент.':'Для проектной документации действуют отдельные условия.',
    'Отверстие и дополнительная обработка публикуются только если реально доступны.':'Отверстие и дополнительную обработку согласуйте до изготовления.',
    'Размеры в текущем калькуляторе:':'Доступные размеры:',
    'Размер изделия должен находиться в пределах текущего калькулятора. Материал и толщина выбираются из доступного списка; нестандартный материал требует отдельного согласования.':'Размер изделия, материал и толщину согласуйте до изготовления. Нестандартный материал требует отдельного согласования.',
    'PVC/винил не включаем в список материалов для CO₂-резки.':'ПВХ и винил не подходят для CO₂-резки.',
    'Объёмный/выборочный лак возможен только при соответствующей конфигурации Clear — это не обещаем без подтверждения текущей комплектации.':'Возможность объёмного или выборочного лака согласуйте отдельно: она зависит от комплектации оборудования.',
    'Толщина и материал выбираются только из доступных в калькуляторе вариантов.':'Доступные материалы и толщины уточните при согласовании заказа.',
    'Печать на металлическом изделии заказчика на этой странице не обещаем.':'Печать на металлическом изделии заказчика требует отдельного согласования.',
}

def technical_copy(value):
    for before,after in REQUIREMENT_ADAPTATIONS.items():value=value.replace(before,after)
    return escape(value)

def technical_body(item):
    profile=item.get('technical')
    if not profile:return '<ul class="requirements-points" data-requirement-text>'+''.join(f'<li>{technical_copy(sentence)}</li>' for sentence in re.split(r'(?<=[.!?])\s+(?=[А-ЯЁA-Z])',item['text']))+'</ul>'
    def points(values):return '<ul class="requirements-points">'+''.join('<li>'+technical_copy(value)+'</li>' for value in values)+'</ul>'
    def block(key,title,value,extra=''):
        body=points(value) if isinstance(value,list) else '<p>'+technical_copy(value)+'</p>'
        return f'<section class="requirements-detail-block {extra}" data-technical-block="{key}"><h4>{title}</h4>{body}</section>'
    fixed='<div class="requirements-fixed">'+''.join('<span>'+technical_copy(value)+'</span>' for value in profile['fixed'])+'</div>' if profile['fixed'] else ''
    content='<p class="requirements-send"><strong>Что передать</strong>'+technical_copy(profile['send'])+'</p>'+fixed
    content+=block('file','Файл и технический минимум',profile['fileSpec'],'requirements-file')
    content+=diagram(profile['scheme'],item['id'])+block('checks','Проверьте макет',profile['checks'])
    content+=block('critical','Критично',profile['critical'],'requirements-critical')
    content+=block('mistakes','Не делайте так',profile['mistakes'])
    content+=block('preflight','Что проверяем перед запуском',profile['preflight'])
    content+=block('example','Пример',profile['example'],'requirements-example')
    if profile['note']:content+='<p class="requirements-detail-note">'+technical_copy(profile['note'])+'</p>'
    return '<div data-requirement-text>'+content+'</div>'
def requirements(prefix):
    def count_label(count):
        return f'{count} '+('услуга' if count%10==1 and count%100!=11 else 'услуги' if count%10 in (2,3,4) and count%100 not in (12,13,14) else 'услуг')
    category_icons=['printer','document','layers','sticker','wide','scissors']
    category_buttons=[]
    groups=[]
    for category,ico in zip(TOPICS[:6],category_icons):
        category_items=[item for item in SOURCE['requirements'] if item['category']==category]
        category_buttons.append(f'<button class="requirements-category" type="button" data-company-filter="{escape(category)}" aria-pressed="false"><span class="requirements-category-icon">{icon(ico)}</span><span><strong>{escape(category)}</strong><small>{count_label(len(category_items))}</small></span>{icon("arrow")}</button>')
        cards=[]
        for item in category_items:
            points=technical_body(item)
            action='Открыть калькулятор' if item['id']=='3.1' or item['category']=='Наклейки и стикеры' else 'Посмотреть услугу'
            cards.append(f'<details class="requirements-service" id="requirement-{item["id"].replace(".","-")}" data-filter-item data-category="{escape(category)}" data-service-requirement="{item["id"]}"><summary><span>{escape(item["name"])}</span>{icon("plus")}</summary><div class="requirements-service-body">{points}<button class="requirements-service-link" type="button" data-service="{item["id"]}">{action} {icon("arrow")}</button></div></details>')
        groups.append(f'<section class="requirements-group" data-filter-group><div class="requirements-group-heading"><span>{icon(ico)}</span><h3>{escape(category)}</h3><small data-filter-group-count>{count_label(len(category_items))}</small></div><div class="requirements-service-grid faq-list">'+''.join(cards)+'</div></section>')
    tools='<div class="requirements-tools"><div class="requirements-search-row"><label class="company-search requirements-search">'+icon('search')+'<span class="sr-only">Поиск по требованиям</span><input type="search" data-company-search placeholder="Например: визитки, чертежи или наклейки" autocomplete="off"></label><button class="requirements-search-clear" type="button" data-company-search-clear aria-label="Очистить поиск" hidden>'+icon('close')+'</button></div><div class="requirements-filter-heading"><p>Выберите направление или найдите услугу</p><button class="requirements-all" type="button" data-company-filter="all" aria-pressed="true">Все направления</button></div><div class="requirements-category-grid" role="group" aria-label="Направления услуг">'+''.join(category_buttons)+'</div></div>'
    directory=tools+'<p class="sr-only" data-results-status role="status" aria-live="polite"></p><div class="requirements-groups" data-filter-list data-requirements-list>'+''.join(groups)+'</div><div class="requirements-empty" data-empty-results hidden>'+icon('search')+'<h3>Не нашли такую услугу</h3><p>Попробуйте другое название или вернитесь ко всем направлениям.</p><button class="button button-white" type="button" data-company-reset>Сбросить поиск и фильтр</button></div>'
    prep=[('document','Файл и страницы','Для документов удобнее PDF. Проверьте порядок, ориентацию и цветные страницы.'),
          ('wide','Размер и масштаб','Укажите конечный размер изделия. Для чертежей и выкроек проверьте масштаб.'),
          ('scissors','Поля и контуры','Для полиграфии учтите вылеты и безопасные поля. Для фигурной резки нужен отдельный контур.'),
          ('check','Согласование','Материалы, дополнительную обработку и правки обсудим до запуска заказа.')]
    checks='<div class="requirements-preflight">'+''.join(f'<article><span class="requirements-preflight-icon">{icon(ico)}</span><h3>{title}</h3><p>{text}</p></article>' for ico,title,text in prep)+'</div>'
    items=[('','В каком формате отправить документы?','Для стабильной печати лучше присылать PDF. Проверьте порядок страниц, ориентацию, поля и цветные страницы. Если файл требует правок, сначала согласуем макет.'),
           ('','Как проверить масштаб чертежей и выкроек?','В PDF проверьте формат листов, ориентацию и масштаб. Для лекал и выкроек нужен натуральный масштаб и контрольный размер или квадрат для его проверки.'),
           ('','Нужен ли отдельный контур для наклеек?','Для фигурных наклеек контур резки готовится отдельно. В стикерпаке он нужен для каждого элемента. Учтите безопасные поля и технологические расстояния.'),
           ('','Что учесть для прозрачной плёнки?','Заранее согласуйте белые элементы и белую подложку. Для фигурных наклеек на голографической плёнке работа белого цвета также согласуется до запуска.'),
           ('','Какие оригиналы подходят для сканирования?','Оригиналы должны быть читаемыми и пригодными для сканирования. Для чертежей максимальный формат — А3. Если важен порядок страниц, согласуйте его заранее.'),
           ('','Куда отправить макет на проверку?',f'Пришлите файл и параметры заказа на <a href="mailto:tekkkst@yandex.ru">tekkkst@yandex.ru</a>. Вложения добавьте к письму вручную. Укажите услугу, размер, материал и тираж; дождитесь согласования студии.')]
    questions='<section class="company-section requirements-faq lower-home home-faq-section" aria-labelledby="requirements-faq-title"><h2 id="requirements-faq-title">Вопросы о макетах</h2><div class="home-faq-stage"><div class="home-faq-content">'+faq(items).replace('company-faq faq-list','faq-list')+f'</div><img class="faq-mascot" src="{prefix}assets/faq-peeking-robot.webp" alt="Робот ТЕКСТ держится за край карточек с вопросами" width="1166" height="1349" loading="lazy"></div></section>'
    topic_items=[('',escape(topic['title']),escape(topic['text'])) for topic in SOURCE.get('technical_topics',[])]
    common=section('Общие правила подготовки',faq(topic_items),extra='id="requirements-basics"') if topic_items else ''
    return section('Проверьте перед отправкой',checks)+section('Требования к вашей услуге',directory,extra='id="requirements-content"')+common+questions+cta(prefix,'Нужна помощь с макетом?','Пришлите файл и расскажите о задаче — проверим подготовку перед печатью.')

def questions(prefix):
    def count_label(count):
        return f'{count} '+('вопрос' if count%10==1 and count%100!=11 else 'вопроса' if count%10 in (2,3,4) and count%100 not in (12,13,14) else 'вопросов')
    groups=[]
    buttons=['<button type="button" data-company-filter="all" aria-pressed="true">Все темы</button>']
    for group in FAQ_SOURCE['groups']:
        buttons.append(f'<button type="button" data-company-filter="{group["id"]}" aria-pressed="false">{escape(group["label"])}</button>')
        cards=[]
        for item in group['questions']:
            related=[f'<a href="{prefix}{link["route"]}">{escape(link["label"])}</a>' for link in item['links']]
            if item.get('service'):
                service=next(s for s in CATALOG if s['id']==item['service'])
                related=[f'<a href="{service_url(service,prefix)}">{escape(service["name"])}</a>',f'<a href="{prefix}requirements/#requirement-{item["service"].replace(".","-")}">Требования к макету</a>']+related
            related_html='<div class="questions-related">'+''.join(related)+'</div>' if related else ''
            cards.append(f'<details id="question-{item["id"]}" data-filter-item data-category="{group["id"]}" data-question-id="{item["id"]}" data-search-tags="{escape(item["search_tags"],quote=True)}"><summary><span>{escape(item["question"])}</span>{icon("plus")}</summary><p>{escape(item["answer"])}</p>{related_html}</details>')
        groups.append(f'<section class="questions-group" data-filter-group aria-labelledby="questions-{group["id"]}"><div class="questions-group-heading"><span class="questions-group-icon">{icon(group["icon"])}</span><h3 id="questions-{group["id"]}">{escape(group["label"])}</h3><small data-filter-group-count>{count_label(len(cards))}</small></div><div class="faq-list questions-list">'+''.join(cards)+'</div></section>')
    search='<div class="questions-search-row"><label class="company-search questions-search">'+icon('search')+'<span class="sr-only">Поиск по вопросам и ответам</span><input type="search" data-company-search placeholder="Например: Word, доставка или стикерпаки" autocomplete="off"></label><button class="questions-search-clear" type="button" data-company-search-clear aria-label="Очистить поиск" hidden>'+icon('close')+'</button></div>'
    mobile_topics='<label class="questions-topic-select"><span>Тема вопросов</span><select data-company-topic><option value="all">Все темы</option>'+''.join(f'<option value="{g["id"]}">{escape(g["label"])}</option>' for g in FAQ_SOURCE['groups'])+'</select></label>'
    tools='<div class="questions-tools">'+search+'<div class="company-filter questions-filter" role="group" aria-label="Темы вопросов">'+''.join(buttons)+'</div>'+mobile_topics+'<p class="company-results questions-results" data-results-status role="status" aria-live="polite">'+count_label(sum(len(g['questions']) for g in FAQ_SOURCE['groups']))+'</p></div>'
    empty_results='<div class="questions-empty" data-empty-results hidden>'+icon('search')+'<h3>Такого ответа пока нет</h3><p>Попробуйте другое слово или сбросьте выбранную тему. Если вопрос о вашем заказе, напишите нам.</p><button class="button button-white" type="button" data-company-reset>Сбросить поиск и тему</button></div>'
    directory=tools+'<div class="questions-groups lower-home" data-filter-list data-questions-list>'+''.join(groups)+'</div>'+empty_results
    return section('Найдите свой ответ',directory,'О заказе и файлах, сроках и получении — и о подготовке каждой услуги.',extra='id="questions-content"')+cta(prefix,'Не нашли ответ?','Позвоните нам или напишите — поможем разобраться с вашим заказом.')

def order_guide(prefix):
    steps=[('Выберите услугу и параметры','Найдите услугу в меню или через поиск. Для визиток, наклеек и стикерпаков используйте онлайн-калькуляторы. Для остальных услуг укажите размер, материал и тираж в запросе.'),
           ('Соберите позиции в корзине','Добавьте нужные изделия. Нажмите «Подготовить запрос», заполните имя, телефон и комментарий. Позиции без расчёта уточним со студией.'),
           ('Отправьте параметры и макеты','Нажмите «Открыть письмо» и вручную приложите файлы к письму на tekkkst@yandex.ru. Если почтовая программа не настроена, нажмите «Скачать запрос» и отправьте его вместе с макетом самостоятельно.'),
           ('Подтвердите заказ','После проверки макета согласуем окончательные параметры, стоимость, оплату и получение. Производственный срок начинается после полного согласования макета.')]
    grid='<div class="company-grid two">'+''.join(f'<article class="company-card company-order-step"><span class="company-step-number">0{n}</span><h2>{title}</h2><p>{text}</p></article>' for n,(title,text) in enumerate(steps,1))+'</div>'
    return grid+note('Скачивание расчёта или запроса не отправляет заказ. Проверьте письмо и вложения, отправьте его и дождитесь подтверждения студии.')+section('Выберите направление',direction_cards(prefix),extra='id="order-directions"')+cta(prefix,'Поможем оформить заказ','Расскажите, что хотите напечатать — подскажем параметры и подготовку файла.')

def article_minutes(a):
    return max(2,math.ceil(sum(len(b['text'].split()) for b in a['blocks'])/180))

def article_card(a,prefix,heading='h3'):
    teaser=a['teaser'][:170]
    if len(a['teaser'])>170:teaser=teaser.rsplit(' ',1)[0]+'…'
    return f'<a class="company-article-card" data-filter-item data-category="{escape(a["category"])}" href="{prefix}{a["path"]}"><span class="article-card-topic">{icon("document")}{escape(a["category"])}</span><{heading}>{escape(a["title"])}</{heading}><p>{escape(teaser)}</p><span class="article-card-footer"><span>{article_minutes(a)} мин чтения</span><span class="company-read">Читать статью {icon("arrow")}</span></span></a>'

def articles(prefix):
    topic_icons=['printer','document','layers','sticker','wide','scissors','check']
    topics='<button type="button" data-company-filter="all" aria-pressed="true">Все статьи <span>150</span></button>'+''.join(f'<button type="button" data-company-filter="{escape(topic)}" aria-pressed="false">{icon(ico)}{escape(topic)} <span>{sum(a["category"]==topic for a in ARTICLES)}</span></button>' for topic,ico in zip(TOPICS,topic_icons))
    tools='<div class="articles-tools"><div class="articles-search-row"><label class="company-search articles-search">'+icon('search')+'<span class="sr-only">Поиск по статьям</span><input type="search" data-company-search placeholder="О чём хотите узнать?"></label><button class="requirements-search-clear" type="button" data-company-search-clear aria-label="Очистить поиск" hidden>'+icon('close')+'</button></div><div class="company-filter articles-filter" aria-label="Темы статей">'+topics+'</div></div>'
    return '<section id="articles-content" class="articles-directory" aria-label="Статьи о печати">'+tools+'<div class="articles-results-row"><h2>Выберите полезную статью</h2><p class="company-results" data-results-status role="status" aria-live="polite"></p></div><div class="company-grid articles-grid" data-filter-list>'+''.join(article_card(a,prefix,'h2') for a in ARTICLES)+'</div>'+empty()+'<button class="button button-white company-load-more" data-load-more>Показать ещё статьи '+icon('plus')+'</button></section>'+cta(prefix,'Остались вопросы по печати?','Поможем применить рекомендации к вашему макету и заказу.')

def date_label(value):
    year,month,day=value.split('-')
    months=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
    return f'{int(day)} {months[int(month)-1]} {year}'

def related_link_label(link):
    if link['route'] in SERVICES:return SERVICES[link['route']]['name']
    target=SOURCE_ROUTES.get(link['route'])
    return next((name for name,path,_ in PAGES if path==target),'Как оформить заказ' if target=='kak-oformit-zakaz/' else link['label'])

LEGAL_ADAPTATIONS={
    'Необходимые данные localStorage используются для корзины, выбора мессенджера, настройки анимации и сохранения выбора по cookies.':'Необходимые данные localStorage используются для состава корзины и сохранения выбора cookies. Прикреплённые макеты хранятся в IndexedDB на устройстве пользователя и не отправляются автоматически.',
    'корзина, выбранный мессенджер, параметры расчёта, настройка анимации, выбор cookies':'корзина, параметры расчёта, выбор cookies',
    'На сайте используется Яндекс Метрика, счётчик 86530452.':'На основном домене text-print.ru используется Яндекс Метрика, счётчик 86530452.',
    'для анонимных идентификаторов браузера,':'для идентификаторов браузера,',
    'Необходимые настройки работают для корзины, анимации и сохранения выбора по cookies.':'Необходимые настройки работают для корзины и сохранения выбора по cookies.',
    'tekst-cart-v1 — содержимое корзины; tekst-motion — настройка анимации; tekst-cookie-consent — сохранённый выбор пользователя по аналитике. Эти данные хранятся в браузере пользователя.':'text-print-cart-v1 — содержимое корзины; text-print-consent-v1 — выбор пользователя по аналитике и дата его сохранения. Выбор действует 180 дней, после чего сайт предложит выбрать снова. Прикреплённые макеты сохраняются локально в IndexedDB (text-print-order-files) и не отправляются автоматически. Эти данные хранятся в браузере пользователя.',
    'При выборе «Разрешить аналитику» сайт может загрузить Яндекс Метрику, счётчик 86530452.':'При выборе «Разрешить аналитику» на основном домене text-print.ru сайт может загрузить Яндекс Метрику, счётчик 86530452. На локальном предпросмотре и GitHub Pages аналитика не запускается.',
    'Перед публичным запуском оператору необходимо сверить документ с фактическими серверными формами, хостингом, подрядчиками и уведомлением Роскомнадзора.':'',
    'Текст согласия должен оставаться доступным по постоянному URL, указанному рядом с чекбоксом формы.':'',
}

def legal_document(name,prefix):
    if name=='font-license':
        body=section('Шрифты текущей версии','<p>Интерфейс использует системные Arial и Segoe UI, а также стандартный шрифт без засечек. Отдельные файлы веб-шрифтов не загружаются.</p>')
        body+=section('Шрифты в PDF-расчётах',f'<p>В PDF из корзины встраиваются DejaVu Sans и DejaVu Sans Bold 2.37, чтобы русский текст отображался на любом устройстве. <a href="{prefix}assets/fonts/DejaVu-LICENSE.txt">Лицензия DejaVu</a>.</p>')
        body+=section('Гарнитуры из материалов заказчика','<p>В исходном дизайне предусмотрены Manrope и Playfair Display. Они распространяются по SIL Open Font License 1.1. Тексты лицензий сохранены вместе с сайтом.</p>')
        body+=section('Тексты лицензий',f'<div class="company-actions"><a class="button button-white" href="{prefix}fonts/Manrope-OFL.txt">Manrope — OFL 1.1 {icon("document")}</a><a class="button button-white" href="{prefix}fonts/PlayfairDisplay-OFL.txt">Playfair Display — OFL 1.1 {icon("document")}</a></div>')
    else:
        blocks=[]
        for block in source_page(name)['sections']:
            value=block['html']
            for before,after in LEGAL_ADAPTATIONS.items():value=value.replace(before,after)
            if block['tag']=='h2' and plain(value)==source_page(name)['title']:continue
            if block['tag']=='h2':
                value=value.replace('<h2>',f'<h2 id="legal-section-{len([b for b in blocks if "<h2" in b])+1}">',1)
            blocks.append(render_source(value,prefix))
        body=''.join(blocks)
        if name=='cookies':body+='<div class="company-actions"><button class="button button-primary" type="button" data-cookie-settings>Изменить выбор cookies '+icon('gear')+'</button></div>'
    related='<aside class="company-legal-links"><h2>Документы студии</h2>'+''.join(f'<a href="{prefix}{path}"'+(' aria-current="page"' if path=='company/'+name+'/' else '')+'>'+label+'</a>' for label,path,_ in LEGAL_PAGES)+'</aside>'
    return '<p class="company-legal-date">Редакция от 7 октября 2026 года</p><div class="company-legal-layout"><article class="company-legal-reading">'+body+'</article>'+related+'</div>'

for label,path,intro in LEGAL_PAGES:
    name=path.strip('/').split('/')[-1]
    build(path,escape(source_page(name)['title']),escape(intro),None,lambda prefix,name=name:legal_document(name,prefix),seo=page_seo(name),actions='<a class="button button-white" href="../">'+icon('arrow')+' Раздел «Компания»</a>')

build('company/about/','ТЕКСТ — <em>больше,</em><br>чем печать',paragraphs('')[0],'company-about.webp',about,schema_type='AboutPage',seo=page_seo(''))
build('contacts/','Хорошие идеи<br>начинаются <em>с общения</em>','Приезжайте в студию на Строителей, 11 или напишите нам. Обсудим вашу задачу и поможем с заказом.','company-contacts.webp',contacts,schema_type='ContactPage',seo=page_seo('contacts'),actions='<button class="button button-primary" type="button" data-action="contacts" aria-haspopup="dialog">'+icon('phone')+' Позвонить</button><button class="button button-white" data-action="contacts">Написать нам</button>')
build('dostavka-i-oplata/','Ваши идеи<br>уже <em>в пути</em>','Самовывоз из студии и отправка по России. Условия, стоимость и способ получения согласуем при подтверждении заказа.','company-delivery.webp',delivery,seo=page_seo('delivery'))
build('company/payment/','Сначала детали.<br>Потом <em>оплата</em>','Проверим макеты, согласуем состав заказа и итоговую стоимость. После подтверждения сообщим способ оплаты и реквизиты.','company-payment.webp',payment,seo=page_seo('payment','Оплата заказа в студии ТЕКСТ: согласование макета и итоговой стоимости. Способ оплаты и реквизиты сообщаем при подтверждении заказа.'),actions='<button class="button button-primary" data-action="contacts">Уточнить оплату '+icon('arrow')+'</button><button class="button button-white" type="button" data-action="order-guide" aria-haspopup="dialog">Как оформить заказ</button>')
build('requirements/','Технические<br><em>требования</em>','Для документов, чертежей, полиграфии и изделий с резкой. Найдите свою услугу и проверьте файл перед отправкой.','company-requirements.webp',requirements,seo=page_seo('requirements'),actions='<a class="button button-primary" href="#requirements-content">Найти требования '+icon('arrow')+'</a><button class="button button-white" data-action="contacts">Помощь с макетом</button>')
build('company/vopros-otvet/','Вопросы<br><em>и ответы</em>','Как оформить заказ, подготовить макет и получить тираж. Собрали ответы по всем направлениям печати — выберите тему или найдите свой вопрос.','company-contacts.webp',questions,schema_type='FAQPage',seo=page_seo('vopros-otvet','Ответы студии ТЕКСТ о заказе, макетах, оплате и доставке, печати документов, наклейках, полиграфии и UV-печати. Барнаул, Строителей, 11.'),actions='<a class="button button-primary" href="#questions-content">Найти ответ '+icon('search')+'</a><button class="button button-white" data-action="contacts">Задать вопрос</button>')
build('company/article/','Полезно знать<br><em>перед печатью</em>','Выбираем бумагу и материалы, готовим документы и макеты, разбираемся в технологиях. 150 практических статей от студии ТЕКСТ.',None,articles,seo=page_seo('articles'),schema_type='CollectionPage',actions='<a class="button button-primary" href="#articles-content">Выбрать статью '+icon('arrow')+'</a><a class="button button-white" href="../../requirements/">Требования к файлам</a>')
build('kak-oformit-zakaz/','От идеи<br>до <em>готового заказа</em>','Четыре шага: выбрать услугу, подготовить параметры, отправить файлы и подтвердить заказ со студией.','company-contacts.webp',order_guide,actions='<button class="button button-primary" data-action="catalog">Выбрать услугу '+icon('arrow')+'</button><button class="button button-white" data-action="cart">Открыть корзину</button>')
build('company/','Знакомьтесь:<br>студия печати <em>ТЕКСТ</em>','О нашей работе, производстве и заботе о ваших заказах. Вся полезная информация о студии — в одном разделе.','company-about.webp',lambda prefix:'<div class="company-grid">'+''.join(f'<a class="company-card" href="{prefix}{path}">{icon(i)}<h3>{label}</h3><p>{intro}</p></a>' for (label,path,intro),i in zip(PAGES,['printer','pin','truck','bag','check','message','document','check']))+'</div>'+section('Документы студии','<div class="company-grid">'+''.join(f'<a class="company-card" href="{prefix}{path}">{icon("document")}<h3>{label}</h3><p>{intro}</p></a>' for label,path,intro in LEGAL_PAGES)+'</div>')+cta(prefix),schema_type='CollectionPage')

for a in ARTICLES:
    def reading(prefix,a=a):
        content=[];contents=[];position=0
        while position<len(a['blocks']):
            block=a['blocks'][position]
            position+=1
            value=render_source(block['html'],prefix)
            if block['tag']=='h2':
                anchor='section-'+str(len(contents)+1);contents.append((block['text'],anchor));value=value.replace('<h2>',f'<h2 id="{anchor}">',1)
            elif block['tag']=='table':value='<div class="company-table-wrap">'+value.replace('<table>','<table class="company-table">',1)+'</div>'
            elif block['tag']=='aside':value=note('Стоимость зависит от выбранных параметров и дополнительных работ. Уточняйте условия услуги перед заказом; числа в примерах служат ориентиром.')
            content.append(value)
            if block['tag']=='h2' and block['text']=='Частые вопросы':
                answers=[]
                while position+1<len(a['blocks']):
                    question,answer=a['blocks'][position:position+2]
                    if question['tag']!='p' or answer['tag']!='p' or not question['text'].endswith('?'):break
                    question_html=render_source(question['html'],prefix).removeprefix('<p>').removesuffix('</p>')
                    answers.append(f'<details><summary>{question_html}{icon("plus")}</summary>{render_source(answer["html"],prefix)}</details>')
                    position+=2
                if answers:content.append('<div class="company-faq faq-list">'+''.join(answers)+'</div>')
        aside='<aside class="company-reading-aside"><h2>В этой статье</h2>'+''.join(f'<a href="#{anchor}">{escape(text)}</a>' for text,anchor in contents)+f'<a class="button button-primary" href="{prefix}requirements/">Требования к макетам</a></aside>'
        services='<div class="company-service-links">'+''.join(f'<a class="button button-white" href="{escape(resolve_route(s["route"],prefix),quote=True)}">{escape(related_link_label(s))} {icon("arrow")}</a>' for s in a['services'])+'</div>'
        related=[other for other in ARTICLES if other['category']==a['category'] and other['id']!=a['id']][:3]
        date=f'<div class="company-article-date"><span>Редакция студии ТЕКСТ</span><span>Опубликовано <time datetime="{a["seo"]["Опубликовано"]}">{date_label(a["seo"]["Опубликовано"])}</time></span><span>Обновлено <time datetime="{a["seo"]["Обновлено"]}">{date_label(a["seo"]["Обновлено"])}</time></span></div>'
        link_title='Услуги по теме' if any(s['route'] in SERVICES for s in a['services']) else 'Полезные ссылки'
        return date+'<div class="company-reading-layout"><article class="company-reading">'+''.join(content)+'</article>'+aside+'</div>'+section(link_title,services)+section('Ещё по этой теме','<div class="company-grid">'+''.join(article_card(other,prefix) for other in related)+'</div>')+cta(prefix,'Применим к вашему заказу','Пришлите макет и параметры — поможем разобраться в деталях.')
    seo={'title':a['seo']['Title'],'description':a['seo']['Description'],'published':a['seo']['Опубликовано'],'updated':a['seo']['Обновлено'],'category':a['category'],'minutes':article_minutes(a),'image':ASSETS[a['category']]+'.webp'}
    build(a['path'],escape(a['title']),escape(a['teaser']),None,reading,schema_type='Article',seo=seo)

manifest={'source':SOURCE['source'],'articles':[{k:a[k] for k in ['id','title','category','path','source_route']} for a in ARTICLES]}
(ROOT/'company-articles.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

# Keep all Copy Center pages reproducible with the site's normal build.
import subprocess, sys
if (ROOT/'copycenter-content.json').is_file():
    subprocess.run([sys.executable,str(ROOT/'scripts/build-copycenter-pages.py')],cwd=ROOT,check=True)
if (ROOT/'project-content.json').is_file():
    subprocess.run([sys.executable,str(ROOT/'scripts/build-project-pages.py')],cwd=ROOT,check=True)
if (ROOT/'leaflet-content.json').is_file():
    subprocess.run([sys.executable,str(ROOT/'scripts/build-leaflet-pages.py')],cwd=ROOT,check=True)

if (ROOT/'uv-content.json').is_file():
    subprocess.run([sys.executable,str(ROOT/'scripts/build-uv-pages.py')],cwd=ROOT,check=True)

from site_seo import apply_site_seo
apply_site_seo()

# A new resource URL invalidates browser caches only when CSS or JavaScript changes.
asset_versions={}
for file in sorted(ROOT.rglob('*.html')):
    if any(part.startswith('.') or part in ('node_modules','preview') for part in file.relative_to(ROOT).parts):continue
    newline='\r\n' if b'\r\n' in file.read_bytes() else '\n'
    text=file.read_text(encoding='utf-8')
    # Apply after category page generation so this stylesheet is always last.
    original_text=text
    text=re.sub(r'\s*<link\b[^>]*href="[^"]*service-calculator\.css(?:\?[^"]*)?"[^>]*>', '', text)
    calculator_css='../'*len(file.parent.relative_to(ROOT).parts)+'service-calculator.css'
    if file.relative_to(ROOT).parts[0]!='shirokiy-format':
        text=text.replace('</head>',f'\n<link rel="stylesheet" href="{calculator_css}">\n</head>',1)
    def version_asset(match):
        url=urlsplit(unescape(match[2]))
        if url.scheme or url.netloc or Path(url.path).suffix not in ('.css','.js'):return match[0]
        asset=(file.parent/unquote(url.path)).resolve()
        if not asset.is_relative_to(ROOT) or not asset.is_file():return match[0]
        if asset not in asset_versions:asset_versions[asset]=hashlib.sha256(asset.read_bytes()).hexdigest()[:12]
        query=[(key,value) for key,value in parse_qsl(url.query,keep_blank_values=True) if key!='v']
        query.append(('v',asset_versions[asset]))
        versioned=urlunsplit((url.scheme,url.netloc,url.path,urlencode(query),url.fragment))
        return match[1]+escape(versioned,quote=True)
    versioned=re.sub(r'((?:href|src)=")([^\"]+)(?=")',version_asset,text)
    if versioned!=original_text:file.write_text(versioned,encoding='utf-8',newline=newline)

print(f'Built {len(PAGES)-1} company pages, overview, order guide, {len(LEGAL_PAGES)} legal pages and {len(ARTICLES)} complete articles with {len(SOURCE["requirements"])} service requirements.')
