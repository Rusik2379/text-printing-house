"""Build UV printing and cutting pages using the shared Copy Center components."""
from pathlib import Path
from html import escape
from urllib.parse import quote
import json, re, subprocess, shutil

ROOT=Path(__file__).resolve().parents[1]
SOURCE=json.loads((ROOT/'uv-content.json').read_text(encoding='utf-8'))
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
 '6.1':'Ваш дизайн — прямо на материале. Выберите основание, толщину и белую подложку: рассчитайте печать на пластике, акриле и композитной панели.',
 '6.2':'Буквы, логотипы и аккуратные контуры из цветной плёнки. Подготовим элементы для переноса на витрину, стекло или другую согласованную поверхность.',
 '6.3':'От векторного контура до готовой детали. Рассчитайте работу по фанере, МДФ, акрилу, картону или лазерному пластику — материал согласуем отдельно.',
 '6.4':'Логотип, надпись или рисунок с характером. Выберите гравировку по площади или контуру и получите предварительную стоимость работы по вашему макету.',
 '6.5':'Помогите людям найти нужное место. Сделаем таблички для кабинетов, офиса и навигации — с вашим дизайном на выбранном материале.',
 '6.6':'Маленький предмет, который остаётся с вами. Выберите материал, форму, нанесение и фурнитуру для брелоков вашего бренда или события.',
 '6.7':'Важные данные — на своей пластине. Изготовим шильды с названием, серийным номером, логотипом или кодом по согласованной спецификации.',
 '6.8':'Изображение на готовой металлической пластине. Выберите алюминий или нержавеющую сталь, толщину и размер — рассчитайте изделие с UV-печатью.',
 '6.9':'Порядок начинается с понятного номера. Изготовим комплект для гардероба: согласуем материал, отверстия и полную последовательность по вашей таблице.'}
VARIANTS={
 '6.1':[('Основание под вашу задачу','ПВХ, оргстекло, пенокартон, ПЭТ или алюминиевая композитная панель. Толщины зависят от выбранного материала.','layers'),('Белый слой WHITE','На прозрачных и цветных материалах подложка помогает передать задуманный цвет. Её схему согласуем по отдельному слою.','palette'),('Размер и ориентация','Ширина 50–400 мм, высота 50–600 мм. Сторону печати, отверстия и контур задайте на чертеже.','wide')],
 '6.2':[('Три вида плёнки','Белая, цветная и металлизированная плёнка. Плоттер вырезает форму, а не печатает фотографическое изображение.','layers'),('Простая или сложная резка','Для мелких элементов проверим линии, просветы и удобство выборки. Один рез — одна векторная траектория.','target'),('Перенос с Oratape','Монтажная плёнка включена в текущую модель. Поле заказа — от 200 × 200 до 600 × 2000 мм с возможностью поворота.','copy')],
 '6.3':[('Материал и толщина','Фанера, МДФ, акрил, картон и двухслойный лазерный пластик — в разрешённых толщинах. ПВХ и винил исключены.','layers'),('Чистый вектор 1:1','Резка и гравировка — в отдельных слоях. Для соединений и пазов сначала согласуем пробную деталь.','target'),('Расчёт работы','Калькулятор предварительно оценивает длину реза по периметру габаритов. Точный фигурный контур и материал подтвердим по файлу.','calculator')],
 '6.4':[('По площади или контуру','Для рисунка учитывается заполнение зоны; для линий — предварительная длина по периметру габаритов. Итог подтверждаем по макету.','target'),('Заполнение 10–100 %','Это доля рисунка внутри области. Подсказка рядом с полем помогает оценить заполнение, а не мощность лазера.','palette'),('Стандартная или плотная','Материал, плотность и пробный результат согласуем до серии. Калькулятор считает работу без стоимости заготовки.','layers')],
 '6.5':[('Для кабинетов и навигации','Название, номер, логотип или схема — с понятным расположением и читаемыми деталями.','document'),('Материалы и белая подложка','ПВХ, акрил, пенокартон, ПЭТ и композитная панель. Выберите толщину и необходимость WHITE.','layers'),('Крепление по схеме','Готовый размер 50 × 50–400 × 600 мм. Отверстия, крепёж и монтаж согласуются отдельно до производства.','target')],
 '6.6':[('Шесть видов материала','Прозрачный, белый, цветной или зеркальный акрил, фанера и двухслойный пластик. Нанесение зависит от основания.','layers'),('Ваш силуэт и изображение','Размер от 20 до 120 мм по каждой стороне. Простая, фигурная или сложная форма, UV-печать и доступная гравировка.','palette'),('Фурнитура и эффект','Кольцо, карабин, шнурок или вариант без фурнитуры. Лак доступен для UV-печати после согласования эффекта.','bag')],
 '6.7':[('Материал по назначению','Нержавеющая сталь AISI, алюминий или двухслойный пластик. Допустимую толщину покажет калькулятор.','layers'),('Постоянные и переменные данные','Подготовьте один макет и таблицу серийных номеров или кодов. Читаемость проверим в конечном размере.','document'),('Цена за площадь изделия','Максимальный габарит 600 × 400 мм с поворотом. Цена за штуку не меняется от тиража; общий итог растёт с количеством.','calculator')],
 '6.8':[('Алюминий или AISI','Готовая металлическая пластина толщиной 0,5, 0,8 или 1 мм. Двухслойный пластик на этой странице не предлагается.','layers'),('Ваш макет на металле','Изображение, текст, сторона печати и белая подложка согласуются перед запуском. Для фирменного цвета подготовим образец.','palette'),('Готовое изделие','Размер до 600 × 400 мм с возможностью поворота. Печать на принесённом металлическом предмете обсуждается отдельно.','shield')],
 '6.9':[('Полная последовательность','Укажите диапазон, пропуски и повторы в таблице. Сверим каждый номер с макетом и согласуем образец до серии.','document'),('Материал и нанесение','Акрил, фанера или двухслойный пластик; доступные толщины и способы нанесения связаны с выбором основания.','layers'),('Считаем каждый номерок','Тираж — число отдельных изделий, а не пар. Брелочная фурнитура исключена; отверстие и комплектность задаются на схеме.','calculator')]}
