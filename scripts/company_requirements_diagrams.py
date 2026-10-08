"""Small native SVG diagrams for the site's technical notes."""

def diagram(kind, service_id):
    if kind == 'bleed':
        body='<rect x="30" y="22" width="260" height="156" rx="8" fill="#fff0f1"/><rect x="51" y="43" width="218" height="114" rx="3" class="req-diagram-cut"/><rect x="72" y="64" width="176" height="72" rx="3" stroke-dasharray="5 5"/><path d="M95 88h130M95 106h95"/>'
        caption='Фон на вылет · линия реза · безопасное поле'
        if service_id == '3.2': caption='Для листовок: фон продолжается на 4 мм за линию реза'
    elif kind == 'canvas':
        body='<rect x="30" y="22" width="260" height="156" rx="4" fill="#fff0f1" stroke-dasharray="6 5"/><rect x="63" y="49" width="194" height="102" class="req-diagram-cut"/><path d="m30 22 33 27m227-27-33 27M30 178l33-27m227 27-33-27"/><text x="160" y="106">Лицевая часть</text>'
        caption='Лицевая часть + заворот по выбранному подрамнику'
    elif kind in ('sticker','stickerpack','papersticker','dome','domepack'):
        body='<rect x="30" y="22" width="260" height="156" rx="12" fill="#fafafa"/><circle cx="98" cy="89" r="33" fill="#fff0f1" class="req-diagram-cut"/><rect x="161" y="58" width="91" height="62" rx="19" fill="#fff0f1" class="req-diagram-cut"/><path d="M66 142h188" stroke-dasharray="5 5"/><path d="M98 71v35M80 89h36M178 80h55M178 97h36"/>'
        caption='Печатный макет и отдельный замкнутый контур'
        if kind == 'papersticker': caption='С резкой: поле 20 мм, зазор ≥ 3 мм; без резки: 8 и 0 мм'
        if kind in ('dome','domepack'): caption='Плавный контур без острых выступов для объёмного покрытия'
    elif kind == 'fold' and service_id.startswith('3.'):
        body='<rect x="30" y="32" width="260" height="136" rx="4"/><path d="M117 32v136M203 32v136" stroke-dasharray="5 5" class="req-diagram-cut"/><path d="M51 69h43M51 90h31M138 69h43M138 90h31M224 69h43M224 90h31"/>'
        caption='Линии сгиба и безопасные поля — в готовом размере'
    elif kind in ('drawing','fold'):
        body='<rect x="66" y="20" width="188" height="156" rx="3"/><rect x="89" y="42" width="118" height="87" stroke-dasharray="5 5"/><path d="M89 149h118M89 143v12M207 143v12" class="req-diagram-cut"/><text x="149" y="171">100 мм</text>'
        caption='Размер листа и масштаб — по файлу и параметрам заказа'
        if service_id == '2.7': caption='Масштаб 1:1 и контрольный размер в файле'
        if kind == 'fold': caption='Положение штампа и порядок сгибов согласуйте до фальцовки'
    elif kind == 'uv':
        body='<rect x="38" y="141" width="244" height="32" rx="4"/><rect x="56" y="96" width="208" height="30" rx="4" fill="#fff0f1" class="req-diagram-cut"/><rect x="77" y="51" width="166" height="30" rx="4"/><text x="160" y="71">CMYK</text><text x="160" y="116">Белила</text><text x="160" y="162">Материал</text>'
        caption='Изображение, белая подложка и материал — отдельные слои'
    elif kind in ('plotter','laser','engrave'):
        body='<path d="M57 150V60h84l33 28h89v62Z" fill="#fff0f1" class="req-diagram-cut"/><path d="M94 97h54M94 117h89"/><circle cx="240" cy="109" r="12"/><path d="M57 174h206" stroke-dasharray="5 5"/>'
        caption='Макет и отдельный векторный контур в готовом размере'
        if kind in ('laser','engrave'): caption='Чистый вектор 1:1: резка и гравировка разделены'
    elif kind in ('binding','bindinghard','brochure'):
        body='<rect x="73" y="23" width="174" height="154" rx="5"/><path d="M103 23v154" stroke-dasharray="5 5" class="req-diagram-cut"/><path d="M85 48H63m22 28H63m22 28H63m22 28H63m22 28H63M125 57h99M125 83h76M125 109h89"/>'
        caption='Последовательные страницы и поле со стороны переплёта'
    elif kind == 'thermal' or service_id == '6.9':
        body='<rect x="42" y="39" width="236" height="122" rx="8"/><path d="M42 80h236M115 39v122"/><text x="78" y="68">ID</text><text x="195" y="68">Данные</text><text x="78" y="107">001</text><text x="78" y="140">002</text><path d="M142 99h108M142 132h84" class="req-diagram-cut"/>'
        caption='Одна строка данных — одно изделие; ведущие нули сохраняйте'
    elif kind in ('plate','keychain','tag'):
        body='<rect x="37" y="39" width="246" height="113" rx="12"/><circle cx="62" cy="64" r="7" class="req-diagram-cut"/><path d="M86 72h158M86 96h119M86 120h146M37 175h246M37 169v12M283 169v12" stroke-dasharray="5 5"/>'
        caption='Готовый размер, расположение текста и отверстий согласуйте'
    else:
        body='<rect x="55" y="25" width="98" height="135" rx="6"/><rect x="73" y="41" width="98" height="135" rx="6" fill="white"/><path d="M94 71h57M94 94h40M94 117h52M198 100h63m-14-13 14 13-14 13" class="req-diagram-cut"/>'
        caption='Исходный файл → готовый размер → согласованное превью'
    return '<figure class="requirements-diagram"><svg viewBox="0 0 320 200" role="img" aria-label="'+caption+'">'+body+'</svg><figcaption>'+caption+'</figcaption></figure>'
