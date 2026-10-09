"""Build the Project documentation landing and seven service pages in the shared design.

Run before build-company-pages.py, which applies SEO and resource fingerprints
to the whole site. Content is imported separately; this build needs no archive.
"""
from pathlib import Path
from html import escape
from urllib.parse import quote
import json, re, subprocess, os, shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads((ROOT / 'project-content.json').read_text(encoding='utf-8'))
SERVICES = SOURCE['services']
BY_ID = {s['id']: s for s in SERVICES}
ARTICLES = json.loads((ROOT / 'company-articles.json').read_text(encoding='utf-8'))['articles']
STICKERS = json.loads((ROOT / 'sticker-services.js').read_text(encoding='utf-8').split('=', 1)[1].rstrip(';\n '))
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

def preparation(s, prefix):
    tech=s['technical']
    checks='<ul class="cc-checks">'+''.join(f'<li>{icon("check")}<span>{text(v)}</span></li>' for v in tech['checks'])+'</ul>'
    guide=f'<aside class="cc-file-guide"><h3>Что подготовить</h3><p>{text(tech["send"])}</p><p>{text(s["requirements"])}</p><p class="cc-example-note"><strong>Например:</strong> {text(tech["example"])}</p><a class="text-button" href="{prefix}requirements/#requirement-{s["id"].replace(".","-")}">Все требования к услуге {icon("arrow")}</a></aside>'
    answers=[]
    if tech.get('fileSpec'):
        answers.append(('Какой файл или оригинал подготовить?',paragraphs(tech['fileSpec'])))
    for key,title in [('critical','Что особенно важно проверить?'),('mistakes','Каких ошибок избежать?')]:
        if tech.get(key):
            answers.append((title,paragraphs('\n\n'.join(tech[key]))))
    if tech.get('preflight'):
        answers.append(('Что проверим перед запуском?',paragraphs(tech['preflight'])))
    details='<div class="company-faq cc-faq faq-list project-preparation-details">'+''.join(f'<details><summary>{title}{icon("plus")}</summary>{body}</details>' for title,body in answers)+'</div>'
    return f'<div class="cc-requirements">{checks}{guide}</div>'+details

EXAMPLES = {
 '2.1':[('Чертежи A1',{},'A1 · ч/б · 10 листов · без обработки'),('Комплект разных форматов',{'rows':[{'B':'A1','C':'Ч/Б','D':5},{'B':'A2','C':'Цвет','D':10}],'B4':'Под A4'},'5 листов A1 + 10 листов A2 · фальцовка под A4'),('Проект на пружине',{'rows':[{'B':'A1','C':'Ч/Б','D':20}],'B4':'Под A4','B5':'Да','B6':'Пластик','B7':'A4','B8':'10–12 мм (до 80 л.)','B9':1},'20 листов A1 · фальцовка · одна брошюра A4')],
 '2.2':[('Один альбом A3',{},'Металл · 10 мм · до 80 обычных листов'),('Том проекта A4',{'B4':'Пластик','B5':'A4','B7':'6–8 мм (до 40 л.)','B8':1},'Пластик · до 40 листов · проектный коэффициент 1,15'),('Серия из 12 альбомов',{'B8':12},'A3 · металл · до 80 листов · 12 комплектов')],
 '2.3':[('Десять чертежей A1',{'B4':'A1','B5':10},'10 готовых листов A1'),('Чертежи A2',{'B4':'A2','B5':25},'25 готовых листов A2'),('Удлинённые листы',{},'A1×4 · 10 готовых листов')],
 '2.4':[('Сшитые чертежи A4',{},'A4 · 10 сторон · ручная подача'),('Чертежи A3',{'B5':'A3','B7':10},'A3 · 10 сторон · ручная подача'),('Отдельные листы',{'B5':'A3','B6':'НЕТ','B7':25},'A3 · 25 сторон · автоматическая подача')],
 '2.5':[('Комплект копий A1',{},'A1 · ч/б · 10 листов'),('Копии двух форматов',{'rows':[{'B':'A4','C':'Ч/Б','D':10},{'B':'A3','C':'Цвет','D':10}]},'10 листов A4 ч/б + 10 листов A3 цвет'),('Копии с фальцовкой',{'rows':[{'B':'A1','C':'Ч/Б','D':10}],'B4':'Под A4'},'10 листов A1 · фальцовка под A4')],
 '2.6':[('Цветной альбом A3',{},'10 цветных листов · 80 г/м² · одна металлическая пружина'),('Чертежи и визуализации',{'rows':[{'B':'A3','C':'Стандартная (80 г/м²)','D':'Ч/Б','E':20},{'B':'A3','C':'Color Copy 200 г/м²','D':'Цвет','E':10}]},'20 ч/б + 10 цветных листов · один альбом'),('Печать без сборки',{'B4':'Нет','rows':[{'B':'A4','C':'Color Copy 120 г/м²','D':'Цвет','E':10}]},'10 цветных листов A4 · 120 г/м² · без брошюровки')],
 '2.7':[('Выкройка на рулоне',{},'841 × 1500 мм · ч/б · 1 экземпляр'),('Компактный комплект',{'B4':600,'B5':1000,'B7':2},'600 × 1000 мм · ч/б · 2 экземпляра'),('Цветные лекала',{'B4':841,'B5':2000,'B6':'Цвет','B7':1},'841 × 2000 мм · цвет · 1 экземпляр')],
}
node = os.environ.get('NODE_BINARY') or shutil.which('node') or str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe')
js = "require('./project-pricing-data.js');require('./copycenter-engine.js');require('./project-pricing.js');const input=" + json.dumps(EXAMPLES, ensure_ascii=False) + ";console.log(JSON.stringify(Object.fromEntries(Object.entries(input).map(([id,items])=>[id,items.map(([name,c,note])=>({name,note,...TEXT_PROJECT_PRICING.quote(id,c)}))]))));"
QUOTES = json.loads(subprocess.check_output([node, '-e', js], cwd=ROOT).decode('utf-8'))
for service_id, examples in QUOTES.items():
    for q in examples:
        if not q['valid']: raise ValueError(service_id + ': invalid price example ' + str(q))

