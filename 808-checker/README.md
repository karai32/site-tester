# 808 Checker

Сервис проверки сайтов. Сервер — Fastify, страницы собираются на сервере
из шаблонов EJS, база — SQLite. Фронтенд-фреймворка и сборки нет:
файл поправил — перезапустил — работает.

## Запуск

```bash
npm install
npm run add-user -- artem "Артем Тепляков" artem@808group.ru   # покажет пароль
npm run add-project -- Hadassah https://hadassah.moscow/
npm run dev                                                     # http://127.0.0.1:3001
```

Настройки через переменные окружения (можно положить в файл `.env`):

| Переменная | По умолчанию | Что это |
|---|---|---|
| `PORT` | `3001` | Порт сервера |
| `HOST` | `127.0.0.1` | Адрес сервера |
| `DB_PATH` | `data/app.db` | Файл базы |
| `NODE_ENV` | — | `production` на сервере: cookie только по https |

## Где что лежит

```
src/
  server.js          запуск: плагины, проверка входа, подключение маршрутов
  helpers.js         функции для шаблонов: initials(), shortName(), displayUrl()
  auth/
    passwords.js     хеширование паролей
    session.js       вход, выход, текущий пользователь
  db/
    schema.sql       все таблицы базы
    database.js      подключение к базе
    users.js         запросы к таблице users
    sessions.js      запросы к таблице sessions
    projects.js      запросы к таблице projects
  routes/            один файл на раздел сайта
    auth.js          /login, /logout
    projects.js      /projects, /projects/:id и вкладки проекта
    profile.js       /profile
    settings.js      /settings
  views/             шаблоны EJS
    layouts/app.ejs  каркас страницы: шапка, меню, контент
    layouts/auth.ejs каркас страницы входа
    partials/        куски, общие для разных страниц
    projects/        страницы проекта
scripts/             команды для терминала (add-user, add-project)
public/assets/       CSS, JS, шрифты, картинки из UI-кита
data/                база (в git не попадает)
```

## Как устроена страница

1. Браузер открывает `/projects/1`.
2. `server.js` проверяет, вошёл ли пользователь. Если нет — отправляет на `/login`.
3. Маршрут в `routes/projects.js` берёт проект из базы и вызывает
   `reply.view('projects/dashboard.ejs', { project }, { layout: 'layouts/app.ejs' })`.
4. EJS вставляет `dashboard.ejs` в каркас `layouts/app.ejs` и отдаёт готовый HTML.

## Правила

- **Шаблон только выводит данные.** Всё, что нужно посчитать или отфильтровать,
  делается в маршруте, а в шаблон передаётся готовое.
- **В шаблоне выводим через `<%= %>`** — так текст экранируется, и HTML из
  базы не сломает страницу. `<%- %>` — только для `include` и `body`.
- **SQL пишем руками** в файлах `src/db/*.js`, по одному файлу на таблицу.
- **Новая таблица** — добавить её в `schema.sql`, она создастся при запуске.
- **Цвета** — только переменные из `public/assets/css/theme.css`.
  Свои стили — в `public/assets/css/app.css`.
- **Разметка компонентов** берётся из UI-кита (`/ui.html`).
