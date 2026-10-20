-- Аватарка проекта: файл в папке data/media, например 'projects/1-1792091234567.png'.
-- NULL - вместо аватарки показываются первые буквы названия.
ALTER TABLE projects ADD COLUMN logo TEXT;
