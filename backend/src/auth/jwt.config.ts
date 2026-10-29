import { ACCESS_TOKEN_TTL_SECONDS } from './token.constants.js';

export function jwtOptions() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }
  return {
    secret,
    signOptions: {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      algorithm: 'HS256' as const,
    },
  };
}
