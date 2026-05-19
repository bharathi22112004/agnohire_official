import { error } from '../utils/response.js';

export function validate(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return error(res, 'Validation failed', 422, 'VALIDATION_ERROR', details);
    }
    req[target] = result.data;
    next();
  };
}
