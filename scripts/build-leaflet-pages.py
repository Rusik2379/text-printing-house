"""Build sheet printing pages using the shared Copy Center components."""
from pathlib import Path
from html import escape
from urllib.parse import quote
import json, re, subprocess, shutil

ROOT=Path(__file__).resolve().parents[1]
SOURCE=json.loads((ROOT/'leaflet-content.json').read_text(encoding='utf-8'))
SERVICES=SOURCE['services']; BY_ID={s['id']:s for s in SERVICES}
ARTICLES=json.loads((ROOT/'company-articles.json').read_text(encoding='utf-8'))['articles']
home=(ROOT/'index.html').read_text(encoding='utf-8')
header=home[home.index('  <a class="skip-link"'):home.index('  <main id="main">')]
footer=home[home.index('  <footer'):home.index('</body>')]
head=home[home.index('<head>')+6:home.index('</head>')]
head=re.sub(r'\s*<script\b[^>]*type="application/ld\+json"[^>]*>.*?</script>','',head,flags=re.S)
head=re.sub(r'\s*<meta\b[^>]*(?:name="(?:description|robots)"|property="og:[^"]+")[^>]*>|\s*<link\b[^>]*rel="canonical"[^>]*>','',head)
def text(v):return escape(str(v))
def icon(n):return f'<span data-icon="{n}"></span>'
def paths(html,prefix):return re.sub(r'(href|src)="([^"#]+)"',lambda m:m[0] if re.match(r'^[a-z]+:|^//',m[2]) else f'{m[1]}="{prefix}{m[2]}"',html)
def paragraphs(v):return ''.join('<p>'+text(p)+'</p>' for p in v.split('\n\n') if p.strip())
def section(title,body,anchor='',intro=''):
    return f'<section class="company-section"{f" id=\"{anchor}\"" if anchor else ""}><div class="company-section-heading"><h2>{title}</h2></div>{f"<p class=\"company-section-intro\">{intro}</p>" if intro else ""}{body}</section>'
def money(n):return f'{n:,.2f}'.rstrip('0').rstrip('.').replace(',','\u00a0').replace('.',',')+' ₽'

INTRO={
 '3.1':'Знакомство, которое остаётся под рукой. Выберите бумагу, стороны и обработку — рассчитайте визитки для себя и вашей команды.',
 '3.2':'Расскажите о событии, акции или своей идее. Подберём формат и бумагу, напечатаем и аккуратно нарежем ваш тираж.',
 '3.3':'Больше информации на одном листе. Напечатаем буклеты, сложим по согласованной схеме и сохраним правильный порядок панелей.',
 '3.4':'История, инструкция или презентация — в удобном издании. Рассчитайте печать блока, обложки и сборку брошюр на скобы.',
 '3.5':'Ваш ассортимент в понятном и аккуратном каталоге. Выберите формат, бумагу обложки и блока, количество страниц и тираж.',
 '3.6':'Поздравление, приглашение или маленький знак внимания. Выберите формат и плотную бумагу для открыток с вашим дизайном.',
 '3.7':'Отметьте достижения красиво. Напечатаем грамоты и дипломы для мероприятий, команды, учеников и победителей.',
 '3.8':'Подарок, приглашение или подтверждение участия. Подготовим сертификаты с вашим оформлением и согласованными данными.',
 '3.9':'Сделайте событие заметным. Напечатаем листовые афиши для витрин, стендов и объявлений — с читаемым текстом и яркими деталями.',
 '3.10':'Маленькая деталь, которая расскажет о вашем товаре. Рассчитайте бумажные бирки нужного размера для одежды, подарков и упаковки.'}