EXAMPLES={
 '6.1':[('Печать на акриле',{},'400 × 200 мм · акрил 3 мм · WHITE · 10 шт.'),('Небольшие панели',{'B4':'ПВХ','B5':3,'B7':100,'B8':150,'B9':5,'B10':'Нет'},'100 × 150 мм · ПВХ 3 мм · без WHITE · 5 шт.'),('Печать на ПЭТ',{'B4':'ПЭТ','B5':1,'B7':200,'B8':300,'B9':25},'200 × 300 мм · ПЭТ 1 мм · WHITE · 25 шт.')],
 '6.2':[('Надпись из белой плёнки',{},'1000 × 600 мм · сложная резка · 1 поле'),('Цветной логотип',{'B4':'ЦВЕТНАЯ','B5':500,'B6':500,'B7':5,'B9':'ПРОСТАЯ'},'500 × 500 мм · простая резка · 5 полей'),('Металлизированные элементы',{'B4':'МЕТАЛЛИЗИРОВАННАЯ','B5':600,'B6':2000,'B7':10},'600 × 2000 мм · сложная резка · 10 полей')],
 '6.3':[('Детали из фанеры',{},'300 × 200 мм · фанера 3 мм · 10 шт. · работа без материала'),('Контур из акрила',{'B4':'Акрил / оргстекло','B5':5,'B6':400,'B7':300,'B9':25,'B10':'СЛОЖНАЯ'},'400 × 300 мм · акрил 5 мм · 25 шт. · предварительно'),('Картонные детали',{'B4':'Картон','B5':2,'B6':150,'B7':100,'B9':100},'150 × 100 мм · картон 2 мм · 100 шт. · работа без материала')],
 '6.4':[('Рисунок на акриле',{'B6':100,'B7':100,'B8':20,'B10':10},'100 × 100 мм · заполнение 20 % · 10 шт. · работа'),('Плотная графика',{'B4':'Фанера / дерево','B6':200,'B7':100,'B8':50,'B10':25,'B11':'ПЛОТНАЯ'},'200 × 100 мм · заполнение 50 % · 25 шт. · работа'),('Контурная гравировка',{'B5':'КОНТУРНАЯ','B6':200,'B7':100,'B10':100},'200 × 100 мм · контур по периметру · 100 шт. · предварительно')],
 '6.5':[('Таблички на акриле',{},'400 × 200 мм · акрил 3 мм · WHITE · 10 шт.'),('Номера кабинетов',{'B4':'ПВХ','B5':5,'B7':200,'B8':100,'B9':5,'B10':'Нет'},'200 × 100 мм · ПВХ 5 мм · без WHITE · 5 шт.'),('Навигация на композите',{'B4':'АКП','B5':3,'B7':300,'B8':400,'B9':3},'300 × 400 мм · композит 3 мм · WHITE · 3 шт.')],
 '6.6':[('Фигурные брелоки',{},'25 × 45 мм · акрил 3 мм · UV-печать · шнурок · 100 шт.'),('Брелоки с гравировкой',{'B5':'Фанера','B6':3,'B7':'ГРАВИРОВКА 1 СТОРОНА','B8':40,'B9':40,'B10':50,'B11':'ПРОСТАЯ','B12':'Кольцо с цепочкой'},'40 × 40 мм · фанера 3 мм · гравировка · кольцо · 50 шт.'),('Двусторонняя UV-печать',{'B7':'УФ-ПЕЧАТЬ 2 СТОРОНЫ','B8':50,'B9':50,'B10':25,'B12':'Карабин'},'50 × 50 мм · акрил 3 мм · две стороны · карабин · 25 шт.')],
 '6.7':[('Шильды на нержавейке',{},'90 × 110 мм · AISI 0,8 мм · 26 шт.'),('Алюминиевая маркировка',{'B4':'Алюминий','B5':0.5,'B6':80,'B7':40,'B8':25},'80 × 40 мм · алюминий 0,5 мм · 25 шт.'),('Двухслойный пластик',{'B4':'Пластик двуслойный','B5':1.5,'B6':100,'B7':50,'B8':10},'100 × 50 мм · пластик 1,5 мм · 10 шт.')],
 '6.8':[('Печать на AISI',{},'90 × 110 мм · готовая пластина 0,8 мм · 26 шт.'),('Алюминиевые пластины',{'B4':'Алюминий','B5':1,'B6':200,'B7':100,'B8':5},'200 × 100 мм · алюминий 1 мм · 5 шт.'),('Небольшой тираж',{'B4':'Алюминий','B5':0.5,'B6':100,'B7':100,'B8':1},'100 × 100 мм · алюминий 0,5 мм · 1 шт. · минимальный чек')],
 '6.9':[('Номерки из акрила',{'B8':40,'B9':60,'B10':50,'B11':'ПРОСТАЯ'},'40 × 60 мм · акрил 3 мм · UV-печать · 50 отдельных изделий'),('Гравировка на пластике',{'B5':'Пластик двухслойный','B6':1.5,'B7':'ГРАВИРОВКА 1 СТОРОНА','B8':40,'B9':60,'B10':100,'B11':'ПРОСТАЯ'},'40 × 60 мм · пластик 1,5 мм · 100 отдельных изделий'),('Номерки для парного набора',{'B8':40,'B9':60,'B10':200,'B11':'ПРОСТАЯ'},'40 × 60 мм · акрил 3 мм · 200 изделий для 100 пар')]}
