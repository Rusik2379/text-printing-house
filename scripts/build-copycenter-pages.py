"""Build the Copy Center landing and nine service pages in the shared design.

Run before build-company-pages.py, which applies SEO and resource fingerprints
to the whole site. Content is imported separately; this build needs no archive.
"""
from pathlib import Path
from html import escape
from urllib.parse import quote
import json, re, subprocess, os, shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads((ROOT / 'copycenter-content.json').read_text(encoding='utf-8'))
SERVICES = SOURCE['services']
BY_ID = {s['id']: s for s in SERVICES}
ARTICLES = json.loads((ROOT / 'company-articles.json').read_text(encoding='utf-8'))['articles']
STICKERS = json.loads((ROOT / 'sticker-services.js').read_text(encoding='utf-8').split('=', 1)[1].rstrip(';\n '))
PROJECTS = {s['id']:s for s in json.loads((ROOT/'project-content.json').read_text(encoding='utf-8'))['services']} if (ROOT/'project-content.json').is_file() else {}
home = (ROOT / 'index.html').read_text(encoding='utf-8')
header = home[home.index('  <a class="skip-link"'):home.index('  <main id="main">')]
footer = home[home.index('  <footer'):home.index('</body>')]
head = home[home.index('<head>')+6:home.index('</head>')]
head = re.sub(r'\s*<script\b[^>]*type="application/ld\+json"[^>]*>.*?</script>', '', head, flags=re.S)
head = re.sub(r'\s*<meta\b[^>]*(?:name="(?:description|robots)"|property="og:[^"]+")[^>]*>|\s*<link\b[^>]*rel="canonical"[^>]*>', '', head)

def icon(name): return f'<span data-icon="{name}"></span>'
def text(value): return escape(str(value))
def paths(html, prefix):
    return re.sub(r'(href|src)="([^"#]+)"', lambda m: m[0] if re.match(r'^[a-z]+:|^//', m[2]) else f'{m[1]}="{prefix}{m[2]}"', html)
def paragraphs(value): return ''.join('<p>'+text(p)+'</p>' for p in value.split('\n\n') if p.strip())
def section(title, body, anchor='', intro=''):
    return f'<section class="company-section"{f" id=\"{anchor}\"" if anchor else ""}><div class="company-section-heading"><h2>{title}</h2></div>{f"<p class=\"company-section-intro\">{intro}</p>" if intro else ""}{body}</section>'
def money(value): return f'{value:,.2f}'.rstrip('0').rstrip('.').replace(',', '\u00a0').replace('.', ',') + ' ₽'
def price(q): return money(q['price']).removesuffix(' ₽')+'–'+money(q['upper']) if q['range'] else money(q['price'])

