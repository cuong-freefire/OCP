import { toErrorPayload } from '../utils/response.util.js';

export function errorMiddleware(error, _req, res, _next) {
  const { status, body } = toErrorPayload(error);
  res.status(status).json(body);
}
