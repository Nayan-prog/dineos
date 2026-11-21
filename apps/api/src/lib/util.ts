import type { Context } from 'hono';
import { stripMoney, canSeeMoney } from '@dineos/shared';
import { randomBytes } from 'node:crypto';

/** JSON response that removes money fields for roles that may not see money (admin, chef). */
export function out(c: Context, data: unknown, status = 200) {
  const s = c.get('staff');
  const body = s && !canSeeMoney(s.role) ? stripMoney(data) : data;
  return c.json(body as any, status as any);
}

export const token = (n = 12) => randomBytes(n).toString('base64url');
export const now = () => new Date();