EXAMPLES = {
 '1.1': [('Документ на 10 страниц',{},'A4 · ч/б · одна сторона · 80 г/м²'),('50 страниц с двух сторон',{'B7':50,'B6':'двусторонняя'},'A4 · ч/б · 25 физических листов'),('Цветной документ A3',{'B4':'А3','B5':'цветная','B7':10},'10 страниц · одна сторона · тариф зависит от заполнения')],
 '1.2': [('Оригиналы со стекла',{},'A4 · ч/б · 25 прогонов'),('Стопка документов',{'B6':'С автоподатчика','B7':50},'A4 · ч/б · 50 прогонов'),('Крупная цветная копия',{'B4':'A3','B5':'Цвет','B7':10},'A3 · со стекла · 10 прогонов')],
 '1.3': [('Набор фотографий',{'B8':10},'A6 · сатин · 10 отпечатков'),('Фотография на стену',{'B4':'A2','B5':'Матовая','B8':1},'A2 · матовая бумага · 1 отпечаток'),('Ваш размер',{'B4':'Индивидуальный','B6':300,'B7':400,'B8':3},'300 × 400 мм · сатин · 3 отпечатка')],
 '1.4': [('Один документ',{'B4':'A4','B5':'75 мкм','B6':1},'A4 · 75 мкм · минимальный заказ 60 ₽'),('Памятки и карточки',{},'A6 · 125 мкм · 25 штук · скидка 20 %'),('Меню и инструкции',{'B4':'A4','B5':'100 мкм','B6':20},'A4 · 100 мкм · 20 штук · скидка 20 %')],
 '1.5': [('Небольшой документ',{'B4':'Пластик','B5':'A4','B7':'6–8 мм (до 40 л.)','B8':1},'A4 · пластиковая пружина · до 40 листов'),('Альбомы A3',{},'Металл · 10 мм · до 80 листов · 12 альбомов'),('Комплект документов',{'B4':'Металл','B5':'A4','B7':'10 мм (до 80 л.)','B8':26},'A4 · металлическая пружина · 26 экземпляров')],
 '1.6': [('Печать и твёрдый переплёт',{},'55 ч/б + 22 цветные страницы · 1 экземпляр · 3 мультифоры'),('Переплёт готовой печати',{'B5':'ПЕЧАТЬ ВАША','B7':50,'B13':0},'A4 · 50 листов · красная твёрдая обложка'),('Мягкий переплёт',{'B4':'Мягкий','B5':'ПЕЧАТЬ ВАША','B7':50,'B12':'Белый','B13':0},'A4 · 50 листов · белая обложка')],
 '1.7': [('Сшитый документ',{},'A4 · 2 прогона · ручная подача'),('Архив отдельных листов',{'B6':'НЕТ','B7':25},'A4 · 25 прогонов · автоподатчик'),('Документы A3',{'B5':'A3','B7':10},'10 прогонов · ручная подача')],
 '1.8': [('Небольшая партия',{'B7':50},'58 × 40 мм · 50 термоэтикеток'),('Маркировка товаров',{'B7':200},'58 × 40 мм · 200 термоэтикеток'),('Большой тираж',{'B7':501},'58 × 40 мм · 501 термоэтикетка')],
 '1.9': [('Тираж 100 экземпляров',{},'A5 · 24 ч/б страницы · зелёная обложка'),('Небольшой тираж',{'B8':10,'B7':'БЕЛАЯ'},'A5 · 24 ч/б страницы · 10 экземпляров'),('С цветными вставками',{'B4':20,'B5':4,'B8':50,'B7':'БЕЛАЯ'},'A5 · 20 ч/б + 4 цветные страницы · 50 экземпляров')],
}
# Use the same pricing API for visible examples and the interactive form.
node = os.environ.get('NODE_BINARY') or shutil.which('node') or str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe')
js = "require('./copycenter-pricing-data.js');require('./copycenter-engine.js');require('./copycenter-pricing.js');const input=" + json.dumps(EXAMPLES, ensure_ascii=False) + ";console.log(JSON.stringify(Object.fromEntries(Object.entries(input).map(([id,items])=>[id,items.map(([name,c,note])=>({name,note,...TEXT_COPYCENTER_PRICING.quote(id,c)}))]))));"
QUOTES = json.loads(subprocess.check_output([node, '-e', js], cwd=ROOT).decode('utf-8'))
for service_id, examples in QUOTES.items():
    for q in examples:
        if not q['valid']: raise ValueError(service_id + ': invalid price example ' + str(q))

