# 808 Checker API

JSON API для работы с 808 Checker из другой админки. Всё, что можно сделать
в интерфейсе сервиса, постепенно становится доступно здесь.

Адрес: `https://audit.808-test.ru/api/...`

## Ключ

Ключ создаётся в 808 Checker: **Настройки → API-ключи → Создать ключ**.
Он показывается один раз — сохраните его сразу. Запросы с ключом выполняются
от имени пользователя, который его создал (он будет автором сценариев,
запустившим проверки и т. д.).

Ключ передаётся в каждом запросе заголовком:

```
Authorization: Bearer 808ck_...
```

Ключ — как пароль: только в заголовке (не в адресе), только с сервера
админки (не из браузера), не в git. Если ключ утёк — удалите его
в «Настройках» и создайте новый: старый перестаёт работать сразу.

## Формат ответов

Успех:

```json
{ "ok": true, "data": { } }
```

Список — плюс `meta` со страницей и общим количеством:

```json
{ "ok": true, "data": [ ], "meta": { "page": 1, "perPage": 10, "total": 37 } }
```

Ошибка — HTTP-код ошибки и описание:

```json
{ "ok": false, "error": { "code": "validation_failed", "message": "Выберите хотя бы один тест", "fields": { "tests": "Выберите хотя бы один тест" } } }
```

`code` не меняется — по нему удобно проверять ошибку в коде, `message` — текст для человека,
`fields` — ошибки по полям запроса (есть у `validation_failed`). Вложенные поля — через точку:
`schedule.time`, `notifications.emails`.

Данные в запросах — JSON с заголовком `Content-Type: application/json`
(кроме загрузки аватарки). У запросов `DELETE` и действий без данных тело не нужно —
и заголовок `Content-Type` тогда не передавайте.

| HTTP | code | Когда |
|---|---|---|
| 400 | `bad_request` | запрос не разобран, например неверный JSON |
| 400 | `validation_failed` | неверные данные, подробности в `fields` |
| 401 | `unauthorized` | нет ключа или ключ неверный / удалён |
| 404 | `not_found` | нет такого адреса или объекта |
| 409 | `conflict` | действие сейчас невозможно: например, сценарий выключен или проверка уже закончилась |
| 500 | `server_error` | ошибка сервиса — сообщите нам |

Имена полей — `camelCase`. Даты — ISO 8601 в UTC: `2026-10-19T08:00:00Z`.

## Списки

Списки отдаются по страницам: `?page=2&perPage=20` (по умолчанию 10 на странице, не больше 100).
В `meta` — номер страницы, размер, всего записей и страниц:

```json
"meta": { "page": 2, "perPage": 20, "total": 37, "pagesCount": 2 }
```

Фильтры и сортировка — как на страницах сервиса:

| Параметр | Значения |
|---|---|
| `author` | имя автора из `meta.authors` этого же списка, например `Тест Т.` или `808 Checker` (сценарии, созданные сервисом) |
| `categories` | id категорий через запятую — сценарий содержит **все** указанные: `seo,forms` |
| `regular` | `yes` — регулярные, `no` — нерегулярные, не указан — все |
| `sort` | `new` (по умолчанию), `old`, `tests-desc`, `tests-asc`, `categories-desc`, `categories-asc`, `pages-desc`, `pages-asc` |

`author: null` в объектах — сценарий создал сам сервис («Полная проверка»), `startedBy: null` —
проверку запустило расписание.

## Запросы

### `GET /api/me`

Пользователь, от имени которого работает ключ.

```json
{
  "ok": true,
  "data": {
    "id": 1,
    "login": "artem",
    "name": "Артем Тепляков",
    "email": "artem@808.ru",
    "telegramId": "123456789",
    "createdAt": "2026-10-13T18:21:07Z"
  }
}
```

### `GET /api/catalog`

Справочники для форм: категории и тесты, выборки страниц, варианты расписания,
события и способы уведомлений.