VARIANTS={
 '3.1':[('Четыре вида бумаги','Color Copy 350 г/м², Xerox Colour 300 г/м², дизайнерская бумага и Touch.','layers'),('Лицо и оборот','Одна или две стороны. Передайте их отдельными страницами одинакового размера.','copy'),('Детали отделки','Ламинация и скругление углов рассчитываются отдельно в параметрах заказа.','target')],
 '3.2':[('Ваш формат','A6, A5, A4, A3 или индивидуальный размер в миллиметрах.','wide'),('Четыре плотности','120, 160, 250 или 300 г/м² — для раздачи, вложений и презентации.','layers'),('Одна или две стороны','Дополните оборот условиями или контактами. Ламинация — по выбранным параметрам.','copy')],
 '3.3':[('Развёртка A4 или A3','Сначала выберите размер листа, затем схему сложения и готовый размер.','wide'),('От одного до трёх сгибов','За каждый сгиб — 5 ₽ на экземпляр. Ширины панелей согласуем по шаблону.','layers'),('Двусторонняя печать','Бумага 120 или 160 г/м². Проверьте порядок чтения на сложенном образце.','copy')],
 '3.4':[('Формат A4 или A5','Готовое изделие после складывания и скрепления.','wide'),('Обложка и блок','Обложка 200–350 г/м², внутренний блок 120, 160 или 200 г/м².','layers'),('Сборка на скобы','От 4 страниц, кратно четырём, включая обложку. Другой переплёт согласуем отдельно.','document')],
 '3.5':[('Каталог A4 или A5','Формат готового издания. Печатный лист рассчитывается автоматически.','wide'),('Два типа бумаги','Плотность обложки и внутреннего блока выбираются независимо.','layers'),('Печать и сборка','В онлайн-расчёт входят биговка, скобы и подготовка тиража. Другую сборку согласуем.','document')],
 '3.6':[('A6, A5 или свой размер','Размер готовой открытки задаётся до печати.','wide'),('Плотная бумага','200, 250, 300 или 350 г/м². Доступна печать одной или двух сторон.','layers'),('Отделка по задаче','Ламинация — в калькуляторе. Сгиб, биговку и направление открывания согласуем отдельно.','target')],
 '3.7':[('Формат и ориентация','A4, A3 или индивидуальный размер. Проверьте расположение текста и подписей.','wide'),('Бумага и ламинация','Плотность 120–350 г/м², одна или две стороны и защита плёнкой.','layers'),('Список получателей','Для разных ФИО передайте проверенную таблицу. Стоимость персонализации согласуем отдельно.','document')],
 '3.8':[('С вашим оформлением','A4, A3 или индивидуальный размер, выбранная бумага и стороны печати.','wide'),('Номера и номиналы','Персонализацию и уникальные коды согласуем по финальной таблице.','document'),('Защита и обработка','Ламинация рассчитывается в форме. Сгибы и другие работы согласуем отдельно.','shield')],
 '3.9':[('Листовая афиша','A4, A3 или индивидуальный формат. Большие A2–A0 относятся к широкоформатной печати.','wide'),('Удобная бумага','120–350 г/м², одна или две стороны. Ламинация доступна в расчёте.','layers'),('Читаемость с расстояния','Дата, место и главное сообщение должны быть заметны. Проверьте макет в готовом размере.','target')],
 '3.10':[('Ваш размер','От 30 × 30 до 105 × 148 мм; ширину и высоту можно поменять местами.','wide'),('Два вида бумаги','200 или 300 г/м²; печать одной или двух сторон. Минимальный чек — 1 000 ₽.','layers'),('Крепление отдельно','Отверстие, шнур и дополнительную обработку согласуем отдельно по размерной схеме.','target')]}
