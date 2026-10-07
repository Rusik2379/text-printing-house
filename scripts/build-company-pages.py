"""Build static company pages from company-content.json and the shared homepage.

Python standard library only; original ZIP/XLSX is needed only for a fresh import.
"""
from pathlib import Path
from html import escape, unescape
import json, re, math
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
SOURCE=json.loads((ROOT/'company-content.json').read_text(encoding='utf-8'))
PAGES = [
    ('О нас','company/about/','О студии, производстве и нашем подходе к работе'),
    ('Контакты','contacts/','Адрес, график работы и удобные способы связи'),
    ('Доставка','dostavka-i-oplata/','Самовывоз, отправка и расчёт у перевозчиков'),
    ('Оплата','company/payment/','Согласование заказа, способ оплаты и документы'),
    ('Технические требования','requirements/','Подготовьте файл к печати и обработке'),
    ('Примеры работ','company/photo/','Подберём образцы печати под вашу задачу'),
    ('Акции','company/action/','Скидка на ламинирование и условия тиража'),
    ('Отзывы','company/request/','Впечатления клиентов на Яндекс Картах и в 2ГИС'),
    ('Вопросы и ответы','company/vopros-otvet/','Ответы о заказе, файлах, оплате и получении'),
    ('Статьи','company/article/','Практические материалы о печати и макетах'),
    ('Как заказать','kak-oformit-zakaz/','Порядок оформления, отправки файлов и подтверждения'),
]
CATEGORIES = [
    ('Копицентр','direction-copy',8),('Проектная документация','direction-project',17),
    ('Листовая полиграфия','direction-print',26),('Наклейки и стикеры','direction-stickers',37),
    ('Широкий формат','direction-wide',44),('UV-печать и резка','direction-uv',50),
]
home = (ROOT/'index.html').read_text(encoding='utf-8')

def links(prefix):
    return ''.join(f'<a href="{prefix}{path}">{label}</a>' for label,path,_ in PAGES)

# Keep the homepage and all product pages connected to the same company section.
product_pages=[(str(file.relative_to(ROOT)),'../'*len(file.relative_to(ROOT).parent.parts)) for file in sorted((ROOT/'nakleyki-i-stikery').rglob('index.html'))]
for relative,prefix in [('index.html',''),*product_pages]:
    file=ROOT/relative
    text=file.read_text(encoding='utf-8')
    text=re.sub(r'(<h3>Компания</h3>)<div class="footer-links"[^>]*>.*?</div>',
                lambda match:match[1]+f'<div class="footer-links" data-company-links>{links(prefix)}</div>',text,count=1,flags=re.S)
    credit=f'<div class="footer-credit"><div class="footer-credit-copy"><span>Сделано «Сибирь Софт»</span><span>Поддерживается с 2026 года</span></div><a class="footer-credit-logo" href="https://sibsoft-it.ru/" target="_blank" rel="noopener" aria-label="Сибирь Софт — разработка и поддержка сайта"><img src="{prefix}assets/sibsoft-logo.png" alt="Сибирь Софт" width="848" height="1264" loading="lazy"></a></div>'
    text=re.sub(r'<a class="footer-credit"[^>]*>.*?</a>|<div class="footer-credit">.*?</a></div>|<span>Сделано с <span class="footer-heart">♥</span> в Барнауле</span>',lambda _:credit,text,count=1,flags=re.S)
    file.write_text(text,encoding='utf-8')