```json
{
  "ok": true,
  "data": {
    "categories": [
      { "id": "seo", "title": "SEO", "shortTitle": "SEO", "tests": [ { "id": "title-present", "title": "Title заполнен на всех страницах" } ] }
    ],
    "pageSets": [ { "id": "top", "title": "Верхнеуровневые страницы" } ],
    "scheduleTypes": [
      { "id": "daily", "title": "Каждый день в", "hint": null, "hasTime": true, "number": null },
      { "id": "hours", "title": "Каждые", "hint": null, "hasTime": false, "number": { "unit": "часов", "min": 1, "max": 24, "default": 6 } }
    ],
    "notificationEvents": [ { "id": "started", "question": "Получать уведомления о проверках?", "title": "Запуск проверки", "hint": "…" } ],
    "notificationChannels": [ { "id": "telegram", "title": "Тг" }, { "id": "email", "title": "Почта" }, { "id": "none", "title": "Нет" } ]
  }
}
```

Пример:

```bash
curl -H "Authorization: Bearer $KEY" https://audit.808-test.ru/api/catalog
```

## Проекты

### `GET /api/projects`

Все проекты (сайты).

```json
{ "ok": true, "data": [ { "id": 1, "name": "Hadassah", "url": "https://hadassah.moscow/", "logoUrl": "/api/media/projects/1-1792092982498.webp", "createdAt": "2026-10-13T18:21:07Z" } ] }
```

`logoUrl` — аватарка проекта (запрашивается с тем же ключом), `null` — не загружена.

### `GET /api/projects/:id`

Проект и всё, что на его дашборде:

| Поле | Что это |
|---|---|
| `project` | проект, как в списке |
| `scenarios` | активные сценарии в порядке создания — их можно запустить. Объекты как в списке сценариев |
| `upcoming` | 5 ближайших проверок: `{ scenarioId, scenarioName, runAt, isRegular }`, `isRegular: false` — отложенная |
| `lastFullReport` | последняя готовая полная проверка (отчёт как в списке) и итог по категориям `categories: [{ id, title, shortTitle, passedCount, testsCount }]`; `null` — не было |
| `lastPartialReport` | последняя готовая частичная проверка; `null` — не было |
| `recentReports` | 10 последних отчётов |

## Сценарии

### `GET /api/projects/:id/scenarios`

Сценарии проекта. По умолчанию активные, `?status=inactive` — неактивные.
Фильтры: `author`, `categories`, `regular`, `sort` (см. «Списки»).
В `meta` дополнительно `activeCount`, `inactiveCount` и `authors`.

```json
{
  "id": 3,
  "projectId": 1,
  "name": "SEO главных",
  "title": "SEO главных #1",
  "revision": 1,
  "rootId": null,
  "isFull": false,
  "isActive": true,
  "author": { "id": 1, "name": "Артем Тепляков" },
  "createdAt": "2026-10-19T17:46:43Z",
  "categoriesCount": 1,
  "testsCount": 2,
  "testsTotal": 53,
  "pagesCount": 2,
  "sitePagesCount": 1228,
  "schedule": { "type": "daily", "time": "17:00", "number": null, "text": "Каждый день в 17:00", "nextRunAt": "2026-10-20T14:00:00Z" },
  "deferredAt": null
}
```

| Поле | Что это |
|---|---|
| `title` | название с номером редакции — так сценарий показывается в сервисе |
| `revision`, `rootId` | номер редакции и id первого сценария этого «семейства» (у первого — `null`) |
| `isFull` | полная проверка: все тесты на всех страницах |
| `testsCount` / `testsTotal` | тестов в сценарии / всего тестов в сервисе («2/53») |
| `pagesCount` / `sitePagesCount` | страниц в последней готовой проверке / страниц на сайте тогда же; `0` и `null` — проверок ещё не было |
| `schedule` | регулярность: `type` — вариант из `catalog.scheduleTypes`, `null` — нерегулярный; время `time` — московское; `nextRunAt` — следующий запуск |
| `deferredAt` | отложенная проверка; `null` — не запланирована |

### `GET /api/scenarios/:id`

Сценарий целиком: всё из списка плюс

```json
"categories": [ { "id": "seo", "title": "SEO", "tests": [ { "id": "title-present", "title": "…" } ] } ],
"pageSets": [ { "id": "top", "title": "Верхнеуровневые страницы" } ],
"notifications": {
  "events": { "started": "none", "done": "telegram", "critical": "email", "regular": "none", "repeated": "none", "status": "none" },
  "passPercent": 80,
  "emails": [ "qa@808.ru" ],
  "telegramIds": [ "123456789" ]
}
```

