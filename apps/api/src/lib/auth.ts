import { SignJWT, jwtVerify } from 'jose';
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Role } from '@dineos/shared';

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-only-secret-change-me');

export type StaffClaims = { kind: 'staff'; sub: number; rid: number; role: Role; name: string };
export type GuestClaims = { kind: 'guest'; sub: number; rid: number; tableId: number; sessionId: number };
export type Claims = StaffClaims | GuestClaims;

export async function sign(claims: Claims, ttl = '14h') {
  return new SignJWT({ ...claims, sub: String(claims.sub) } as any)
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(ttl).sign(secret);
}

export async function verify(token: string): Promise<Claims> {
  const { payload } = await jwtVerify(token, secret);
  return { ...(payload as any), sub: Number(payload.sub) } as Claims;
}

function bearer(c: Context) {
  const h = c.req.header('authorization');
  return h?.startsWith('Bearer ') ? h.slice(7) : c.req.query('token');
}

export const requireStaff = (...roles: Role[]) => async (c: Context, next: Next) => {
  const t = bearer(c);
  if (!t) throw new HTTPException(401, { message: 'Sign in first' });
  let claims: Claims;
  try { claims = await verify(t); } catch { throw new HTTPException(401, { message: 'Session expired, sign in again' }); }
  if (claims.kind !== 'staff') throw new HTTPException(403, { message: 'Staff only' });
  if (roles.length && !roles.includes(claims.role)) throw new HTTPException(403, { message: 'Your role cannot do this' });
  c.set('staff', claims);
  await next();
};

export const requireGuest = async (c: Context, next: Next) => {
  const t = bearer(c);
  if (!t) throw new HTTPException(401, { message: 'Scan the table QR to start' });
  let claims: Claims;
  try { claims = await verify(t); } catch { throw new HTTPException(401, { message: 'Session expired, scan the QR again' }); }
  if (claims.kind !== 'guest') throw new HTTPException(403, { message: 'Guests only' });
  c.set('guest', claims);
  await next();
};

declare module 'hono' {
  interface ContextVariableMap { staff: StaffClaims; guest: GuestClaims }
}