js="require('./uv-pricing-data.js');require('./copycenter-engine.js');require('./uv-pricing.js');const e="+json.dumps(EXAMPLES,ensure_ascii=False)+";console.log(JSON.stringify(Object.fromEntries(Object.entries(e).map(([id,a])=>[id,a.map(([name,c,note])=>({name,note,...TEXT_UV_PRICING.quote(id,c)}))]))));"
QUOTES=json.loads(subprocess.check_output([shutil.which('node'),'--eval',js],cwd=ROOT).decode('utf-8'))
for sid,items in QUOTES.items():
    for q in items:
        if not q['valid']:raise ValueError(sid+': invalid example '+str(q))

def preparation(s,prefix):
    t=s['technical']
    checks='<ul class="cc-checks">'+''.join(f'<li>{icon("check")}<span>{text(v)}</span></li>' for v in t['checks'])+'</ul>'
    guidance=f'<p class="cc-example-note">{text(t["note"])}</p>' if t.get('note') else ''
    guide=f'<aside class="cc-file-guide"><h3>Что подготовить</h3><p>{text(t["send"])}</p><p>{text(s["requirements"])}</p><p class="cc-example-note"><strong>Например:</strong> {text(t["example"])}</p>{guidance}<a class="text-button" href="{prefix}requirements/#requirement-{s["id"].replace(".","-")}">Все требования к услуге {icon("arrow")}</a></aside>'
    answers=[('Какой файл подготовить?',t['fileSpec']),('Что особенно важно проверить?','\n\n'.join(t['critical'])),('Каких ошибок избежать?','\n\n'.join(t['mistakes'])),('Что проверим перед запуском?',t['preflight'])]
    return '<div class="cc-requirements">'+checks+guide+'</div><div class="company-faq cc-faq faq-list uv-preparation-details">'+''.join(f'<details><summary>{title}{icon("plus")}</summary>{paragraphs(body)}</details>' for title,body in answers)+'</div>'