home=(ROOT/'index.html').read_text(encoding='utf-8')
header=home[home.index('  <a class="skip-link"'):home.index('  <main id="main">')]
footer=home[home.index('  <footer'):home.index('</body>')]
head=home[home.index('<head>')+6:home.index('</head>')]

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
    schema={'@context':'https://schema.org','@graph':[entity,{'@type':'BreadcrumbList','itemListElement':crumbs}]}
    page_head+=f'  <link rel="canonical" href="{url}">\n  <link rel="stylesheet" href="{prefix}company-pages.css">\n  <script src="{prefix}company-pages.js" defer></script>\n  <script type="application/ld+json">{json.dumps(schema,ensure_ascii=False).replace("</","<\\/")}</script>\n'
    page_header=root_paths(header,prefix).replace('class="brand" href="#main"',f'class="brand" href="{prefix}"')
    page_footer=root_paths(footer,prefix).replace('class="brand" href="#main"',f'class="brand" href="{prefix}"')
    breadcrumb=f'<nav class="company-breadcrumbs" aria-label="Хлебные крошки"><a href="{prefix}">Главная</a><span aria-hidden="true">/</span><a href="{prefix}company/">Компания</a>'+(f'<span aria-hidden="true">/</span><span aria-current="page">{next((l for l,p,_ in PAGES if p==path),"Статья" if article else plain(title))}</span>' if path!='company/' else '')+'</nav>'
    if article:breadcrumb=breadcrumb.replace('<span aria-current="page">Статья</span>',f'<a href="../">Статьи</a><span aria-hidden="true">/</span><span aria-current="page">Статья</span>')
    actions=actions or '<button class="button button-primary" data-action="contacts">Обсудить заказ '+icon('arrow')+'</button><button class="button button-white" data-action="catalog">Наши услуги</button>'
    hero=f'<section class="company-hero" aria-labelledby="company-title"><div><h1 id="company-title">{title}</h1><p>{intro}</p><div class="company-actions">{actions}</div></div><div class="company-art"><img src="{prefix}assets/{art}" alt="Робот студии ТЕКСТ — {escape(plain(title))}" width="900" height="900" fetchpriority="high"></div></section>'
    page_class='company-page company-article-page' if article else 'company-page company-about-page' if path=='company/about/' else 'company-page'
    output=f'<!doctype html>\n<html lang="ru"><head>{page_head}</head><body class="{page_class}">\n{page_header}<main id="main"><div class="container">{breadcrumb}{hero}{body(prefix)}</div></main>\n{page_footer}</body></html>\n'
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
    '/company/photo/':'company/photo/','/company/action/':'company/action/',
    '/company/request/':'company/request/','/company/vopros-otvet/':'company/vopros-otvet/',
    '/kak-oformit-zakaz/':'kak-oformit-zakaz/',
    **{a['source_route']:a['path'] for a in ARTICLES},
}
CATEGORY_ROUTES=dict(zip(['/kopitsentr/','/proektnaya-dokumentatsiya/','/listovaya-poligrafiya/',
                         '/nakleyki-i-stikery/','/shirokiy-format/','/uv-pechat-i-rezka/'],TOPICS[:6]))

def service_url(service,prefix):
    return prefix+'nakleyki-i-stikery/stikerpaki/' if service['id']=='4.4' else prefix+'?service='+service['id']

def resolve_route(route,prefix):
    if route in SOURCE_ROUTES:return prefix+SOURCE_ROUTES[route]
    if route in SERVICES:return service_url(SERVICES[route],prefix)
    if route in CATEGORY_ROUTES:return prefix+'?category='+quote(CATEGORY_ROUTES[route])
    if route=='/':return prefix+'?catalog=1'
    raise ValueError('Missing local destination for '+route)