INTRO = {
 '1.1':'Документы для учёбы, работы и ваших идей. Выберите A4 или A3, чёрно-белую или цветную печать — рассчитайте стоимость и подготовьте заказ онлайн.',
 '1.2':'Копии с бумажных оригиналов A4 и A3. Выберите цветность и способ подачи: аккуратно со стекла или стопкой через автоподатчик.',
 '1.3':'Любимые кадры на бумаге — от небольших фотографий до A1 и вашего размера. Выберите формат, материал и количество отпечатков.',
 '1.4':'Защитите документы, меню, памятки и карточки. Подберём формат пакета и толщину плёнки, а стоимость вы узнаете сразу.',
 '1.5':'Соберём документы, отчёты и курсовые в удобный блок. Пластиковая или металлическая пружина для A4 и A3 — с подбором по толщине листов.',
 '1.6':'Финальный штрих для вашей работы. Напечатаем и переплетём диплом или соберём готовые листы A4 в выбранную обложку.',
 '1.7':'Переведём бумажные документы до A3 в электронный вид. Согласуем порядок страниц и результат: один PDF или отдельные файлы.',
 '1.8':'Чёткая маркировка товаров и отправлений. Чёрно-белые термоэтикетки 58 × 40 мм с текстом и штрихкодами — от 50 штук.',
 '1.9':'Авторефераты A5 с двусторонней печатью и скреплением на скобы. Рассчитайте весь тираж: печать, обложки, подготовку и биговку.',
}
VARIANTS = {
 '1.1':[('A4 или A3','Для документов, таблиц и схем. Укажите формат и масштаб печати.','document'),('Одна или две стороны','Ч/б и цветные страницы считайте отдельными позициями. Пустые обороты проверьте в PDF.','copy'),('Бумага для задачи','80 г/м², IQ Color для A4 и Color Copy 120, 200 или 300 г/м². Доплата зависит от числа листов.','layers')],
 '1.2':[('Со стекла','Для сшитых, отдельных и сложных оригиналов. Возможность копирования ветхих листов согласуем.','copy'),('С автоподатчика','Для ровных отдельных листов. Уберите скобы и проверьте порядок оригиналов.','printer'),('Считаем стороны','Один прогон — одна копируемая сторона. Заполненный оборот тоже входит в расчёт.','calculator')],
 '1.3':[('Ваш формат','Полароид, квадрат A6, A6–A1 или индивидуальный размер в миллиметрах.','wide'),('Сатин или матовая','До A3 — сатин. Для A2, A1 и индивидуального размера доступны два материала.','layers'),('Кадрирование','Согласуйте обрезку под формат или вписывание с полями. Важные детали должны остаться в кадре.','target')],
 '1.4':[('Четыре формата','Пакеты A6, A5, A4 и A3. Учитывайте готовый размер вместе с герметичной кромкой.','wide'),('Толщина плёнки','75, 100 или 125 мкм. Выберите подходящий пакет до запуска работы.','layers'),('Выгоднее тиражом','От 20 изделий — скидка 20 %. Минимальная стоимость одной позиции — 60 ₽.','calculator')],
 '1.5':[('Пластиковая пружина','Диаметр 6–51 мм: варианты для блока до 500 листов по таблице вместимости.','layers'),('Металлическая пружина','Диаметр 6–14 мм: варианты до 120 листов. Формат документа A4 или A3.','document'),('Толщина блока','Вместимость ориентировочная: плотная бумага, обложки и вкладки увеличивают толщину.','target')],
 '1.6':[('Два типа переплёта','Твёрдый или мягкий. Блок A4 содержит от 15 до 300 физических листов.','document'),('Цвет обложки','Для твёрдого: красный, синий или чёрный. Для мягкого: белый.','palette'),('С печатью или без','Рассчитайте печать ч/б и цветных страниц либо переплёт уже готового блока. Мультифоры — отдельно.','printer')],
 '1.7':[('Оригиналы до A3','Сканируем документы A4 и A3. Большие форматы этим калькулятором не рассчитываются.','wide'),('Ручная или автоподача','Сшитые документы — вручную. Для отдельных листов доступен автоподатчик.','copy'),('Понятный результат','Перед работой согласуйте порядок страниц, цветность, детализацию и объединение в PDF.','document')],
 '1.8':[('58 × 40 мм','Фиксированный размер этикетки. Печать на TSC TE200 с разрешением 203 dpi.','sticker'),('Текст и штрихкоды','Чёрно-белый макет. Сохраняйте пропорции кодов и свободные поля вокруг них.','target'),('От 50 штук','До 200 — 5 ₽/шт.; 201–500 — 4 ₽/шт.; от 501 — 3 ₽/шт.','calculator')],
 '1.9':[('Готовый формат A5','Двусторонняя печать, скрепление на скобы. Страницы в PDF идут по порядку чтения.','document'),('Ч/б и цвет','Укажите число страниц каждого типа. Общий объём кратен четырём, включая пустые полосы.','palette'),('Тираж от 10','В расчёт включены печать, подготовка, скобы, обложки и биговка. Доставка — отдельно.','calculator')],
}

