import { AppError, authCodes } from '../utils/response.util.js';

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});

    if (!result.success) {
      next(
        new AppError('Request validation failed', authCodes.VALIDATION_ERROR, 400, {
          fields: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        }),
      );
      return;
    }

    req[source] = result.data;
    next();
  };
}