def faq(s=None):
    items=list(s['faq']) if s else [
      {'q':'Что выбрать: печать, резку или гравировку?','a':'UV-печать наносит цветное изображение на материал. Плоттер вырезает элементы из плёнки, CO₂-лазер — детали из разрешённых листовых материалов. Гравировка создаёт надписи и рисунки. Готовые таблички, шильды, брелоки и номерки рассчитываются на своих страницах.'},
      {'q':'Какие материалы доступны?','a':'Список и толщина зависят от услуги. Выберите материал в калькуляторе: доступные толщины и способы нанесения обновятся. ПВХ и винил для CO₂-лазера исключены. Неизвестное основание сначала согласуйте со студией.'},
      {'q':'Входит ли материал в лазерную резку и гравировку?','a':'Калькуляторы лазерной резки и гравировки рассчитывают работу без стоимости материала. Для фигурного контура длина предварительно оценивается по периметру габаритов; точную работу подтвердим по файлу. Заготовку и технологические отступы согласуем отдельно.'},
      {'q':'Как подготовить макет?','a':'Передайте файл в масштабе 1:1. Для резки нужны чистые векторные контуры без дублей; для печати — отдельные слои цветного изображения и WHITE. Отверстия и крепление укажите на размерной схеме, переменные номера — в таблице.'},
      {'q':'Когда будет готов заказ?','a':'Ориентир — один рабочий день на каждые 7 000 ₽ с округлением вверх после полного согласования макета. Точный срок, подготовку файлов и доставку подтвердим перед производством.'}]
    items += [
      {'q':'Как сохранить и отправить расчёт?','a':'Добавьте услуги в корзину и скачайте общий PDF с логотипом, параметрами и ценами. Можно также скопировать расчёт и ссылку на выбранные параметры.'},
      {'q':'Как получить готовый заказ?','a':'Самовывоз: Барнаул, проспект Строителей, 11. Курьерскую доставку или отправку по России, стоимость и срок согласуйте со студией.'},
      {'q':'Корзина сразу запускает печать?','a':'Корзина сохраняет предварительный расчёт в вашем браузере. Отправьте запрос и файлы в студию; производство начинается после согласования параметров, макета и оплаты.'}]
    return '<div class="company-faq cc-faq faq-list">'+''.join(f'<details><summary>{text(v["q"])}{icon("plus")}</summary><p>{text(v["a"])}</p></details>' for v in items)+'</div>'
def calculator(s,prefix):
    fixed=s['technical']['fixed']
    return f'''<section class="cc-calculator" id="calculator" aria-labelledby="calculator-title"><div class="cc-heading"><h2 id="calculator-title">Выберите нужные параметры</h2><p>Укажите параметры заказа — стоимость пересчитывается сразу.</p></div>
    <form id="copycenter-form"><div class="cc-calc-layout"><div class="cc-options-panel"><button class="cc-copy-button" type="button" data-cc-copy disabled aria-label="Скопировать параметры, стоимость и ссылку" title="Скопировать параметры, стоимость и ссылку">{icon('copy')}<span>Скопировать расчёт</span></button><div class="cc-parameters" data-cc-fields></div><div class="cc-parameter-footer"><div class="cc-fixed">{''.join('<span>'+text(v)+'</span>' for v in fixed)}</div><p class="cc-helper"><a href="#service-requirements">Проверить требования к макету →</a></p><button class="cc-reset" type="button" data-cc-reset>Сбросить параметры</button></div></div>
    <aside class="cc-result" aria-label="Макет и результат расчёта"><label class="cc-upload" data-cc-file-zone>{icon('upload')}<strong data-cc-file-label>Загрузите макет</strong><span>или перетащите файл сюда</span><input type="file" data-cc-file accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.svg,.ai,.eps,.cdr,.psd,.zip"></label><div class="cc-file-tools"><p class="cc-file-status" data-cc-file-status role="status">PDF, изображения, исходники или ZIP · до 100 МБ. Можно прикрепить позже в корзине.</p><button type="button" data-cc-remove-file hidden>Убрать файл</button></div><label class="cc-comment" for="cc-comment">Комментарий к заказу<textarea id="cc-comment" data-cc-comment rows="2" maxlength="2000" placeholder="Размер, ориентация, обработка и важные детали"></textarea></label>
    <div class="cc-result-summary"><p class="cc-error" data-cc-error role="status" hidden></p><h3>Стоимость заказа</h3><div class="cc-total" data-cc-total aria-live="polite">—</div><p class="cc-days" data-cc-days></p><p class="cc-range-note" data-cc-range-note hidden></p><button class="cc-add-button" type="submit" data-cc-add disabled>В корзину</button><div class="cc-tools"><button type="button" data-cc-download disabled>{icon('download')}Скачать расчёт</button><button type="button" data-action="cart">Открыть корзину</button></div><p class="cc-disclosure">После добавления позиций в корзину можно скачать общий PDF с параметрами и ценами. Стоимость и срок подтвердим перед производством.</p></div></aside></div>
    <details class="cc-breakdown" data-cc-breakdown-panel hidden><summary>Из чего складывается цена</summary><dl data-cc-breakdown></dl></details><p class="cc-calculator-note">{text(s['sla'])} Подготовка макета, доставка и дополнительные работы согласуются отдельно.</p></form><noscript><p>Для интерактивного расчёта включите JavaScript. Ниже доступны примеры стоимости; заказ можно согласовать по телефону +7 (923) 654-78-96.</p></noscript></section>'''
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
    items=[('Согласуем заказ','Выберите параметры, передайте файл и важные детали. До запуска подтвердим стоимость, срок и макет.'),('Изготовим ваш тираж','Выполним согласованную печать, резку или гравировку. Проверим качество, данные и комплектность заказа.'),('Передадим вам','Заберите заказ в студии или согласуйте доставку. Подготовим продукцию к выдаче и упаковке.')]
    return '<div class="cc-process">'+''.join(f'<article class="cc-step"><span class="cc-step-number">0{n}</span><h3>{h}</h3><p>{p}</p></article>' for n,(h,p) in enumerate(items,1))+'</div>'