def benefits():
    return '<div class="cc-benefits">'+''.join(f'<article>{icon(i)}<div><h2>{h}</h2><p>{p}</p></div></article>' for i,h,p in [('calculator','Стоимость онлайн','Параметры и состав цены перед заказом'),('check','Проверим детали','Файл или оригиналы согласуем до работы'),('pin','Удобно получить','Барнаул, Строителей, 11 · отправка по России')])+'</div>'

def faq(service=None):
    items = list(service['faq']) if service else [
      {'q':'Можно прислать документы заранее?','a':'Да. Отправьте PDF на tekkkst@yandex.ru, в Telegram или MAX. Укажите услугу, формат, параметры и количество. Заказ начинается после согласования.'},
      {'q':'Вы работаете с бумажными оригиналами?','a':'Да, для копирования, сканирования, ламинирования и переплёта можно принести готовые листы. Уточните состояние, размер и порядок оригиналов.'},
      {'q':'Можно заказать несколько услуг вместе?','a':'Рассчитайте нужные позиции отдельно и добавьте их в общую корзину. Например, печать документов и брошюровку. Отправьте запрос для подтверждения всего заказа.'},
      {'q':'Как узнать срок изготовления?','a':'Ориентир для копицентра — один рабочий день на каждые 10 000 ₽ заказа с округлением вверх. Срок начинается после полного согласования; подготовка макета и доставка в него не входят.'},
      {'q':'Как получить готовый заказ?','a':'Самовывоз: Барнаул, проспект Строителей, 11. Возможность курьерской доставки по городу и отправки по России, стоимость и срок согласуйте со студией.'},
      {'q':'Где посмотреть требования к файлам?','a':'На странице каждой услуги есть свой список проверок. Общие правила также собраны в разделе «Технические требования».'},
    ]
    if service:
        items += [
          {'q':'Что передать для начала работы?','a':service['technical']['send']+' '+service['requirements']},
          {'q':'Как получить готовый заказ?','a':'Можно забрать заказ на проспекте Строителей, 11 в Барнауле. Курьерскую доставку и отправку по России, стоимость и срок согласуйте со студией.'},
          {'q':'Добавление в корзину запускает производство?','a':'Корзина сохраняет расчёт в вашем браузере. Подготовьте запрос, отправьте его вместе с файлами и согласуйте заказ со студией. После подтверждения параметров, макета и оплаты заказ передаётся в работу.'},
        ]
    return '<div class="company-faq cc-faq faq-list">'+''.join(f'<details><summary>{text(item["q"])}{icon("plus")}</summary><p>{text(item["a"])}</p></details>' for item in items)+'</div>'

def related_link(service_id,prefix):
    art={
        '2.2':'service-project-binding.webp','2.4':'service-drawing-scan.webp',
        '3.1':'popular-art-визитки.webp','3.2':'popular-art-листовки.webp',
        '3.6':'service-postcards.webp','3.7':'service-certificates.webp',
        '4.5':'sticker-hero-labels.webp','4.7':'sticker-hero-paper.webp',
        '5.2':'service-posters.webp','5.4':'service-canvas.webp',
    }
    if service_id in PROJECTS:
        s=PROJECTS[service_id];image=s['art']
    elif service_id in BY_ID:
        s=BY_ID[service_id];image=s['art']
    elif service_id in STICKERS:
        s=STICKERS[service_id];image=art[service_id]
    else:
        catalog=json.loads((ROOT/'catalog.js').read_text(encoding='utf-8').split('=',1)[1].rstrip(';\n '))
        s=next(s for s in catalog if s['id']==service_id);image=art[service_id]
    tag='a' if s.get('path') else 'button'
    attrs=f'href="{prefix}{s["path"]}"' if tag=='a' else f'type="button" data-service="{service_id}"'
    name=' '.join(f'<span class="featured-word">{text(word)}</span>' for word in s['name'].split())
    return f'<{tag} class="featured-card" {attrs} aria-label="{text(s["name"])}"><span class="featured-copy"><span class="featured-name">{name}</span><span class="cc-card-link">Выбрать услугу →</span></span><span class="featured-art"><img src="{prefix}assets/{image}" alt="" width="960" height="960" loading="lazy"></span></{tag}>'

