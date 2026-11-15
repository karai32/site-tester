export function sendData(reply, data, meta) {
  const body = { ok: true, data };
  if (meta) body.meta = meta;
  return reply.send(body);
}

export function sendError(reply, statusCode, code, message, fields) {
  const error = { code, message };
  if (fields) error.fields = fields;
  return reply.code(statusCode).send({ ok: false, error });
}

export function sendValidationErrors(reply, errors) {
  const message = Object.values(errors).join('. ');
  return sendError(reply, 400, 'validation_failed', message, errors);
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

export function valueOrCurrent(body, field, current) {
  if (body[field] === undefined) return current;
  return body[field];
}
