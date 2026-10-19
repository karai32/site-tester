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
`fields` — ошибки по полям запроса (есть не всегда).

| HTTP | code | Когда |
|---|---|---|
| 400 | `bad_request` | запрос не разобран, например неверный JSON |
| 400 | `validation_failed` | неверные данные, подробности в `fields` |
| 401 | `unauthorized` | нет ключа или ключ неверный / удалён |
| 404 | `not_found` | нет такого адреса или объекта |
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