INTRO = {
 '2.1':'Чёткие чертежи, точный масштаб и весь проект в порядке. Рассчитайте листы разных форматов, добавьте фальцовку и сборку на пружину.',
 '2.2':'Соберём чертежи и пояснительные записки в удобный том. Подберём пружину для A4 или A3 и согласуем последовательность всего проекта.',
 '2.3':'Аккуратно сложим чертежи для хранения или подшивки. Исходный формат, основная надпись и схема сборки учитываются до начала работы.',
 '2.4':'Переведём бумажные чертежи A4 и A3 в электронный вид. Согласуем детализацию, порядок страниц и формат готовых файлов.',
 '2.5':'Копии чертежей с читаемыми линиями и согласованным масштабом. Рассчитайте комплект по форматам, а способ работы с оригиналами подтвердим заранее.',
 '2.6':'Планировки, визуализации и ведомости — в одном аккуратном альбоме. Выберите A3 или A4, бумагу для каждого типа листов и брошюровку.',
 '2.7':'Ваши выкройки в натуральную величину, без склеивания листов. Печать 1:1 на рулоне шириной до 841 мм — с проверкой контрольного размера.',
}
VARIANTS = {
 '2.1':[('Разные форматы','A4–A0 и удлинённые форматы из калькулятора. До 20 строк с отдельной цветностью и количеством листов.','wide'),('Точный масштаб','Передайте PDF с указанным масштабом и контрольным размером. Печать без вписывания согласуем заранее.','target'),('Готовый комплект','Фальцовка под A4 или A3 и брошюровка на пластик или металл рассчитываются вместе с печатью.','layers')],
 '2.2':[('Пластик или металл','Выберите пружину по толщине готового блока, учитывая сложенные чертежи и обложки.','layers'),('Тома A4 и A3','Согласуйте формат, сторону крепления, обложку, разделители и последовательность листов.','document'),('Расчёт всего тиража','Проектная документация рассчитывается с коэффициентом 1,15. Число комплектов влияет на тариф.','calculator')],
 '2.3':[('Стандартные и длинные','A4–A0 и удлинённые форматы. Для каждого формата добавьте отдельный расчёт в корзину.','wide'),('Подшивка или хранение','Укажите конечный формат, полосу для крепления и требования принимающей организации.','layers'),('Штамп на виду','Основная надпись должна остаться читаемой. Ориентацию и схему складывания согласуем до работы.','target')],
 '2.4':[('Только A4 и A3','Максимальный оригинал — A3. Сканирование A2, A1 и A0 студия не предлагает.','wide'),('Разные оригиналы','Для сшитых листов — ручная подача; для отдельных листов — автоматическая по калькулятору.','copy'),('Удобные файлы','Согласуйте цветность, детализацию, PDF или отдельные файлы и понятные имена страниц.','document')],
 '2.5':[('Сохраним детали','Проверьте читаемость линий, текста и цветных пометок. Для масштаба нужен контрольный размер.','target'),('Оригинал или файл','Для бумажных оригиналов больше A3 отдельно согласуйте способ получения цифрового файла.','document'),('Соберём проект','Добавьте фальцовку и брошюровку после изготовления копий. Укажите порядок и число комплектов.','layers')],
 '2.6':[('Пять типов листов','В одном расчёте — до пяти строк с форматами A4/A3, бумагой и цветностью. Количество — на весь заказ.','wide'),('Бумага для подачи','80 г/м² или Color Copy 120, 200, 300 г/м². Обложки и визуализации можно задать отдельной строкой.','palette'),('Альбом на пружине','Пластиковая или металлическая пружина A4/A3. Фальцовка в этой услуге не применяется.','layers')],
 '2.7':[('Печать 1:1','PDF без подгонки. Контрольный квадрат или подписанный размер проверяется на готовом отпечатке.','target'),('Размер в миллиметрах','Ширина до 841 мм, длина до 18 000 мм. Стоимость зависит от общей площади и цветности.','wide'),('Ваши комплекты','Укажите число экземпляров, подпишите размеры изделий и проверьте метки совмещения, долевую и припуски.','document')],
}