def service_body(s,prefix):
    examples='<div class="cc-examples">'+''.join(f'<article class="cc-example"><h3>{text(q["name"])}</h3><p>{text(q["note"])}</p><strong>{money(q["price"])}</strong><a href="?calc={quote(json.dumps(q["configuration"],ensure_ascii=False,separators=(",",":")))}#calculator">Рассчитать этот вариант</a></article>' for q in QUOTES[s['id']])+'</div>'
    variants='<div class="cc-variants">'+''.join(f'<article class="cc-variant">{icon(i)}<h3>{h}</h3><p>{p}</p></article>' for h,p,i in VARIANTS[s['id']])+'</div>'
    articles=[a for a in ARTICLES if a['id'] in s['articleIds']][:3]
    reading='<div class="cc-reading">'+''.join(f'<a href="{prefix}{a["path"]}"><h3>{text(a["title"])}</h3><span>Читать статью →</span></a>' for a in articles)+'</div>'
    number_set=section('Номерки, которые идут по порядку','<div class="uv-number-set"><ol class="uv-number-grid" aria-label="Полный пример комплекта от 001 до 050">'+''.join(f'<li>{n:03}</li>' for n in range(1,51))+'</ol><p>Пример полного комплекта 001–050: 50 отдельных изделий. Для парного набора укажите два экземпляра каждого номера и тираж 100 шт. Свой диапазон, пропуски и повторы передайте в таблице вместе с макетом.</p></div>') if s['id']=='6.9' else ''
    return calculator(s,prefix)+number_set+section('Примеры стоимости',examples,'price-examples','Расчёты для конкретных параметров. Откройте пример и измените его под свой заказ.')+section('Варианты для вашей задачи',variants,'service-options')+section('От заказа до результата',process())+section('Проверьте перед заказом',preparation(s,prefix),'service-requirements')+section('Частые вопросы',faq(s),'service-faq')+section('Добавьте к заказу',related(s,prefix),'related-services')+section('Полезно перед заказом',reading)+section(s['name']+' в студии ТЕКСТ','<div class="cc-seo">'+paragraphs(s['seo'])+'</div>')
CARD_TEXT=['Материал · толщина · белая подложка','Плёнка · чистый вектор · Oratape','Фанера, акрил и другие материалы','По площади или контуру · заполнение','Для офисов, кабинетов и навигации','Материал · форма · нанесение · фурнитура','Металл и пластик · номера и коды','Готовая металлическая пластина','Полная последовательность по таблице']