`notifications.events` — способ (`telegram`, `email`, `none`) для каждого события из `catalog.notificationEvents`;
`passPercent` — от скольких % успешных тестов проверка считается пройденной.

### `GET /api/scenarios/:id/reports`

Отчёты сценария от самого недавнего до самого первого (для «Сводки по сценарию»), по страницам.

## Отчёты

### `GET /api/projects/:id/reports`

Архив отчётов проекта. `?q=` — поиск по номеру, названию сценария, автору и дате;
`author` — автор **сценария**; `categories`, `regular` (проверка по расписанию или нет), `sort` — см. «Списки».

```json
{
  "id": 12,
  "projectId": 1,
  "scenario": { "id": 1, "name": "Полная проверка", "isFull": true, "author": null },
  "startedBy": { "id": 1, "name": "Артем Тепляков" },
  "isRegular": false,
  "status": "done",
  "error": null,
  "note": null,
  "pagesCount": 1228,
  "sitePagesCount": 1228,
  "testsTotal": 53,
  "testsDone": 53,
  "testsPassed": 41,
  "percent": 77,
  "createdAt": "2026-10-19T08:00:00Z",
  "startedAt": "2026-10-19T08:00:03Z",
  "finishedAt": "2026-10-19T09:12:40Z"
}
```

| `status` | Что значит |
|---|---|
| `queued` | ждёт в очереди |
| `running` | идёт: прогресс — `testsDone` из `testsTotal` |
| `done` | готов |
| `error` | не выполнился, причина в `error` |
| `cancelled` | отменён |

`note` — предупреждение к отчёту (например, обход сайта остановлен на 4000 адресах), `percent` — % успешных тестов.

### `GET /api/reports/:id`

Отчёт целиком: всё из списка плюс результаты тестов по категориям.

```json
"categories": [
  {
    "id": "seo",
    "title": "SEO",
    "passedCount": 3,
    "testsCount": 4,
    "tests": [
      {
        "testId": "title-present",
        "title": "Title корректный на всех страницах сайта",
        "passed": false,
        "comment": "Найдено проблем: 2. Проверено 120 страниц.",
        "problems": [ "https://site.ru/page: title пустой" ],
        "pages": [ "https://site.ru/page" ],
        "media": [ { "url": "/api/media/reports/12/title-present-1.jpg", "type": "image", "caption": null } ],
        "durationMs": 1520
      }
    ]
  }
]
```

`media[].type` — `image` или `video`. Файлы запрашиваются с тем же ключом.

### `GET /api/reports/:id/download`

Отчёт одним HTML-файлом со встроенными скриншотами — тот же, что кнопка «Скачать» в сервисе.
Ответ — файл (`Content-Disposition: attachment`), а не JSON.

### `GET /api/media/...`

Скриншоты, видео и аватарки. Адреса берутся из ответов API (`url`, `logoUrl`). Ответ — сам файл.

## Действия

Создание отвечает кодом **201** и созданным объектом, остальные действия — **200** и объектом
после изменения. Запросы выполняются от имени владельца ключа: он становится автором сценариев
и тем, кто запустил проверку.

### Проверки

#### `POST /api/scenarios/:id/checks`

Запустить проверку сейчас. Ответ — новый отчёт со статусом `queued`: проверки идут по одной,
статус и прогресс — в `GET /api/reports/:id`. Выключенный сценарий — `409`.

#### `POST /api/reports/:id/cancel`

Отменить проверку: из очереди убирается сразу, идущая останавливается перед следующим тестом
(уже выполненные тесты остаются в отчёте). Закончившуюся отменить нельзя — `409`.

### Сценарии

#### `POST /api/projects/:id/scenarios`

Новый сценарий.

```json
{
  "name": "SEO главных страниц",
  "testIds": [ "title-present", "h1-present" ],
  "pageSets": [ "top" ],
  "schedule": { "type": "weekdays", "time": "09:00" },
  "notifications": {
    "events": { "done": "telegram", "critical": "email" },
    "passPercent": 80,
    "emails": [ "qa@808.ru" ],
    "telegramIds": [ "123456789" ]
  }
}
```

