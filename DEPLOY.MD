# Развёртывание Site Tester на Timeweb

Инструкция рассчитана на новый облачный сервер Timeweb с Ubuntu и домен tester.ru.

Все команды выполняются от root. Отдельного пользователя создавать не нужно. Само приложение будет работать от стандартного пользователя www-data, который уже есть в Ubuntu.

https://github.com/karai32/site-tester

## 1. Создать сервер и настроить DNS

При создании сервера выбери Ubuntu и добавь свой SSH-ключ.

В DNS домена создай A-запись:

~~~text
Тип: A
Хост: @
Значение: IP нового сервера
~~~

Если у домена есть AAAA-запись, обнови её на IPv6 нового сервера или удали. Старая AAAA-запись может направлять часть пользователей не на тот сервер.

В сетевом экране Timeweb должны быть открыты порты:

~~~text
22
80
443
~~~

Подключись к серверу:

~~~bash
ssh root@IP_СЕРВЕРА
~~~

Проверь, что домен уже указывает на новый IP:

~~~bash
getent ahostsv4 tester.ru
~~~

## 2. Добавить swap

Для Chromium желательно иметь хотя бы 2 ГБ RAM и 2 ГБ swap.

Проверь swap:

~~~bash
free -h
swapon --show
~~~

Если команда swapon ничего не показала, выполни:

~~~bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
~~~

Проверь ещё раз:

~~~bash
swapon --show
~~~

## 3. Установить программы

Установи основные пакеты:

~~~bash
apt update
apt install -y curl ca-certificates git nginx certbot python3-certbot-nginx apache2-utils rsync cron ufw build-essential
~~~

Установи Node.js 22:

~~~bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
bash /tmp/nodesource_setup.sh
apt install -y nodejs
~~~

Проверь версии:

~~~bash
node -v
npm -v
nginx -v
~~~

Версия Node.js должна быть 22 или выше.

## 4. Скачать проект

Клонируй репозиторий:

~~~bash
git clone https://github.com/karai32/site-tester.git /opt/site-checker
cd /opt/site-checker
~~~

Установи зависимости:

~~~bash
npm ci --omit=dev
~~~

## 5. Подготовить SQLite и Chromium

Создай папку для постоянных данных:

~~~bash
install -d -o www-data -g www-data -m 0750 /var/lib/site-checker
install -d -o www-data -g www-data -m 0755 /var/lib/site-checker/pw-browsers
~~~

Установи Chromium и его системные зависимости:

~~~bash
cd /opt/site-checker
env PLAYWRIGHT_BROWSERS_PATH=/var/lib/site-checker/pw-browsers npx playwright install --with-deps chromium
chown -R www-data:www-data /var/lib/site-checker
~~~

Проверь запуск Chromium:

~~~bash
cd /opt/site-checker
runuser -u www-data -- env PLAYWRIGHT_BROWSERS_PATH=/var/lib/site-checker/pw-browsers node --input-type=module -e "import { chromium } from '@playwright/test'; const browser = await chromium.launch(); console.log('Chromium:', await browser.version()); await browser.close();"
~~~

Команда должна вывести версию Chromium.

## 6. Создать настройки приложения

Открой файл:

~~~bash
nano /etc/site-checker.env
~~~

Добавь:

~~~env
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
SQLITE_PATH=/var/lib/site-checker/site-checker.sqlite
PLAYWRIGHT_BROWSERS_PATH=/var/lib/site-checker/pw-browsers
~~~

Сохрани файл и закрой Nano:

~~~text
Ctrl+O
Enter
Ctrl+X
~~~

Ограничь доступ к настройкам:

~~~bash
chmod 600 /etc/site-checker.env
~~~

Название и адрес проверяемого сайта уже находятся в:

~~~text
/opt/site-checker/config/site.js
~~~

## 7. Создать systemd-сервис

Открой файл:

~~~bash
nano /etc/systemd/system/site-checker.service
~~~

Добавь:

~~~ini
[Unit]
Description=Site Tester
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/site-checker
EnvironmentFile=/etc/site-checker.env
ExecStart=/usr/bin/node /opt/site-checker/src/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
~~~

Примени настройки и запусти приложение:

~~~bash
systemctl daemon-reload
systemctl enable --now site-checker.service
~~~

Проверь:

~~~bash
systemctl status site-checker.service --no-pager
curl -fsS http://127.0.0.1:3000/api/health
~~~