def landing_body():
    cards='<div class="cc-category-grid" id="uv-services">'+''.join(f'<a class="cc-service-card" href="{s["path"].removeprefix("uv-pechat-i-rezka/")}"><div><h3>{text(s["name"])}</h3><p>{CARD_TEXT[i]}</p><span>Рассчитать →</span></div><img src="../assets/{s["art"]}" alt="" width="960" height="960" loading="lazy"></a>' for i,s in enumerate(SERVICES))+'</div>'
    return section('Изображения, формы и детали',cards,intro='Девять услуг с онлайн-расчётом. Выберите материал и параметры, а готовые расчёты соберите в один заказ.')+section('Как оформить заказ',process())+section('Частые вопросы',faq(),'service-faq')
for s in [None,*SERVICES]:
    route=s['path'] if s else 'uv-pechat-i-rezka/';prefix='../'*len(Path(route).parts)
    title=s['h1'] if s else 'UV-печать и резка в Барнауле'
    heading=text(title).replace(' в Барнауле',' <span class="cc-hero-place">в Барнауле</span>')
    intro=INTRO[s['id']] if s else 'Ваши идеи обретают цвет и форму. Печатаем на жёстких материалах, вырезаем детали и наносим гравировку — для навигации, маркировки, подарков и вашего бренда.'
    art=s['art'] if s else SERVICES[0]['art'];primary='#calculator' if s else '#uv-services'
    breadcrumb=f'<nav class="company-breadcrumbs" aria-label="Хлебные крошки"><a href="{prefix}">Главная</a><span aria-hidden="true">/</span>'+(f'<a href="../">UV-печать и резка</a><span aria-hidden="true">/</span><span aria-current="page">{text(s["name"])}</span>' if s else '<span aria-current="page">UV-печать и резка</span>')+'</nav>'
    hero=f'<section class="cc-hero" aria-labelledby="copycenter-title"><div><h1 id="copycenter-title">{heading}</h1><p>{intro}</p><div class="company-actions"><a class="button button-primary" href="{primary}">{"Рассчитать стоимость" if s else "Выбрать услугу"} {icon("arrow")}</a><button class="button button-white" type="button" data-action="contacts">Задать вопрос</button></div></div><div class="cc-art"><img src="{prefix}assets/{art}" alt="Робот ТЕКСТ — {text(s["name"] if s else "UV-печать и резка")}" width="960" height="960" fetchpriority="high"></div></section>'
    benefits='<div class="cc-benefits">'+''.join(f'<article>{icon(i)}<div><h2>{h}</h2><p>{p}</p></div></article>' for i,h,p in [('calculator','Понятный расчёт','Параметры и цена до заказа'),('shield','Проверим макет','Согласуем детали до запуска'),('truck','Выдача и доставка','Барнаул и отправка по России')])+'</div>'
    cta=f'<aside class="company-cta"><div><h2>Поможем с вашим заказом</h2><p>Обсудим параметры, проверим файл и согласуем готовность.</p></div><div class="company-actions"><a class="company-phone" href="tel:+79236547896">{icon("phone")}+7 (923) 654-78-96</a><button class="button button-primary" type="button" data-action="contacts">Написать нам {icon("arrow")}</button></div></aside>'
    page_head=paths(head,prefix);page_head=re.sub(r'<title>.*?</title>',f'<title>{text(s["title"] if s else "UV-печать и резка в Барнауле | ТЕКСТ")}</title>',page_head)
    page_head+=f'<link rel="stylesheet" href="{prefix}company-pages.css"><link rel="stylesheet" href="{prefix}copycenter.css"><link rel="stylesheet" href="{prefix}uv.css">\n'
    if s:page_head+=''.join(f'<script src="{prefix}{name}.js" defer></script>\n' for name in ['uv-pricing-data','copycenter-engine','uv-pricing','uv-ui','copycenter'])
    page_header=paths(header,prefix).replace('class="brand" href="#main"',f'class="brand" href="{prefix}"');page_footer=paths(footer,prefix).replace('class="brand" href="#main"',f'class="brand" href="{prefix}"')
    body=service_body(s,prefix) if s else landing_body();attribute=f' data-uv-service="{s["id"]}"' if s else ''
    html=f'<!doctype html>\n<html lang="ru"><head>{page_head}</head><body class="company-page copycenter-page uv-page">\n{page_header}<main id="main"{attribute}><div class="container">{breadcrumb}{hero}{benefits}{body}{cta}</div></main>\n{page_footer}</body></html>\n'
    output=ROOT/route/'index.html';output.parent.mkdir(parents=True,exist_ok=True);output.write_text(html,encoding='utf-8')
print('Built UV printing and cutting overview and nine service pages with 27 calculated examples.')
