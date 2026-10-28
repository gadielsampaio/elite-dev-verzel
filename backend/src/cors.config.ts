import type { INestApplication } from '@nestjs/common';

export function configureCors(app: INestApplication) {
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const url = new URL(value);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      )
        throw new Error(
          'CORS_ORIGINS must contain HTTP(S) origins, without paths or credentials',
        );
      return url.origin;
    });
  // Bearer-token authentication does not require cross-origin cookies.
  // No wildcard: an unset allowlist permits only same-origin browser usage.
  app.enableCors({ origin: origins });
}