EXAMPLES={
 '3.1':[('Первое знакомство',{},'100 шт. · Color Copy 350 г/м² · одна сторона'),('Визитки с оборотом',{'B5':'двусторонние','B6':300},'300 шт. · две стороны'),('Визитки с отделкой',{'B6':500,'B7':'да','B8':'да'},'500 шт. · ламинация · скругление')],
 '3.2':[('Небольшая акция',{},'A6 · 120 г/м² · 100 шт. · одна сторона'),('Листовка с оборотом',{'B4':'A5','B7':160,'B8':'Двусторонняя','B10':100},'A5 · 160 г/м² · 100 шт. · две стороны'),('Вложение своего размера',{'B4':'Индивидуальный','B5':100,'B6':100,'B10':200},'100 × 100 мм · 200 шт.')],
 '3.3':[('Буклет для презентации',{},'Развёртка A4 · 120 г/м² · 2 сгиба · 100 шт.'),('Крупный буклет',{'B4':'A3','B5':160,'B7':1,'B8':50},'Развёртка A3 · 160 г/м² · 1 сгиб · 50 шт.'),('Небольшой тираж',{'B7':3,'B8':25},'Развёртка A4 · 3 сгиба · 25 шт.')],
 '3.4':[('Брошюра A4',{},'16 страниц с обложкой · 10 шт. · скобы'),('Компактная брошюра',{'B4':'A5','B7':20,'B8':25},'A5 · 20 страниц с обложкой · 25 шт.'),('Пробный экземпляр',{'B7':8,'B8':1},'A4 · 8 страниц с обложкой · 1 шт.')],
 '3.5':[('Каталог A4',{},'16 страниц с обложкой · 10 шт. · скобы'),('Каталог ассортимента',{'B4':'A5','B7':24,'B8':25},'A5 · 24 страницы с обложкой · 25 шт.'),('Короткий каталог',{'B7':8,'B8':5},'A4 · 8 страниц с обложкой · 5 шт.')],
 '3.6':[('Открытки к событию',{},'A6 · 250 г/м² · две стороны · 100 шт.'),('Открытки A5',{'B4':'A5','B7':300,'B10':50},'A5 · 300 г/м² · две стороны · 50 шт.'),('Квадратное приглашение',{'B4':'ИНДИВИДУАЛЬНЫЙ','B5':120,'B6':120,'B10':50},'120 × 120 мм · 50 шт.')],
 '3.7':[('Грамоты к мероприятию',{},'A4 · 120 г/м² · одна сторона · 100 шт.'),('Плотные дипломы',{'B7':300,'B10':25},'A4 · 300 г/м² · 25 шт.'),('Грамоты с ламинацией',{'B9':'1 СТОРОНА','B10':10},'A4 · 10 шт. · ламинация одной стороны')],
 '3.8':[('Сертификаты A4',{},'A4 · 120 г/м² · одна сторона · 100 шт.'),('Подарочные сертификаты',{'B7':300,'B8':'ДВУСТОРОННЯЯ','B10':25},'A4 · 300 г/м² · две стороны · 25 шт.'),('Свой формат',{'B4':'ИНДИВИДУАЛЬНЫЙ','B5':100,'B6':200,'B10':50},'100 × 200 мм · 50 шт.')],
 '3.9':[('Афиши A4',{},'A4 · 120 г/м² · 100 шт.'),('Афиши A3',{'B4':'A3','B7':160,'B10':25},'A3 · 160 г/м² · 25 шт.'),('Защита для размещения',{'B9':'2 СТОРОНЫ','B10':10},'A4 · 10 шт. · ламинация двух сторон')],
 '3.10':[('Бирки для упаковки',{},'40 × 40 мм · 300 г/м² · две стороны · 500 шт.'),('Небольшая партия',{'B7':200,'B8':'ОДНОСТОРОННЯЯ','B9':50},'40 × 40 мм · 200 г/м² · 50 шт. · минимальный чек'),('Бирка с информацией',{'B5':50,'B6':90,'B9':200},'50 × 90 мм · 300 г/м² · 200 шт.')]}
js="require('./leaflet-pricing-data.js');require('./copycenter-engine.js');require('./leaflet-pricing.js');const e="+json.dumps(EXAMPLES,ensure_ascii=False)+";console.log(JSON.stringify(Object.fromEntries(Object.entries(e).map(([id,a])=>[id,a.map(([name,c,note])=>({name,note,...TEXT_LEAFLET_PRICING.quote(id,c)}))]))));"
QUOTES=json.loads(subprocess.check_output([shutil.which('node'),'--eval',js],cwd=ROOT).decode('utf-8'))
for sid,items in QUOTES.items():
    for q in items:
        if not q['valid']:raise ValueError(sid+': invalid example '+str(q))

def preparation(s,prefix):
    t=s['technical']
    checks='<ul class="cc-checks">'+''.join(f'<li>{icon("check")}<span>{text(v)}</span></li>' for v in t['checks'])+'</ul>'
    guide=f'<aside class="cc-file-guide"><h3>Что подготовить</h3><p>{text(t["send"])}</p><p>{text(s["requirements"])}</p><p class="cc-example-note"><strong>Например:</strong> {text(t["example"])}</p><a class="text-button" href="{prefix}requirements/#requirement-{s["id"].replace(".","-")}">Все требования к услуге {icon("arrow")}</a></aside>'
    answers=[('Какой файл подготовить?',t['fileSpec']),('Что особенно важно проверить?','\n\n'.join(t['critical'])),('Каких ошибок избежать?','\n\n'.join(t['mistakes'])),('Что проверим перед запуском?',t['preflight'])]
    return '<div class="cc-requirements">'+checks+guide+'</div><div class="company-faq cc-faq faq-list leaflet-preparation-details">'+''.join(f'<details><summary>{title}{icon("plus")}</summary>{paragraphs(body)}</details>' for title,body in answers)+'</div>'
