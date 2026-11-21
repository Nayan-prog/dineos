import { validator } from 'hono/validator';
import { HTTPException } from 'hono/http-exception';
import type { ZodSchema, z } from 'zod';

/** Small zod validator (same shape as @hono/zod-validator) with readable error messages. */
export const zValidator = <T extends ZodSchema, K extends 'json' | 'query' | 'param'>(target: K, schema: T) =>
  validator(target, (value) => {
    const r = schema.safeParse(value);
    if (!r.success) {
      const i = r.error.issues[0];
      throw new HTTPException(400, { message: `${i.path.join('.') || 'input'}: ${i.message}` });
    }
    return r.data as z.infer<T>;
  });
