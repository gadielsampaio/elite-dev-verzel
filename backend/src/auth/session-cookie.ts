import { ForbiddenException } from '@nestjs/common';
import type { CookieOptions, Request } from 'express';
export const refreshCookie = 'auction_refresh';
export function cookieOptions(): CookieOptions {
  const secure = process.env.AUTH_COOKIE_SECURE !== 'false';
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
  };
}
export function sessionRequest(request: Request) {
  // Non-simple header forces cross-origin browser requests through CORS preflight.
  if (request.get('X-Session-Request') !== '1')
    throw new ForbiddenException('Session request header required');
}
export function cookieToken(request: Request) {
  const value = request.headers.cookie
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${refreshCookie}=`))
    ?.slice(refreshCookie.length + 1);
  return value; // Base64url is unescaped; never deserialize client objects.
}
