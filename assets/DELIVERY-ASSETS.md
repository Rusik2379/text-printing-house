# Изображения страницы доставки

Обновлены 07.10.2026. Все пять файлов хранятся в репозитории; сайт не подгружает логотипы с внешних адресов. Подписи «Откуда» и «Забор» удалены из карточек перевозчиков. Инструкция о месте отправления осталась в блоке «Передадим перевозчику».

| Файл в `assets/` | Происхождение |
| --- | --- |
| delivery-truck-icon.png | Новая иконка: встроенный imagegen, прозрачный PNG, 1254 × 1254 px |
| carrier-pek.svg | [Оригинал ПЭК](https://upload.pecom.ru/svg/logo.svg), используется на [сайте ПЭК](https://pecom.ru/) |
| carrier-cdek.svg | [Оригинал СДЭК](https://static.tildacdn.com/tild6361-3235-4832-b038-666362643932/Group_1000002812.svg), используется в шапке [официального справочного сайта СДЭК](https://help.cdek.ru/) |
| carrier-delovye-linii.png | [Оригинал Деловых Линий](https://assets-rgw.dellin.ru/integra-assets/dllogo-wbg.png) из [официального раздела логотипов](https://dev.dellin.ru/download/logos/) |
| carrier-energia.svg | [Оригинал Энергии](https://nrg-tk.pro/local/templates/etc/img/logo-2026-2.svg), используется в шапке [сайта перевозчика](https://nrg-tk.pro/) |

Оригинальные файлы логотипов сохранены без изменения геометрии, надписей и цветов. Белые поля PNG Деловых Линий скрываются рамкой изображения в CSS; сам знак и надпись видны полностью. На узком экране карточки располагаются в один столбец.

## Промпт иконки

Создана встроенным `image_gen.imagegen` с `transparent_background: true`. PNG скопирован в проект без обработки; исходный файл сохранён в каталоге generated_images Codex.

```text
Use case: logo-brand. Asset type: a single small delivery icon for a Russian printing studio website, displayed at 64 by 64 CSS pixels. Primary request: generate a clean red delivery truck icon to replace a poorly drawn truck pictogram. Style: crisp professional minimal flat line illustration, smooth consistent medium-thick red outline (#ee1024), rounded line caps, very clear balanced geometry. Subject: one compact delivery truck in perfectly flat side view, a simple rectangular cargo box at the left and short cab at the right, two perfectly circular aligned wheels, clean connected chassis, one simple cab window. Composition: centered, fully visible, balanced square canvas, artwork occupies 85 percent of the canvas with modest even margins. Constraints: genuinely transparent background with alpha; only solid red strokes and transparent interiors; no text, no lettering, no logo, no perspective, no gradients, no shadows, no decorative marks, no watermark. Prioritize an elegant readable silhouette at tiny UI sizes. Generate only the single icon.
```
