"""Native SVG illustrations for service preparation, separate from customer facts."""
from html import escape
import re


def model(service):
    service_id = service['id']
    match = re.search(r'req-scheme-([a-z0-9-]+)', service['schemeHtml'])
    kind = match[1] if match else 'document'
    uid = 'req-model-' + service_id.replace('.', '-')
    paper = f'url(#{uid}-paper)'
    metal = f'url(#{uid}-metal)'
    rose = f'url(#{uid}-rose)'
    shadow = f'url(#{uid}-shadow)'
    gloss = f'url(#{uid}-gloss)'

    def rect(x, y, w, h, fill=None, radius=8, extra=''):
        stroke = '' if re.search(r'\bstroke=', extra) else 'stroke="#d8dce2"'
        return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill or paper}" {stroke} stroke-width="1.3" {extra}/>'

    def line(path, color='#9ba2ad', width=2, extra=''):
        return f'<path d="{path}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'

    def label(x, y, text, anchor='start', cls='req-model-label'):
        return f'<text x="{x}" y="{y}" text-anchor="{anchor}" class="{cls}">{escape(text)}</text>'

    def callout(path, x, y, text, anchor='start'):
        return line(path, '#b5bac3', 1.3) + label(x, y, text, anchor)

    def content(x, y, w=116):
        return ''.join(line(f'M{x} {y+i*19}h{length}', '#bec3cc', 5) for i, length in enumerate([w, w-24, w-8, w-37]))

    def brand(x, y):
        return f'<circle cx="{x}" cy="{y}" r="19" fill="#df1836"/>' + label(x, y+6, 'Т', 'middle', 'req-model-brand')

    def artwork(x, y, w, h):
        return (rect(x, y, w, h, rose, 3) +
                f'<circle cx="{x+w*.72}" cy="{y+h*.28}" r="{h*.14}" fill="#fff" opacity=".85"/>' +
                f'<path d="M{x} {y+h}V{y+h*.75}L{x+w*.36} {y+h*.36}L{x+w*.68} {y+h}Z" fill="#d94b60"/>' +
                f'<path d="M{x+w*.42} {y+h}L{x+w*.8} {y+h*.53}L{x+w} {y+h*.72}V{y+h}Z" fill="#9c263b" opacity=".72"/>')

    def page(x, y, w=178, h=226, extra=''):
        return rect(x, y, w, h, extra=extra) + brand(x+35, y+38) + content(x+25, y+85, w-50)

    body = ''
    caption = ''
    if kind == 'document':
        body = (f'<g filter="{shadow}">' + rect(213, 45, 166, 224, '#e7e9ee') +
                rect(196, 61, 166, 224, '#f4f5f7') + page(177, 78, 166, 224) + '</g>' +
                rect(196, 249, 70, 28, '#fff0f3', 7) + label(231, 269, 'PDF', 'middle', 'req-model-accent') +
                callout('M177 108H111V94', 48, 80, 'Один файл') +
                callout('M362 153H418V118', 568, 106, 'Порядок страниц', 'end') +
                ''.join(f'<circle cx="{427+i*43}" cy="148" r="14" fill="#fff" stroke="#d8dce2"/>'+label(427+i*43,153,str(i+1),'middle') for i in range(3)) +
                line('M442 148h12m28 0h12', '#df1836', 2))
        caption = 'Последовательные страницы в одном PDF'
    elif kind == 'scan':
        copying = service_id == '1.2'
        body = (f'<g filter="{shadow}">' + rect(96, 231, 337, 70, '#eef0f3', 14) +
                rect(112, 216, 305, 32, metal, 10) + page(157, 58, 174, 192) +
                rect(166, 184, 156, 25, '#fce6eb', 0, 'stroke="none"') + line('M166 197h156', '#df1836', 2) +
                '</g>' + line('M356 152h47m-12-10 12 10-12 10', '#df1836', 2.2) +
                rect(425, 97, 88, 112, extra=f'filter="{shadow}"') + content(439, 124, 58) +
                label(469, 195, 'Копия' if copying else 'PDF', 'middle', 'req-model-accent') +
                label(248, 329, 'Читаемый оригинал', 'middle'))
        caption = 'Проверьте оригинал, ориентацию и порядок страниц'
    elif kind == 'photo':
        body = (f'<g transform="rotate(-9 260 174)" filter="{shadow}">' + rect(136, 65, 247, 222) +
                artwork(151, 80, 217, 162) + '</g>' +
                f'<g transform="rotate(9 353 193)" filter="{shadow}">' + rect(233, 104, 229, 202) +
                artwork(248, 119, 199, 145) + '</g>' +
                callout('M462 175H506V150', 502, 135, 'Пропорции', 'end') +
                label(134, 327, 'Без растяжения изображения'))
        caption = 'Сохраните пропорции и проверьте кадрирование'
    elif kind == 'laminate':
        body = (f'<g filter="{shadow}">' + rect(173, 46, 240, 274, '#f1f4f8', 18) +
                page(193, 66, 200, 234) + '</g>' +
                rect(180, 53, 226, 260, 'none', 12, 'stroke-dasharray="5 5"') +
                callout('M406 264H469V236', 480, 231, 'Кромка') +
                line('M184 78V64h20', '#fff', 3))
        caption = 'Герметичная кромка вокруг готового документа'
    elif kind == 'binding':
        hard = service_id == '1.6'
        stapled = service_id in ('1.9', '3.4')
        body = (f'<g filter="{shadow}">' + rect(207, 76, 185, 239, '#dfe3e9') +
                rect(202, 69, 185, 239, '#eef0f4') + rect(197, 62, 185, 239, '#f8f9fb') +
                rect(183, 51, 194, 243, '#343b49' if hard else paper) + '</g>')
        if hard:
            body += rect(183, 51, 20, 243, '#df1836', 5) + label(286, 134, 'ДИПЛОМ', 'middle', 'req-model-cover') + line('M236 151h102', '#82909f', 1)
        else:
            body += brand(272, 95) + content(230, 136, 117)
            if stapled:
                body += line('M191 99h13m-13 115h13', '#535b68', 4)
            else:
                for y in range(77, 280, 22):
                    body += f'<ellipse cx="191" cy="{y}" rx="17" ry="7" fill="none" stroke="#68717f" stroke-width="3"/>' + line(f'M184 {y-4}q15-6 22 2', '#fff', 1)
        body += line('M221 68v204', '#df1836', 1.5, 'stroke-dasharray="5 5"') + callout('M220 220H112V249', 104, 273, 'Поле у крепления')
        caption = 'Порядок страниц и место для выбранного крепления'
    elif kind == 'thermal':
        bars = ''.join(rect(277+i*6, 179, 2 if i%3 else 4, 38, '#404751', 0, 'stroke="none"') for i in range(20))
        body = (f'<g filter="{shadow}">' + rect(134, 69, 263, 138, '#e4e7ec', 52) +
                f'<ellipse cx="158" cy="138" rx="42" ry="68" fill="{paper}" stroke="#d1d6de"/>' +
                f'<ellipse cx="158" cy="138" rx="17" ry="27" fill="#d3d8df" stroke="#bac1cc"/>' +
                rect(229, 105, 217, 158, paper, 13) + bars + label(337, 155, 'ТЕКСТ', 'middle', 'req-model-accent') + '</g>' +
                line('M232 295h211m-211-6v12m211-12v12', '#a5adb8', 1.4) + label(336, 321, '58 × 40 мм', 'middle'))
        caption = 'Готовый размер и переменные данные — по заданию'
    elif kind == 'drawing':
        body = (f'<g transform="rotate(-4 290 184)" filter="{shadow}">' + rect(121, 49, 340, 245) +
                rect(143, 72, 294, 198, '#f9fafc', 0) +
                line('M174 102h156v109H174ZM195 102v64h55v45m0-109v37h80m-105 27h46m-39 0v45M330 148h52v63h-52', '#657b93', 2) +
                line('M160 87h185m-185-5v10m185-10v10M157 101v112m-5-112h10m-10 112h10', '#a7b3c2', 1.3) +
                rect(303, 235, 132, 33, '#fff', 0) + line('M303 248h132m-82-13v33m38-33v33', '#bbc3ce', 1) + '</g>' +
                callout('M423 243H494V274', 484, 300, 'Штамп', 'end') +
                label(87, 321, 'Масштаб и размер листа'))
        if service_id == '2.7':
            body = (f'<g filter="{shadow}">' + rect(130, 58, 335, 244) +
                    line('M200 92q-33 37-35 88l51 30-8 54h111l-8-54 51-30q-2-51-35-88l-31 22h-64Z', '#52677e', 2.3) +
                    line('M176 105q-28 49-25 86m222-86q28 49 25 86M257 130v112', '#df1836', 1.3, 'stroke-dasharray="5 5"') +
                    label(299, 283, '1:1', 'middle', 'req-model-accent') + '</g>')
        caption = 'Проверьте масштаб и контрольный размер в файле'
    elif kind == 'fold' and service_id != '3.6':
        body = (f'<g filter="{shadow}"><path d="M114 95 229 66 335 93 455 62V271L335 300 229 273 114 302Z" fill="{paper}" stroke="#d8dce2"/>' +
                '<path d="m229 66 106 27v207l-106-27Z" fill="#fcecf0"/>' +
                line('M229 66v207M335 93v207', '#df1836', 1.6, 'stroke-dasharray="5 5"') +
                content(135, 147, 71) + content(248, 136, 65) + content(353, 133, 79) + '</g>' +
                callout('M335 99V37H424', 429, 42, 'Линия сгиба') +
                label(279, 335, 'Развёртка → готовое изделие', 'middle'))
        if service_id == '2.3':
            body += rect(365, 228, 71, 37, '#fff', 0) + label(400, 252, 'Штамп', 'middle', 'req-model-small')
        caption = 'Согласуйте линии сгиба и порядок сложения'
    elif kind == 'bleed' or service_id == '3.6':
        body = (f'<g filter="{shadow}">' + rect(148, 72, 290, 216, '#fce3e9', 10) +
                rect(169, 93, 248, 174, paper, 2) + '</g>' +
                rect(190, 114, 206, 132, 'none', 0, 'stroke-dasharray="5 5"') + brand(227, 153) +
                content(261, 145, 107) +
                rect(169, 93, 248, 174, 'none', 2, 'style="stroke:#df1836" stroke-dasharray="7 5"') +
                callout('M151 107H105V63', 38, 48, 'Вылеты 4 мм' if service_id == '3.2' else 'Вылеты') +
                callout('M416 93H455V53', 464, 49, 'Линия реза') +
                callout('M397 230H472V303', 473, 324, 'Безопасное поле', 'end'))
        caption = 'Фон — до вылетов, важный текст — внутри безопасного поля'
    elif kind == 'sheet':
        body = (f'<g filter="{shadow}">' + rect(174, 49, 242, 267) +
                rect(188, 63, 214, 239, 'none', 0) + line('M199 79h192M199 286h192', '#e2a5b1', 1.5) +
                brand(295, 107) + label(295, 155, 'СЕРТИФИКАТ' if service_id == '3.8' else 'ДИПЛОМ', 'middle', 'req-model-accent') +
                label(295, 192, 'ИМЯ ФАМИЛИЯ', 'middle', 'req-model-label') +
                content(235, 217, 119) + '</g>' +
                callout('M416 192H493V159', 481, 143, 'Проверьте данные', 'end'))
        caption = 'Текст, имена и реквизиты проверяют до печати'
    elif kind in ('sticker', 'dome'):
        circle = service_id in ('4.2', '4.9')
        rectangular = service_id in ('4.3', '4.5', '4.10')
        shape = ('<circle cx="0" cy="0" r="64" {attrs}/>' if circle else
                 '<rect x="-73" y="-53" width="146" height="106" rx="20" {attrs}/>' if rectangular else
                 '<path d="M-57-27Q-59-69-17-60Q21-91 40-53Q88-50 65-11Q91 25 51 39Q34 84 0 56Q-43 83-52 42Q-89 29-66-5Z" {attrs}/>')
        body = '<g transform="translate(190 188)" filter="'+shadow+'">' + shape.format(attrs=f'fill="{rose}" stroke="#e6a5b4" stroke-width="1.4"') + brand(0, 0)
        if kind == 'dome':
            body += shape.format(attrs=f'fill="{gloss}" stroke="#fff" stroke-opacity=".65"') + '<path d="M-37-23q12-22 40-23" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".8"/>'
        body += ('</g><g transform="translate(424 188)">' + shape.format(attrs='fill="#fff" stroke="#df1836" stroke-width="2" stroke-dasharray="7 4"') + '</g>' +
                line('M283 188h43m-12-10 12 10-12 10', '#a0a7b2', 2) +
                label(190, 296, 'Изображение', 'middle') + label(424, 296, 'Контур реза', 'middle'))
        caption = 'Отдельный замкнутый контур по форме изделия'
    elif kind in ('stickerpack', 'papersticker', 'domepack'):
        body = f'<g transform="rotate(-4 294 188)" filter="{shadow}">' + rect(148, 47, 288, 267)
        for x, y, shape in [(208,114,'circle'),(321,108,'pill'),(370,178,'circle'),(218,224,'pill'),(318,253,'circle')]:
            body += (f'<circle cx="{x}" cy="{y}" r="31" fill="{rose}" stroke="#df1836" stroke-dasharray="5 3"/>' if shape=='circle' else
                     rect(x-40,y-27,80,54,rose,18,'style="stroke:#df1836" stroke-dasharray="5 3"'))
            body += brand(x,y)
            if kind=='domepack':
                body += line(f'M{x-18} {y-14}q12-10 25-6','#fff',5)
        body += '</g>' + callout('M436 209H492V153', 488, 134, 'Каждый контур', 'end')
        caption = 'Размер подложки и отдельный контур каждого элемента'
    elif kind in ('uv', 'uvdtf', 'mount'):
        mounting = kind == 'mount'
        layers = [(202, metal), (141, '#fff'), (78, rose)] if not mounting else [(180, metal), (88, rose)]
        body = ''
        for y, fill in layers:
            body += (f'<g filter="{shadow}"><path d="M140 {y+45} 325 {y} 464 {y+60} 277 {y+108}Z" fill="{fill}" stroke="#d3d8e0"/>' +
                     f'<path d="m140 {y+45} 137 63 187-48v12l-187 48-137-63Z" fill="#cfd5df" stroke="#c3cad5"/>' + '</g>')
        body += brand(296,128 if mounting else 118)
        body += callout('M442 128H565', 582, 116, 'Печать', 'end')
        if not mounting:
            body += callout('M438 187H565', 582, 175, 'WHITE', 'end')
        body += callout('M441 264H565', 582, 252, 'Основа' if mounting else 'Материал', 'end')
        caption = 'Печать на плёнке и основа — отдельные слои' if mounting else 'Печатный слой, белая подложка и материал'
    elif kind in ('plotter', 'laser', 'engrave'):
        contour='M-97-66H15L95-4V68H-97Z'
        body = f'<g transform="translate(286 180)" filter="{shadow}"><path d="{contour}" fill="{paper}" stroke="#d4d9e1"/>'
        if kind == 'engrave':
            body += '<rect x="-64" y="-26" width="124" height="57" rx="8" fill="#e8ebf0"/>' + ''.join(line(f'M{x} -23v51','#a4adba',2) for x in range(-58,59,7))
        else:
            body += brand(-17,-5) + line('M-50 38h89','#bac1cb',4)
        body += (f'<path d="{contour}" fill="none" stroke="#df1836" stroke-width="2"/>' + ''.join(f'<circle cx="{x}" cy="{y}" r="5" fill="#fff" stroke="#df1836" stroke-width="2"/>' for x,y in [(-97,-66),(15,-66),(95,-4),(95,68),(-97,68)]) + '</g>' +
                callout('M381 177H470V134', 459, 112, 'Замкнутый контур', 'end') + label(287, 307, 'Вектор · готовый размер', 'middle'))
        caption = 'Разделите резку и гравировку в векторном файле' if kind in ('laser','engrave') else 'Замкнутые контуры без лишних линий и дубликатов'
    elif kind in ('tag', 'plate', 'keychain'):
        if service_id == '6.9':
            body = f'<g filter="{shadow}">' + ''.join(rect(150+i*106, 86+i*18, 91, 166, metal, 20) + f'<circle cx="{195+i*106}" cy="{109+i*18}" r="8" fill="#fff" stroke="#b9c2ce"/>' + label(195+i*106,180+i*18,f'00{i+1}','middle','req-model-number') for i in range(3)) + '</g>' + label(304, 322, 'Сохраните ведущие нули', 'middle')
            caption = 'Одна строка таблицы — один номерок'
        elif kind == 'keychain' or kind == 'tag':
            body = (f'<g transform="rotate(-9 297 188)" filter="{shadow}">' + rect(201, 105, 199, 172, rose, 28) +
                    '<circle cx="233" cy="138" r="11" fill="#fff" stroke="#d88598"/>' + brand(307,179) + content(269,220,76) + '</g>' +
                    (f'<circle cx="229" cy="116" r="33" fill="none" stroke="{metal}" stroke-width="8"/>' if kind=='keychain' else '') +
                    callout('M223 114H129V78', 49, 58, 'Отверстие по схеме'))
            caption = 'Размер, форма и расположение отверстия'
        else:
            body = (f'<g transform="rotate(-4 293 187)" filter="{shadow}">' + rect(132, 84, 323, 203, metal, 15) +
                    brand(203,143) + content(247,136,158) +
                    ''.join(f'<circle cx="{x}" cy="{y}" r="6" fill="#fff" stroke="#a8b1bf"/>' for x,y in [(150,102),(437,102),(150,269),(437,269)]) + '</g>' +
                    callout('M436 266H507V304', 502, 328, 'Крепление по заданию', 'end'))
            caption = 'Готовый размер, текст и крепление по размерной схеме'
    elif kind in ('wide', 'banner', 'canvas', 'film'):
        body = f'<g transform="rotate(-4 297 184)" filter="{shadow}">' + rect(144, 68, 313, 222, paper, 6) + artwork(163,87,275,181)
        if kind == 'banner':
            body += rect(151,75,299,208,'none',2,'stroke-dasharray="5 4"') + ''.join(f'<circle cx="{x}" cy="{y}" r="5" fill="#fff" stroke="#9da7b5"/>' for x,y in [(157,81),(444,81),(157,276),(444,276)])
        elif kind == 'canvas':
            body += '<path d="m144 290 16 14h313l-16-14Z" fill="#c8cfd8"/><path d="m457 68 16 14v222l-16-14Z" fill="#dce1e8"/>'
        elif kind == 'film':
            body += '<path d="m403 290 54-54v54Z" fill="#eceff4" stroke="#cfd5df"/><path d="m403 290 54-54q-14 32-54 54Z" fill="#fff"/>'
        body += '</g>' + line('M146 321h312m-312-6v12m312-12v12','#a3acb8',1.4) + label(302,347,'Готовый размер','middle')
        caption = {'banner':'Размер изображения и обработка краёв по заданию','canvas':'Лицевая часть и заворот под выбранный подрамник','film':'Готовое изображение и сторона просмотра','wide':'Готовый размер и читаемость изображения'}[kind]
    else:
        body = f'<g filter="{shadow}">' + page(204,54) + '</g>'
        caption = 'Файл в готовом размере и согласованные параметры'

    description = f'Схема подготовки для услуги «{service["name"]}». {caption}. Иллюстрация не задаёт размеры изделия.'
    return f'''<figure class="req-scheme req-scheme-v3" data-model-kind="{kind}">
<svg viewBox="0 0 600 360" role="img" aria-labelledby="{uid}-title {uid}-desc" xmlns="http://www.w3.org/2000/svg">
<title id="{uid}-title">{escape(caption)}</title><desc id="{uid}-desc">{escape(description)}</desc>
<defs>
<linearGradient id="{uid}-paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#f5f6f9"/></linearGradient>
<linearGradient id="{uid}-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e9edf4"/><stop offset=".48" stop-color="#fcfdff"/><stop offset="1" stop-color="#b8c2d1"/></linearGradient>
<linearGradient id="{uid}-rose" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fde4e9"/><stop offset="1" stop-color="#f0a4b6"/></linearGradient>
<linearGradient id="{uid}-gloss" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".65"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".3"/></linearGradient>
<filter id="{uid}-shadow" x="-35%" y="-30%" width="170%" height="175%"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#4b566d" flood-opacity=".13"/></filter>
</defs>
<ellipse cx="302" cy="306" rx="176" ry="19" fill="#dae0e9" opacity=".35"/>
{body}</svg><figcaption>{escape(caption)}</figcaption></figure>'''
