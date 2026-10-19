// Единый формат ответов API.
//   Успех:   { "ok": true, "data": ..., "meta": ... }   (meta — только у списков: страница, всего)
//   Ошибка:  { "ok": false, "error": { "code": "not_found", "message": "...", "fields": {...} } }
// code — постоянное короткое имя ошибки для программы, message — текст для человека.

export function sendData(reply, data, meta) {
  const body = { ok: true, data };
  if (meta) body.meta = meta;
  return reply.send(body);
}

// fields — ошибки по полям запроса: { tests: 'Выберите хотя бы один тест' }
export function sendError(reply, statusCode, code, message, fields) {
  const error = { code, message };
  if (fields) error.fields = fields;
  return reply.code(statusCode).send({ ok: false, error });
}