После первого запуска SQLite будет создана автоматически:

~~~text
/var/lib/site-checker/site-checker.sqlite
~~~

## 8. Настроить firewall

Сначала разреши SSH, HTTP и HTTPS:

~~~bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
~~~

Порт 3000 открывать не нужно. Он используется только внутри сервера.

## 9. Настроить Nginx

Создай конфигурацию:

~~~bash
nano /etc/nginx/sites-available/tester.ru
~~~

Добавь:

~~~nginx
server {
    listen 80;
    listen [::]:80;

    server_name tester.ru;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
~~~

Включи сайт:

~~~bash
ln -s /etc/nginx/sites-available/tester.ru /etc/nginx/sites-enabled/tester.ru
nginx -t
systemctl enable --now nginx
systemctl reload nginx
~~~

Проверь проксирование:

~~~bash
curl -I -H 'Host: tester.ru' http://127.0.0.1
~~~

## 10. Подключить HTTPS

Перед выпуском сертификата ещё раз проверь DNS:

~~~bash
getent ahostsv4 tester.ru
~~~

IP в ответе должен совпадать с IP нового сервера.

Получи сертификат:

~~~bash
certbot --nginx -d tester.ru --redirect
~~~

Certbot попросит email и согласие с условиями. После этого он сам добавит HTTPS в конфигурацию Nginx.

Проверь:

~~~bash
nginx -t
curl -I https://tester.ru
~~~

Проверь автоматическое обновление сертификата:

~~~bash
certbot renew --dry-run
~~~

## 11. Закрыть сайт паролем

Без пароля любой посетитель сможет запускать тяжёлые проверки. Создай пользователя admin:

~~~bash
htpasswd -c /etc/nginx/tester.htpasswd admin
chown root:www-data /etc/nginx/tester.htpasswd
chmod 640 /etc/nginx/tester.htpasswd
~~~

Команда попросит придумать пароль.

Открой конфигурацию:

~~~bash
nano /etc/nginx/sites-available/tester.ru
~~~

Найди блок location / и добавь в него две строки:

~~~nginx
location / {
    auth_basic "Private Site Tester";
    auth_basic_user_file /etc/nginx/tester.htpasswd;

    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
~~~

Проверь и перезагрузи Nginx:

~~~bash
nginx -t
systemctl reload nginx
~~~

Проверка без пароля должна вернуть 401:

~~~bash
curl -I https://tester.ru
~~~

## 12. Настроить ежедневную проверку

Cron использует часовой пояс сервера. Если запуск нужен в 03:00 по Москве, установи московский часовой пояс:

~~~bash
timedatectl set-timezone Europe/Moscow
timedatectl
~~~

Запусти cron:

~~~bash
systemctl enable --now cron
~~~

Открой расписание root:

~~~bash
crontab -e
~~~

Добавь внизу:

~~~cron
0 3 * * * /usr/bin/curl -fsS -X POST http://127.0.0.1:3000/api/scans >/dev/null 2>&1
~~~

Проверь:

~~~bash
crontab -l
systemctl is-active cron
~~~

Cron обращается напрямую к Fastify на 127.0.0.1, поэтому пароль Nginx ему не нужен.

Приложение само удаляет из SQLite отчёты старше 90 дней.

## 13. Проверить весь проект

Проверь сервисы:

~~~bash
systemctl is-active site-checker.service
systemctl is-active nginx
systemctl is-active cron
~~~

Проверь API внутри сервера:

~~~bash
curl -fsS http://127.0.0.1:3000/api/health
~~~

Открой в браузере:

~~~text
https://tester.ru
~~~

Введи логин admin и пароль, затем запусти одну проверку вручную.

Логи приложения:

~~~bash
journalctl -u site-checker.service -n 100 --no-pager
~~~

Логи Nginx:

~~~bash
tail -n 100 /var/log/nginx/error.log
~~~

## Краткая карта файлов

~~~text
/opt/site-checker
Код приложения

/var/lib/site-checker
SQLite и Chromium

/etc/site-checker.env
Настройки Node.js

/etc/systemd/system/site-checker.service
Запуск приложения

/etc/nginx/sites-available/tester.ru
Настройка домена и прокси

/etc/nginx/tester.htpasswd
Логин и пароль

/etc/letsencrypt
HTTPS-сертификаты
~~~