def benefits():
    return '<div class="cc-benefits">'+''.join(f'<article>{icon(i)}<div><h2>{h}</h2><p>{p}</p></div></article>' for i,h,p in [('calculator','Стоимость онлайн','Параметры и состав цены перед заказом'),('check','Проверим детали','Файл или оригиналы согласуем до работы'),('pin','Удобно получить','Барнаул, Строителей, 11 · отправка по России')])+'</div>'

def faq(service=None):
    items = list(service['faq']) if service else [
      {'q':'Как рассчитать проект с разными форматами?', 'a':'В инженерной печати и копировании задайте каждый формат и цветность отдельной строкой. В дизайн-проекте также выбирается бумага. Количество листов указывайте суммарно на весь заказ.'},
      {'q':'Можно собрать печать, фальцовку и переплёт вместе?', 'a':'Да, в инженерном калькуляторе эти работы рассчитываются вместе. Для готовых листов доступны отдельные услуги фальцовки и брошюровки. Добавляйте в корзину только необходимые позиции, чтобы не посчитать обработку дважды.'},
      {'q':'Какие чертежи вы сканируете?', 'a':'Только оригиналы A4 и A3. Крупноформатное сканирование A2, A1 и A0 не предлагается. Способ работы с большим бумажным оригиналом нужно согласовать заранее.'},
      {'q':'Как сохранить масштаб чертежа или выкройки?', 'a':'Подготовьте PDF с верным размером страницы и контрольным размером, укажите масштаб и печать без вписывания. Для выкроек требуется масштаб 1:1.'},
      {'q':'Когда будет готов заказ?', 'a':'Ориентир — один рабочий день на каждые 25 000 ₽ с округлением вверх после полного согласования. Подготовка файлов и доставка согласуются отдельно.'},
      {'q':'Как передать файлы и получить заказ?', 'a':'Отправьте PDF и ведомость на tekkkst@yandex.ru, в Telegram или MAX. Готовый заказ можно забрать на проспекте Строителей, 11 в Барнауле; доставка согласуется со студией.'},
    ]
    if service:
        items += [
          {'q':'Можно отправить расчёт своему заказчику?', 'a':'Да. Добавьте нужные позиции в корзину и нажмите «Скачать расчёт PDF». В документе будут логотип ТЕКСТ, параметры, список услуг и цены. Это предварительный расчёт; стоимость и срок подтвердим перед производством.'},
          {'q':'Как получить готовый заказ?','a':'Можно забрать заказ на проспекте Строителей, 11 в Барнауле. Курьерскую доставку и отправку по России, стоимость и срок согласуйте со студией.'},
          {'q':'Добавление в корзину запускает производство?','a':'Корзина сохраняет расчёт в вашем браузере. Подготовьте запрос, отправьте его вместе с файлами и согласуйте заказ со студией. После подтверждения параметров, макета и оплаты заказ передаётся в работу.'},
        ]
    return '<div class="company-faq cc-faq faq-list">'+''.join(f'<details><summary>{text(item["q"])}{icon("plus")}</summary><p>{text(item["a"])}</p></details>' for item in items)+'</div>'

