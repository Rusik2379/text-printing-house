# Размещение и перенос

Нужны Docker Engine и Docker Compose. Приложение запускается с постоянным томом; HTTPS-адрес передаётся через `PUBLIC_ORIGIN`.

## Новый сервер

1. Распакуйте исходники и перейдите в каталог с `compose.yaml`.
2. Скопируйте `deploy/.env.example` в `.env`. Укажите адрес сайта в `PUBLIC_ORIGIN`. Для доступа только через локальный reverse proxy задайте `BIND_ADDRESS=127.0.0.1`.
3. Запустите:

```sh
docker compose up -d --build
docker compose ps
```

Внешний HTTPS-proxy должен передавать исходный Host на порт `HTTP_PORT` (по умолчанию 8083). Если сервер сам принимает 80/443, задайте `SITE_DOMAIN` и используйте:

```sh
docker compose -f compose.yaml -f compose.tls.yaml up -d --build
```

## Готовый образ

Если рядом с исходниками передан `tekst-site-image.tar.gz`, сборка из исходников необязательна:

```sh
docker load -i tekst-site-image.tar.gz
docker compose up -d --no-build
```

Готовый образ предназначен для Linux amd64 и имеет тег `tekst-site-app:latest`, используемый Compose по умолчанию. Для другой архитектуры используйте сборку из исходников. При упаковке через `scripts/package-source.py` время и Git-коммит записываются в `RELEASE.json`.

## Перенос действующего сайта

Пароль админки, тарифы, оценки, заказы, макеты и ключ интеграции находятся в томе `tekst-site_tekst_data`. Архив приложения содержит только код. Для сохранения действующих данных создайте приватную копию тома на старом сервере:

```sh
mkdir -p backups
docker compose stop app
docker run --rm --user 0 --entrypoint tar \
  -v tekst-site_tekst_data:/data:ro \
  -v "$PWD/backups:/backup" \
  tekst-site-app:latest -C /data -czf /backup/tekst-data.tar.gz .
docker compose start app
chmod 600 backups/tekst-data.tar.gz
```

На новом сервере сначала загрузите или соберите образ, создайте новый пустой том и восстановите копию **до первого запуска приложения**:

```sh
docker compose build app
docker volume create tekst-site_tekst_data
docker run --rm --user 0 --entrypoint tar \
  -v tekst-site_tekst_data:/data \
  -v "$PWD/backups:/backup:ro" \
  tekst-site-app:latest -C /data -xzf /backup/tekst-data.tar.gz
docker compose up -d --no-build
```

Приватную копию переносите отдельно от исходников и храните с ограниченным доступом. Каталог `/data` принадлежит UID/GID 1000, как в исходной установке.

Для совершенно новой установки настройте вход командой `docker compose exec app node tools/admin-setup.mjs`, затем перезапустите приложение. Команда сохраняет первоначальный пароль в `/data/access.txt` и не заменяет существующий вход.

## SEO при смене домена

Сайт подготовлен для `https://text-print.ru`: индексация публичных страниц разрешена, canonical, sitemap и llms.txt используют основной домен. Админка и служебные API закрыты от индексации. Домен `telegadocs.ru` отключён и не должен запускаться как отдельная копия сайта.

## work-server с Nginx Proxy Manager

Здесь порты 80/443 уже обслуживает Nginx Proxy Manager. Дополнительный proxy из базового Compose запускать не нужно. Создайте `.env` с `PUBLIC_ORIGIN=https://text-print.ru` и `APP_IMAGE=tekst-site-app:latest`, восстановите приватный том, затем запустите:

```sh
docker compose -f compose.yaml -f compose.work-server.yaml up -d --build app
```

Приложение доступно прокси по `http://tekst-site-app:4173` в существующей сети `nginx-proxy-manager_default`. Публиковать порт приложения на хосте не требуется. В Nginx Proxy Manager настройте `text-print.ru` и `www.text-print.ru`, лимит загрузки 100 MB и перенаправление www на основной HTTPS-адрес. Сертификат Let's Encrypt выпускается после переключения DNS.

Публичный IPv4 work-server — `5.129.183.119`. Измените A-запись корня `text-print.ru` и добавьте явную A-запись `www` на этот адрес. Почтовые A/MX/TXT и NS оставьте прежними: почта остаётся на старом сервере. Поддомен `www` должен иметь собственную запись, поскольку wildcard сейчас указывает на старый хост.

## Проверка после запуска

Откройте `/healthz`, одну услугу каждого направления, `/admin/` и существующий заказ. Сверьте тарифы и оценки, скачайте PDF/Excel с пробной корзиной. Отправку реальных уведомлений проверяйте отдельной согласованной заявкой.