| Поле | Обязательно | Что это |
|---|---|---|
| `name` | да | название |
| `testIds` | да | id тестов из `catalog.categories[].tests` |
| `pageSets` | да | id выборок из `catalog.pageSets` |
| `schedule` | нет | регулярность (см. ниже); не передана — нерегулярный |
| `notifications` | нет | уведомления (см. ниже); не переданы — не отправляются |

#### `POST /api/scenarios/:id/copy`

«Скопировать и изменить»: новая редакция сценария, исходный не меняется. Поля те же, что
при создании, все необязательные: непереданные берутся из исходного, `name` — «Название #N»
со следующим номером редакции. Пустое тело `{}` — точная копия.

#### `PUT /api/scenarios/:id/active`

Включить или выключить: `{ "isActive": false }`. Выключенный сценарий не запускается
(и по расписанию тоже), его отложенная проверка отменяется.

#### `PUT /api/scenarios/:id/schedule`

Регулярность. Не создаёт новую редакцию.

```json
{ "type": "days", "time": "15:00", "number": 3 }
```

`type` — вариант из `catalog.scheduleTypes` или `null` (нерегулярный); `time` — московское
время `ЧЧ:ММ`, нужно вариантам с `hasTime: true`; `number` — нужно вариантам с `number`
(в пределах `min`–`max`).

#### `PUT /api/scenarios/:id/notifications`

Уведомления — все настройки целиком: `{ events, passPercent, emails, telegramIds }`.
`events` — способ для каждого события из `catalog.notificationEvents`: `telegram`, `email` или `none`
(непереданные события — `none`). Если выбрана почта, нужен хотя бы один адрес в `emails`,
если Telegram — хотя бы один Telegram ID (число) в `telegramIds`.

#### `PUT /api/scenarios/:id/deferred`

Отложенная проверка — один запуск в указанное время: `{ "runAt": "2026-10-20T06:00:00Z" }`.
Время — в будущем; у сценария она одна, новая заменяет прежнюю. Выключенный сценарий — `409`.

#### `DELETE /api/scenarios/:id/deferred`

Отменить отложенную проверку.

### Проекты

#### `POST /api/projects`

Новый проект: `{ "name": "Hadassah", "url": "https://hadassah.moscow/" }`.
Вместе с ним создаётся сценарий «Полная проверка» (все тесты на всех страницах).

#### `PATCH /api/projects/:id`

Изменить `name` и/или `url` — непереданные поля не меняются.

#### `DELETE /api/projects/:id`

Удалить проект **со всеми сценариями, отчётами и скриншотами** — отменить нельзя.
Пока идёт проверка проекта — `409`.

#### `POST /api/projects/:id/logo`

Аватарка: файл PNG, JPEG или WebP до 2 МБ, `multipart/form-data`, поле `logo`.

```bash
curl -H "Authorization: Bearer $KEY" -F "logo=@logo.png" https://audit.808-test.ru/api/projects/1/logo
```

### Пользователи

#### `GET /api/users`, `GET /api/users/:id`

Пользователи (как в `/api/me`).

#### `POST /api/users`

Новый пользователь: `{ "login": "maria", "name": "Мария Иванова", "email": "maria@808.ru", "telegramId": "123456789" }`
(`email` и `telegramId` — необязательные). Логин — латинские буквы, цифры, `.`, `-`, `_`.
Пароль придумывает сервис и возвращает **один раз**:

```json
{ "ok": true, "data": { "user": { "id": 4, "login": "maria", "...": "..." }, "password": "k3J9xQ2mP7aB" } }
```

#### `PATCH /api/users/:id`

Изменить `name`, `email`, `telegramId` — непереданные поля не меняются. Логин не меняется.

#### `POST /api/users/:id/password`

Новый пароль (например, пользователь забыл старый): `{ "password": "..." }` — один раз.
Пользователь выходит из сервиса во всех браузерах.

#### `DELETE /api/users/:id`

Удалить пользователя: его API-ключи перестают работать, у его сценариев и отчётов автор
становится пустым (`null`). Удалить владельца ключа, которым сделан запрос, нельзя — `409`.