def related_link(service_id,prefix):
    copy=json.loads((ROOT/'copycenter-content.json').read_text(encoding='utf-8'))['services']
    all_services={s['id']:s for s in [*SERVICES,*copy]}
    s=all_services.get(service_id)
    if not s:
        catalog=json.loads((ROOT/'catalog.js').read_text(encoding='utf-8').split('=',1)[1].rstrip(';\n '))
        s=next(s for s in catalog if s['id']==service_id)
    image=s.get('art',{'5.2':'service-posters.webp','5.3':'service-posters.webp'}.get(service_id,'popular-art-инженерная печать.webp'))
    tag='a' if s.get('path') else 'button'
    attrs=f'href="{prefix}{s["path"]}"' if tag=='a' else f'type="button" data-service="{service_id}"'
    name=' '.join(f'<span class="featured-word">{text(word)}</span>' for word in s['name'].split())
    return f'<{tag} class="featured-card" {attrs} aria-label="{text(s["name"])}"><span class="featured-copy"><span class="featured-name">{name}</span><span class="cc-card-link">Выбрать услугу →</span></span><span class="featured-art"><img src="{prefix}assets/{image}" alt="" width="960" height="960" loading="lazy"></span></{tag}>'

def calculator(s,prefix):
    fixed = s['technical']['fixed']
    if s['id']=='2.2':fixed=['Проектная документация · коэффициент 1,15']
    paper=s['id'] in ('2.2','2.3','2.4','2.5')
    upload_label='Прикрепите файл или пример' if paper else 'Загрузите макет'
    file_hint='Файл можно приложить для уточнения задачи. Для работы с бумажными листами передайте оригиналы в студию.' if paper else 'PDF, изображения, исходники или ZIP · до 100 МБ. Можно прикрепить позже в корзине.'
    comment_hint={'2.1':'Масштаб, порядок листов и комплектность','2.2':'Порядок листов, обложки и сторона крепления','2.3':'Конечный формат, подшивка и расположение штампа','2.4':'Формат готовых файлов, детализация и порядок страниц','2.5':'Состояние оригиналов, масштаб и порядок копий','2.6':'Порядок страниц, обложка и сторона крепления','2.7':'Контрольный размер, маркировка и число комплектов'}[s['id']]
    return f'''<section class="cc-calculator" id="calculator" aria-labelledby="calculator-title">
      <div class="cc-heading"><h2 id="calculator-title">Выберите нужные параметры</h2><p>Укажите параметры заказа — стоимость пересчитывается сразу.</p></div>
      <form id="copycenter-form"><div class="cc-calc-layout"><div class="cc-options-panel">
        <button class="cc-copy-button" type="button" data-cc-copy disabled aria-label="Скопировать параметры, стоимость и ссылку" title="Скопировать параметры, стоимость и ссылку">{icon('copy')}<span>Скопировать расчёт</span></button>
        <div class="cc-parameters" data-cc-fields></div>
        <div class="cc-parameter-footer">{('<div class="cc-fixed">'+''.join('<span>'+text(v)+'</span>' for v in fixed)+'</div>') if fixed else ''}
        <p class="cc-helper"><a href="#service-requirements">Проверить требования к макету →</a></p><button class="cc-reset" type="button" data-cc-reset>Сбросить параметры</button></div>
      </div><aside class="cc-result" aria-label="Макет и результат расчёта">
        <label class="cc-upload" data-cc-file-zone>{icon('upload')}<strong data-cc-file-label>{upload_label}</strong><span>или перетащите файл сюда</span><input type="file" data-cc-file accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.svg,.ai,.eps,.cdr,.psd,.zip"></label>
        <div class="cc-file-tools"><p class="cc-file-status" data-cc-file-status role="status">{file_hint}</p><button type="button" data-cc-remove-file hidden>Убрать файл</button></div>
        <label class="cc-comment" for="cc-comment">Комментарий к заказу<textarea id="cc-comment" data-cc-comment rows="2" maxlength="2000" placeholder="{comment_hint}"></textarea></label>
        <div class="cc-result-summary"><p class="cc-error" data-cc-error role="status" hidden></p><h3>Стоимость заказа</h3><div class="cc-total" data-cc-total aria-live="polite">—</div><p class="cc-days" data-cc-days></p>
        <p class="cc-range-note" data-cc-range-note hidden>Листы A4 не требуют фальцовки.</p>
        <button class="cc-add-button" type="submit" data-cc-add disabled>В корзину</button><div class="cc-tools"><button type="button" data-cc-download disabled>{icon('download')}Скачать расчёт</button><button type="button" data-action="cart">Открыть корзину</button></div>
        <p class="cc-disclosure">После добавления позиций в корзину можно скачать общий PDF с параметрами и ценами. Стоимость и срок подтвердим перед производством.</p></div>
      </aside></div><details class="cc-breakdown" data-cc-breakdown-panel hidden><summary>Из чего складывается цена</summary><dl data-cc-breakdown></dl></details><p class="cc-calculator-note">{text(s['sla'])} Подготовка макета и доставка согласуются отдельно.</p></form><noscript><p>Для интерактивного расчёта включите JavaScript. Ниже доступны примеры стоимости; точный заказ можно согласовать по телефону +7 (923) 654-78-96.</p></noscript>
    </section>'''

