// Only a UUID lot ID can become a return destination; never accept arbitrary URLs.
export function validReturnId(value: string | null | undefined) {
  if (!value) return null;

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(value) ? value : null;
}

export function lotPath(id: string) {
  return `/lot/${encodeURIComponent(id)}`;
}