def faq(s=None):
    items=list(s['faq']) if s else [
      {'q':'Как выбрать нужную услугу?','a':'Визитки — для контактов, листовки — для короткого предложения, буклеты — для информации со сгибами. Брошюры и каталоги — многостраничные издания; открытки, сертификаты и бирки рассчитываются на своих страницах.'},
      {'q':'Какие тиражи доступны?','a':'Ограничения зависят от изделия и формата. Для визиток — 100–1 000 шт. с шагом 100. Для листовок A6 минимум 50, A5 — 25, A4 — 5, A3 и индивидуального формата — 1. Точный минимум указан в калькуляторе услуги.'},
      {'q':'Как подготовить файл?','a':'Предпочтителен PDF в размере 1:1. Перед запуском согласуйте вылеты, бумагу и обработку. Лицо и оборот передавайте отдельно; для брошюр — страницы по порядку без самостоятельного спуска.'},
      {'q':'Можно напечатать разные имена или номера?','a':'Да, задачу по персонализации нужно согласовать отдельно. Подготовьте образец макета и проверенную таблицу получателей, номеров или кодов. Стоимость этой работы не включена автоматически в обычный тираж.'},
      {'q':'Когда будет готов тираж?','a':'Ориентир — один рабочий день на каждые 15 000 ₽ с округлением вверх после полного согласования макета. Подготовка файлов и доставка согласуются отдельно.'}]
    items += [
      {'q':'Как сохранить и отправить расчёт?','a':'Добавьте услуги в корзину и скачайте общий PDF с логотипом, параметрами и ценами. Можно также скопировать расчёт и ссылку на выбранные параметры.'},
      {'q':'Как получить готовый заказ?','a':'Самовывоз: Барнаул, проспект Строителей, 11. Курьерскую доставку или отправку по России, стоимость и срок согласуйте со студией.'},
      {'q':'Корзина сразу запускает печать?','a':'Корзина сохраняет предварительный расчёт в вашем браузере. Отправьте запрос и файлы в студию; производство начинается после согласования параметров, макета и оплаты.'}]
    return '<div class="company-faq cc-faq faq-list">'+''.join(f'<details><summary>{text(v["q"])}{icon("plus")}</summary><p>{text(v["a"])}</p></details>' for v in items)+'</div>'
def calculator(s,prefix):
    fixed=['Минимальный чек 1 000 ₽'] if s['id']=='3.10' else s['technical']['fixed']
    return f'''<section class="cc-calculator" id="calculator" aria-labelledby="calculator-title"><div class="cc-heading"><h2 id="calculator-title">Выберите нужные параметры</h2><p>Укажите параметры заказа — стоимость пересчитывается сразу.</p></div>
    <form id="copycenter-form"><div class="cc-calc-layout"><div class="cc-options-panel"><button class="cc-copy-button" type="button" data-cc-copy disabled aria-label="Скопировать параметры, стоимость и ссылку" title="Скопировать параметры, стоимость и ссылку">{icon('copy')}<span>Скопировать расчёт</span></button><div class="cc-parameters" data-cc-fields></div><div class="cc-parameter-footer"><div class="cc-fixed">{''.join('<span>'+text(v)+'</span>' for v in fixed)}</div><p class="cc-helper"><a href="#service-requirements">Проверить требования к макету →</a></p><button class="cc-reset" type="button" data-cc-reset>Сбросить параметры</button></div></div>
    <aside class="cc-result" aria-label="Макет и результат расчёта"><label class="cc-upload" data-cc-file-zone>{icon('upload')}<strong data-cc-file-label>Загрузите макет</strong><span>или перетащите файл сюда</span><input type="file" data-cc-file accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.svg,.ai,.eps,.cdr,.psd,.zip"></label><div class="cc-file-tools"><p class="cc-file-status" data-cc-file-status role="status">PDF, изображения, исходники или ZIP · до 100 МБ. Можно прикрепить позже в корзине.</p><button type="button" data-cc-remove-file hidden>Убрать файл</button></div><label class="cc-comment" for="cc-comment">Комментарий к заказу<textarea id="cc-comment" data-cc-comment rows="2" maxlength="2000" placeholder="Размер, ориентация, обработка и важные детали"></textarea></label>
    <div class="cc-result-summary"><p class="cc-error" data-cc-error role="status" hidden></p><h3>Стоимость заказа</h3><div class="cc-total" data-cc-total aria-live="polite">—</div><p class="cc-days" data-cc-days></p><p class="cc-range-note" data-cc-range-note hidden></p><button class="cc-add-button" type="submit" data-cc-add disabled>В корзину</button><div class="cc-tools"><button type="button" data-cc-download disabled>{icon('download')}Скачать расчёт</button><button type="button" data-action="cart">Открыть корзину</button></div><p class="cc-disclosure">После добавления позиций в корзину можно скачать общий PDF с параметрами и ценами. Стоимость и срок подтвердим перед производством.</p></div></aside></div>
    <details class="cc-breakdown" data-cc-breakdown-panel hidden><summary>Из чего складывается цена</summary><dl data-cc-breakdown></dl></details><p class="cc-calculator-note">{text(s['sla'])} Подготовка макета, персонализация и доставка согласуются отдельно.</p></form><noscript><p>Для интерактивного расчёта включите JavaScript. Ниже доступны примеры стоимости; заказ можно согласовать по телефону +7 (923) 654-78-96.</p></noscript></section>'''