def service_body(s,prefix):
    sid=s['id'];tech=s['technical']
    examples='<div class="cc-examples">'+''.join(f'<article class="cc-example"><h3>{text(q["name"])}</h3><p>{text(q["note"])}</p><strong>{price(q)}</strong><a href="?calc={quote(json.dumps(q["configuration"],ensure_ascii=False,separators=(",",":")))}#calculator">Рассчитать этот вариант</a></article>' for q in QUOTES[sid])+'</div>'
    variants='<div class="cc-variants">'+''.join(f'<article class="cc-variant">{icon(i)}<h3>{h}</h3><p>{p}</p></article>' for h,p,i in VARIANTS[sid])+'</div>'
    process='<div class="cc-process">'+''.join(f'<article class="cc-step"><span class="cc-step-number">0{n}</span><h3>{h}</h3><p>{p}</p></article>' for n,h,p in [(1,'Согласуем заказ','Выберите параметры, подготовьте файл или оригиналы. До запуска подтвердим стоимость, срок и детали.'),(2,'Выполним работу',text(s['production'])),(3,'Передадим вам','Заберите заказ в студии или согласуйте доставку. Проверим комплектность и упаковку.')])+'</div>'
    requirements=preparation(s,prefix)
    articles=[a for a in SOURCE['articles'] if a['id'] in s['articleIds']][:3]
    local={a['source_route']:a for a in ARTICLES}
    reading='<div class="cc-reading">'+''.join(f'<a href="{prefix}{local[a["url"]]["path"]}"><h3>{text(a["h1"])}</h3><span>Читать статью →</span></a>' for a in articles)+'</div>'
    related=f'<div class="featured-grid cc-related" data-cards="{len(s["related"])}">'+''.join(related_link(i,prefix) for i in s['related'])+'</div>'
    return calculator(s,prefix)+section('Примеры стоимости',examples,'price-examples','Ориентиры для конкретных параметров. Вы можете открыть любой пример и изменить его.')+section('Варианты для вашей задачи',variants,'service-options')+section('От заказа до результата',process)+section('Проверьте перед заказом',requirements,'service-requirements')+section('Частые вопросы',faq(s),'service-faq')+section('Добавьте к заказу',related,'related-services')+section('Полезно перед печатью',reading)+section(s['name']+' в студии ТЕКСТ','<div class="cc-seo">'+paragraphs(s['seo'])+'</div>')

CARD_TEXT = ['A4–A0 · ч/б и цвет · фальцовка и сборка','Пластик или металл · тома A4 и A3','Стандартные и удлинённые форматы','Оригиналы только до A3 · PDF и изображения','Точный масштаб · форматы и обработка','Альбомы A4/A3 · выбор бумаги и пружины','До 841 × 18 000 мм · натуральный масштаб']

