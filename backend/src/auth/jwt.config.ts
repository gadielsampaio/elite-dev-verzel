export function jwtOptions() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }
  return {
    secret,
    signOptions: { expiresIn: 900, algorithm: 'HS256' as const },
  };
}