def calculator(s,prefix):
    fixed = s['technical']['fixed']
    if s['id']=='1.7':fixed=['Документы A4 и A3']
    if s['id']=='1.5':fixed=['Форматные документы A4 и A3']
    return f'''<section class="cc-calculator" id="calculator" aria-labelledby="calculator-title">
      <div class="cc-heading"><h2 id="calculator-title">Выберите нужные параметры</h2><p>Сравните варианты тиража — стоимость пересчитывается сразу.</p></div>
      <form id="copycenter-form"><div class="cc-calc-layout"><div class="cc-options-panel">
        <button class="cc-copy-button" type="button" data-cc-copy disabled aria-label="Скопировать параметры, стоимость и ссылку" title="Скопировать параметры, стоимость и ссылку">{icon('copy')}<span>Скопировать расчёт</span></button>
        <div class="cc-parameters" data-cc-fields></div>
        <div class="cc-parameter-footer">{('<div class="cc-fixed">'+''.join('<span>'+text(v)+'</span>' for v in fixed)+'</div>') if fixed and s['id']!='1.8' else ''}
        <p class="cc-helper"><a href="#service-requirements">Проверить требования к макету →</a></p><button class="cc-reset" type="button" data-cc-reset>Сбросить параметры</button></div>
      </div><aside class="cc-result" aria-label="Макет и результат расчёта">
        <label class="cc-upload" data-cc-file-zone>{icon('upload')}<strong data-cc-file-label>Загрузите макет</strong><span>или перетащите файл сюда</span><input type="file" data-cc-file accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.svg,.ai,.eps,.cdr,.psd,.zip"></label>
        <div class="cc-file-tools"><p class="cc-file-status" data-cc-file-status role="status"></p><button type="button" data-cc-remove-file hidden>Убрать файл</button></div>
        <label class="cc-comment" for="cc-comment">Комментарий к заказу<textarea id="cc-comment" data-cc-comment rows="2" maxlength="2000" placeholder="Пожелания к макету или заказу"></textarea></label>
        <div class="cc-result-summary"><p class="cc-error" data-cc-error role="status" hidden></p><h3>Стоимость заказа</h3><div class="cc-total" data-cc-total aria-live="polite">—</div><p class="cc-days" data-cc-days></p>
        <p class="cc-range-note" data-cc-range-note hidden>Диапазон для цветной печати A3. Итоговый тариф зависит от заполнения страниц и подтверждается после проверки файла.</p>
        <button class="cc-add-button" type="submit" data-cc-add disabled>В корзину</button><div class="cc-tools"><button type="button" data-cc-download disabled>{icon('download')}Скачать расчёт</button><button type="button" data-action="cart">Открыть корзину</button></div>
        <p class="cc-disclosure">Расчёт и наличие материалов подтвердим перед производством. Файл сохраняется только в вашем браузере.</p></div>
      </aside></div><details class="cc-breakdown" data-cc-breakdown-panel hidden><summary>Из чего складывается цена</summary><dl data-cc-breakdown></dl></details><p class="cc-calculator-note">{text(s['sla'])} Подготовка макета и доставка согласуются отдельно.</p></form><noscript><p>Для интерактивного расчёта включите JavaScript. Ниже доступны примеры стоимости; точный заказ можно согласовать по телефону +7 (923) 654-78-96.</p></noscript>
    </section>'''

