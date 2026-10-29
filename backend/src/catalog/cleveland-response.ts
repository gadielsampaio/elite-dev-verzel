import { ServiceUnavailableException } from '@nestjs/common';

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string')
    throw new ServiceUnavailableException('Cleveland Museum API unavailable');
  return value;
}

export function imageUrlFrom(images: unknown, variant: string) {
  const asset = record(images) ? images[variant] : null;
  if (asset != null && !record(asset))
    throw new ServiceUnavailableException('Cleveland Museum API unavailable');
  const url = record(asset) ? text(asset.url) : null;
  if (url && !url.startsWith('https://'))
    throw new ServiceUnavailableException('Cleveland Museum API unavailable');
  return url;
}