def related(s,prefix):
    ids=[sid for sid in s['related'] if sid in BY_ID]
    for other in SERVICES:
        if len(ids)>=4:break
        if other['id']!=s['id'] and other['id'] not in ids:ids.append(other['id'])
    cards=[]
    for sid in ids[:4]:
        other=BY_ID[sid];name=' '.join(f'<span class="featured-word">{text(w)}</span>' for w in other['name'].split())
        cards.append(f'<a class="featured-card" href="{prefix}{other["path"]}" aria-label="{text(other["name"])}"><span class="featured-copy"><span class="featured-name">{name}</span><span class="cc-card-link">Выбрать услугу →</span></span><span class="featured-art"><img src="{prefix}assets/{other["art"]}" alt="" width="960" height="960" loading="lazy"></span></a>')
    return '<div class="featured-grid cc-related" data-cards="4">'+''.join(cards)+'</div>'
def process():
    items=[('Согласуем заказ','Выберите параметры, передайте файл и важные детали. До запуска подтвердим стоимость, срок и макет.'),('Напечатаем и соберём','Выполним печать и выбранную обработку. Проверим качество и комплектность тиража.'),('Передадим вам','Заберите заказ в студии или согласуйте доставку. Подготовим продукцию к выдаче и упаковке.')]
    return '<div class="cc-process">'+''.join(f'<article class="cc-step"><span class="cc-step-number">0{n}</span><h3>{h}</h3><p>{p}</p></article>' for n,(h,p) in enumerate(items,1))+'</div>'
def service_body(s,prefix):
    examples='<div class="cc-examples">'+''.join(f'<article class="cc-example"><h3>{text(q["name"])}</h3><p>{text(q["note"])}</p><strong>{money(q["price"])}</strong><a href="?calc={quote(json.dumps(q["configuration"],ensure_ascii=False,separators=(",",":")))}#calculator">Рассчитать этот вариант</a></article>' for q in QUOTES[s['id']])+'</div>'
    variants='<div class="cc-variants">'+''.join(f'<article class="cc-variant">{icon(i)}<h3>{h}</h3><p>{p}</p></article>' for h,p,i in VARIANTS[s['id']])+'</div>'
    articles=[a for a in ARTICLES if a['id'] in s['articleIds']][:3]
    reading='<div class="cc-reading">'+''.join(f'<a href="{prefix}{a["path"]}"><h3>{text(a["title"])}</h3><span>Читать статью →</span></a>' for a in articles)+'</div>'
    return calculator(s,prefix)+section('Примеры стоимости',examples,'price-examples','Расчёты для конкретных параметров. Откройте пример и измените его под свой заказ.')+section('Варианты для вашей задачи',variants,'service-options')+section('От заказа до результата',process())+section('Проверьте перед заказом',preparation(s,prefix),'service-requirements')+section('Частые вопросы',faq(s),'service-faq')+section('Добавьте к заказу',related(s,prefix),'related-services')+section('Полезно перед печатью',reading)+section(s['name']+' в студии ТЕКСТ','<div class="cc-seo">'+paragraphs(s['seo'])+'</div>')
CARD_TEXT=['Четыре вида бумаги · лицо и оборот','A6–A3 · свой размер · ламинация','A4/A3 · от одного до трёх сгибов','A4/A5 · обложка и блок · скобы','Ваш ассортимент в готовом издании','A6/A5 · плотная бумага · свой формат','Для достижений, наград и мероприятий','Для подарков, участия и вашего бренда','Листовые афиши A4/A3 и своего размера','Размер от 30 × 30 до 105 × 148 мм']
def landing_body():
    cards='<div class="cc-category-grid" id="leaflet-services">'+''.join(f'<a class="cc-service-card" href="{s["path"].removeprefix("listovaya-poligrafiya/")}"><div><h3>{text(s["name"])}</h3><p>{CARD_TEXT[i]}</p><span>Рассчитать →</span></div><img src="../assets/{s["art"]}" alt="" width="960" height="960" loading="lazy"></a>' for i,s in enumerate(SERVICES))+'</div>'
    return section('Полиграфия для ваших идей',cards,intro='Десять услуг с онлайн-расчётом. Выберите нужную, настройте параметры и соберите общий заказ в корзине.')+section('Как оформить заказ',process())+section('Частые вопросы',faq(),'service-faq')