def service_body(s,prefix):
    sid=s['id'];tech=s['technical']
    examples='<div class="cc-examples">'+''.join(f'<article class="cc-example"><h3>{text(q["name"])}</h3><p>{text(q["note"])}</p><strong>{price(q)}</strong><a href="?calc={quote(json.dumps(q["configuration"],ensure_ascii=False,separators=(",",":")))}#calculator">Рассчитать этот вариант</a></article>' for q in QUOTES[sid])+'</div>'
    variants='<div class="cc-variants">'+''.join(f'<article class="cc-variant">{icon(i)}<h3>{h}</h3><p>{p}</p></article>' for h,p,i in VARIANTS[sid])+'</div>'
    process='<div class="cc-process">'+''.join(f'<article class="cc-step"><span class="cc-step-number">0{n}</span><h3>{h}</h3><p>{p}</p></article>' for n,h,p in [(1,'Согласуем заказ','Выберите параметры, подготовьте файл или оригиналы. До запуска подтвердим стоимость, срок и детали.'),(2,'Выполним работу',text(s['production'])),(3,'Передадим вам','Заберите заказ в студии или согласуйте доставку. Проверим комплектность и упаковку.')])+'</div>'
    checks='<ul class="cc-checks">'+''.join(f'<li>{icon("check")}<span>{text(v)}</span></li>' for v in tech['checks'])+'</ul>'
    requirements=f'<div class="cc-requirements">{checks}<aside class="cc-file-guide"><h3>Что подготовить</h3><p>{text(tech["send"])}</p><p>{text(s["requirements"])}</p><p class="cc-example-note"><strong>Например:</strong> {text(tech["example"])}</p><a class="text-button" href="{prefix}requirements/#requirement-{sid.replace(".","-")}">Все требования к услуге {icon("arrow")}</a></aside></div>'
    articles=[a for a in SOURCE['articles'] if a['id'] in s['articleIds']][:3]
    local={a['source_route']:a for a in ARTICLES}
    reading='<div class="cc-reading">'+''.join(f'<a href="{prefix}{local[a["url"]]["path"]}"><h3>{text(a["h1"])}</h3><span>Читать статью →</span></a>' for a in articles)+'</div>'
    related=f'<div class="featured-grid cc-related" data-cards="{len(s["related"])}">'+''.join(related_link(i,prefix) for i in s['related'])+'</div>'
    return calculator(s,prefix)+section('Примеры стоимости',examples,'price-examples','Ориентиры для конкретных параметров. Вы можете открыть любой пример и изменить его.')+section('Варианты для вашей задачи',variants,'service-options')+section('От заказа до результата',process)+section('Проверьте перед заказом',requirements,'service-requirements')+section('Частые вопросы',faq(s),'service-faq')+section('Добавьте к заказу',related,'related-services')+section('Полезно перед печатью',reading)+section(s['name']+' в студии ТЕКСТ','<div class="cc-seo">'+paragraphs(s['seo'])+'</div>')

CARD_TEXT = ['A4 и A3 · ч/б и цвет · одна или две стороны','Бумажные оригиналы · со стекла или стопкой','От полароида до A1 · сатин и матовая бумага','A6–A3 · плёнка 75–125 мкм','Пластик или металл · документы A4 и A3','С печатью или без · твёрдая и мягкая обложка','Оригиналы до A3 · PDF и отдельные файлы','58 × 40 мм · текст и штрихкоды · от 50 шт.','A5 · скобы · тираж от 10 экземпляров']
def landing_body(prefix):
    cards='<div class="cc-category-grid" id="copycenter-services">'+''.join(f'<a class="cc-service-card" href="{s["path"].removeprefix("kopitsentr/")}"><div><h3>{text(s["name"])}</h3><p>{CARD_TEXT[i]}</p><span>Рассчитать →</span></div><img src="{prefix}assets/{s["art"]}" alt="" width="960" height="960" loading="lazy"></a>' for i,s in enumerate(SERVICES))+'</div>'
    return section('Всё для документов и фотографий',cards,intro='Выберите услугу, рассчитайте параметры и соберите заказ в общей корзине.')+section('Как оформить заказ','<div class="cc-process">'+''.join(f'<article class="cc-step"><span class="cc-step-number">0{n}</span><h3>{h}</h3><p>{p}</p></article>' for n,h,p in [(1,'Выберите услугу','Откройте калькулятор на странице услуги. Укажите формат, материал, количество и дополнительные работы.'),(2,'Подготовьте запрос','Добавьте расчёты в корзину. Отправьте запрос и файлы в студию или принесите бумажные оригиналы.'),(3,'Получите результат','После согласования и оплаты выполним работу. Самовывоз в Барнауле или согласованная доставка.')])+'</div>')+section('Частые вопросы',faq(),'service-faq')

