-- Редакции сценариев и число страниц сайта в отчёте.

-- Первый сценарий «семейства»: у копий («Полный аудит #2», «#3») здесь id исходного сценария.
-- По нему считается номер следующей редакции. У исходного сценария — NULL.
ALTER TABLE scenarios ADD COLUMN root_id INTEGER REFERENCES scenarios(id) ON DELETE SET NULL;

-- Сколько всего HTML-страниц нашёл обход сайта — для «Страниц: 28 из 1228» в списке сценариев
ALTER TABLE reports ADD COLUMN site_pages_count INTEGER;
