// Небольшие функции для шаблонов. Вызываются в шаблоне так: <%= initials(user.name) %>

// "Артем Тепляков" → "АТ", "Hadassah" → "H"
export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

// "Артем Тепляков" → "Артем Т."
export function shortName(name) {
  const [first, last] = name.split(/\s+/);
  return last ? `${first} ${last[0]}.` : first;
}

// "https://hadassah.moscow/" → "hadassah.moscow"
export function displayUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