for service in [None,*SERVICES]:
    path=service['path'] if service else 'kopitsentr/';prefix='../'*len(Path(path).parts)
    title=service['h1'] if service else 'Копицентр в Барнауле'
    heading=text(title).replace(' в Барнауле',' <span class="cc-hero-place">в Барнауле</span>')
    intro=INTRO[service['id']] if service else 'Печать, копии, фотографии и аккуратный переплёт. Девять услуг с онлайн-расчётом — для учёбы, работы и ваших идей.'
    art=service['art'] if service else SERVICES[0]['art']
    primary='#calculator' if service else '#copycenter-services'
    actions=f'<a class="button button-primary" href="{primary}">{"Рассчитать стоимость" if service else "Выбрать услугу"} {icon("arrow")}</a><button class="button button-white" type="button" data-action="contacts">Задать вопрос</button>'
    breadcrumb=f'<nav class="company-breadcrumbs" aria-label="Хлебные крошки"><a href="{prefix}">Главная</a><span aria-hidden="true">/</span>'+(f'<a href="../">Копицентр</a><span aria-hidden="true">/</span><span aria-current="page">{text(service["name"])}</span>' if service else '<span aria-current="page">Копицентр</span>')+'</nav>'
    hero=f'<section class="cc-hero" aria-labelledby="copycenter-title"><div><h1 id="copycenter-title">{heading}</h1><p>{intro}</p><div class="company-actions">{actions}</div></div><div class="cc-art"><img src="{prefix}assets/{art}" alt="Робот ТЕКСТ — {text(service["name"] if service else "печать документов")}" width="960" height="960" fetchpriority="high"></div></section>'
    cta=f'<aside class="company-cta"><div><h2>Поможем с вашим заказом</h2><p>Обсудим параметры, проверим файл и согласуем готовность.</p></div><div class="company-actions"><a class="company-phone" href="tel:+79236547896">{icon("phone")}+7 (923) 654-78-96</a><button class="button button-primary" type="button" data-action="contacts">Написать нам {icon("arrow")}</button></div></aside>'
    page_head=paths(head,prefix)
    page_head=re.sub(r'<title>.*?</title>',f'<title>{text(service["title"] if service else "Копицентр в Барнауле | ТЕКСТ")}</title>',page_head)
    page_head+=f'<link rel="stylesheet" href="{prefix}company-pages.css"><link rel="stylesheet" href="{prefix}copycenter.css">\n'
    if service:
        page_head+=''.join(f'<script src="{prefix}{file}.js" defer></script>\n' for file in ['copycenter-pricing-data','copycenter-engine','copycenter-pricing','copycenter'])
    page_header=paths(header,prefix).replace('class="brand" href="#main"',f'class="brand" href="{prefix}"')
    page_footer=paths(footer,prefix).replace('class="brand" href="#main"',f'class="brand" href="{prefix}"')
    body=service_body(service,prefix) if service else landing_body(prefix)
    attribute=f' data-copycenter-service="{service["id"]}"' if service else ''
    html=f'<!doctype html>\n<html lang="ru"><head>{page_head}</head><body class="company-page copycenter-page">\n{page_header}<main id="main"{attribute}><div class="container">{breadcrumb}{hero}{benefits()}{body}{cta}</div></main>\n{page_footer}</body></html>\n'
    output=ROOT/path/'index.html';output.parent.mkdir(parents=True,exist_ok=True);output.write_text(html,encoding='utf-8')
print('Built Copy Center landing and 9 service pages with 27 calculated examples.')