def landing_body(prefix):
    cards='<div class="cc-category-grid" id="project-services">'+''.join(f'<a class="cc-service-card" href="{s["path"].removeprefix("proektnaya-dokumentatsiya/")}"><div><h3>{text(s["name"])}</h3><p>{CARD_TEXT[i]}</p><span>Рассчитать →</span></div><img src="{prefix}assets/{s["art"]}" alt="" width="960" height="960" loading="lazy"></a>' for i,s in enumerate(SERVICES))+'</div>'
    return section('Всё для вашего проекта',cards,intro='Выберите услугу, рассчитайте параметры и соберите заказ в общей корзине.')+section('Как оформить заказ','<div class="cc-process">'+''.join(f'<article class="cc-step"><span class="cc-step-number">0{n}</span><h3>{h}</h3><p>{p}</p></article>' for n,h,p in [(1,'Выберите услугу','Откройте калькулятор на странице услуги. Укажите формат, материал, количество и дополнительные работы.'),(2,'Сохраните расчёт','Добавьте позиции в корзину и скачайте общий PDF с параметрами и ценами. Отправьте его и файлы в студию.'),(3,'Получите результат','После согласования и оплаты выполним работу. Самовывоз в Барнауле или согласованная доставка.')])+'</div>')+section('Частые вопросы',faq(),'service-faq')

for service in [None,*SERVICES]:
    path=service['path'] if service else 'proektnaya-dokumentatsiya/';prefix='../'*len(Path(path).parts)
    title=service['h1'] if service else 'Проектная документация в Барнауле'
    heading=text(title).replace(' в Барнауле',' <span class="cc-hero-place">в Барнауле</span>')
    intro=INTRO[service['id']] if service else 'От отдельных чертежей до готового тома проекта. Семь услуг с онлайн-расчётом — для архитекторов, инженеров, дизайнеров и ваших идей.'
    art=service['art'] if service else SERVICES[0]['art']
    primary='#calculator' if service else '#project-services'
    actions=f'<a class="button button-primary" href="{primary}">{"Рассчитать стоимость" if service else "Выбрать услугу"} {icon("arrow")}</a><button class="button button-white" type="button" data-action="contacts">Задать вопрос</button>'
    breadcrumb=f'<nav class="company-breadcrumbs" aria-label="Хлебные крошки"><a href="{prefix}">Главная</a><span aria-hidden="true">/</span>'+(f'<a href="../">Проектная документация</a><span aria-hidden="true">/</span><span aria-current="page">{text(service["name"])}</span>' if service else '<span aria-current="page">Проектная документация</span>')+'</nav>'
    hero=f'<section class="cc-hero" aria-labelledby="copycenter-title"><div><h1 id="copycenter-title">{heading}</h1><p>{intro}</p><div class="company-actions">{actions}</div></div><div class="cc-art"><img src="{prefix}assets/{art}" alt="Робот ТЕКСТ — {text(service["name"] if service else "проектная документация")}" width="960" height="960" fetchpriority="high"></div></section>'
    cta=f'<aside class="company-cta"><div><h2>Поможем с вашим заказом</h2><p>Обсудим параметры, проверим файл и согласуем готовность.</p></div><div class="company-actions"><a class="company-phone" href="tel:+79236547896">{icon("phone")}+7 (923) 654-78-96</a><button class="button button-primary" type="button" data-action="contacts">Написать нам {icon("arrow")}</button></div></aside>'
    page_head=paths(head,prefix)
    page_head=re.sub(r'<title>.*?</title>',f'<title>{text(service["title"] if service else "Проектная документация в Барнауле | ТЕКСТ")}</title>',page_head)
    page_head+=f'<link rel="stylesheet" href="{prefix}company-pages.css"><link rel="stylesheet" href="{prefix}copycenter.css"><link rel="stylesheet" href="{prefix}project.css">\n'
    if service:
        page_head+=''.join(f'<script src="{prefix}{file}.js" defer></script>\n' for file in ['project-pricing-data','copycenter-engine','project-pricing','project'])
    page_header=paths(header,prefix).replace('class="brand" href="#main"',f'class="brand" href="{prefix}"')
    page_footer=paths(footer,prefix).replace('class="brand" href="#main"',f'class="brand" href="{prefix}"')
    body=service_body(service,prefix) if service else landing_body(prefix)
    attribute=f' data-project-service="{service["id"]}"' if service else ''
    html=f'<!doctype html>\n<html lang="ru"><head>{page_head}</head><body class="company-page copycenter-page project-page">\n{page_header}<main id="main"{attribute}><div class="container">{breadcrumb}{hero}{benefits()}{body}{cta}</div></main>\n{page_footer}</body></html>\n'
    output=ROOT/path/'index.html';output.parent.mkdir(parents=True,exist_ok=True);output.write_text(html,encoding='utf-8')
print('Built Project documentation landing and 7 service pages with 21 calculated examples.')