for s in [None,*SERVICES]:
    route=s['path'] if s else 'listovaya-poligrafiya/';prefix='../'*len(Path(route).parts)
    title=s['h1'] if s else 'Листовая полиграфия в Барнауле'
    heading=text(title).replace(' в Барнауле',' <span class="cc-hero-place">в Барнауле</span>')
    intro=INTRO[s['id']] if s else 'От визитки до каталога — всё, что расскажет о вас и вашем деле. Выберите формат, бумагу и тираж, а мы поможем превратить ваш макет в готовую продукцию.'
    art=s['art'] if s else SERVICES[0]['art'];primary='#calculator' if s else '#leaflet-services'
    breadcrumb=f'<nav class="company-breadcrumbs" aria-label="Хлебные крошки"><a href="{prefix}">Главная</a><span aria-hidden="true">/</span>'+(f'<a href="../">Листовая полиграфия</a><span aria-hidden="true">/</span><span aria-current="page">{text(s["name"])}</span>' if s else '<span aria-current="page">Листовая полиграфия</span>')+'</nav>'
    hero=f'<section class="cc-hero" aria-labelledby="copycenter-title"><div><h1 id="copycenter-title">{heading}</h1><p>{intro}</p><div class="company-actions"><a class="button button-primary" href="{primary}">{"Рассчитать стоимость" if s else "Выбрать услугу"} {icon("arrow")}</a><button class="button button-white" type="button" data-action="contacts">Задать вопрос</button></div></div><div class="cc-art"><img src="{prefix}assets/{art}" alt="Робот ТЕКСТ — {text(s["name"] if s else "листовая полиграфия")}" width="960" height="960" fetchpriority="high"></div></section>'
    benefits='<div class="cc-benefits">'+''.join(f'<article>{icon(i)}<div><h2>{h}</h2><p>{p}</p></div></article>' for i,h,p in [('calculator','Понятный расчёт','Параметры и цена до заказа'),('shield','Проверим макет','Согласуем детали до печати'),('truck','Выдача и доставка','Барнаул и отправка по России')])+'</div>'
    cta=f'<aside class="company-cta"><div><h2>Поможем с вашим заказом</h2><p>Обсудим параметры, проверим файл и согласуем готовность.</p></div><div class="company-actions"><a class="company-phone" href="tel:+79236547896">{icon("phone")}+7 (923) 654-78-96</a><button class="button button-primary" type="button" data-action="contacts">Написать нам {icon("arrow")}</button></div></aside>'
    page_head=paths(head,prefix);page_head=re.sub(r'<title>.*?</title>',f'<title>{text(s["title"] if s else "Листовая полиграфия в Барнауле | ТЕКСТ")}</title>',page_head)
    page_head+=f'<link rel="stylesheet" href="{prefix}company-pages.css"><link rel="stylesheet" href="{prefix}copycenter.css"><link rel="stylesheet" href="{prefix}leaflet.css">\n'
    if s:page_head+=''.join(f'<script src="{prefix}{name}.js" defer></script>\n' for name in ['leaflet-pricing-data','copycenter-engine','leaflet-pricing','leaflet-ui','copycenter'])
    page_header=paths(header,prefix).replace('class="brand" href="#main"',f'class="brand" href="{prefix}"');page_footer=paths(footer,prefix).replace('class="brand" href="#main"',f'class="brand" href="{prefix}"')
    body=service_body(s,prefix) if s else landing_body();attribute=f' data-leaflet-service="{s["id"]}"' if s else ''
    html=f'<!doctype html>\n<html lang="ru"><head>{page_head}</head><body class="company-page copycenter-page leaflet-page">\n{page_header}<main id="main"{attribute}><div class="container">{breadcrumb}{hero}{benefits}{body}{cta}</div></main>\n{page_footer}</body></html>\n'
    output=ROOT/route/'index.html';output.parent.mkdir(parents=True,exist_ok=True);output.write_text(html,encoding='utf-8')
print('Built sheet printing overview and ten service pages with 30 calculated examples.')
