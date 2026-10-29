import { createHmac, timingSafeEqual } from 'node:crypto';
import { jwtOptions } from '../../auth/jwt.config.js';

export function receiptShareToken(lotId: string, resultId: string) {
  return createHmac('sha256', jwtOptions().secret)
    .update(`receipt-share:v1:${lotId}:${resultId}`)
    .digest('hex');
}

export function validReceiptShare(
  token: string,
  lotId: string,
  resultId: string,
) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  return timingSafeEqual(
    Buffer.from(token, 'hex'),
    Buffer.from(receiptShareToken(lotId, resultId), 'hex'),
  );
}