# Adapt only instructions about the source site's UI to the actual shared cart.
# PDF requirements for printing files remain intact.
COPY_ADAPTATIONS={
    'Каждая услуга имеет свой калькулятор.':'Для визиток и стикерпаков доступны онлайн-калькуляторы; параметры остальных услуг согласуем со студией.',
    'Это описание текущей версии сайта. Возможности отправки могут расшириться: следите за обновлениями.':'После отправки письма студия проверит файлы и подтвердит заказ.',
    'Расчёт можно редактировать в корзине.':'Параметры стикерпака можно изменить из корзины. Для остальных позиций при необходимости добавьте новый расчёт.',
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
def direction_cards(prefix,inline=False):
    descriptions=['Документы, фотографии, ламинирование и переплёт','Чертежи, проекты, фальцовка и готовые альбомы',
                  'Визитки, листовки, буклеты и каталоги','Этикетки, фигурные наклейки и готовые наборы',
                  'Баннеры, постеры, плёнка и печать на холсте','Печать на материалах, таблички и изделия с резкой']
    if inline:
        return '<div class="featured-grid company-about-directions">'+''.join(
            f'<a class="featured-card" href="?category={quote(name)}" data-action="catalog" data-category="{escape(name,quote=True)}" aria-label="{escape(name,quote=True)} — посмотреть услуги"><span class="featured-copy"><span class="featured-name">'+
            ' '.join(f'<span class="featured-word">{escape(word)}</span>' for word in name.split())+
            f'</span><span class="company-direction-description">{escape(desc)}</span><span class="company-direction-link">Смотреть услуги →</span></span><span class="featured-art"><img src="{prefix}assets/{asset}.webp" alt="" width="900" height="900" loading="lazy"></span></a>'
            for (name,asset,_),desc in zip(CATEGORIES,descriptions))+'</div>'
    return '<div class="company-grid">'+''.join(
        f'<a class="company-card company-direction" href="{"" if inline else prefix}?category={quote(name)}"{f" data-action=\"catalog\" data-category=\"{escape(name,quote=True)}\"" if inline else ""}><div><h3>{name}</h3><p>{desc}</p><span>Посмотреть услуги →</span></div><img src="{prefix}assets/{asset}.webp" alt="" width="85" height="100" loading="lazy"></a>'
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
    return trust+section('Больше, чем <span class="company-accent">печать</span>',story)+section('Всё, что нужно вашим идеям',direction_cards(prefix,inline=True))+section('Наше производство',machines)+section('От идеи до готового заказа',steps)+client_section+questions

MAPS=[('Яндекс Карты','https://yandex.ru/maps/-/CXEUYTi7'),('2ГИС','https://2gis.ru/barnaul/firm/70000001043200458'),('Google Карты','https://maps.app.goo.gl/ZmEnRcK45HJikqRp7')]
def contacts(prefix):
    rows=[('pin','Мы находимся','Барнаул, проспект Строителей, 11','Приходите в студию или оформите заказ удалённо.'),('clock','График работы','Пн–пт 09:00–18:00','Сб–вс — выходные.'),
          ('phone','Позвонить','<a href="tel:+79236547896">+7 (923) 654-78-96</a>','Уточните параметры, стоимость и готовность заказа.'),
          ('mail','Отправить макет','<a href="mailto:tekkkst@yandex.ru">tekkkst@yandex.ru</a>','Укажите размер, материал и тираж.')]
    listing='<div class="company-contact-list">'+''.join(f'<div class="company-contact-row">{icon(i)}<div><small>{label}</small><strong>{value}</strong><p>{text}</p></div></div>' for i,label,value,text in rows)+'</div>'
    mapbox='<div class="company-map"><iframe title="Студия ТЕКСТ на Яндекс Картах — проспект Строителей, 11" src="https://yandex.ru/map-widget/v1/?ol=biz&amp;oid=230216768273&amp;z=17" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe><div class="company-map-caption"><span>Барнаул, Строителей, 11</span><a href="https://2gis.ru/barnaul/firm/70000001043200458" target="_blank" rel="noopener">Построить маршрут →</a></div></div>'
    social='<div class="company-messengers">'+''.join(f'<a data-social="{key}" href="{url}" target="_blank" rel="noopener"><img src="{prefix}assets/{key}.svg" alt="" width="23" height="23">{label}</a>' for key,label,url in [('telegram','Telegram','https://t.me/tekkkstos'),('max','MAX','https://max.ru/u/f9LHodD0cOII3pfsxMqRJ6CzaCIs8OuOO5zmsR3qDGblmxnJwlsxM4WiGoY')])+'</div>'
    maps='<div class="company-grid">'+''.join(f'<a class="company-card" href="{url}" target="_blank" rel="noopener">{icon("pin")}<h3>{label}</h3><p>Посмотреть адрес и построить маршрут →</p></a>' for label,url in MAPS)+'</div>'
    return '<div class="company-info-layout">'+listing+mapbox+'</div>'+section('Напишите удобным способом',social,'Пришлите макет и напишите размер, материал и тираж.')+section('Открыть нас на карте',maps)+cta(prefix)

def delivery(prefix):
    ways='<div class="company-grid two">'+card('Забрать в студии','Барнаул, проспект Строителей, 11.<br>Пн–пт 09:00–18:00. Сб–вс — выходные.','pin')+card('Передадим перевозчику','Место отправления: Барнаул, проспект Строителей, 11. Выберите забор груза курьером от нашего адреса.','truck')+'</div>'
    carriers='<div class="company-grid four">'+''.join(f'<a class="company-card company-carrier" href="{escape(link["url"].split("?utm_referrer")[0],quote=True)}" target="_blank" rel="noopener">{icon("truck")}<h3>{name}</h3><p>Откуда: Барнаул<br>Забор: Строителей, 11</p><span>Рассчитать доставку ↗</span></a>' for name,link in zip(['ПЭК','СДЭК','Деловые Линии','Энергия'],source_page('delivery')['links']))+'</div>'
    daily=[10000,25000,15000,10000,7000,7000]
    table='<div class="company-table-wrap"><table class="company-table"><caption class="sr-only">Объём изготовления за один рабочий день по разделам</caption><thead><tr><th scope="col">Направление</th><th scope="col">За один рабочий день</th></tr></thead><tbody>'+''.join(f'<tr><th scope="row">{category}</th><td>До <strong>{str(amount//1000)} 000 ₽</strong></td></tr>' for (category,_,_),amount in zip(CATEGORIES,daily))+'</tbody></table></div>'
    questions=faq([('','Доставка входит в стоимость печати?','Нет. Стоимость доставки, адрес и перевозчика согласуем отдельно.'),
                   ('','Какие габариты указать перевозчику?','Размер и вес упаковки зависят от заказа. После производства подтвердим фактические параметры груза.'),
                   ('','Когда начинается производственный срок?','После полного согласования макета. Срок считается в рабочих днях; пн–пт 09:00–18:00, сб–вс — выходные.')])
    return ways+note('Доставка не входит в стоимость печати. Условия и получение согласуем при подтверждении заказа.')+section('Сравните стоимость у перевозчиков',carriers,'Ссылки ведут на официальные калькуляторы. Для расчёта выбирайте забор груза от студии.')+note('Размер и вес упаковки зависят от конкретного заказа. После производства подтвердим фактические параметры груза.')+section('Когда заказ будет готов?',table,'Срок считается в рабочих днях после полного согласования макета. Для большей суммы делим стоимость на дневной объём направления и округляем вверх.')+section('Частые вопросы',questions)+cta(prefix,'Подберём удобное получение','Укажите адрес и состав заказа — обсудим самовывоз или отправку.')

def payment(prefix):
    text=paragraphs('payment')
    text[1]='Способ оплаты и необходимые реквизиты сообщим при подтверждении заказа. Скачанный расчёт или запрос не является платёжным документом или подтверждением оплаты.'
    body='<div class="company-grid">'+''.join(card(title,escape(p),ico) for title,p,ico in zip(['Сначала согласование','Как оплатить','Что указать для документов'],text,['check','bag','document']))+'</div>'
    questions=faq([('','Можно ли оплатить заказ прямо на сайте?','Условия и способ оплаты сообщит студия при подтверждении заказа.'),
                   ('','Что нужно сообщить организации?','Наименование и реквизиты организации. Передайте их вместе с параметрами заказа.'),
                   ('','Скачивание расчёта отправляет заказ?','Нет. Отправьте письмо с параметрами и макетом на tekkkst@yandex.ru и дождитесь подтверждения студии.')])
    return body+note('Дополнительные работы и доставку согласуем после проверки макетов, до подтверждения заказа.')+section('Частые вопросы об оплате',questions)+cta(prefix,'Уточним оплату вашего заказа','Позвоните или напишите — сообщим порядок оплаты и необходимые документы.')

REQUIREMENT_ADAPTATIONS={
    'Для проектной документации используется отдельная страница и коэффициент.':'Для проектной документации действуют отдельные условия.',
    'Отверстие и дополнительная обработка публикуются только если реально доступны.':'Отверстие и дополнительную обработку согласуйте до изготовления.',
    'Размеры в текущем калькуляторе:':'Доступные размеры:',
    'Размер изделия должен находиться в пределах текущего калькулятора. Материал и толщина выбираются из доступного списка; нестандартный материал требует отдельного согласования.':'Размер изделия, материал и толщину согласуйте до изготовления. Нестандартный материал требует отдельного согласования.',
    'PVC/винил не включаем в список материалов для CO₂-резки.':'ПВХ и винил не подходят для CO₂-резки.',
    'Объёмный/выборочный лак возможен только при соответствующей конфигурации Clear — это не обещаем без подтверждения текущей комплектации.':'Возможность объёмного или выборочного лака согласуйте отдельно: она зависит от комплектации оборудования.',
    'Толщина и материал выбираются только из доступных в калькуляторе вариантов.':'Доступные материалы и толщины уточните при согласовании заказа.',
    'Печать на металлическом изделии заказчика на этой странице не обещаем.':'Печать на металлическом изделии заказчика требует отдельного согласования.',
}
def requirements(prefix):
    checks='<ul class="company-req-checks">'+''.join(f'<li>{icon(i)}{text}</li>' for i,text in [('document','Проверьте файл'),('layers','Укажите размер'),('scissors','Учтите резку'),('check','Согласуйте макет')])+'</ul>'
    items=[]
    for item in SOURCE['requirements']:
        text=item['text']
        for before,after in REQUIREMENT_ADAPTATIONS.items():text=text.replace(before,after)
        service=next(s for s in CATALOG if s['id']==item['id'])
        answer=escape(text)+f'</p><p><a href="{service_url(service,prefix)}">{ "Открыть калькулятор" if item["id"] in ["3.1","4.4"] else "Посмотреть услугу" } →</a>'
        items.append((item['category'],escape(item['name']),answer))
    return checks+section('Требования к вашей услуге',filters(TOPICS[:6],requirements=True)+faq(items,True)+empty(),'Выберите направление или найдите услугу по названию. Здесь собраны требования для всех 55 услуг.',extra='id="requirements-content"')+cta(prefix,'Нужна помощь с макетом?','Пришлите файл и расскажите о задаче — проверим подготовку перед печатью.')

def photo(prefix):
    info='<div class="company-story"><div><h3>Образец под вашу задачу</h3><p>Чтобы увидеть подходящие примеры печати, напишите на <a href="mailto:tekkkst@yandex.ru">tekkkst@yandex.ru</a>.</p></div><div><h3>Что указать в сообщении</h3><p>Услугу, материал и предполагаемый тираж. Если есть референс или макет, приложите его — так проще подобрать подходящий образец.</p></div></div>'
    return info+section('С чего начнём?',direction_cards(prefix),'Выберите направление, для которого нужны примеры.')+note('Иллюстрации роботов на страницах — маскоты студии. Это не фотографии выполненных заказов.')+cta(prefix,'Подберём подходящий пример','Расскажите о продукции, материале и тираже.')

def actions_page(prefix):
    promo='<div class="company-promo"><div><span class="company-promo-number">−20%</span><h2>На пакетное ламинирование<br>от 20 штук</h2><p>Скидка действует при количестве от 20 штук.<br>Минимальная стоимость заказа — 60 ₽.</p><a class="button button-primary" href="'+prefix+'?service=1.4">Посмотреть услугу '+icon('arrow')+'</a></div><img src="'+prefix+'assets/direction-copy.webp" alt="" width="400" height="300" loading="lazy"></div>'
    return promo+section('Тиражные тарифы','<div class="company-grid">'+card('Количество','В ряде услуг цена за единицу зависит от тиража. Укажите нужное количество при расчёте или согласовании.','layers')+card('Общая площадь','Для печати по площади важны конечные размеры и число изделий. Сравнивайте одинаковые параметры.','wide')+card('Условия услуги','Тарифы и скидки одной услуги не переносятся автоматически на другую. Уточните условия вашего заказа.','check')+'</div>')+cta(prefix,'Рассчитаем ваш тираж','Назовите услугу, размер и количество — подберём подходящие условия.')

def reviews(prefix):
    platforms='<div class="company-grid">'+''.join(f'<a class="company-card company-review-card" href="{url}" target="_blank" rel="noopener">{icon("heart")}<h3>{label}</h3><p>Читайте отзывы клиентов и делитесь своим впечатлением о студии.</p><span class="company-read">Открыть отзывы ↗</span></a>' for label,url in MAPS)+'</div>'
    feedback='<div class="company-story"><div><h3>Поделитесь впечатлением</h3><p>Обратную связь по заказу можно отправить на <a href="mailto:tekkkst@yandex.ru">tekkkst@yandex.ru</a> или передать по телефону <a href="tel:+79236547896">+7 (923) 654-78-96</a>.</p></div><div><h3>Помогите нам разобраться в деталях</h3><p>Укажите услугу и дату заказа. Если есть вопрос по результату, приложите фотографию и опишите, что нужно проверить.</p></div></div>'
    return platforms+section('Ваше мнение важно',feedback)+note(f'Студия ТЕКСТ: Барнаул, проспект Строителей, 11. <a href="{prefix}contacts/">Контакты и карта</a>.')+cta(prefix,'Обсудим ваш заказ','Напишите напрямую — найдём заказ и разберёмся в деталях.')

def questions(prefix):
    groups=['Заказ','Макеты','Сроки','Получение','Макеты']
    items=[]
    for item,group in zip(SOURCE['questions'],groups):
        answer=escape(item['answer'])
        if group=='Заказ':answer='Да. Добавляйте позиции в корзину: у каждой сохраняются собственные параметры. Для услуг без онлайн-расчёта стоимость уточним при согласовании.'
        if group=='Макеты' and 'требования' in item['question'].lower():answer=f'Для чертежей, наклеек и полиграфии требования различаются. Все 55 памяток собраны в разделе <a href="{prefix}requirements/">«Технические требования»</a>.'
        if group=='Макеты' and 'макеты' in item['question'].lower():answer='Файлы остаются на вашем устройстве. При отправке письма на <a href="mailto:tekkkst@yandex.ru">tekkkst@yandex.ru</a> приложите их вручную. Проверьте вложения перед отправкой.'
        items.append((group,escape(item['question']),answer))
    return '<div id="questions-content">'+filters(['Заказ','Макеты','Сроки','Получение'])+faq(items,True)+empty()+'</div>'+note(f'Заказываете впервые? <a href="{prefix}kak-oformit-zakaz/">Посмотрите порядок оформления заказа</a>.')+cta(prefix,'Не нашли ответ?','Позвоните нам или напишите — поможем разобраться с вашим заказом.')

def order_guide(prefix):
    steps=[('Выберите услугу и параметры','Найдите услугу в меню или через поиск. Для визиток и стикерпаков используйте онлайн-калькуляторы. Для остальных услуг укажите размер, материал и тираж в запросе.'),
           ('Соберите позиции в корзине','Добавьте нужные изделия. Нажмите «Подготовить запрос», заполните имя, телефон и комментарий. Позиции без расчёта уточним со студией.'),
           ('Отправьте параметры и макеты','Нажмите «Открыть письмо» и вручную приложите файлы к письму на tekkkst@yandex.ru. Если почтовая программа не настроена, нажмите «Скачать запрос» и отправьте его вместе с макетом самостоятельно.'),
           ('Подтвердите заказ','После проверки макета согласуем окончательные параметры, стоимость, оплату и получение. Производственный срок начинается после полного согласования макета.')]
    grid='<div class="company-grid two">'+''.join(f'<article class="company-card company-order-step"><span class="company-step-number">0{n}</span><h2>{title}</h2><p>{text}</p></article>' for n,(title,text) in enumerate(steps,1))+'</div>'
    return grid+note('Скачивание расчёта или запроса не отправляет заказ. Проверьте письмо и вложения, отправьте его и дождитесь подтверждения студии.')+section('Выберите направление',direction_cards(prefix))+cta(prefix,'Поможем оформить заказ','Расскажите, что хотите напечатать — подскажем параметры и подготовку файла.')

def article_card(a,prefix):
    teaser=a['teaser'][:170]
    if len(a['teaser'])>170:teaser=teaser.rsplit(' ',1)[0]+'…'
    return f'<a class="company-card company-article-card" data-filter-item data-category="{escape(a["category"])}" href="{prefix}{a["path"]}"><div class="company-article-visual"><img src="{prefix}assets/{ASSETS[a["category"]]}.webp" alt="" width="180" height="130" loading="lazy"></div><div><small>{escape(a["category"])}</small><h2>{escape(a["title"])}</h2><p>{escape(teaser)}</p><span class="company-read">Читать статью →</span></div></a>'

def articles(prefix):
    return '<div id="articles-content">'+filters(TOPICS,True)+'<div class="company-grid" data-filter-list>'+''.join(article_card(a,prefix) for a in ARTICLES)+'</div>'+empty()+'<button class="button button-white company-load-more" data-load-more>Показать ещё статьи '+icon('plus')+'</button></div>'+cta(prefix,'Остались вопросы по печати?','Поможем применить рекомендации к вашему макету и заказу.')

def date_label(value):
    year,month,day=value.split('-')
    months=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
    return f'{int(day)} {months[int(month)-1]} {year}'

def related_link_label(link):
    if link['route'] in SERVICES:return SERVICES[link['route']]['name']
    target=SOURCE_ROUTES.get(link['route'])
    return next((name for name,path,_ in PAGES if path==target),'Как оформить заказ' if target=='kak-oformit-zakaz/' else link['label'])

build('company/about/','ТЕКСТ — <em>больше,</em><br>чем печать',paragraphs('')[0],'company-about.webp',about,schema_type='AboutPage',seo=page_seo(''))
build('contacts/','Хорошие идеи<br>начинаются <em>с общения</em>','Приезжайте в студию на Строителей, 11 или напишите нам. Обсудим вашу задачу и поможем с заказом.','company-contacts.webp',contacts,schema_type='ContactPage',seo=page_seo('contacts'),actions='<a class="button button-primary" href="tel:+79236547896">'+icon('phone')+' Позвонить</a><button class="button button-white" data-action="contacts">Написать нам</button>')
build('dostavka-i-oplata/','Ваши идеи<br>уже <em>в пути</em>','Самовывоз из студии и отправка по России. Условия, стоимость и способ получения согласуем при подтверждении заказа.','company-delivery.webp',delivery,seo=page_seo('delivery'))
build('company/payment/','Сначала детали.<br>Потом <em>оплата</em>','Проверим макеты, согласуем состав заказа и итоговую стоимость. После подтверждения сообщим способ оплаты и реквизиты.','company-contacts.webp',payment,seo=page_seo('payment'))
build('requirements/','Хорошая печать<br>начинается <em>с макета</em>','Требования к файлам для всех 55 услуг: документы, чертежи, полиграфия, наклейки и изделия с резкой. Найдите памятку для своей задачи.','company-requirements.webp',requirements,seo=page_seo('requirements'),actions='<a class="button button-primary" href="#requirements-content">Посмотреть требования '+icon('arrow')+'</a><button class="button button-white" data-action="contacts">Помощь с макетом</button>')
build('company/photo/','Печать, которую<br>можно <em>увидеть</em>','Подберём подходящие примеры под вашу задачу. Напишите, что нужно изготовить, на каком материале и каким тиражом.','company-about.webp',photo,seo=page_seo('photo','Примеры печати студии ТЕКСТ в Барнауле. Напишите на tekkkst@yandex.ru, укажите услугу, материал и тираж — подберём подходящие образцы.'))
build('company/action/','Больше тираж —<br><em>выгоднее печать</em>','Скидка на пакетное ламинирование и тиражные тарифы. Подберём условия для вашего количества и выбранной продукции.','direction-copy.webp',actions_page,seo=page_seo('action'))
build('company/request/','Спасибо<br>за ваше <em>доверие</em>','Отзывы клиентов и обратная связь со студией. Читайте впечатления на картах или расскажите нам о своём заказе.','company-about.webp',reviews,seo=page_seo('request','Отзывы о студии печати ТЕКСТ в Барнауле. Читайте на картах или отправьте обратную связь на tekkkst@yandex.ru, указав услугу и дату заказа.'))
build('company/vopros-otvet/','Всё, что вы хотели<br><em>спросить о печати</em>','Ответы о расчёте, отправке файлов, сроках и получении заказа. Выберите тему или найдите свой вопрос.','company-contacts.webp',questions,seo=page_seo('vopros-otvet','Ответы студии ТЕКСТ на вопросы о корзине, макетах, производственных сроках и получении заказа. Барнаул, Строителей, 11.'),actions='<a class="button button-primary" href="#questions-content">Найти ответ '+icon('search')+'</a><button class="button button-white" data-action="contacts">Задать вопрос</button>')
build('company/article/','Полезно знать<br><em>перед печатью</em>','150 практических материалов: выбираем бумагу и материалы, готовим документы и макеты, разбираемся в технологиях.','company-requirements.webp',articles,seo=page_seo('articles'),schema_type='CollectionPage',actions='<a class="button button-primary" href="#articles-content">Выбрать статью '+icon('arrow')+'</a><a class="button button-white" href="../../requirements/">Требования к файлам</a>')
build('kak-oformit-zakaz/','От идеи<br>до <em>готового заказа</em>','Четыре шага: выбрать услугу, подготовить параметры, отправить файлы и подтвердить заказ со студией.','company-contacts.webp',order_guide,actions='<button class="button button-primary" data-action="catalog">Выбрать услугу '+icon('arrow')+'</button><button class="button button-white" data-action="cart">Открыть корзину</button>')
build('company/','Знакомьтесь:<br>студия печати <em>ТЕКСТ</em>','О нашей работе, производстве и заботе о ваших заказах. Вся полезная информация о студии — в одном разделе.','company-about.webp',lambda prefix:'<div class="company-grid">'+''.join(f'<a class="company-card" href="{prefix}{path}">{icon(i)}<h3>{label}</h3><p>{intro}</p></a>' for (label,path,intro),i in zip(PAGES,['printer','pin','truck','bag','check','layers','heart','message','message','document','check']))+'</div>'+cta(prefix),schema_type='CollectionPage')

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
        date=f'<p class="company-article-date">Опубликовано {date_label(a["seo"]["Опубликовано"])} · Обновлено {date_label(a["seo"]["Обновлено"])}<br>Редакция студии ТЕКСТ</p>'
        link_title='Услуги по теме' if any(s['route'] in SERVICES for s in a['services']) else 'Полезные ссылки'
        return date+'<div class="company-reading-layout"><article class="company-reading">'+''.join(content)+'</article>'+aside+'</div>'+section(link_title,services)+section('Ещё по этой теме','<div class="company-grid">'+''.join(article_card(other,prefix) for other in related)+'</div>')+cta(prefix,'Применим к вашему заказу','Пришлите макет и параметры — поможем разобраться в деталях.')
    minutes=max(2,math.ceil(sum(len(b['text'].split()) for b in a['blocks'])/180))
    seo={'title':a['seo']['Title'],'description':a['seo']['Description'],'published':a['seo']['Опубликовано'],'updated':a['seo']['Обновлено']}
    build(a['path'],escape(a['title']),f'{escape(a["category"])} · {minutes} мин чтения. Практическая памятка по подготовке и выбору печатной продукции.',ASSETS[a['category']]+'.webp',reading,actions='<a class="button button-white" href="../">'+icon('arrow')+' Все статьи</a>',schema_type='Article',seo=seo)

manifest={'source':SOURCE['source'],'articles':[{k:a[k] for k in ['id','title','category','path','source_route']} for a in ARTICLES]}
(ROOT/'company-articles.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Built {len(PAGES)-1} company pages, overview, order guide and {len(ARTICLES)} complete articles with {len(SOURCE["requirements"])} service requirements.')
